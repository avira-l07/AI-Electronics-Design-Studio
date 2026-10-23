import copy,json
from pathlib import Path
from sqlalchemy import select
from test_security import env,verified_user,login,post,csrf
from test_product_teams_ai import paid
from test_assembly import project
from api.models import ProjectPresence,Subscription,now
from api.solid_data import validate_solid

def setup(env):
    app,c,_,_=env;paid(env);verified_user(app,'guest@example.com');p=project();second=copy.deepcopy(p['assembly3d']['objects'][0]);second['id']='part-2';p['assembly3d']['objects'].append(second);id=post(c,'/api/projects',p).json()['id'];base='/api/team/projects/'+id;post(c,base+'/members',{'email':'guest@example.com','role':'editor'});login(c,'guest@example.com');post(c,base+'/accept');return app,c,base

def patch(c,base,before,**updates):
    after={**copy.deepcopy(before),**updates};return c.patch(base+'/assembly',json={'before':[before],'after':[after]},headers=csrf(c))

def test_independent_changes_merge_same_part_conflicts_and_old_full_saves_fail(env):
    app,c,base=setup(env);original=c.get(base).json()['project'];a,b=original['assembly3d']['objects'];assert patch(c,base,a,name='Guest label').status_code==200
    login(c);assert patch(c,base,b,position=[70,0,0]).status_code==200
    latest=c.get(base).json()['project'];assert latest['assembly3d']['objects'][0]['name']=='Guest label';assert latest['assembly3d']['objects'][1]['position']==[70,0,0]
    assert patch(c,base,a,name='Stale overwrite').status_code==409
    assert c.patch('/api/projects/'+original['id'],json=original,headers=csrf(c)).status_code==409
    invalid=c.patch(base+'/assembly',json={'before':[{'id':[]}],'after':[{'id':[]}]},headers=csrf(c));assert invalid.status_code==422
    assert patch(c,base,latest['assembly3d']['objects'][0],material='Brass').status_code==422
    assert c.get(base).json()['project']==latest

def test_presence_expiry_roles_revocation_and_subscription_checks(env):
    app,c,base=setup(env);pulse={'client_id':'device-a','selected':'part-1'}
    assert post(c,base+'/presence',pulse).json()['peers'][0]['self'] is True
    login(c);owner=post(c,base+'/presence',{'client_id':'owner-tab'}).json();assert {p['name'] for p in owner['peers']}=={'alice','guest'};assert 'email' not in json.dumps(owner)
    post(c,base+'/members',{'email':'guest@example.com','role':'viewer'});login(c,'guest@example.com');assert patch(c,base,c.get(base).json()['project']['assembly3d']['objects'][0],name='No').status_code==403
    with app.state.Factory.begin() as db:
        for row in db.scalars(select(ProjectPresence)):row.updated=now()-61
    assert len(post(c,base+'/presence',pulse).json()['peers'])==1
    login(c);guest_id=c.get(base+'/members').json()[0]['user_id'];assert c.delete(base+'/members/'+guest_id,headers=csrf(c)).status_code==200
    login(c,'guest@example.com');assert post(c,base+'/presence',pulse).status_code==404
    login(c)
    with app.state.Factory.begin() as db:db.get(Subscription,'sub_test').status='canceled'
    assert post(c,base+'/presence',{'client_id':'owner-tab'}).status_code==403

def test_presence_account_deletion_and_csrf(env):
    from test_security import PASSWORD
    app,c,base=setup(env);post(c,base+'/presence',{'client_id':'tab'});assert c.post(base+'/presence',json={'client_id':'tab'}).status_code==403
    assert c.request('DELETE','/api/account',json={'password':PASSWORD},headers=csrf(c)).status_code==200
    with app.state.Factory() as db:assert db.scalar(select(ProjectPresence)) is None

def test_recipe_schema_parity_with_actual_js_generated_models():
    path=Path('tmp/v12/recipes.json')
    if not path.exists():
        # CI runs Python before Node; the same committed fixture is independent of run order.
        path=Path('tests/fixtures/v12-recipes.json')
    for row in json.loads(path.read_text()):
        assert validate_solid(row['model'],row['depth'])
        model=copy.deepcopy(row['model']);model['script']='execute';assert not validate_solid(model,row['depth'])
