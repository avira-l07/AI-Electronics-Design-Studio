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
for(const path of ['dist/assembly-data.js','dist/drone-template.js'])vm.runInContext(fs.readFileSync(path,'utf8'),context);
process.stdout.write(vm.runInContext('JSON.stringify(StudioDrone.projectData())',context));
"""
    data=json.loads(subprocess.check_output(['node','-e',script],cwd=root,text=True))
    data.update(name='Quadcopter assembly',material='Steel',stroke=80,rod=150,rpm=600,notes=[],revisions=[])
    assert len(data['assembly3d']['objects'])==120
    assert sum(row['qty'] for row in data['parts'])==120
    assert json.loads(project_data(data))['assembly3d']==data['assembly3d']
    app,c,g,s=env;verified_user(app);login(c)
    response=post(c,'/api/projects',data)
    assert response.status_code==201,response.text
    saved=c.get('/api/projects').json()[0]
    assert saved['assembly3d']==data['assembly3d']
    assert saved['parts']==data['parts']
