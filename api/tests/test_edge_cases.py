from concurrent.futures import ThreadPoolExecutor
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from api.models import Profile, Payment, User, Subscription, now
from api.tests.test_security import env, verified_user, login, post, csrf, subscription, event, PASSWORD

def test_parallel_profile_creation_is_limited(env):
    app,c,g,s=env;id=verified_user(app);login(c);subscription(app,g,id);event(c,s,'evt_allow','customer.subscription.updated',g.subs['sub_test'])
    for n in range(3):assert post(c,'/api/profiles',{'name':str(n)}).status_code==201
    token=csrf(c);cookies=dict(c.cookies)
    def create(n):
        with TestClient(app) as other:
            other.cookies.update(cookies)
            return other.post('/api/profiles',json={'name':f'Concurrent {n}'},headers=token).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:codes=list(pool.map(create,[1,2]))
    assert sorted(codes)==[201,403]
    with app.state.Factory() as db:assert db.scalar(select(func.count()).select_from(Profile).where(Profile.user_id==id))==5

def test_refund_is_not_undone_by_late_invoice_event(env):
    app,c,g,s=env;id=verified_user(app);login(c);subscription(app,g,id);event(c,s,'evt_p1','invoice.paid',g.invoices['in_test'])
    g.charges['ch_1']={'id':'ch_1','customer':'cus_test','invoice':'in_test','amount_refunded':9900,'refunded':True}
    event(c,s,'evt_r1','charge.refunded',g.charges['ch_1']);event(c,s,'evt_late_paid','invoice.paid',g.invoices['in_test'])
    assert c.get('/api/billing').json()['payments'][0]['status']=='refunded';assert c.get('/api/premium').status_code==403

def test_partial_and_old_period_refunds(env):
    app,c,g,s=env;id=verified_user(app);login(c);subscription(app,g,id);event(c,s,'evt_p2','invoice.paid',g.invoices['in_test'])
    g.charges['ch_2']={'id':'ch_2','customer':'cus_test','invoice':'in_test','amount_refunded':100,'refunded':False}
    event(c,s,'evt_partial','charge.refunded',g.charges['ch_2']);assert c.get('/api/premium').status_code==200
    g.subs['sub_test']['latest_invoice']='in_renewal';g.charges['ch_2']['refunded']=True;g.charges['ch_2']['amount_refunded']=9900
    event(c,s,'evt_old_refund','charge.refunded',g.charges['ch_2']);assert c.get('/api/premium').status_code==200

def test_checkout_failure_reuses_durable_attempt(env):
    app,c,g,s=env;id=verified_user(app);login(c);original=g.checkout;keys=[]
    def failing(user,price,period,key):keys.append(key);raise RuntimeError('provider unavailable')
    g.checkout=failing
    with pytest.raises(RuntimeError):post(c,'/api/payments/checkout',{'period':'monthly'})
    with app.state.Factory() as db:assert db.get(User,id).checkout_id==keys[0]
    def retry(user,price,period,key):keys.append(key);return original(user,price,period,key)
    g.checkout=retry;assert post(c,'/api/payments/checkout',{'period':'monthly'}).status_code==200
    assert keys[0]==keys[1]

def test_unknown_price_does_not_grant_premium(env):
    app,c,g,s=env;id=verified_user(app);login(c);subscription(app,g,id);g.subs['sub_test']['items']['data'][0]['price']['id']='price_attacker'
    event(c,s,'evt_unknown_price','customer.subscription.updated',g.subs['sub_test']);assert c.get('/api/premium').status_code==403

def test_invalid_revision_is_rejected(env):
    app,c,g,s=env;verified_user(app);login(c)
    data={'name':'Project','material':'Steel','stroke':80,'rod':150,'rpm':600,'parts':[],'notes':[],'revisions':[{'label':'x','date':'today','snapshot':'not an object'}]}
    assert post(c,'/api/projects',data).status_code==422

def test_password_whitespace_preserved(env):
    app,c,g,s=env;verified_user(app,password='  '+PASSWORD+'  ')
    assert login(c,password=PASSWORD).status_code==401
    assert login(c,password='  '+PASSWORD+'  ').status_code==200

def test_duplicate_and_unrecognized_signup_fields(env):
    app,c,g,s=env;body={'email':'new@example.com','name':'New','password':PASSWORD}
    assert post(c,'/api/auth/signup',{**body,'role':'admin'}).status_code==422
    assert post(c,'/api/auth/signup',body).json()==post(c,'/api/auth/signup',body).json()

def test_currency_minor_units():
    from api.money import format_minor
    assert format_minor(9900,'inr')=='99.00 INR'
    assert format_minor(500,'jpy')=='500 JPY'
    assert format_minor(500,'isk')=='5.00 ISK'
    assert format_minor(500,'ugx')=='5.00 UGX'
    assert format_minor(1234,'kwd')=='1.234 KWD'

def test_mfa_challenge_lockout(env):
    from api.security import encrypt, action_token
    app,c,g,s=env;id=verified_user(app)
    with app.state.Factory.begin() as db:
        u=db.get(User,id);u.totp=encrypt(s,'JBSWY3DPEHPK3PXP');token=action_token(db,u,'mfa',300)
    for _ in range(5):assert post(c,'/api/auth/mfa',{'token':token,'code':'not-a-code'}).status_code==401
    from api.models import Token
    from api.security import digest
    with app.state.Factory() as db:assert db.get(Token,digest(token)).used

def test_imported_revision_cannot_inject_prototype_keys(env):
    app,c,g,s=env;verified_user(app);login(c)
    snapshot={'name':'Original','material':'Steel','stroke':80,'rod':150,'rpm':600,'parts':[],'notes':[],'__proto__':{'costSettings':{'quantity':'<img src=x>'}}}
    data={**snapshot,'revisions':[{'label':'Safe','date':'today','snapshot':snapshot}]}
    assert post(c,'/api/projects',data).status_code==201
    project=c.get('/api/projects').json()[0]
    assert '__proto__' not in project and '__proto__' not in project['revisions'][0]['snapshot']

def test_chunked_body_limit_and_production_cookie_mode(env):
    app,c,g,s=env
    def chunks():
        for _ in range(20):yield b'x'*65536
    assert c.post('/api/auth/login',content=chunks(),headers={**csrf(c),'Content-Type':'application/json'}).status_code==413
    from api.config import Settings
    assert Settings(environment='production').secure_cookies

