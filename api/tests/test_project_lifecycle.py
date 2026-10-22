import json
from urllib.parse import urlparse,parse_qs
from sqlalchemy import select
from test_security import env,verified_user,login,post,csrf
from api.models import Project,Share,now
from api.project_data import project_data
from fastapi import HTTPException
import pytest

def sample():return {'name':'Test project','kind':'Mechanical assembly','material':'Steel','stroke':80,'rod':150,'rpm':600,'parts':[],'notes':[],'revisions':[],'designType':'slider-crank','currency':'USD'}
def create(c):return post(c,'/api/projects',sample()).json()

@pytest.mark.parametrize('change',[{'name':'   '},{'circuit':{'voltage':1e308,'resistance':1e-300,'rating':1}},{'stroke':2**2000}])
def test_invalid_name_and_non_finite_circuit_result_rejected(change):
    with pytest.raises(HTTPException) as error:
        project_data({**sample(),**change})
    assert error.value.status_code==422

def test_version_checked_updates_and_recoverable_trash(env):
    app,c,g,s=env;verified_user(app);login(c);created=create(c);id=created['id'];assert created['version']==1
    data={**sample(),'version':1,'name':'Updated'}
    assert c.patch('/api/projects/'+id,json=data,headers=csrf(c)).json()['version']==2
    assert c.patch('/api/projects/'+id,json=data,headers=csrf(c)).status_code==409
    assert c.patch('/api/projects/'+id,json=sample(),headers=csrf(c)).status_code==409
    assert c.delete('/api/projects/'+id,headers=csrf(c)).status_code==422
    assert c.request('DELETE','/api/projects/'+id,json={'version':1},headers=csrf(c)).status_code==409
    assert c.request('DELETE','/api/projects/'+id,json={'version':2},headers=csrf(c)).status_code==200
    assert c.get('/api/projects').json()==[]
    trash=c.get('/api/projects?trash=true').json();assert len(trash)==1 and trash[0]['version']==3
    assert post(c,'/api/projects/'+id+'/restore',{'version':3}).json()['version']==4
    assert c.get('/api/projects').json()[0]['name']=='Updated'

def test_trash_and_shares_cannot_cross_accounts(env):
    app,c,g,s=env;verified_user(app);login(c);id=create(c)['id'];verified_user(app,'other@example.com');login(c,'other@example.com')
    assert c.request('DELETE','/api/projects/'+id,json={'version':1},headers=csrf(c)).status_code==404
    assert post(c,'/api/projects/'+id+'/restore',{'version':1}).status_code==404
    assert c.get('/api/projects/'+id+'/shares').status_code==404
    assert post(c,'/api/projects/'+id+'/guide',{'question':'Explain this'}).status_code==404

def test_share_is_snapshot_expiring_and_revocable(env):
    app,c,g,s=env;s.sharing_enabled=True;verified_user(app);login(c);id=create(c)['id']
    share=post(c,'/api/projects/'+id+'/shares',{'version':1,'days':2}).json()
    token=parse_qs(urlparse(share['url']).fragment.split('?',1)[1])['token'][0]
    assert token not in json.dumps(c.get('/api/projects/'+id+'/shares').json())
    assert c.patch('/api/projects/'+id,json={**sample(),'name':'Later','version':1},headers=csrf(c)).status_code==200
    assert c.get('/api/shared',headers={'Authorization':'Bearer '+token}).json()['project']['name']=='Test project'
    assert c.delete('/api/projects/'+id+'/shares/'+share['id'],headers=csrf(c)).status_code==200
    assert c.get('/api/shared',headers={'Authorization':'Bearer '+token}).status_code==404
    share=post(c,'/api/projects/'+id+'/shares',{'version':2}).json();token=parse_qs(urlparse(share['url']).fragment.split('?',1)[1])['token'][0]
    with app.state.Factory.begin() as db:db.get(Share,share['id']).expires=now()-1
    assert c.get('/api/shared',headers={'Authorization':'Bearer '+token}).status_code==404

def test_trashing_revokes_share_and_restore_does_not_reopen_it(env):
    app,c,g,s=env;s.sharing_enabled=True;verified_user(app);login(c);id=create(c)['id']
    share=post(c,'/api/projects/'+id+'/shares',{'version':1}).json();token=parse_qs(urlparse(share['url']).fragment.split('?',1)[1])['token'][0]
    assert c.request('DELETE','/api/projects/'+id,json={'version':1},headers=csrf(c)).status_code==200
    assert post(c,'/api/projects/'+id+'/restore',{'version':2}).status_code==200
    assert c.get('/api/shared',headers={'Authorization':'Bearer '+token}).status_code==404

def test_optional_ai_defaults_off_and_context_is_minimized(env,monkeypatch):
    app,c,g,s=env;verified_user(app);login(c);id=create(c)['id']
    assert post(c,'/api/projects/'+id+'/guide',{'question':'Explain this'}).status_code==503
    s.ai_enabled=True;s.ai_key='test-not-real';s.ai_model='operator-selected-model';calls=[]
    monkeypatch.setattr('api.features.ask_provider',lambda settings,question,context: calls.append((question,context)) or 'Review these assumptions.')
    assert post(c,'/api/projects/'+id+'/guide',{'question':'Explain this'}).json()['context_included']==False
    assert calls[-1][1] is None
    assert post(c,'/api/projects/'+id+'/guide',{'question':'Explain this','include_context':True}).status_code==200
    assert 'notes' not in calls[-1][1] and 'name' not in calls[-1][1]
    assert post(c,'/api/projects/'+id+'/guide',{'question':'Explain this','secret':'invalid'}).status_code==422
    for _ in range(8):assert post(c,'/api/projects/'+id+'/guide',{'question':'Explain'}).status_code==200
    assert post(c,'/api/projects/'+id+'/guide',{'question':'Explain'}).status_code==429

def test_extended_geometry_and_network_validation():
    data={**sample(),'sketch':[{'type':'text','x':5,'y':6,'text':'<script>','layer':'Annotations'},{'type':'dimension','x':5,'y':6,'x2':15,'y2':6}],
          'resistorNetwork':{'mode':'parallel','voltage':12,'resistors':[100,200]}}
    assert json.loads(project_data(data))['sketch'][0]['text']=='<script>'
    for patch in [{'currency':'FAKE'},{'sketch':[{'type':'rect','x':1,'y':1,'w':-2,'h':2}]},{'resistorNetwork':{'mode':'parallel','voltage':12,'resistors':[0]}}]:
        with pytest.raises(HTTPException):project_data({**data,**patch})
