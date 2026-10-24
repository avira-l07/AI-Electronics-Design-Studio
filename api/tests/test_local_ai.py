import json
from dataclasses import replace
import httpx
import pytest
from fastapi import HTTPException
from test_security import env, verified_user, login, post
from test_assembly import project
from api.beta_access import grant_beta
from api.features import ask_provider
from api.ai_modelling import SCHEMA


def local_settings(base):
    return replace(base, origin='http://127.0.0.1:4203', free_beta=True,
        billing_enabled=False, ai_provider='ollama', ai_enabled=True)


def transport(monkeypatch, handler):
    original=httpx.Client
    monkeypatch.setattr('api.local_ai.httpx.Client',lambda **kwargs:
        original(transport=httpx.MockTransport(handler), **kwargs))


def test_local_provider_uses_fixed_loopback_schema_and_no_cloud_key(env, monkeypatch):
    s=local_settings(env[3]);seen=[]
    def handle(request):
        seen.append(request)
        if request.url.path=='/api/tags':return httpx.Response(200,json={'models':[{'name':'phi4-mini:3.8b'}]})
        return httpx.Response(200,json={'done':True,'done_reason':'stop','response':'synthetic answer'})
    transport(monkeypatch,handle)
    assert ask_provider(s,'synthetic plate',schema=SCHEMA)=='synthetic answer'
    assert [str(r.url) for r in seen]==['http://127.0.0.1:11434/api/tags','http://127.0.0.1:11434/api/generate']
    payload=json.loads(seen[-1].content)
    assert payload['format']==SCHEMA and payload['keep_alive']==0 and payload['stream'] is False
    assert not any('authorization' in r.headers for r in seen)
    assert payload['options']['num_predict']==1200


@pytest.mark.parametrize('change',[
    {'environment':'production'}, {'origin':'https://public.example.com'},
    {'ollama_model':'unknown:cloud'}, {'ai_provider':'unknown'}])
def test_local_provider_rejects_public_or_unapproved_configuration(env,change):
    s=replace(local_settings(env[3]),**change)
    with pytest.raises(RuntimeError):s.validate()


@pytest.mark.parametrize('response',[
    {'done':False,'response':'partial'}, {'done':True,'done_reason':'length','response':'truncated'},
    {'done':True,'done_reason':'stop','response':42}])
def test_incomplete_local_answers_fail_closed(env,monkeypatch,response):
    def handle(request):
        if request.url.path=='/api/tags':return httpx.Response(200,json={'models':[{'name':'phi4-mini:3.8b'}]})
        return httpx.Response(200,json=response)
    transport(monkeypatch,handle)
    with pytest.raises(HTTPException) as error:ask_provider(local_settings(env[3]),'synthetic')
    assert error.value.status_code==502


def test_missing_model_never_pulls_or_falls_back(env,monkeypatch):
    calls=[]
    def handle(request):
        calls.append(request.url.path)
        return httpx.Response(200,json={'models':[]})
    transport(monkeypatch,handle)
    with pytest.raises(HTTPException) as error:ask_provider(local_settings(env[3]),'synthetic')
    assert error.value.status_code==503 and calls==['/api/tags']


def test_local_proposal_uses_same_entitlement_and_never_applies_automatically(env,monkeypatch):
    app,c,_,s=env;verified_user(app);login(c)
    s.free_beta=True;s.billing_enabled=False;s.ai_provider='ollama';s.ai_enabled=True
    # TestClient uses testserver; runtime adapter validation remains loopback-only.
    proposed={'name':'Synthetic plate','depth':8,'plane':'XZ','outline':[[0,0],[80,0],[80,50],[0,50]],'holes':[]}
    def handle(request):
        if request.url.path=='/api/tags':return httpx.Response(200,json={'models':[{'name':'phi4-mini:3.8b'}]})
        return httpx.Response(200,json={'done':True,'done_reason':'stop','response':json.dumps(proposed)})
    transport(monkeypatch,handle)
    monkeypatch.setattr(s,'validate',lambda:None)
    row=post(c,'/api/projects',project()).json();url='/api/projects/'+row['id']+'/model-proposal'
    assert post(c,url,{'prompt':'synthetic plate','version':1}).status_code==403
    grant_beta(app.state.Factory,s,'alice@example.com')
    result=post(c,url,{'prompt':'synthetic plate','version':1})
    assert result.status_code==200 and result.json()['applied'] is False
    assert result.json()['provider']=='phi4-mini:3.8b'
    after=c.get('/api/projects').json()[0]
    assert after['version']==1 and after['assembly3d']==project()['assembly3d']
