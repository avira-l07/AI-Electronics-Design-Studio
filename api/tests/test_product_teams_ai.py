import copy,json,pytest
from fastapi import HTTPException
from sqlalchemy import select
from test_security import env,verified_user,login,post,csrf,subscription,event,PASSWORD
from test_assembly import project
from api.models import Project,ProjectComment,ProjectMember,Subscription
from api.ai_modelling import recipe
from api.config import Settings

def paid(env):
    app,c,g,s=env;id=verified_user(app);login(c);subscription(app,g,id);assert event(c,s,'evt-pro','invoice.paid',{'id':'in_test','customer':'cus_test'}).status_code==200;return id

def test_pro_features_are_server_gated(env):
    app,c,g,s=env;verified_user(app);login(c);p=post(c,'/api/projects',project()).json()
    assert post(c,'/api/projects/'+p['id']+'/model-proposal',{'prompt':'plate','version':1}).status_code==403
    assert post(c,'/api/team/projects/'+p['id']+'/members',{'email':'x@example.com','role':'editor'}).status_code==403
    assert c.get('/api/entitlements').json()['plan']=='free'

def test_ai_proposal_never_mutates_project_and_failures_consume_quota(env,monkeypatch):
    app,c,g,s=env;paid(env);s.ai_enabled=True;s.ai_key='test-placeholder';s.ai_model='configured-model';p=post(c,'/api/projects',project()).json();url='/api/projects/'+p['id']+'/model-proposal'
    proposed={'name':'Plate','depth':8,'plane':'XZ','outline':[[-20,-10],[20,-10],[20,10],[-20,10]],'holes':[{'diameter':4,'u':0,'v':0}]}
    seen=[]
    def provider(*args,**kw):seen.append(kw);return json.dumps(proposed)
    monkeypatch.setattr('api.ai_modelling.ask_provider',provider)
    response=post(c,url,{'prompt':'plate','version':1});assert response.status_code==200;assert response.json()['applied']==False;assert 'schema' in seen[0]
    row=c.get('/api/projects').json()[0];assert row['version']==1 and row['assembly3d']==project()['assembly3d']
    assert post(c,url,{'prompt':'stale','version':2}).status_code==409
    def fail(*a,**kw):raise HTTPException(502,'provider failed')
    monkeypatch.setattr('api.ai_modelling.ask_provider',fail)
    for _ in range(4):assert post(c,url,{'prompt':'plate','version':1}).status_code==502
    assert post(c,url,{'prompt':'plate','version':1}).status_code==429

def test_team_acceptance_roles_conflicts_revoke_and_downgrade(env):
    app,c,g,s=env;owner=paid(env);guest=verified_user(app,'guest@example.com');stranger=verified_user(app,'stranger@example.com');p=post(c,'/api/projects',project()).json();id=p['id'];base='/api/team/projects/'+id
    assert post(c,base+'/members',{'email':'guest@example.com','role':'viewer'}).status_code==202
    login(c,'guest@example.com');assert c.get(base).status_code==404;assert len(c.get('/api/team/invitations').json())==1;assert post(c,base+'/accept').status_code==200
    row=c.get(base).json()['project'];row['name']='Changed';assert c.patch(base,json=row,headers=csrf(c)).status_code==403
    assert post(c,base+'/comments',{'body':'<script>literal review text</script>'}).status_code==201
    assert c.get('/api/account/export').json()['team_comments'][0]['body'].startswith('<script>')
    login(c,'stranger@example.com');assert c.get(base).status_code==404;assert c.get(base+'/comments').status_code==404
    login(c);assert post(c,base+'/members',{'email':'guest@example.com','role':'editor'}).status_code==202
    login(c,'guest@example.com');assert c.patch(base,json=row,headers=csrf(c)).status_code==200;assert c.patch(base,json=row,headers=csrf(c)).status_code==409
    with app.state.Factory.begin() as db:db.get(Subscription,'sub_test').status='canceled'
    assert c.get(base).status_code==403
    with app.state.Factory.begin() as db:db.get(Subscription,'sub_test').status='active'
    login(c);assert c.delete(base+'/members/'+guest,headers=csrf(c)).status_code==200
    login(c,'guest@example.com');assert c.get(base).status_code==404

@pytest.mark.parametrize('change',[{'depth':True},{'outline':[[0,0],[1,1],[0,1],[1,0]]},{'holes':[{'diameter':float('nan'),'u':0,'v':0}]},{'script':'execute'}])
def test_bad_ai_recipes_rejected(change):
    value={'name':'Plate','depth':8,'plane':'XZ','outline':[[0,0],[20,0],[20,20],[0,20]],'holes':[]};value.update(change)
    with pytest.raises(HTTPException):recipe(value)

def test_live_billing_guard(env):
    _,_,_,s=env;s.environment='development';s.stripe_key='sk_live_example';s.webhook_key='whsec_test'
    with pytest.raises(RuntimeError,match='Live billing'):s.validate()
    s.stripe_key='sk_test_example';s.validate();s.annual_price=s.monthly_price
    with pytest.raises(RuntimeError,match='distinct'):s.validate()

def test_collaboration_content_removed_on_account_deletion(env):
    app,c,g,s=env;paid(env);guest=verified_user(app,'guest@example.com');id=post(c,'/api/projects',project()).json()['id'];base='/api/team/projects/'+id
    post(c,base+'/members',{'email':'guest@example.com','role':'viewer'});login(c,'guest@example.com');post(c,base+'/accept');post(c,base+'/comments',{'body':'My private review'})
    assert c.request('DELETE','/api/account',json={'password':PASSWORD},headers=csrf(c)).status_code==200
    with app.state.Factory() as db:
        assert db.scalar(select(ProjectComment).where(ProjectComment.user_id==guest)) is None
        assert db.scalar(select(ProjectMember).where(ProjectMember.user_id==guest)) is None

def test_ai_provider_contract_is_structured_and_has_no_project_side_effects(env,monkeypatch):
    from api.features import ask_provider
    from api.ai_modelling import SCHEMA
    _,_,_,s=env;s.ai_model='configured-model';s.ai_key='never-sent-test-key';seen={}
    class Response:
        status_code=200
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def iter_bytes(self):yield json.dumps({'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':'{"name":"proposal"}'}]}]}).encode()
    class Client:
        def __init__(self,*a,**kw):pass
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def stream(self,method,url,**kw):seen.update(kw['json']);return Response()
    monkeypatch.setattr('api.features.httpx.Client',Client)
    assert ask_provider(s,'plate',schema=SCHEMA)=='{"name":"proposal"}'
    assert seen['store'] is False and seen['text']['format']['strict'] is True and 'tools' not in seen

def test_trash_restore_does_not_reopen_team_grants(env):
    app,c,g,s=env;paid(env);verified_user(app,'guest@example.com');id=post(c,'/api/projects',project()).json()['id'];base='/api/team/projects/'+id
    post(c,base+'/members',{'email':'guest@example.com','role':'viewer'});login(c,'guest@example.com');post(c,base+'/accept');login(c)
    assert c.request('DELETE','/api/projects/'+id,json={'version':1},headers=csrf(c)).status_code==200
    assert post(c,'/api/projects/'+id+'/restore',{'version':2}).status_code==200
    login(c,'guest@example.com');assert c.get(base).status_code==404;assert c.get('/api/team/invitations').json()==[]

def test_production_health_fails_without_migration_record(env):
    app,c,g,s=env;s.environment='production'
    assert c.get('https://testserver/api/health').status_code==503
