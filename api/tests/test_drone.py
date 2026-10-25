"""Check the actual frontend starter against the server trust boundary."""
import json, subprocess
from pathlib import Path
from api.project_data import project_data
from test_security import env,verified_user,login,post

def test_complete_drone_persists_through_api(env):
    root=Path(__file__).resolve().parents[2]
    script="""
const fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({structuredClone});
for(const path of ['dist/solid-model.js','dist/assembly-data.js','dist/drone-template.js'])vm.runInContext(fs.readFileSync(path,'utf8'),context);
process.stdout.write(vm.runInContext('JSON.stringify(StudioDrone.projectData())',context));
"""
    data=json.loads(subprocess.check_output(['node','-e',script],cwd=root,text=True))
    data.update(name='Quadcopter assembly',material='Steel',stroke=80,rod=150,rpm=600,notes=[],revisions=[])
    assert len(data['assembly3d']['objects'])==136
    assert sum(row['qty'] for row in data['parts'])==136
    assert json.loads(project_data(data))['assembly3d']==data['assembly3d']
    app,c,g,s=env;verified_user(app);login(c)
    response=post(c,'/api/projects',data)
    assert response.status_code==201,response.text
    saved=c.get('/api/projects').json()[0]
    assert saved['assembly3d']==data['assembly3d']
    assert saved['parts']==data['parts']

def test_bumper_rejects_impossible_walls():
    import pytest
    from fastapi import HTTPException
    from api.assembly_data import validate_assembly
    item=dict(id='bumper',partId='arm_bumper',name='Bumper',dims=dict(diameter=33,height=12,thickness=2),material='ABS polymer',position=[0,0,0],rotation=[0,0,0],visible=True,wireframe=False)
    assembly=dict(version=1,units='mm',objects=[item])
    validate_assembly(assembly)
    for thickness in [12,17]:
        item['dims']['thickness']=thickness
        with pytest.raises(HTTPException) as error:validate_assembly(assembly)
        assert error.value.status_code==422
