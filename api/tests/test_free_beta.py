import json
from dataclasses import replace
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select

from test_security import env, verified_user, post, login, csrf, PASSWORD
from api.app import create_app
from api.models import Base, Mail, Token, User, Subscription, now, seed
from api.security import account_token, action_token, effective_plan, notify
from api.beta_access import grant_beta
from api.mail_delivery import deliver_pending, send_message
from api.free_host import configuration


@pytest.mark.parametrize('purpose', ['verify', 'reset', 'mfa', 'confirm-login'])
def test_account_token_locks_account_before_token_and_refreshes_used_state(env, purpose):
    app, c, g, s = env
    uid = verified_user(app)
    with app.state.Factory.begin() as db:
        raw = action_token(db, db.get(User, uid), purpose)
    locks = []
    def record(state):
        statement = state.statement
        if getattr(statement, '_for_update_arg', None) is not None:
            locks.extend(table.name for table in statement.get_final_froms())
    with app.state.Factory() as db:
        cached = db.scalar(select(Token).where(Token.user_id == uid))
        with app.state.Factory.begin() as other:
            other.get(Token, cached.digest).used = True
        event.listen(db, 'do_orm_execute', record)
        user, token = account_token(db, raw, purpose)
        assert user.id == uid and token.used
    assert locks[:2] == ['users', 'action_tokens']


def test_free_beta_refuses_paid_activation(env):
    app, c, g, s = env
    beta = replace(s, free_beta=True, billing_enabled=False)
    beta.validate()
    for change in [{'billing_enabled': True}, {'allow_live_billing': True},
                   {'stripe_key': 'sk_live_synthetic'}, {'ai_enabled': True}]:
        with pytest.raises(RuntimeError, match='FREE_BETA'):
            replace(beta, **change).validate()
    with pytest.raises(RuntimeError, match='INLINE_MAIL'):
        replace(beta, inline_mail=True).validate()


def test_complimentary_beta_expires_and_never_calls_payment_provider(env, monkeypatch):
    app, c, g, s = env
    uid = verified_user(app)
    with pytest.raises(RuntimeError): grant_beta(app.state.Factory, s, 'alice@example.com')
    s.billing_enabled = False
    s.free_beta = True
    result = grant_beta(app.state.Factory, s, 'alice@example.com', 7)
    assert result == {'days': 7, 'renews': False, 'payment_collected': False}
    with app.state.Factory.begin() as db:
        assert effective_plan(db, s, db.get(User, uid)).id == 'premium'
        row = db.get(Subscription, 'beta_' + uid)
        row.ends = now() - 1
    with app.state.Factory() as db:
        assert effective_plan(db, s, db.get(User, uid)).id == 'free'
    grant_beta(app.state.Factory, s, 'alice@example.com', 1)
    monkeypatch.setattr(g, 'cancel', lambda *a, **k: pytest.fail('Complimentary beta must not contact Stripe'))
    assert login(c).status_code == 200
    assert c.request('DELETE', '/api/account', json={'password': PASSWORD}, headers=csrf(c)).status_code == 200


def test_resend_https_destination_and_stable_idempotency_key(env, monkeypatch):
    app, c, g, s = env
    s.mail_transport = 'resend'
    s.mail_from = 'studio@example.com'
    s.resend_key = 'synthetic-local-key'
    requests = []
    def handle(request):
        requests.append(request)
        return httpx.Response(200, json={'id': 'synthetic-id'})
    original = httpx.Client
    monkeypatch.setattr('api.mail_delivery.httpx.Client', lambda **kw: original(transport=httpx.MockTransport(handle), **kw))
    for _ in range(2):
        send_message(s, SimpleNamespace(id='same-outbox-record'), {'to':'recipient@example.com','subject':'Test','body':'Synthetic text'})
    assert len(requests) == 2
    assert all(str(r.url) == 'https://api.resend.com/emails' for r in requests)
    assert all(r.headers['Idempotency-Key'] == 'studio-mail-same-outbox-record' for r in requests)
    assert json.loads(requests[0].content)['to'] == ['recipient@example.com']


def test_outbox_failure_preserves_encrypted_message_then_retries(env, monkeypatch):
    app, c, g, s = env
    uid = verified_user(app)
    s.mail_transport, s.mail_from, s.resend_key = 'resend', 'studio@example.com', 'synthetic'
    with app.state.Factory.begin() as db:
        notify(db, s, db.get(User, uid), 'Synthetic subject', 'Synthetic private content')
    def fail(*args): raise httpx.ReadTimeout('synthetic')
    monkeypatch.setattr('api.mail_delivery.send_message', fail)
    assert deliver_pending(app.state.Factory, s) == {'sent':0,'deferred':1}
    with app.state.Factory.begin() as db:
        row = db.scalar(select(Mail))
        assert not row.sent and row.attempts == 1 and 'Synthetic private content' not in row.payload
        row.available = now() - 1
    monkeypatch.setattr('api.mail_delivery.send_message', lambda *args: None)
    assert deliver_pending(app.state.Factory, s) == {'sent':1,'deferred':0}
    assert deliver_pending(app.state.Factory, s) == {'sent':0,'deferred':0}
    with app.state.Factory() as db:
        assert db.scalar(select(Mail)).payload == ''


