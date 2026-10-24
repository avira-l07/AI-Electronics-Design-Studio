"""Opt-in real PostgreSQL races in a disposable schema; never uses .env DB.

Set PG_ACCEPTANCE_URL to a dedicated test database with CREATE SCHEMA permission.
No provider/payment/mail request is sent. Only the generated schema is dropped.
"""
import os
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


def main():
    raw = os.getenv('PG_ACCEPTANCE_URL', '')
    if not raw:
        raise SystemExit('NOT RUN: supply a dedicated PG_ACCEPTANCE_URL; no PostgreSQL acceptance claimed.')
    if raw.startswith('postgresql://'):
        raw = 'postgresql+psycopg://' + raw[len('postgresql://'):]
    if not raw.startswith('postgresql+psycopg://'):
        raise SystemExit('PG_ACCEPTANCE_URL must be PostgreSQL with psycopg.')
    schema = 'studio_acceptance_' + uuid.uuid4().hex
    admin = create_engine(raw, connect_args={'connect_timeout':10})
    engine = None
    app = None
    try:
        with admin.begin() as db: db.execute(text('CREATE SCHEMA ' + schema))
        scoped = make_url(raw).update_query_dict({'options':'-csearch_path=' + schema + ' -clock_timeout=5000 -cstatement_timeout=10000'})
        from cryptography.fernet import Fernet
        import secrets
        os.environ.update(DATABASE_URL=scoped.render_as_string(hide_password=False),
            APP_ENV='test', APP_ORIGIN='http://testserver', JWT_SECRET=secrets.token_urlsafe(48),
            ENCRYPTION_KEY=Fernet.generate_key().decode(), BILLING_ENABLED='false',
            FREE_BETA='false', INLINE_MAIL='false', AI_ENABLED='false')
        from api.migrate import migrate
        migrate()
        from api.app import create_app
        from api.models import User, Profile, Token, now
        from api.security import passwords, encrypt
        from fastapi.testclient import TestClient
        import pyotp
        app = create_app()
        password = 'Synthetic PostgreSQL acceptance 739!'
        def post(client, route, data=None):
            token = client.get('/api/csrf').json()['token']
            return client.post(route, json=data or {}, headers={'Origin':'http://testserver','X-CSRF-Token':token})
        for index in range(5):
            with app.state.Factory.begin() as db:
                user = User(email=f'race{index}@example.com', name='Synthetic race', verified=True, password=passwords.hash(password))
                db.add(user);db.flush();db.add(Profile(user_id=user.id,name='Test'));uid=user.id
            with TestClient(app) as owner, TestClient(app) as second:
                body = {'email':f'race{index}@example.com','password':password}
                assert post(owner,'/api/auth/login',body).status_code == 200
                with app.state.Factory.begin() as db:
                    db.get(User,uid).totp=encrypt(app.state.settings,'JBSWY3DPEHPK3PXP')
                challenge=post(second,'/api/auth/login',body).json()['challenge']
                barrier=Barrier(2)
                def factor():
                    barrier.wait();return post(second,'/api/auth/mfa',{'token':challenge,'code':pyotp.TOTP('JBSWY3DPEHPK3PXP').now()}).status_code
                def revoke():
                    barrier.wait();return post(owner,'/api/auth/logout-all').status_code
                with ThreadPoolExecutor(max_workers=2) as executor:
                    a,b=executor.submit(factor),executor.submit(revoke)
                    assert a.result(timeout=20) in [200,401]
                    assert b.result(timeout=20) == 200
                assert second.get('/api/me').status_code == 401
        print('PASS: migration 0005 and five real PostgreSQL MFA/revocation races; no provider calls.')
    finally:
        if app: app.state.engine.dispose()
        if engine: engine.dispose()
        with admin.begin() as db: db.execute(text('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE'))
        admin.dispose()


if __name__ == '__main__': main()
