"""Opt-in project collaboration with per-request authorization and optimistic edits."""
import json
from fastapi import Depends,Query
from pydantic import BaseModel,ConfigDict,EmailStr,Field
from sqlalchemy import select,func,delete
from api.models import Project,ProjectMember,ProjectInvitation,ProjectComment,ProjectPresence,Session,User,now
from api.assembly_data import validate_assembly
from api.security import require_profile,fail,limit,audit,effective_plan,recipient_limit
from api.product import require_feature
from api.project_data import project_data

class Invite(BaseModel):
    model_config=ConfigDict(extra='forbid')
    email:EmailStr
    role:str=Field(pattern='^(viewer|editor)$')
class CommentInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    body:str=Field(min_length=1,max_length=2000)
class PresenceInput(BaseModel):
    model_config=ConfigDict(extra='forbid',strict=True)
    client_id:str=Field(pattern=r'^[a-zA-Z0-9_-]{1,64}$')
    selected:str|None=Field(default=None,max_length=80)
class AssemblyEdit(BaseModel):
    model_config=ConfigDict(extra='forbid',strict=True)
    # Object compare-and-swap, independent of unrelated project edits.
    before:list[dict]=Field(min_length=1,max_length=20)
    after:list[dict]=Field(min_length=1,max_length=20)

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
        rows=db.execute(select(ProjectInvitation,Project).join(Project,Project.id==ProjectInvitation.project_id).where(ProjectInvitation.email==who[0].email,ProjectInvitation.expires>now(),Project.trashed==False)).all()
        return [{'project_id':p.id,'name':json.loads(p.data)['name'],'role':m.role} for m,p in rows if (owner:=db.get(User,p.user_id)) and not owner.deleted and not owner.banned and effective_plan(db,s,owner).id=='premium']
    @app.post('/api/team/projects/{id}/accept')
    def accept(id:str,who=Depends(auth),db=Depends(db_session)):
        row=db.scalar(select(Project).where(Project.id==id,Project.trashed==False).with_for_update())
        invitation=db.scalar(select(ProjectInvitation).where(ProjectInvitation.project_id==id,ProjectInvitation.email==who[0].email,ProjectInvitation.expires>now()).with_for_update())
        if not invitation or not row or row.user_id==who[0].id:fail(404,'Invitation unavailable')
        owner=db.get(User,row.user_id)
        if not owner or owner.deleted or owner.banned:fail(404,'Invitation unavailable')
        require_feature(db,s,owner,'team_projects')
        member=db.get(ProjectMember,(id,who[0].id))
        if not member:
            if db.scalar(select(func.count()).select_from(ProjectMember).where(ProjectMember.project_id==id,ProjectMember.accepted==True))>=10:fail(409,'This project supports ten collaborators.')
            db.add(ProjectMember(project_id=id,user_id=who[0].id,role=invitation.role,accepted=True))
        else:member.role=invitation.role;member.accepted=True
        db.delete(invitation);audit(db,who[0],'team.invitation.accepted');return {'accepted':True}
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
    @app.patch('/api/team/projects/{id}/assembly')
    def merge_assembly(id:str,body:AssemblyEdit,who=Depends(auth),db=Depends(db_session)):
        row,role=access(db,who,id,write=True)
        if role=='owner':require_feature(db,s,who[0],'team_projects')
        limit(db,'team-edit:'+who[0].id,240,60)
        data=json.loads(row.data);assembly=data.get('assembly3d')
        if not assembly:fail(409,'This project has no shared assembly yet.')
        if any(not isinstance(v.get('id'),str) for v in body.before+body.after):fail(422,'Part IDs must be strings.')
        before={v.get('id'):v for v in body.before};after={v.get('id'):v for v in body.after}
        if len(before)!=len(body.before) or set(before)!=set(after) or len(after)!=len(body.after) or any(not isinstance(k,str) for k in before):fail(422,'Use matching, unique part IDs.')
        current={v['id']:v for v in assembly['objects']}
        if any(k not in current or current[k]!=v for k,v in before.items()):fail(409,'A selected part changed. Refresh and review your draft; nothing was overwritten.')
        linked={j[k] for j in assembly.get('joints',[]) for k in ['parent','child']}
        for key,value in after.items():
            # Kinematic groups need a shared solver; never detach or corrupt them silently.
            if key in linked:fail(409,'Joint-linked parts must be edited in the owner workspace.')
            if any(value.get(k)!=before[key].get(k) for k in set(value)|set(before[key]) if k not in ['name','position','rotation','visible','wireframe']):fail(422,'Shared edits support name, transform and visibility only.')
        assembly['objects']=[after.get(v['id'],v) for v in assembly['objects']]
        validate_assembly(assembly);row.data=project_data(data);row.version+=1;row.updated=now();audit(db,who[0],'team.assembly.merged')
        return {'project':{**json.loads(row.data),'id':row.id,'version':row.version},'role':role}
    @app.post('/api/team/projects/{id}/presence')
    def presence(id:str,body:PresenceInput,who=Depends(auth),db=Depends(db_session)):
        row,role=access(db,who,id)
        if role=='owner':require_feature(db,s,who[0],'team_projects')
        limit(db,'team-presence:'+who[0].id,120,60)
        ids={v['id'] for v in json.loads(row.data).get('assembly3d',{}).get('objects',[])}
        if body.selected is not None and body.selected not in ids:fail(422,'Selected part no longer exists.')
        # Short-lived rows; a crashed tab expires without a leave message.
        db.execute(delete(ProjectPresence).where(ProjectPresence.updated<now()-60))
        key=(id,who[1].id,body.client_id);entry=db.get(ProjectPresence,key)
        if not entry:
            if db.scalar(select(func.count()).select_from(ProjectPresence).where(ProjectPresence.project_id==id,ProjectPresence.session_id==who[1].id))>=8:fail(429,'Use at most eight shared tabs per session.')
            entry=ProjectPresence(project_id=id,session_id=who[1].id,client_id=body.client_id,user_id=who[0].id);db.add(entry)
        entry.selected=body.selected;entry.updated=now();db.flush()
        rows=db.execute(select(ProjectPresence,User,Session).join(User,User.id==ProjectPresence.user_id).join(Session,Session.id==ProjectPresence.session_id).where(ProjectPresence.project_id==id,ProjectPresence.updated>=now()-20,Session.revoked==False,Session.expires>now(),User.deleted==False,User.banned==False)).all()
        grants={m.user_id for m in db.scalars(select(ProjectMember).where(ProjectMember.project_id==id,ProjectMember.accepted==True))}
        return {'version':row.version,'role':role,'peers':[{'name':u.name,'selected':p.selected,'self':p.session_id==who[1].id and p.client_id==body.client_id} for p,u,_ in rows if u.id==row.user_id or u.id in grants]}
    @app.delete('/api/team/projects/{id}/presence/{client_id}')
    def leave(id:str,client_id:str,who=Depends(auth),db=Depends(db_session)):
        db.execute(delete(ProjectPresence).where(ProjectPresence.project_id==id,ProjectPresence.session_id==who[1].id,ProjectPresence.client_id==client_id));return {'left':True}
    @app.get('/api/team/projects/{id}/members')
    def members(id:str,who=Depends(auth),db=Depends(db_session)):
        access(db,who,id,owner_only=True)
        return [{'user_id':u.id,'email':u.email,'role':m.role,'accepted':True} for m,u in db.execute(select(ProjectMember,User).join(User,User.id==ProjectMember.user_id).where(ProjectMember.project_id==id,ProjectMember.accepted==True)).all()]
    @app.get('/api/team/projects/{id}/invitations')
    def pending_invitations(id:str,who=Depends(auth),db=Depends(db_session)):
        access(db,who,id,owner_only=True)
        return [{'id':r.id,'email':r.email,'role':r.role,'expires':r.expires} for r in db.scalars(select(ProjectInvitation).where(ProjectInvitation.project_id==id,ProjectInvitation.expires>now()))]
    @app.delete('/api/team/projects/{id}/invitations/{invitation_id}')
    def cancel_invitation(id:str,invitation_id:str,who=Depends(auth),db=Depends(db_session)):
        access(db,who,id,owner_only=True)
        db.execute(delete(ProjectInvitation).where(ProjectInvitation.project_id==id,ProjectInvitation.id==invitation_id));audit(db,who[0],'team.invitation.revoked');return {'revoked':True}
    @app.post('/api/team/projects/{id}/members',status_code=202)
    def invite(id:str,body:Invite,who=Depends(auth),db=Depends(db_session)):
        row,_=access(db,who,id,owner_only=True);limit(db,'team-invite:'+who[0].id,10,3600)
        email=str(body.email).lower()
        # An already accepted collaborator has deliberately disclosed membership.
        member=db.scalar(select(ProjectMember).join(User,User.id==ProjectMember.user_id).where(ProjectMember.project_id==id,ProjectMember.accepted==True,User.email==email))
        if member:member.role=body.role
        else:
            invitation=db.scalar(select(ProjectInvitation).where(ProjectInvitation.project_id==id,ProjectInvitation.email==email))
            count=db.scalar(select(func.count()).select_from(ProjectMember).where(ProjectMember.project_id==id,ProjectMember.accepted==True))
            count+=db.scalar(select(func.count()).select_from(ProjectInvitation).where(ProjectInvitation.project_id==id,ProjectInvitation.expires>now()))
            if (not invitation or invitation.expires<=now()) and count>=10:fail(409,'This project supports ten collaborators or pending invitations.')
            recipient_limit(db,email)
            if not invitation:db.add(ProjectInvitation(project_id=id,email=email,role=body.role,expires=now()+7*86400))
            else:invitation.role=body.role;invitation.expires=now()+7*86400
        audit(db,who[0],'team.invitation.created');return {'status':'Invitation saved for this email. The recipient must verify their account and accept in-app. No email was sent.'}
    @app.delete('/api/team/projects/{id}/members/{user_id}')
    def revoke(id:str,user_id:str,who=Depends(auth),db=Depends(db_session)):
        access(db,who,id,owner_only=True);member=db.get(ProjectMember,(id,user_id))
        if member:db.delete(member)
        db.execute(delete(ProjectPresence).where(ProjectPresence.project_id==id,ProjectPresence.user_id==user_id))
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
