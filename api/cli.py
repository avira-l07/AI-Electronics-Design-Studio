"""Explicit operational commands; no secrets or verification links are printed."""
import argparse
from sqlalchemy import select, delete
from api.app import create_app
from api.models import Base, User, Mail, Rate, UsedRefresh, Token, Audit, ProjectInvitation, now, seed
from api.billing import sync_subscription

def main():
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['init-db','create-admin','grant-beta','send-mail','reconcile','cleanup']);parser.add_argument('--email');parser.add_argument('--days',type=int,default=7);args=parser.parse_args()
    app=create_app();s=app.state.settings
    if args.command=='grant-beta':
        from api.beta_access import grant_beta
        print('Complimentary beta access:',grant_beta(app.state.Factory,s,args.email or '',args.days));return
    if args.command=='init-db':
        if s.environment=='production':raise SystemExit('Apply the reviewed migration SQL in production; init-db is for development only.')
        Base.metadata.create_all(app.state.engine)
        with app.state.Factory.begin() as db:seed(db)
        print('Development schema initialized.');return
    with app.state.Factory.begin() as db:
        if args.command=='create-admin':
            user=db.scalar(select(User).where(User.email==(args.email or '').lower()).with_for_update())
            if not user or not user.verified:raise SystemExit('Create and verify the account first.')
            if not user.totp:raise SystemExit('Enable two-factor authentication first.')
            user.role='admin';print('Verified account promoted; this action should be recorded in your operator change log.')
        elif args.command=='send-mail':
            from api.mail_delivery import deliver_pending
            print('Outbox batch:',deliver_pending(app.state.Factory,s,batch=25))
        elif args.command=='reconcile':
            from api.models import Subscription
            for sub in db.scalars(select(Subscription).where(Subscription.status.not_in(['canceled','incomplete_expired']))):
                user=db.scalar(select(User).where(User.id==sub.user_id).with_for_update())
                sync_subscription(db,s,app.state.gateway,user,sub.id)
            print('Subscription states reconciled against Stripe.')
        elif args.command=='cleanup':
            db.execute(delete(Rate).where(Rate.expires<now()));db.execute(delete(UsedRefresh).where(UsedRefresh.expires<now()));db.execute(delete(Token).where(Token.expires<now()-86400));db.execute(delete(ProjectInvitation).where(ProjectInvitation.expires<=now()))
            db.execute(delete(Audit).where(Audit.created<now()-90*86400));db.execute(delete(Mail).where(Mail.sent==True));print('Expired operational records removed; financial records preserved.')

if __name__=='__main__':main()
