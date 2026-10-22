import copy,json,subprocess
from pathlib import Path
import pytest
from fastapi import HTTPException
from api.assembly_data import validate_assembly
from test_security import env,verified_user,login,post

def recipe():
    return {'version':1,'plane':'XZ','outline':[[-40,-25],[40,-25],[40,25],[-40,25]],'features':[{'id':'hole','name':'Mounting hole','enabled':True,'operation':'subtract','shape':'cylinder','dims':{'diameter':6,'depth':12},'position':[0,0,0],'rotation':[0,0,0],'through':True}]}
def assembly():return {'version':1,'units':'mm','objects':[{'id':'custom','partId':'custom_solid','name':'My solid','dims':{'depth':12},'model':recipe(),'material':'Aluminium 6061','position':[0,0,0],'rotation':[0,0,0],'visible':True,'wireframe':False}]}

@pytest.mark.parametrize('case',['crossed','touch','repeat','zero','too_many_points','too_many_features','duplicate_feature','unknown_model_field','unknown_feature_field','nan','bad_plane','bad_operation','bad_size','bad_through','missing_model','catalogue_model','wrong_type'])
def test_reject_bad_solid(case):
    a=assembly();m=a['objects'][0]['model'];f=m['features'][0]
    if case=='crossed':m['outline']=[[0,0],[10,10],[0,10],[10,0]]
    elif case=='touch':m['outline']=[[0,0],[10,0],[5,0],[5,10]]
    elif case=='repeat':m['outline'].append(m['outline'][0])
    elif case=='zero':m['outline']=[[0,0],[1,0],[2,0]]
    elif case=='too_many_points':m['outline']=[[i,i] for i in range(65)]
    elif case=='too_many_features':m['features']=[{**f,'id':str(i)} for i in range(17)]
    elif case=='duplicate_feature':m['features'].append(copy.deepcopy(f))
    elif case=='unknown_model_field':m['code']='alert(1)'
    elif case=='unknown_feature_field':f['code']='alert(1)'
    elif case=='nan':m['outline'][0][0]=float('nan')
    elif case=='bad_plane':m['plane']='script'
    elif case=='bad_operation':f['operation']='execute'
    elif case=='bad_size':f['dims']['diameter']=0
    elif case=='bad_through':f['operation']='union'
    elif case=='missing_model':del a['objects'][0]['model']
    elif case=='catalogue_model':a['objects'][0].update(partId='plate_flat',dims={'width':80,'height':60,'thickness':3})
    elif case=='wrong_type':m['version']=True
    with pytest.raises(HTTPException) as error:validate_assembly(a)
    assert error.value.status_code==422

def test_solid_recipe_project_and_snapshot_round_trip(env):
    app,c,g,s=env;verified_user(app);login(c)
    root=Path(__file__).resolve().parents[2]
    script="const fs=require('fs'),vm=require('vm'),c=vm.createContext({});for(const p of ['dist/solid-model.js','dist/assembly-data.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);process.stdout.write(vm.runInContext('JSON.stringify(StudioSolidModel.demoAssembly())',c));"
    data=json.loads(subprocess.check_output(['node','-e',script],cwd=root,text=True));validate_assembly(data)
    p={'name':'Custom bracket','material':'Steel','stroke':80,'rod':150,'rpm':600,'parts':[],'notes':[],'revisions':[],'assembly3d':data}
    p['revisions']=[{'label':'Solid checkpoint','date':'2026-10-23','snapshot':copy.deepcopy(p)}]
    response=post(c,'/api/projects',p);assert response.status_code==201,response.text
    row=c.get('/api/projects').json()[0];assert row['assembly3d']==data;assert row['revisions'][0]['snapshot']['assembly3d']==data
    headers=c.get('/api/config').headers
    assert "'wasm-unsafe-eval'" not in headers['Content-Security-Policy']
    assert "'unsafe-eval'" not in headers['Content-Security-Policy']
    assert "'unsafe-eval'" in c.get('/solid-worker.js').headers['Content-Security-Policy']
    assert "'unsafe-eval'" not in c.get('/solid-editor.js').headers['Content-Security-Policy']
