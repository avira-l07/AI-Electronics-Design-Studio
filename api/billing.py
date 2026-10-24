"""Stripe is authoritative. Redirects and browser state never grant access."""
import stripe
from fastapi import HTTPException
from sqlalchemy import select
from api.models import User, Subscription, Payment, Webhook, now
from api.security import notify, audit, fail
from api.money import format_minor

STRIPE_API_VERSION='2024-06-20'

class StripeGateway:
    def __init__(self,settings):self.s=settings
    def options(self):
        if not self.s.stripe_key:fail(503,'Stripe is not configured')
        return {'api_key':self.s.stripe_key,'stripe_version':STRIPE_API_VERSION}
    def customer(self,user):return stripe.Customer.create(email=user.email,metadata={'user_id':user.id},idempotency_key='customer-'+user.id,**self.options())['id']
    def checkout(self,user,price,period,key):
        options={'customer':user.customer,'mode':'subscription','line_items':[{'price':price,'quantity':1}],'success_url':self.s.origin+'/#/confirmation','cancel_url':self.s.origin+'/#/upgrade','client_reference_id':user.id,'allow_promotion_codes':True}
        if self.s.trial_days and not user.trial_used:options['subscription_data']={'trial_period_days':self.s.trial_days}
        return stripe.checkout.Session.create(**options,idempotency_key=key,**self.options()).to_dict()
    def subscription(self,id):return stripe.Subscription.retrieve(id,**self.options()).to_dict()
    def invoice(self,id):return stripe.Invoice.retrieve(id,**self.options()).to_dict()
    def charge(self,id):return stripe.Charge.retrieve(id,**self.options()).to_dict()
    def active_subscriptions(self,customer):
        rows=stripe.Subscription.list(customer=customer,status='all',limit=100,**self.options()).to_dict()['data']
        return [r for r in rows if r['status'] not in ['canceled','incomplete_expired']]
    def cancel(self,id,immediate=False):
        if immediate:return stripe.Subscription.delete(id,**self.options())
        return stripe.Subscription.modify(id,cancel_at_period_end=True,**self.options())
    def portal(self,customer):return stripe.billing_portal.Session.create(customer=customer,return_url=self.s.origin+'/#/billing',**self.options())['url']
    def verify_event(self,raw,signature):
        if not self.s.webhook_key:fail(503,'Webhook verification is not configured')
        try:event=stripe.Webhook.construct_event(raw,signature,self.s.webhook_key,tolerance=300).to_dict()
        except (ValueError,stripe.error.SignatureVerificationError):fail(400,'Invalid webhook signature')
        # Endpoint event versions are independent of API request versions.
        # Reject drift before recording an event as processed.
        if event.get('api_version')!=STRIPE_API_VERSION:fail(400,'Webhook API version mismatch; configure the pinned endpoint version')
        data=event.get('data')
        if not isinstance(event.get('id'),str) or not isinstance(event.get('type'),str) or not isinstance(data,dict) or not isinstance(data.get('object'),dict):fail(400,'Invalid webhook event')
        return event

def object_id(value):return value.get('id') if isinstance(value,dict) else value
def invoice_subscription(invoice):
    """Validate the authoritative pinned invoice before changing any ledger."""
    if not isinstance(invoice,dict) or 'subscription' not in invoice:fail(502,'Unexpected provider invoice schema; event was not processed')
    subscription=object_id(invoice['subscription'])
    if subscription is not None and (not isinstance(subscription,str) or not subscription.startswith('sub_')):fail(502,'Invalid provider subscription reference')
    if any(not isinstance(invoice.get(k),str) or not invoice[k] for k in ['id','status','currency']):fail(502,'Incomplete provider invoice')
    if not isinstance(object_id(invoice.get('customer')),str):fail(502,'Incomplete provider invoice customer')
    if any(type(invoice.get(k)) is not int or invoice[k]<0 for k in ['amount_paid','created']):fail(502,'Invalid provider invoice amounts or timestamp')
    return subscription
