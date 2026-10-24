import json, hashlib, hmac, time
import pytest, pyotp
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from api.app import create_app
from api.config import Settings
from api.models import Base, User, Profile, Session, Token, Subscription, Payment, Mail, Webhook, now, seed
from api.security import decrypt, cookie_name, passwords, digest, random_token, encrypt
from api.billing import StripeGateway

PASSWORD='Correct horse battery staple 73!'
class Gateway(StripeGateway):
    def __init__(self,s):super().__init__(s);self.subs={};self.invoices={};self.charges={};self.checkouts=0
    def customer(self,user):return 'cus_'+user.id
    def checkout(self,user,price,period,key):self.checkouts+=1;return {'id':'cs_1','url':'https://checkout.stripe.com/c/pay/test','expires_at':now()+1800}
    def subscription(self,id):return self.subs[id]
    def invoice(self,id):return self.invoices[id]
    def charge(self,id):return self.charges[id]
    def active_subscriptions(self,customer):return [r for r in self.subs.values() if r['customer']==customer and r['status'] not in ['canceled','incomplete_expired']]
    def cancel(self,id,immediate=False):
        if immediate:self.subs[id]['status']='canceled';self.subs[id]['current_period_end']=now()
        else:self.subs[id]['cancel_at_period_end']=True
    def portal(self,customer):return 'https://billing.stripe.com/p/session/test'

@pytest.fixture
def env(tmp_path):
    s=Settings(database_url='sqlite:///'+str(tmp_path/'test.db'),environment='test',origin='http://testserver',jwt_key=random_token(),encryption_key=Fernet.generate_key().decode(),monthly_price='price_month',annual_price='price_year',webhook_key='whsec_test',billing_enabled=True)
    gateway=Gateway(s);app=create_app(s,gateway);Base.metadata.create_all(app.state.engine)
    with app.state.Factory.begin() as db:seed(db)
    with TestClient(app) as client:yield app,client,gateway,s
    app.state.engine.dispose()

def csrf(client):return {'Origin':'http://testserver','X-CSRF-Token':client.get('/api/csrf').json()['token']}
def post(client,url,body=None):return client.post(url,json=body or {},headers=csrf(client))
def verified_user(app,email='alice@example.com',password=PASSWORD):
    with app.state.Factory.begin() as db:
        u=User(email=email,name=email.split('@')[0],verified=True,password=passwords.hash(password));db.add(u);db.flush();db.add(Profile(user_id=u.id,name='Main'));id=u.id
    return id
def login(client,email='alice@example.com',password=PASSWORD):return post(client,'/api/auth/login',{'email':email,'password':password})
def event(client,s,id,kind,obj):
    raw=json.dumps({'id':id,'type':kind,'data':{'object':obj}},separators=(',',':')).encode();stamp=str(now());signature=hmac.new(s.webhook_key.encode(),stamp.encode()+b'.'+raw,hashlib.sha256).hexdigest()
    return client.post('/api/payments/webhook',content=raw,headers={'stripe-signature':f't={stamp},v1={signature}','Content-Type':'application/json'})
def subscription(app,gateway,user_id,status='active'):
    with app.state.Factory.begin() as db:
        u=db.get(User,user_id);u.customer='cus_test'
    gateway.subs['sub_test']={'id':'sub_test','customer':'cus_test','status':status,'current_period_end':now()+86400,'cancel_at_period_end':False,'latest_invoice':'in_test','items':{'data':[{'price':{'id':'price_month'}}]}}
    gateway.invoices['in_test']={'id':'in_test','customer':'cus_test','subscription':'sub_test','status':'paid','amount_paid':9900,'currency':'inr','created':now(),'hosted_invoice_url':'https://invoice.stripe.com/i/test'}

def test_signup_verify_and_reuse(env):
    app,c,g,s=env;r=post(c,'/api/auth/signup',{'email':'new@example.com','password':PASSWORD,'name':'New'});assert r.status_code==202
    with app.state.Factory() as db:
        u=db.scalar(select(User).where(User.email=='new@example.com'));assert u.password.startswith('$argon2id$');assert PASSWORD not in u.password
        mail=db.scalar(select(Mail).where(Mail.user_id==u.id));token=json.loads(decrypt(s,mail.payload))['body'].split('token=')[1]
    assert login(c,'new@example.com').status_code==403
    assert post(c,'/api/auth/verify',{'token':token}).status_code==200
    assert post(c,'/api/auth/verify',{'token':token}).status_code==400
    assert login(c,'new@example.com').status_code==200
    assert c.get('/api/me').status_code==200

