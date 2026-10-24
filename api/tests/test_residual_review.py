import pytest
from sqlalchemy import select
from test_security import env,verified_user,login,post
from api.models import Token,now
from api.security import random_token

@pytest.mark.parametrize('ttl',[600,1200,1800])
def test_signin_confirmation_uses_configured_ttl(env,ttl):
    app,c,_,s=env;s.login_confirmation_ttl=ttl;s.validate();uid=verified_user(app)
    for _ in range(5):assert login(c,password='wrong').status_code==401
    start=now();response=login(c);assert response.json()['confirmation_required']
    with app.state.Factory() as db:
        token=db.scalar(select(Token).where(Token.user_id==uid,Token.purpose=='confirm-login'))
        assert start+ttl<=token.expires<=now()+ttl
    assert post(c,'/api/auth/confirm-login',{'token':random_token()}).status_code==400

@pytest.mark.parametrize('ttl',[599,1801,True,1200.5])
def test_unbounded_confirmation_ttl_is_rejected(env,ttl):
    _,_,_,s=env;s.login_confirmation_ttl=ttl
    with pytest.raises(RuntimeError,match='LOGIN_CONFIRMATION_TTL'):s.validate()

@pytest.mark.parametrize('path',['/.env','/studio.db','/.git/config','/api/app.py','/api/security.py','/deploy/compose.yml','/api/../.env','/dist/../api/config.py','/%2e%2e/api/config.py'])
def test_static_mount_does_not_publish_source_or_runtime_files(env,path):
    _,c,_,_=env
    assert c.get(path).status_code in [400,404]

def test_accidentally_copied_private_files_are_denied_even_inside_public_root(tmp_path):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from api.static_files import PublicFrontend
    (tmp_path/'index.html').write_text('<h1>Public interface</h1>')
    for name in ['.env','studio.db','studio.db-wal','secret.pem','config.py']:(tmp_path/name).write_text('synthetic private value')
    app=FastAPI();app.mount('/',PublicFrontend(directory=tmp_path,html=True))
    with TestClient(app) as c:
        assert c.get('/').status_code==200
        for name in ['.env','studio.db','studio.db-wal','secret.pem','config.py']:assert c.get('/'+name).status_code==404