def sync_subscription(db,settings,gateway,user,subscription_id):
    # Called only while the account row is locked: serializes concurrent webhook deliveries.
    obj=gateway.subscription(subscription_id)
    if object_id(obj['customer'])!=user.customer:fail(400,'Subscription ownership mismatch')
    items=obj.get('items',{}).get('data',[])
    price=object_id(items[0].get('price')) if len(items)==1 else ''
    end=obj.get('current_period_end') or (items[0].get('current_period_end',0) if items else 0)
    row=db.get(Subscription,subscription_id)
    if row and row.user_id!=user.id:fail(400,'Subscription ownership mismatch')
    if not row:row=Subscription(id=subscription_id,user_id=user.id,status=obj['status'],price=price or '');db.add(row)
    row.status=obj['status'];row.price=price or '';row.ends=int(end);row.cancel_at_end=bool(obj.get('cancel_at_period_end'));row.updated=now()
    if row.refunded_invoice and object_id(obj.get('latest_invoice'))!=row.refunded_invoice:row.refunded_invoice=None
    if obj.get('trial_start'):user.trial_used=True
    if row.status in ['active','trialing']:user.checkout_expires=0;user.trial_used=True
    return row,obj

def process_event(db,settings,gateway,event):
    if db.get(Webhook,event['id']):return {'received':True,'duplicate':True}
    obj=event['data']['object'];kind=event['type'];customer=object_id(obj.get('customer'))
    if not customer and kind.startswith('charge.'):
        obj=gateway.charge(obj['id']);customer=object_id(obj.get('customer'))
    user=db.scalar(select(User).where(User.customer==customer).with_for_update()) if customer else None
    # Recheck after account lock, so concurrent duplicate deliveries are harmless.
    if db.get(Webhook,event['id']):return {'received':True,'duplicate':True}
    if user:
        subscription_id=None;invoice=None
        if kind.startswith('customer.subscription.'):subscription_id=obj['id']
        elif kind.startswith('invoice.'):
            invoice=gateway.invoice(obj['id']);subscription_id=invoice_subscription(invoice)
        elif kind.startswith('checkout.session.'):
            subscription_id=object_id(obj.get('subscription'))
        elif kind in ['charge.refunded','charge.dispute.created']:
            charge=gateway.charge(obj['id'] if kind=='charge.refunded' else object_id(obj['charge']))
            if charge.get('invoice'):
                invoice=gateway.invoice(object_id(charge['invoice']));subscription_id=invoice_subscription(invoice)
        sub=None
        if subscription_id:sub,_=sync_subscription(db,settings,gateway,user,subscription_id)
        if invoice:
            if object_id(invoice['customer'])!=user.customer:fail(400,'Invoice ownership mismatch')
            row=db.get(Payment,invoice['id']);first_paid=not row or row.status!='paid'
            if not row:row=Payment(id=invoice['id'],user_id=user.id,status=invoice['status']);db.add(row)
            row.subscription_id=subscription_id;row.status=invoice['status'];row.amount=int(invoice.get('amount_paid',0));row.currency=invoice['currency'];row.invoice_url=invoice.get('hosted_invoice_url');row.created=int(invoice.get('created',now()))
            if row.refunded:row.status='refunded' if row.refunded>=row.amount else 'partially_refunded'
            if kind=='invoice.payment_failed' and row.status not in ['paid','refunded','partially_refunded']:row.status='failed'
            if kind=='charge.refunded':
                row.refunded=int(charge.get('amount_refunded',0));row.status='refunded' if charge.get('refunded') else 'partially_refunded'
                if charge.get('refunded') and sub:
                    authoritative=gateway.subscription(sub.id)
                    if object_id(authoritative.get('latest_invoice'))==invoice['id']:sub.refunded_invoice=invoice['id']
            if kind=='charge.dispute.created' and sub:sub.disputed=True
            if row.status=='paid' and first_paid:
                notify(db,settings,user,'Your Studio invoice is paid',f'Invoice {row.id}\nAmount: {format_minor(row.amount,row.currency)}\nView the provider-generated invoice in Billing. No card details are stored by Studio.')
            elif row.status=='failed':notify(db,settings,user,'Subscription payment needs attention','Open Billing to review the latest payment status.')
        audit(db,user,'payment.webhook.'+kind)
    db.add(Webhook(id=event['id'],kind=kind));db.flush()
    return {'received':True,'duplicate':False}
