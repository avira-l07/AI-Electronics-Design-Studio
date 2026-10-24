"""Operator-only complimentary beta access; never represents a payment."""
from sqlalchemy import select
from api.models import User, Subscription, now
from api.security import audit

BETA_PRICE = 'complimentary_beta_access'


def grant_beta(factory, settings, email, days=7):
    if not settings.free_beta or settings.billing_enabled:
        raise RuntimeError('Complimentary access requires FREE_BETA and disabled billing.')
    if type(days) is not int or not 1 <= days <= 30:
        raise ValueError('Choose 1–30 days; no automatic renewal.')
    with factory.begin() as db:
        user = db.scalar(select(User).where(User.email == email.lower()).with_for_update())
        if not user or not user.verified or user.banned or user.deleted:
            raise ValueError('An active verified account is required.')
        ident = 'beta_' + user.id
        row = db.get(Subscription, ident)
        if not row:
            row = Subscription(id=ident, user_id=user.id, price=BETA_PRICE, status='trialing')
            db.add(row)
        row.status = 'trialing'
        row.ends = now() + days * 86400
        row.cancel_at_end = True
        row.updated = now()
        audit(db, user, 'beta.complimentary_access.granted')
    return {'days': days, 'renews': False, 'payment_collected': False}
