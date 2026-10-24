"""Regression checks for the supplied 25 October adversarial audit."""
import hashlib,hmac,json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select,func,event as sql_event
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from test_security import env,verified_user,login,post,csrf,subscription,event
from test_product_teams_ai import paid
from test_assembly import project
from api.models import User,Session,Notice,Audit,Rate,Webhook,Payment,Subscription,now
from api.security import cookie_name,digest,encrypt,recipient_limit
from api.billing import STRIPE_API_VERSION

def test_public_share_throttles_before_database_and_ignores_spoofed_headers(env):
    app,c,_,s=env;s.sharing_enabled=True;queries=[]
    def record(conn,cursor,statement,parameters,context,executemany):queries.append(statement)
    sql_event.listen(app.state.engine,'before_cursor_execute',record)
    try:
        for i in range(60):
            response=c.get('/api/shared',headers={'Authorization':'Bearer '+'a'*64,'X-Forwarded-For':f'198.51.100.{i}'})
            assert response.status_code==404
        count=len(queries)
        response=c.get('/api/shared',headers={'Authorization':'Bearer '+'b'*64})
        assert response.status_code==429 and len(queries)==count
        assert 1<=int(response.headers['Retry-After'])<=60
        assert response.headers['Cache-Control']=='no-store'
        assert response.headers['X-Frame-Options']=='DENY'
        with TestClient(app,client=('203.0.113.2',5000)) as other:
            assert other.get('/api/shared').status_code==404
    finally:sql_event.remove(app.state.engine,'before_cursor_execute',record)

@pytest.mark.anyio
async def test_snapshot_global_guard_is_bounded_and_recovers(monkeypatch):
    from api.middleware import PublicShareLimit
    clock=[100.0];monkeypatch.setattr('api.middleware.monotonic',lambda:clock[0])
    calls=[];responses=[]
    async def app(scope,receive,send):calls.append(scope['client'])
    guard=PublicShareLimit(app,key='synthetic-key')
    async def receive():return {'type':'http.request','body':b''}
    async def send(message):responses.append(message)
    for i in range(1201):
        await guard({'type':'http','path':'/api/shared','method':'GET','client':(str(i),1)},receive,send)
    assert len(calls)==1200 and len(guard.clients)==1200
    assert responses[0]['status']==429
    clock[0]+=60
    await guard({'type':'http','path':'/api/shared','method':'GET','client':('new',1)},receive,send)
    assert len(calls)==1201 and len(guard.clients)==1

def test_only_trusted_proxy_changes_client_identity(env):
    app,_,_,_=env;wrapped=ProxyHeadersMiddleware(app,trusted_hosts=['10.0.0.2'])
    with TestClient(wrapped,client=('10.0.0.2',5000)) as trusted:
        for _ in range(60):assert trusted.get('/api/shared',headers={'X-Forwarded-For':'203.0.113.1'}).status_code==404
        assert trusted.get('/api/shared',headers={'X-Forwarded-For':'203.0.113.1'}).status_code==429
        assert trusted.get('/api/shared',headers={'X-Forwarded-For':'203.0.113.2'}).status_code==404
    with TestClient(wrapped,client=('198.51.100.1',5000)) as untrusted:
        for i in range(60):assert untrusted.get('/api/shared',headers={'X-Forwarded-For':f'203.0.113.{i}'}).status_code==404
        assert untrusted.get('/api/shared',headers={'X-Forwarded-For':'203.0.113.100'}).status_code==429

@pytest.mark.parametrize('email',['registered@example.com','absent@example.com'])
def test_recipient_limit_spans_projects_owners_and_canceled_invites(env,email):
    app,c,_,_=env;paid(env);verified_user(app,'registered@example.com')
    first=post(c,'/api/projects',project()).json()['id']
    second=post(c,'/api/projects',project()).json()['id']
    for pid in [first,second,first]:
        base='/api/team/projects/'+pid
        assert post(c,base+'/members',{'email':email,'role':'viewer'}).status_code==202
        pending=c.get(base+'/invitations').json()[0]
        assert c.delete(base+'/invitations/'+pending['id'],headers=csrf(c)).status_code==200
    assert post(c,'/api/team/projects/'+second+'/members',{'email':email,'role':'editor'}).status_code==429
    # The limit belongs to the recipient, independent of the sender account.
    other=verified_user(app,'other-owner@example.com')
    with app.state.Factory.begin() as db:db.add(Subscription(id='sub_other_owner',user_id=other,status='active',price='price_month',ends=now()+86400))
    login(c,'other-owner@example.com');second=post(c,'/api/projects',project()).json()['id']
    assert post(c,'/api/team/projects/'+second+'/members',{'email':email,'role':'editor'}).status_code==429
    with app.state.Factory.begin() as db:
        rows=list(db.scalars(select(Rate).where(Rate.id.like('invite-recipient:%'))))
        assert len(rows)==3 and all(email not in row.id for row in rows)
        rows[0].expires=now()-1
    assert post(c,'/api/team/projects/'+second+'/members',{'email':email,'role':'editor'}).status_code==202
    with app.state.Factory() as db:assert db.scalar(select(func.count()).select_from(Rate).where(Rate.id.like('invite-recipient:%')))==3

