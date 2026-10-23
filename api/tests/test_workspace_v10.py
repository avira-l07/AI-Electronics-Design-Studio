import copy,json,pytest
from fastapi import HTTPException
from test_security import env,verified_user,login,post
from test_assembly import assembly,project
from api.assembly_data import validate_assembly
from api.solid_data import validate_solid

def scene():
    a=assembly();a['objects'][0]['id']='a';a['objects'].append({**copy.deepcopy(a['objects'][0]),'id':'b'})
    a['groups']=[{'id':'group','name':'Motion pair','members':['a','b']}]
    a['joints']=[{'id':'joint','parent':'a','child':'b','type':'hinge','axis':'Y','offset':[30,0,0],'orientation':[0,0,0],'value':45,'min':-90,'max':90}]
    a['objects'].append({'id':'mesh','partId':'imported_mesh','name':'Triangle','dims':{'scale':1},'mesh':{'version':1,'positions':[0,0,0,10,0,0,0,10,0]},'material':'Steel','position':[0,0,0],'rotation':[0,0,0],'visible':True,'wireframe':False})
    return a

def test_cloud_project_round_trip_mesh_groups_joints_and_snapshot(env):
    app,c,_,_=env;verified_user(app);login(c);p=project();p['assembly3d']=scene();snapshot=copy.deepcopy(p);snapshot.pop('revisions');p['revisions']=[{'label':'V10','date':'2026-10-23','snapshot':snapshot}]
    assert post(c,'/api/projects',p).status_code==201
    row=c.get('/api/projects').json()[0];assert row['assembly3d']==p['assembly3d'];assert row['revisions'][0]['snapshot']['assembly3d']==p['assembly3d']
    assert 'imported_mesh' in json.dumps(c.get('/api/account/export').json())

@pytest.mark.parametrize('case',['cycle','missing_parent','duplicate_child','joint_limit','joint_axis','joint_extra','group_overlap','missing_member','mesh_nan','mesh_degenerate','mesh_extra','mesh_scale','wrong_mesh_part','mesh_aggregate'])
def test_v10_malformed_assembly_rejected(case):
    a=scene();j=a['joints'][0];m=a['objects'][2]
    if case=='cycle':a['joints'].append({**j,'id':'cycle','parent':'b','child':'a'})
    elif case=='missing_parent':j['parent']='missing'
    elif case=='duplicate_child':a['joints'].append({**j,'id':'duplicate'})
    elif case=='joint_limit':j['value']=100
    elif case=='joint_axis':j['axis']='eval'
    elif case=='joint_extra':j['script']='no'
    elif case=='group_overlap':a['groups'].append({'id':'two','name':'Other','members':['a','b']})
    elif case=='missing_member':a['groups'][0]['members'][1]='missing'
    elif case=='mesh_nan':m['mesh']['positions'][0]=float('nan')
    elif case=='mesh_degenerate':m['mesh']['positions']=[0]*9
    elif case=='mesh_extra':m['mesh']['script']='no'
    elif case=='mesh_scale':m['dims']['scale']=21
    elif case=='wrong_mesh_part':a['objects'][0]['mesh']=m['mesh']
    elif case=='mesh_aggregate':
        m['mesh']['positions']*=6000
        a['objects'].extend([{**copy.deepcopy(m),'id':'mesh2'},{**copy.deepcopy(m),'id':'mesh3'}])
    with pytest.raises(HTTPException) as err:validate_assembly(a)
    assert err.value.status_code==422

def model():
    return {'version':1,'plane':'XZ','outline':[[10,0],[20,0],[20,30],[10,30]],'features':[],
            'base':{'type':'revolve','angle':360,'twist':0,'scale':1},
            'constraints':[{'type':'vertical','a':1,'b':2,'value':0},{'type':'fixed','a':0,'value':[10,0]}],
            'modifiers':[{'type':'mirror','axis':'U'},{'type':'pattern','count':2,'step':[50,0,0]}]}

def test_extended_recipe_is_valid():assert validate_solid(model(),12)

@pytest.mark.parametrize('case',['constraint_residual','constraint_index','constraint_length','base_radius','base_angle','base_scale','modifier_count','modifier_axis','modifier_zero','modifier_instances'])
def test_invalid_extended_recipes_rejected(case):
    m=model()
    if case=='constraint_residual':m['constraints'][1]['value']=[0,0]
    elif case=='constraint_index':m['constraints'][0]['a']=99
    elif case=='constraint_length':m['constraints'][0].update(type='length',value=-1)
    elif case=='base_radius':m['outline'][3][0]=-10
    elif case=='base_angle':m['base']['angle']=361
    elif case=='base_scale':m['base']['scale']=0
    elif case=='modifier_count':m['modifiers'][1]['count']=9
    elif case=='modifier_axis':m['modifiers'][0]['axis']='Q'
    elif case=='modifier_zero':m['modifiers'][1]['step']=[0,0,0]
    elif case=='modifier_instances':m['modifiers']=[{'type':'pattern','count':8,'step':[50,0,0]}]*2
    assert not validate_solid(m,12)
