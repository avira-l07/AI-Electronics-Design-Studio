"""AI proposes bounded data; geometry evaluation and user acceptance happen in the editor."""
from fastapi import Depends
from pydantic import BaseModel,ConfigDict,Field
from sqlalchemy import select
from api.models import Project
from api.security import require_profile,fail,limit,audit
from api.product import require_feature
from api.solid_data import validate_solid
from api.features import ask_provider
import json

SCHEMA={'type':'object','additionalProperties':False,'required':['name','depth','plane','outline','holes'],'properties':{
    'name':{'type':'string'},'depth':{'type':'number'},'plane':{'type':'string','enum':['XZ','XY','YZ']},
    'outline':{'type':'array','items':{'type':'array','items':{'type':'number'},'minItems':2,'maxItems':2},'minItems':3,'maxItems':32},
    'holes':{'type':'array','maxItems':8,'items':{'type':'object','additionalProperties':False,'required':['diameter','u','v'],'properties':{k:{'type':'number'} for k in ['diameter','u','v']}}}}}

def recipe(value):
    if not isinstance(value,dict) or set(value)!={'name','depth','plane','outline','holes'} or not isinstance(value['name'],str) or not value['name'].strip() or len(value['name'])>80 or not isinstance(value['holes'],list) or len(value['holes'])>8:fail(422,'AI proposal is not a supported modelling recipe.')
    model={'version':1,'plane':value['plane'],'outline':value['outline'],'features':[]}
    for i,h in enumerate(value['holes']):
        if not isinstance(h,dict) or set(h)!={'diameter','u','v'}:fail(422,'Invalid proposed hole.')
        model['features'].append({'id':'ai-hole-'+str(i),'name':'Proposed hole '+str(i+1),'enabled':True,'operation':'subtract','shape':'cylinder','dims':{'diameter':h['diameter'],'depth':value['depth']},'position':[h['u'],h['v'],0],'rotation':[0,0,0],'through':True})
    if not validate_solid(model,value['depth']):fail(422,'AI proposal contains invalid geometry parameters.')
    return {'name':value['name'].strip(),'depth':value['depth'],'model':model}

class ProposalInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    prompt:str=Field(min_length=1,max_length=2000)
    version:int=Field(ge=1)

def install_ai_modelling(app,auth,db_session):
    s=app.state.settings
    @app.post('/api/projects/{id}/model-proposal')
    def propose(id:str,body:ProposalInput,who=Depends(auth),db=Depends(db_session)):
        user,session=who;require_profile(db,s,user,session);require_feature(db,s,user,'ai_modelling')
        row=db.scalar(select(Project).where(Project.id==id,Project.user_id==user.id,Project.profile_id==session.profile_id,Project.trashed==False))
        if not row:fail(404,'Project not found')
        if row.version!=body.version:fail(409,'Project changed. Reload before requesting another proposal.')
        if not s.ai_enabled or not s.ai_key or not s.ai_model:fail(503,'AI modelling is not configured.')
        # Commit quota before the remote request so failures cannot bypass cost controls.
        limit(db,'ai-model:'+user.id,5,3600);audit(db,user,'ai.model.requested');db.commit()
        text=ask_provider(s,body.prompt,schema=SCHEMA)
        try:proposal=recipe(json.loads(text))
        except (ValueError,TypeError,KeyError):fail(502,'AI returned an invalid proposal. No project was changed.')
        return {'proposal':proposal,'project_version':body.version,'applied':False,'provider':s.ai_model}
