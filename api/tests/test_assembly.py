import copy,json,pytest
from fastapi import HTTPException
from test_security import env,verified_user,login,post,csrf
from api.assembly_data import validate_assembly
from api.project_data import project_data

def assembly():
    return {'version':1,'units':'mm','objects':[{'id':'part-1','partId':'bearing_ball','name':'Bearing','dims':{'outerDiameter':52,'innerDiameter':25,'width':15},'material':'Steel','position':[25,0,-10],'rotation':[0,90,0],'visible':True,'wireframe':False}]}
def project():
    return {'name':'3D test','material':'Steel','stroke':80,'rod':150,'rpm':600,'parts':[],'notes':[],'revisions':[],'assembly3d':assembly()}

def test_assembly_round_trip_versions_export_and_snapshot(env):
    app,c,g,s=env;verified_user(app);login(c)
    p=project();snapshot=copy.deepcopy(p);snapshot.pop('revisions');p['revisions']=[{'label':'3D checkpoint','date':'2026-10-22','snapshot':snapshot}]
    created=post(c,'/api/projects',p);assert created.status_code==201
    row=c.get('/api/projects').json()[0];assert row['assembly3d']==p['assembly3d'];assert row['revisions'][0]['snapshot']['assembly3d']==p['assembly3d']
    row['assembly3d']['objects']=[]
    assert c.patch('/api/projects/'+row['id'],json=row,headers=csrf(c)).status_code==200
    assert c.get('/api/projects').json()[0]['assembly3d']['objects']==[]
    export=c.get('/api/account/export').json();assert 'assembly3d' in json.dumps(export)

@pytest.mark.parametrize('case',['units','nan','position','rotation','wall','unknown','duplicate','count','extra','id'])
def test_invalid_assembly_rejected(case):
    a=assembly();o=a['objects'][0]
    if case=='units':a['units']='scene'
    elif case=='nan':o['dims']['width']=float('nan')
    elif case=='position':o['position']=[2**2000,0,0]
    elif case=='rotation':o['rotation']=[0,99999,0]
    elif case=='wall':o['dims']['innerDiameter']=60
    elif case=='unknown':o['partId']='execute_script'
    elif case=='duplicate':a['objects'].append(copy.deepcopy(o))
    elif case=='count':a['objects']=[{**o,'id':str(i)} for i in range(201)]
    elif case=='extra':o['sourceCode']='alert(1)'
    elif case=='id':o['id']='\"><img>'
    with pytest.raises(HTTPException) as err:validate_assembly(a)
    assert err.value.status_code==422

def test_all_catalogue_defaults_valid_and_bom_key_retained():
    from api.assembly_data import SCHEMA
    for id,dims in SCHEMA['parts'].items():
        a=assembly();a['objects'][0].update(partId=id,dims=dims)
        if id=='custom_solid':a['objects'][0]['model']={'version':1,'plane':'XZ','outline':[[0,0],[20,0],[20,20],[0,20]],'features':[]}
        validate_assembly(a)
    p=project();p['parts']=[{'name':'Bearing','material':'Steel','qty':1,'price':100,'source3dKey':'bounded-key'}]
    assert json.loads(project_data(p))['parts'][0]['source3dKey']=='bounded-key'