def test_recipient_budget_is_atomic_under_concurrent_senders(env):
    from concurrent.futures import ThreadPoolExecutor
    from fastapi import HTTPException
    app,_,_,_=env
    def claim(_):
        try:
            with app.state.Factory.begin() as db:recipient_limit(db,'target@example.com')
            return 202
        except HTTPException as e:return e.status_code
    with ThreadPoolExecutor(max_workers=6) as pool:assert sorted(pool.map(claim,range(6)))==[202,202,202,429,429,429]

def test_replay_revokes_one_family_and_alerts_only_once(env):
    app,c,_,s=env;uid=verified_user(app);login(c);old=c.cookies.get(cookie_name(s,'refresh'))
    with TestClient(app,client=('203.0.113.9',5000)) as independent:
        assert login(independent).status_code==200
        assert post(c,'/api/auth/refresh').status_code==200
        c.cookies.set(cookie_name(s,'refresh'),old,domain='testserver.local',path='/')
        for _ in range(2):assert post(c,'/api/auth/refresh').status_code==401
        assert c.get('/api/me').status_code==401
        assert independent.get('/api/me').status_code==200
        with app.state.Factory() as db:
            assert db.scalar(select(func.count()).select_from(Audit).where(Audit.user_id==uid,Audit.action=='refresh.replay'))==1
            assert db.scalar(select(func.count()).select_from(Notice).where(Notice.user_id==uid,Notice.message=='Session revoked after token replay'))==1

def test_recovery_code_unlocks_mfa_account_and_cannot_be_reused(env):
    app,c,_,s=env;uid=verified_user(app);code='synthetic-recovery-7391'
    with app.state.Factory.begin() as db:
        u=db.get(User,uid);u.totp=encrypt(s,'JBSWY3DPEHPK3PXP');u.recovery=json.dumps([digest(code)])
    for _ in range(5):assert login(c,password='wrong').status_code==401
    challenge=login(c).json()['challenge']
    assert post(c,'/api/auth/mfa',{'token':challenge,'code':code}).status_code==200
    challenge=login(c).json()['challenge']
    assert post(c,'/api/auth/mfa',{'token':challenge,'code':code}).status_code==401

@pytest.mark.parametrize('version',[None,'2025-03-31.basil'])
def test_signed_webhook_version_drift_is_not_acknowledged(env,version):
    app,c,g,s=env;uid=verified_user(app);subscription(app,g,uid)
    raw=json.dumps({'id':'evt_drift','type':'invoice.paid','api_version':version,'data':{'object':{'id':'in_test','customer':'cus_test'}}}).encode()
    stamp=str(now());sig=hmac.new(s.webhook_key.encode(),stamp.encode()+b'.'+raw,hashlib.sha256).hexdigest()
    response=c.post('/api/payments/webhook',content=raw,headers={'Stripe-Signature':f't={stamp},v1={sig}'})
    assert response.status_code==400
    with app.state.Factory() as db:assert db.get(Webhook,'evt_drift') is None

@pytest.mark.parametrize('change',['missing-subscription','invalid-amount','missing-created'])
def test_invoice_schema_failure_is_retryable_without_partial_ledger(env,change):
    app,c,g,s=env;uid=verified_user(app);subscription(app,g,uid)
    invoice=g.invoices['in_test']
    if change=='missing-subscription':invoice.pop('subscription');invoice['parent']={'subscription_details':{'subscription':'sub_test'}}
    elif change=='invalid-amount':invoice['amount_paid']=True
    else:invoice.pop('created')
    assert event(c,s,'evt_bad_invoice','invoice.paid',{'id':'in_test','customer':'cus_test'}).status_code==502
    with app.state.Factory() as db:
        assert db.get(Webhook,'evt_bad_invoice') is None and db.get(Payment,'in_test') is None

def test_pinned_one_off_invoice_is_valid_but_does_not_upgrade(env):
    app,c,g,s=env;uid=verified_user(app);subscription(app,g,uid);g.invoices['in_test']['subscription']=None
    assert event(c,s,'evt_one_off','invoice.paid',{'id':'in_test','customer':'cus_test'}).status_code==200
    login(c);assert c.get('/api/premium').status_code==403

@pytest.mark.parametrize('kind',['csrf','body','content-length'])
def test_early_rejections_keep_security_headers(env,kind):
    _,c,_,_=env
    if kind=='body':r=c.post('/api/auth/login',content=b'x'*1048577)
    elif kind=='content-length':r=c.post('/api/auth/login',headers={'Content-Length':'invalid'})
    else:r=c.post('/api/auth/login',json={})
    assert r.status_code in [400,403,413]
    assert r.headers['X-Content-Type-Options']=='nosniff' and r.headers['X-Frame-Options']=='DENY'
    assert r.headers['Cache-Control']=='no-store'