def test_free_beta_signup_delivers_after_transaction_commit_without_worker(env, monkeypatch, tmp_path):
    _, _, _, base = env
    s = replace(base, database_url='sqlite:///' + str(tmp_path/'inline.db'),
        free_beta=True, billing_enabled=False, inline_mail=True,
        mail_transport='resend', mail_from='studio@example.com', resend_key='synthetic')
    delivered = []
    monkeypatch.setattr('api.mail_delivery.send_message', lambda settings,row,payload: delivered.append(payload))
    app = create_app(s)
    Base.metadata.create_all(app.state.engine)
    with app.state.Factory.begin() as db: seed(db)
    with TestClient(app) as c:
        assert post(c, '/api/auth/signup', {'email':'beta@example.com','name':'Beta','password':PASSWORD}).status_code == 202
    assert len(delivered) == 1 and 'token=' in delivered[0]['body']
    with app.state.Factory() as db: assert db.scalar(select(Mail)).sent
    app.state.engine.dispose()


def test_free_host_rejects_unsafe_proxy_trust_and_normalizes_neon_url(monkeypatch):
    for key,value in {'APP_ORIGIN':'https://studio.example.com','DATABASE_URL':'postgresql://test:synthetic@db.example.com/test?sslmode=require',
                      'APP_ENV':'production','FREE_BETA':'true','TRUSTED_PROXY_IPS':'*'}.items(): monkeypatch.setenv(key,value)
    with pytest.raises(RuntimeError, match='verified IP'): configuration()
    monkeypatch.setenv('TRUSTED_PROXY_IPS','0.0.0.0/0')
    with pytest.raises(RuntimeError, match='entire Internet'): configuration()
    monkeypatch.setenv('TRUSTED_PROXY_IPS','10.10.0.0/16,127.0.0.1')
    assert configuration() == '10.10.0.0/16,127.0.0.1'
    import os
    assert os.environ['DATABASE_URL'].startswith('postgresql+psycopg://')


def test_free_beta_applies_concurrent_write_backpressure_and_recovers():
    import asyncio
    from api.middleware import FreeBetaCapacity
    async def run():
        release=asyncio.Event()
        entered=[]
        async def handler(scope,receive,send):
            entered.append(scope['id'])
            await release.wait()
            await send({'type':'http.response.start','status':200,'headers':[]})
            await send({'type':'http.response.body','body':b'{}'})
        app=FreeBetaCapacity(handler)
        async def request(ident):
            messages=[]
            async def receive(): return {'type':'http.request','body':b''}
            async def send(message): messages.append(message)
            await app({'type':'http','path':'/api/auth/login','method':'POST','id':ident},receive,send)
            return messages[0]['status']
        first=asyncio.create_task(request(1));second=asyncio.create_task(request(2))
        await asyncio.sleep(0)
        assert await request(3)==429 and entered==[1,2]
        release.set()
        assert await first==200 and await second==200
        assert await request(4)==200
    asyncio.run(run())


def test_beta_billing_mutations_are_disabled_on_server_not_just_buttons(env, monkeypatch):
    app,c,g,s=env
    uid=verified_user(app);login(c)
    s.free_beta=True;s.billing_enabled=False
    grant_beta(app.state.Factory,s,'alice@example.com')
    with app.state.Factory.begin() as db:db.get(User,uid).customer='cus_synthetic'
    def forbidden(*args,**kwargs):pytest.fail('Disabled beta billing must not call a provider')
    monkeypatch.setattr(g,'portal',forbidden)
    monkeypatch.setattr(g,'cancel',forbidden)
    monkeypatch.setattr(g,'checkout',forbidden)
    for path,body in [('/payments/portal',{}),('/payments/cancel',{}),('/payments/checkout',{'period':'monthly'})]:
        assert post(c,'/api'+path,body).status_code==503


@pytest.mark.parametrize('query', ['sslmode=required', 'other=sslmode=require',
    'sslmode=require&sslmode=disable', 'sslmode=disable', 'sslmode='])
def test_free_host_rejects_misleading_or_ambiguous_tls_parameters(monkeypatch, query):
    for key, value in {'APP_ORIGIN':'https://studio.example.com',
            'DATABASE_URL':'postgresql://test:synthetic@db.example.com/test?' + query,
            'APP_ENV':'production', 'FREE_BETA':'true', 'TRUSTED_PROXY_IPS':'127.0.0.1'}.items():
        monkeypatch.setenv(key, value)
    with pytest.raises(RuntimeError, match='sslmode'):
        configuration()
