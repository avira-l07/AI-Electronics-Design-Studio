"""Zero-provider local demonstration. Synthetic accounts; loopback only."""
import argparse
import json
import os
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4203)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--local-ai', action='store_true', help='Use installed phi4-mini:3.8b through loopback Ollama; never downloads models.')
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        raise SystemExit('Choose a port between 1024 and 65535.')
    directory = ROOT / 'tmp' / 'local-free-demo'
    directory.mkdir(parents=True, exist_ok=True)
    from cryptography.fernet import Fernet
    private = directory / 'local-keys.json'
    if private.exists():
        keys = json.loads(private.read_text())
    else:
        keys = {'jwt':secrets.token_urlsafe(64), 'encryption':Fernet.generate_key().decode()}
        with private.open('x') as file: json.dump(keys, file)
    origin = f'http://127.0.0.1:{args.port}'
    os.environ.update(APP_ENV='test', APP_ORIGIN=origin,
        DATABASE_URL='sqlite:///' + (directory/'demo.db').as_posix(),
        JWT_SECRET=keys['jwt'], ENCRYPTION_KEY=keys['encryption'], FREE_BETA='true',
        INLINE_MAIL='false', MAIL_TRANSPORT='smtp', SMTP_HOST='', MAIL_FROM='',
        RESEND_API_KEY='', BILLING_ENABLED='false', ALLOW_LIVE_BILLING='false',
        STRIPE_SECRET_KEY='', STRIPE_WEBHOOK_SECRET='', STRIPE_MONTHLY_PRICE_ID='',
        STRIPE_ANNUAL_PRICE_ID='', GOOGLE_CLIENT_ID='', GOOGLE_CLIENT_SECRET='',
        AI_ENABLED='true' if args.local_ai else 'false', AI_PROVIDER='ollama' if args.local_ai else 'openai',
        OLLAMA_MODEL='phi4-mini:3.8b', OPENAI_API_KEY='', OPENAI_MODEL='', SHARING_ENABLED='false')
    if args.local_ai:
        from api.local_ai import check_local_model
        try: check_local_model('phi4-mini:3.8b')
        except Exception:
            raise SystemExit('Local AI unavailable. Start loopback Ollama with the installed phi4-mini:3.8b model, or omit --local-ai.') from None
    from api.migrate import migrate
    migrate()
    from api.app import create_app
    from api.models import User, Profile, Project
    from api.security import passwords
    from api.beta_access import grant_beta
    app = create_app()
    app.state.local_demo = True
    password = 'Synthetic demo password 739!'
    with app.state.Factory.begin() as db:
        for name in ['owner', 'editor', 'viewer']:
            if not db.get(User, 'demo-' + name):
                user = User(id='demo-' + name, email=name+'@example.com', name='Demo '+name,
                            verified=True, password=passwords.hash(password))
                db.add(user); db.flush()
                db.add(Profile(id='demo-'+name+'-profile', user_id=user.id, name='Demo'))
        if not db.get(Project, 'demo-assembly'):
            part = {'id':'plate-a','partId':'plate_flat','name':'Base plate',
                'dims':{'width':80,'height':60,'thickness':3},'material':'Aluminium 6061',
                'position':[0,0,0],'rotation':[0,0,0],'visible':True,'wireframe':False}
            data = {'name':'Local demo assembly','material':'Aluminium 6061','stroke':80,
                'rod':150,'rpm':600,'parts':[],'notes':[],'revisions':[],
                'assembly3d':{'version':1,'units':'mm','objects':[part,
                    {**part,'id':'plate-b','name':'Top plate','position':[0,20,0]}]}}
            db.add(Project(id='demo-assembly',user_id='demo-owner',profile_id='demo-owner-profile',data=json.dumps(data)))
    grant_beta(app.state.Factory, app.state.settings, 'owner@example.com', 7)
    if args.check:
        from fastapi.testclient import TestClient
        with TestClient(app, base_url=origin) as client:
            config = client.get('/api/config').json()
            assert config['free_beta'] and config['demo_mode']
            assert not config['payments_enabled'] and config['ai_enabled']==args.local_ai and not config['google_enabled']
            token = client.get('/api/csrf').json()['token']
            response = client.post('/api/auth/login',json={'email':'owner@example.com','password':password},
                headers={'Origin':origin,'X-CSRF-Token':token})
            assert response.status_code == 200
            assert client.get('/api/me').json()['profile_limit'] == 5
        print('PASS: isolated local demo, migration 0005, real login, complimentary Pro; cloud providers disabled. Local AI: '+str(args.local_ai))
        app.state.engine.dispose()
        return
    print('LOCAL DEMO — synthetic accounts only. Do not enter private/customer data.', flush=True)
    print('Open '+origin+'/#/login', flush=True)
    print('Accounts: owner@example.com, editor@example.com, viewer@example.com', flush=True)
    print('Shared synthetic demo password: '+password, flush=True)
    print('No email is sent, no payment is collected. '+('Optional local AI uses installed phi4-mini:3.8b; no cloud fallback.' if args.local_ai else 'AI is disabled.'), flush=True)
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=args.port, proxy_headers=False)


if __name__ == '__main__': main()
