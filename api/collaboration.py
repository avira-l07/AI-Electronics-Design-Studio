"""Opt-in project collaboration with per-request authorization and optimistic edits."""
import json
from fastapi import Depends,Query
from pydantic import BaseModel,ConfigDict,EmailStr,Field
from sqlalchemy import select,func
from api.models import Project,ProjectMember,ProjectComment,User,now
from api.security import require_profile,fail,limit,audit,effective_plan
from api.product import require_feature
from api.project_data import project_data

class Invite(BaseModel):
    model_config=ConfigDict(extra='forbid')
    email:EmailStr
    role:str=Field(pattern='^(viewer|editor)$')
class CommentInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    body:str=Field(min_length=1,max_length=2000)

def install_collaboration(app,auth,db_session):
    s=app.state.settings
    def access(db,who,id,owner_only=False,write=False):
        user,session=who;require_profile(db,s,user,session)
        row=db.scalar(select(Project).where(Project.id==id,Project.trashed==False).with_for_update())
        if not row:fail(404,'Project not found')
        if row.user_id==user.id:
            if row.profile_id!=session.profile_id:fail(404,'Project not found')
            if owner_only:require_feature(db,s,user,'team_projects')
            return row,'owner'
        if owner_only:fail(404,'Project not found')
        member=db.get(ProjectMember,(id,user.id));owner=db.get(User,row.user_id)
        if not member or not member.accepted or not owner or owner.deleted or owner.banned:fail(404,'Project not found')
        if effective_plan(db,s,owner).id!='premium':fail(403,'The owner’s Pro plan is required for team access.')
        if write and member.role!='editor':fail(403,'Editor permission required')
        return row,member.role
    @app.get('/api/team/invitations')
    def invitations(who=Depends(auth),db=Depends(db_session)):
        return [{'project_id':p.id,'name':json.loads(p.data)['name'],'role':m.role} for m,p in db.execute(select(ProjectMember,Project).join(Project,Project.id==ProjectMember.project_id).where(ProjectMember.user_id==who[0].id,ProjectMember.accepted==False,Project.trashed==False)).all()]
    @app.post('/api/team/projects/{id}/accept')
    def accept(id:str,who=Depends(auth),db=Depends(db_session)):
        member=db.get(ProjectMember,(id,who[0].id));row=db.get(Project,id)
        if not member or not row or row.trashed:fail(404,'Invitation unavailable')
        owner=db.get(User,row.user_id)
        if not owner or owner.deleted or owner.banned:fail(404,'Invitation unavailable')
        require_feature(db,s,owner,'team_projects');member.accepted=True;audit(db,who[0],'team.invitation.accepted');return {'accepted':True}
    @app.get('/api/team/projects')
    def team_projects(who=Depends(auth),db=Depends(db_session)):
        rows=db.execute(select(ProjectMember,Project).join(Project,Project.id==ProjectMember.project_id).where(ProjectMember.user_id==who[0].id,ProjectMember.accepted==True,Project.trashed==False)).all()
        return [{'id':p.id,'name':json.loads(p.data)['name'],'role':m.role} for m,p in rows if (owner:=db.get(User,p.user_id)) and not owner.deleted and not owner.banned and effective_plan(db,s,owner).id=='premium']
    @app.get('/api/team/projects/{id}')
    def read(id:str,who=Depends(auth),db=Depends(db_session)):
        row,role=access(db,who,id);return {'project':{**json.loads(row.data),'id':row.id,'version':row.version},'role':role}
    @app.patch('/api/team/projects/{id}')
    def edit(id:str,body:dict,who=Depends(auth),db=Depends(db_session)):
        row,_=access(db,who,id,write=True)
        if type(body.get('version'))!=int or body['version']!=row.version:fail(409,'A newer version exists. Fetch it before editing; no overwrite occurred.')
        row.data=project_data(body);row.version+=1;row.updated=now();audit(db,who[0],'team.project.updated');return {'version':row.version}
    @app.get('/api/team/projects/{id}/members')
    def members(id:str,who=Depends(auth),db=Depends(db_session)):
        access(db,who,id,owner_only=True)
        return [{'user_id':u.id,'email':u.email,'role':m.role,'accepted':m.accepted} for m,u in db.execute(select(ProjectMember,User).join(User,User.id==ProjectMember.user_id).where(ProjectMember.project_id==id)).all()]
    @app.post('/api/team/projects/{id}/members',status_code=202)
    def invite(id:str,body:Invite,who=Depends(auth),db=Depends(db_session)):
        row,_=access(db,who,id,owner_only=True);limit(db,'team-invite:'+who[0].id,10,3600)
        target=db.scalar(select(User).where(User.email==str(body.email).lower(),User.verified==True,User.deleted==False,User.banned==False))
        if target and target.id!=row.user_id:
            member=db.get(ProjectMember,(id,target.id))
            if not member:
                if db.scalar(select(func.count()).select_from(ProjectMember).where(ProjectMember.project_id==id))>=10:fail(409,'This project supports ten collaborators.')
                db.add(ProjectMember(project_id=id,user_id=target.id,role=body.role))
            else:member.role=body.role
        audit(db,who[0],'team.invitation.created');return {'status':'If this verified account exists, its in-app invitation is available. No email was sent.'}
    @app.delete('/api/team/projects/{id}/members/{user_id}')
    def revoke(id:str,user_id:str,who=Depends(auth),db=Depends(db_session)):
        access(db,who,id,owner_only=True);member=db.get(ProjectMember,(id,user_id))
        if member:db.delete(member)
        audit(db,who[0],'team.member.revoked');return {'revoked':True}
    @app.get('/api/team/projects/{id}/comments')
    def comments(id:str,offset:int=Query(0,ge=0),who=Depends(auth),db=Depends(db_session)):
        access(db,who,id)
        return [{'id':r.id,'author':u.name,'body':r.body,'created':r.created} for r,u in db.execute(select(ProjectComment,User).join(User,User.id==ProjectComment.user_id).where(ProjectComment.project_id==id).order_by(ProjectComment.created,ProjectComment.id).offset(offset).limit(100)).all()]
    @app.post('/api/team/projects/{id}/comments',status_code=201)
    def comment(id:str,body:CommentInput,who=Depends(auth),db=Depends(db_session)):
        access(db,who,id);limit(db,'team-comment:'+who[0].id,30,3600)
        if not body.body.strip():fail(422,'Comment cannot be blank')
        if db.scalar(select(func.count()).select_from(ProjectComment).where(ProjectComment.project_id==id))>=1000:fail(409,'Project comment capacity reached')
        row=ProjectComment(project_id=id,user_id=who[0].id,body=body.body.strip());db.add(row);db.flush();return {'id':row.id}
