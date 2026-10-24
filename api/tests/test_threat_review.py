"""Reproduce the submitted report against synthetic local accounts only."""
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select,func
from test_security import env,verified_user,login,post,csrf,PASSWORD
from test_product_teams_ai import paid
from test_assembly import project
from api.models import User,Token,Mail,ProjectMember,ProjectInvitation,now
from api.security import decrypt,digest,action_token,encrypt

def confirmation(app,settings,user_id):
    with app.state.Factory() as db:
        messages=[json.loads(decrypt(settings,m.payload)) for m in db.scalars(select(Mail).where(Mail.user_id==user_id))]
    return next(m['body'].split('token=')[1] for m in messages if m['subject']=='Confirm your Studio sign-in')

def attack_lock(c):
    for _ in range(5):assert login(c,password='incorrect').status_code==401

def test_correct_password_can_recover_without_resetting_password(env):
    app,c,_,s=env;uid=verified_user(app);attack_lock(c)
    response=login(c);assert response.json()['confirmation_required'];assert c.get('/api/me').status_code==401
    raw=confirmation(app,s,uid)
    assert login(c).json()['confirmation_required']
    with app.state.Factory() as db:
        assert db.scalar(select(func.count()).select_from(Token).where(Token.purpose=='confirm-login'))==1
    assert post(c,'/api/auth/confirm-login',{'token':raw}).json()['authenticated']
    assert c.get('/api/me').status_code==200
    assert post(c,'/api/auth/confirm-login',{'token':raw}).status_code==400

@pytest.mark.parametrize('change',['expired','logout-all','reset','banned','unverified'])
def test_confirmation_fails_closed_after_account_security_change(env,change):
    app,c,_,s=env;uid=verified_user(app);attack_lock(c);login(c);raw=confirmation(app,s,uid)
    with app.state.Factory.begin() as db:
        user=db.get(User,uid)
        if change=='expired':db.get(Token,digest(raw)).expires=now()-1
        elif change=='banned':user.banned=True
        elif change=='unverified':user.verified=False
        elif change=='reset':
            token=action_token(db,user,'reset')
        else:
            # Model an already-authenticated second device ending all sessions.
            from api.security import revoke_all
            revoke_all(db,user)
    if change=='reset':assert post(c,'/api/auth/reset',{'token':token,'password':PASSWORD+' changed'}).status_code==200
    assert post(c,'/api/auth/confirm-login',{'token':raw}).status_code==400
    assert c.get('/api/me').status_code==401

def test_enabled_mfa_can_unlock_owner_without_email_challenge(env):
    import pyotp
    app,c,_,s=env;uid=verified_user(app)
    with app.state.Factory.begin() as db:db.get(User,uid).totp=encrypt(s,'JBSWY3DPEHPK3PXP')
    attack_lock(c);r=login(c);assert r.json()['mfa_required']
    assert post(c,'/api/auth/mfa',{'token':r.json()['challenge'],'code':pyotp.TOTP('JBSWY3DPEHPK3PXP').now()}).status_code==200
    assert c.get('/api/me').status_code==200

def test_unknown_or_wrong_password_never_sends_signin_confirmation(env):
    app,c,_,_=env;verified_user(app);attack_lock(c)
    assert login(c,password='still wrong').status_code==401
    assert login(c,'absent@example.com',password='wrong').status_code==401
    with app.state.Factory() as db:assert db.scalar(select(func.count()).select_from(Token).where(Token.purpose=='confirm-login'))==0

def test_parallel_confirmation_consumes_one_token_only_once(env):
    from concurrent.futures import ThreadPoolExecutor
    app,c,_,s=env;uid=verified_user(app);attack_lock(c);login(c);raw=confirmation(app,s,uid);headers=csrf(c);cookies=dict(c.cookies)
    def confirm(_):
        with TestClient(app) as other:
            other.cookies.update(cookies)
            return other.post('/api/auth/confirm-login',json={'token':raw},headers=headers).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:assert sorted(pool.map(confirm,[1,2]))==[200,400]

def test_invitation_observables_do_not_depend_on_account_existence(env):
    app,c,_,_=env;paid(env);guest=verified_user(app,'guest@example.com');verified_user(app,'unverified@example.com')
    with app.state.Factory.begin() as db:db.scalar(select(User).where(User.email=='unverified@example.com')).verified=False
    pid=post(c,'/api/projects',project()).json()['id'];base='/api/team/projects/'+pid
    outputs=[]
    for email in ['guest@example.com','absent@example.com','unverified@example.com']:
        r=post(c,base+'/members',{'email':email,'role':'viewer'});assert r.status_code==202;outputs.append(r.json())
        assert c.get(base+'/members').json()==[]
    assert outputs[0]==outputs[1]==outputs[2]
    pending=c.get(base+'/invitations').json();assert len(pending)==3
    assert all(set(p)=={'id','email','role','expires'} for p in pending)
    with app.state.Factory() as db:assert db.scalar(select(func.count()).select_from(ProjectMember))==0
    login(c,'guest@example.com');assert c.get(base).status_code==404
    assert c.get(base+'/invitations').status_code==404
    assert post(c,base+'/accept').status_code==200
    login(c);members=c.get(base+'/members').json();assert members[0]['user_id']==guest and members[0]['accepted']

@pytest.mark.parametrize('email',['registered@example.com','absent@example.com'])
def test_invitation_capacity_is_identical_for_registered_and_absent_targets(env,email):
    app,c,_,_=env;paid(env);verified_user(app,'registered@example.com');pid=post(c,'/api/projects',project()).json()['id'];base='/api/team/projects/'+pid
    for i in range(9):assert post(c,base+'/members',{'email':f'absent{i}@example.com','role':'editor'}).status_code==202
    # Test a full project without hitting the independent ten/hour invite quota.
    with app.state.Factory.begin() as db:db.add(ProjectInvitation(project_id=pid,email='reserved@example.com',role='viewer',expires=now()+60))
    assert post(c,base+'/members',{'email':email,'role':'editor'}).status_code==409

@pytest.mark.parametrize('state',['cancel','expired','trash'])
def test_invitation_cannot_be_used_after_revocation_or_expiry(env,state):
    app,c,_,_=env;paid(env);verified_user(app,'guest@example.com');pid=post(c,'/api/projects',project()).json()['id'];base='/api/team/projects/'+pid
    post(c,base+'/members',{'email':'guest@example.com','role':'viewer'});pending=c.get(base+'/invitations').json()[0]
    if state=='cancel':assert c.delete(base+'/invitations/'+pending['id'],headers=csrf(c)).status_code==200
    elif state=='expired':
        with app.state.Factory.begin() as db:db.get(ProjectInvitation,pending['id']).expires=now()-1
    else:
        assert c.request('DELETE','/api/projects/'+pid,json={'version':1},headers=csrf(c)).status_code==200
        assert post(c,'/api/projects/'+pid+'/restore',{'version':2}).status_code==200
    login(c,'guest@example.com');assert c.get('/api/team/invitations').json()==[]
    assert post(c,base+'/accept').status_code==404

def test_untrusted_forwarded_header_cannot_change_rate_limit_identity(env):
    app,c,_,_=env;verified_user(app)
    for i in range(20):
        r=c.post('/api/auth/login',json={'email':'unknown@example.com','password':'bad'},headers={**csrf(c),'X-Forwarded-For':f'198.51.100.{i}'})
        assert r.status_code==401
    assert c.post('/api/auth/login',json={'email':'unknown@example.com','password':'bad'},headers={**csrf(c),'X-Forwarded-For':'203.0.113.8'}).status_code==429