def test_cookie_csrf_origin_and_headers(env):
    app,c,g,s=env;verified_user(app);assert c.post('/api/auth/login',json={'email':'alice@example.com','password':PASSWORD}).status_code==403
    assert post(c,'/api/auth/login',{'email':'alice@example.com','password':PASSWORD}).status_code==200
    response=login(c);cookies=response.headers.get_list('set-cookie');assert any('HttpOnly' in x and 'SameSite=lax' in x for x in cookies)
    assert c.post('/api/auth/logout',json={},headers={'Origin':'https://evil.example','X-CSRF-Token':c.get('/api/csrf').json()['token']}).status_code==403
    assert c.get('/api/me').headers['Cache-Control']=='no-store';assert "frame-ancestors 'none'" in c.get('/api/config').headers['Content-Security-Policy']

def test_refresh_rotation_replay_and_logout_everywhere(env):
    app,c,g,s=env;verified_user(app);login(c);old=c.cookies.get(cookie_name(s,'refresh'));assert post(c,'/api/auth/refresh').status_code==200
    assert c.cookies.get(cookie_name(s,'refresh'))!=old
    c.cookies.set(cookie_name(s,'refresh'),old,domain='testserver.local',path='/')
    assert post(c,'/api/auth/refresh').status_code==401;assert c.get('/api/me').status_code==401
    login(c);assert post(c,'/api/auth/logout-all').status_code==200;assert c.get('/api/me').status_code==401

def test_password_reset_expiry_single_use_revocation(env):
    app,c,g,s=env;id=verified_user(app);login(c)
    assert post(c,'/api/auth/forgot',{'email':'alice@example.com'}).status_code==202
    with app.state.Factory() as db:
        mails=list(db.scalars(select(Mail).where(Mail.user_id==id)));raw=[json.loads(decrypt(s,m.payload)) for m in mails if json.loads(decrypt(s,m.payload))['subject'].startswith('Reset')][0]['body'].split('token=')[1]
    new='Another correct password 123!'
    assert post(c,'/api/auth/reset',{'token':raw,'password':new}).status_code==200
    assert c.get('/api/me').status_code==401
    assert post(c,'/api/auth/reset',{'token':raw,'password':new}).status_code==400
    assert login(c,password=PASSWORD).status_code==401;assert login(c,password=new).status_code==200
    expired=random_token()
    with app.state.Factory.begin() as db:db.add(Token(digest=digest(expired),user_id=id,purpose='reset',expires=now()-1))
    assert post(c,'/api/auth/reset',{'token':expired,'password':new}).status_code==400

def test_account_lock_and_persistent_ip_limit(env):
    app,c,g,s=env;id=verified_user(app)
    for _ in range(5):assert login(c,password='wrong').status_code==401
    result=login(c);assert result.status_code==200 and result.json()['confirmation_required']
    with app.state.Factory() as db:assert db.get(User,id).locked_until>now()
    for _ in range(5):assert post(c,'/api/auth/forgot',{'email':'unknown@example.com'}).status_code==202
    assert post(c,'/api/auth/forgot',{'email':'unknown@example.com'}).status_code==429

def test_profile_limits_switch_and_foreign_ownership(env):
    app,c,g,s=env;id=verified_user(app);other=verified_user(app,'other@example.com');login(c)
    assert post(c,'/api/profiles',{'name':'Second'}).status_code==403
    subscription(app,g,id);assert event(c,s,'evt_active','customer.subscription.updated',g.subs['sub_test']).status_code==200
    ids=[]
    for n in range(4):
        r=post(c,'/api/profiles',{'name':f'Profile {n}'});assert r.status_code==201;ids.append(r.json()['id'])
    assert post(c,'/api/profiles',{'name':'Sixth'}).status_code==403
    assert post(c,f'/api/profiles/{ids[-1]}/switch').status_code==200
    g.subs['sub_test']['status']='canceled';event(c,s,'evt_cancel','customer.subscription.deleted',g.subs['sub_test'])
    assert c.get('/api/premium').status_code==403;assert c.get('/api/workspace').status_code==403
    with app.state.Factory() as db:foreign=db.scalar(select(Profile).where(Profile.user_id==other)).id
    assert post(c,f'/api/profiles/{foreign}/switch').status_code==403
    assert c.patch(f'/api/profiles/{foreign}',json={'name':'stolen'},headers=csrf(c)).status_code==404

def test_webhook_signature_duplicate_refund_and_expiry(env):
    app,c,g,s=env;id=verified_user(app);login(c);subscription(app,g,id)
    assert c.post('/api/payments/webhook',content='{}',headers={'stripe-signature':'fake'}).status_code==400
    assert event(c,s,'evt_paid','invoice.paid',g.invoices['in_test']).status_code==200
    assert c.get('/api/premium').status_code==200
    assert event(c,s,'evt_paid','invoice.paid',g.invoices['in_test']).json()['duplicate']
    assert event(c,s,'evt_same_object','invoice.paid',g.invoices['in_test']).status_code==200
    with app.state.Factory() as db:assert db.scalar(select(func.count()).select_from(Payment))==1
    g.charges['ch_1']={'id':'ch_1','customer':'cus_test','invoice':'in_test','amount_refunded':9900,'refunded':True}
    assert event(c,s,'evt_refund','charge.refunded',g.charges['ch_1']).status_code==200
    assert c.get('/api/premium').status_code==403
    assert c.get('/api/billing').json()['payments'][0]['status']=='refunded'

