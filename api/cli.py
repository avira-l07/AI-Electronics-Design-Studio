"""Explicit operational commands; no secrets or verification links are printed."""
import argparse, json, smtplib, ssl
from email.message import EmailMessage
from sqlalchemy import select, delete
from api.app import create_app
from api.models import Base, User, Mail, Rate, UsedRefresh, Token, Audit, ProjectInvitation, now, seed
from api.security import decrypt
from api.billing import sync_subscription

def main():
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['init-db','create-admin','send-mail','reconcile','cleanup']);parser.add_argument('--email');args=parser.parse_args()
    app=create_app();s=app.state.settings
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
            if not s.smtp_host or not s.mail_from:raise SystemExit('Configure SMTP before running the delivery worker.')
            rows=list(db.scalars(select(Mail).where(Mail.sent==False,Mail.available<=now()).order_by(Mail.available).limit(25).with_for_update(skip_locked=True)))
            for row in rows:
                payload=json.loads(decrypt(s,row.payload));message=EmailMessage();message['From']=s.mail_from;message['To']=payload['to'];message['Subject']=payload['subject'];message['Message-ID']='<'+row.id+'@studio-outbox>';message.set_content(payload['body'])
                try:
                    with smtplib.SMTP(s.smtp_host,s.smtp_port,timeout=20) as smtp:
                        smtp.starttls(context=ssl.create_default_context())
                        if s.smtp_user:smtp.login(s.smtp_user,s.smtp_password)
                        smtp.send_message(message)
                    row.sent=True;row.payload='';print('Outbox delivery completed:',row.id)
                except (OSError,smtplib.SMTPException):
                    row.attempts+=1;row.available=now()+min(3600,30*2**min(row.attempts,7));print('Outbox delivery deferred:',row.id)
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