def test_pending_failed_old_event_and_cancel(env):
    app,c,g,s=env;id=verified_user(app);login(c);subscription(app,g,id,'incomplete');g.invoices['in_test']['status']='open';g.invoices['in_test']['amount_paid']=0
    event(c,s,'evt_pending','invoice.payment_failed',g.invoices['in_test']);assert c.get('/api/premium').status_code==403
    assert c.get('/api/billing').json()['payments'][0]['status']=='failed'
    g.invoices['in_test']['status']='paid';g.invoices['in_test']['amount_paid']=9900;g.subs['sub_test']['status']='active'
    event(c,s,'evt_late','invoice.payment_failed',g.invoices['in_test']);assert c.get('/api/premium').status_code==200
    assert c.get('/api/billing').json()['payments'][0]['status']=='paid'
    assert post(c,'/api/payments/cancel').status_code==200;assert c.get('/api/premium').status_code==200
    with app.state.Factory.begin() as db:db.get(Subscription,'sub_test').ends=now()-1
    assert c.get('/api/premium').status_code==403

def test_checkout_idempotent_and_no_redirect_upgrade(env):
    app,c,g,s=env;verified_user(app);login(c)
    assert post(c,'/api/payments/checkout',{'period':'monthly'}).status_code==200
    assert post(c,'/api/payments/checkout',{'period':'monthly'}).status_code==200;assert g.checkouts==1
    assert c.get('/api/premium').status_code==403
    assert post(c,'/api/payments/checkout',{'period':'monthly','price':1,'role':'admin'}).status_code==422

def test_mfa_replay_recovery_and_admin_ban(env):
    app,c,g,s=env;id=verified_user(app);target=verified_user(app,'target@example.com');login(c)
    setup=post(c,'/api/mfa/setup').json();code=pyotp.TOTP(setup['secret']).now();r=post(c,'/api/mfa/enable',{'code':code});assert r.status_code==200;recovery=r.json()['recovery_codes'][0]
    assert c.get('/api/admin').status_code==403
    with app.state.Factory.begin() as db:db.get(User,id).role='admin'
    assert c.get('/api/admin').status_code==200
    post(c,'/api/auth/logout');challenge=login(c).json()['challenge'];assert post(c,'/api/auth/mfa',{'token':challenge,'code':code}).status_code==401
    assert post(c,'/api/auth/mfa',{'token':challenge,'code':recovery}).status_code==200
    assert post(c,f'/api/admin/users/{target}/ban',{'banned':True}).status_code==200
    post(c,'/api/auth/logout');challenge=login(c).json()['challenge'];assert post(c,'/api/auth/mfa',{'token':challenge,'code':recovery}).status_code==401

def test_project_isolation_validation_and_export(env):
    app,c,g,s=env;alice=verified_user(app);bob=verified_user(app,'bob@example.com');login(c)
    data={'name':'Safe project','kind':'Mechanical assembly','material':'Steel','stroke':80,'rod':150,'rpm':600,'parts':[],'notes':[],'revisions':[]}
    r=post(c,'/api/projects',data);assert r.status_code==201;id=r.json()['id']
    assert len(c.get('/api/projects').json())==1
    assert post(c,'/api/projects',{**data,'stroke':'<script>'}).status_code==422
    post(c,'/api/auth/logout');login(c,'bob@example.com')
    assert c.get('/api/projects').json()==[]
    assert c.patch('/api/projects/'+id,json=data,headers=csrf(c)).status_code==404
    export=c.get('/api/account/export');assert export.status_code==200;assert 'password' not in export.text and 'refresh' not in export.text

def test_deleted_account_cannot_use_old_tokens(env):
    app,c,g,s=env;id=verified_user(app);login(c);assert c.request('DELETE','/api/account',json={'password':PASSWORD},headers=csrf(c)).status_code==200
    assert c.get('/api/me').status_code==401
    with app.state.Factory() as db:u=db.get(User,id);assert u.deleted and u.password is None

def test_oauth_disabled_and_secure_config_fail_closed(env):
    app,c,g,s=env;assert c.get('/api/auth/google/start').status_code==503
    assert c.get('/api/auth/google/callback?code=bad&state=bad').status_code==400
    with pytest.raises(RuntimeError):create_app(Settings(jwt_key='short',encryption_key=Fernet.generate_key().decode()))
