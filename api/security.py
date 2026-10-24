import base64, hashlib, hmac, json, secrets, time
import jwt, pyotp
from argon2 import PasswordHasher, Type
from argon2.exceptions import VerificationError, InvalidHashError
from cryptography.fernet import Fernet
from fastapi import HTTPException
from sqlalchemy import select, update
from api.models import User, Session, UsedRefresh, Profile, Subscription, Plan, Token, Audit, Notice, Mail, Rate, now

passwords=PasswordHasher(time_cost=3,memory_cost=65536,parallelism=1,type=Type.ID)
dummy_hash=passwords.hash(secrets.token_urlsafe(32))
def digest(value): return hashlib.sha256(value.encode()).hexdigest()
def random_token(): return secrets.token_urlsafe(48)
def fail(code=401,message='Authentication required'): raise HTTPException(code,message)
def verify_password(encoded,password):
    try: return passwords.verify(encoded or dummy_hash,password)
    except (VerificationError,InvalidHashError): return False
def encrypt(settings,value): return Fernet(settings.encryption_key.encode()).encrypt(value.encode()).decode()
def decrypt(settings,value): return Fernet(settings.encryption_key.encode()).decrypt(value.encode()).decode()
def ip_hash(settings,request): return hmac.new(settings.jwt_key.encode(),request.client.host.encode(),hashlib.sha256).hexdigest()
def audit(db,user,action,request=None,settings=None): db.add(Audit(user_id=user.id if user else None,action=action,ip_hash=ip_hash(settings,request) if request else ''))
def notify(db,settings,user,subject,body,email=True):
    if user.deleted:return
    db.add(Notice(user_id=user.id,message=subject[:1000]))
    if email: db.add(Mail(user_id=user.id,payload=encrypt(settings,json.dumps({'to':user.email,'subject':subject,'body':body}))))
def limit(db,key,maximum=15,seconds=900):
    bucket=now()//seconds;ident=digest(key)+':'+str(bucket)
    dialect=db.bind.dialect.name
    if dialect=='postgresql': from sqlalchemy.dialects.postgresql import insert
    else: from sqlalchemy.dialects.sqlite import insert
    statement=insert(Rate).values(id=ident,count=1,expires=(bucket+2)*seconds)
    statement=statement.on_conflict_do_update(index_elements=['id'],set_={'count':Rate.count+1}).returning(Rate.count)
    count=db.execute(statement).scalar_one()
    if count>maximum:
        db.commit();fail(429,'Too many attempts. Try again later.')
def access_token(settings,user,session):
    return jwt.encode({'sub':user.id,'sid':session.id,'ver':user.epoch,'iat':now(),'exp':now()+300,'iss':settings.origin,'aud':'engineering-studio'},settings.jwt_key,algorithm='HS256')
def decode(settings,token,expired=False):
    try:return jwt.decode(token,settings.jwt_key,algorithms=['HS256'],issuer=settings.origin,audience='engineering-studio',options={'verify_exp':not expired,'require':['exp','iat','sub','sid','ver']})
    except jwt.PyJWTError: fail()
def cookie_name(settings,kind):return ('__Host-studio-' if settings.secure_cookies else 'studio-')+kind
def csrf_binding(settings,request):
    token=request.cookies.get(cookie_name(settings,'access'))
    if not token:return 'anonymous'
    try:return decode(settings,token,expired=True)['sid']
    except HTTPException:return 'anonymous'
def issue_csrf(settings,response,binding='anonymous'):
    value=f'{now()}.{secrets.token_urlsafe(24)}.{binding}'
    signed=value+'.'+hmac.new(settings.jwt_key.encode(),value.encode(),hashlib.sha256).hexdigest()
    response.set_cookie(cookie_name(settings,'csrf'),signed,httponly=False,secure=settings.secure_cookies,samesite='lax',path='/',max_age=7200)
    return signed
def verify_csrf(settings,request):
    if request.headers.get('origin')!=settings.origin:fail(403,'Origin rejected')
    cookie=request.cookies.get(cookie_name(settings,'csrf'),'');header=request.headers.get('x-csrf-token','')
    if not cookie or not hmac.compare_digest(cookie,header):fail(403,'CSRF validation failed')
    try:
        value,signature=cookie.rsplit('.',1);timestamp,nonce,binding=value.split('.',2)
        expected=hmac.new(settings.jwt_key.encode(),value.encode(),hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature,expected) or not 0<=now()-int(timestamp)<7200 or binding!=csrf_binding(settings,request):fail(403,'CSRF expired or invalid')
    except (ValueError,TypeError):fail(403,'CSRF invalid')
def set_auth(settings,response,user,session,raw_refresh):
    for key,value,age in [('access',access_token(settings,user,session),300),('refresh',raw_refresh,max(0,session.expires-now()))]:
        response.set_cookie(cookie_name(settings,key),value,httponly=True,secure=settings.secure_cookies,samesite='lax',path='/',max_age=age)
    issue_csrf(settings,response,session.id)
def clear_auth(settings,response):
    for kind in ['access','refresh','csrf']:response.delete_cookie(cookie_name(settings,kind),path='/',secure=settings.secure_cookies,httponly=kind!='csrf',samesite='lax')
def new_session(db,settings,user,request,response):
    raw=random_token();profile=db.scalar(select(Profile).where(Profile.user_id==user.id).order_by(Profile.created,Profile.id))
    session=Session(user_id=user.id,profile_id=profile.id if profile else None,refresh=digest(raw),expires=now()+30*86400,device=request.headers.get('user-agent','Unknown device')[:200],ip_hash=ip_hash(settings,request))
    db.add(session);db.flush();set_auth(settings,response,user,session,raw)
    audit(db,user,'login.success',request,settings)
    notify(db,settings,user,'New sign-in to your studio','A new session was opened. If this was not you, reset your password and revoke all sessions.')
    return session
def principal(db,settings,request):
    claims=decode(settings,request.cookies.get(cookie_name(settings,'access'),''))
    user=db.scalar(select(User).where(User.id==claims['sub']).with_for_update())
    session=db.scalar(select(Session).where(Session.id==claims['sid']).with_for_update())
    if not user or not session or session.user_id!=user.id or session.revoked or session.expires<=now() or user.epoch!=claims['ver'] or user.banned or user.deleted or not user.verified:fail()
    return user,session
def effective_plan(db,settings,user):
    paid=db.scalar(select(Subscription).where(Subscription.user_id==user.id,Subscription.status.in_(['active','trialing']),Subscription.ends>now(),Subscription.disputed==False,Subscription.refunded_invoice.is_(None),Subscription.price.in_([p for p in [settings.monthly_price,settings.annual_price] if p])))
    return db.get(Plan,'premium' if paid else 'free')
def allowed_profiles(db,settings,user):
    return list(db.scalars(select(Profile).where(Profile.user_id==user.id).order_by(Profile.created,Profile.id).limit(effective_plan(db,settings,user).profile_limit)))
def require_profile(db,settings,user,session):
    profiles=allowed_profiles(db,settings,user)
    if not any(p.id==session.profile_id for p in profiles):fail(403,'Selected profile is unavailable under your current plan. Switch profiles.')
def require_premium(db,settings,user):
    if effective_plan(db,settings,user).id!='premium':fail(403,'An active Premium subscription is required')
def require_admin(user):
    if user.role!='admin':fail(403,'Administrator access required')
def action_token(db,user,purpose,ttl=1800,data=''):
    raw=random_token();db.add(Token(digest=digest(raw),user_id=user.id if user else None,purpose=purpose,expires=now()+ttl,data=data));return raw
def consume_token(db,raw,purpose):
    token=db.scalar(select(Token).where(Token.digest==digest(raw),Token.purpose==purpose).with_for_update())
    if not token or token.used or token.expires<=now():fail(400,'Token expired or invalid')
    token.used=True;return token
def revoke_all(db,user):
    user.epoch+=1;db.execute(update(Session).where(Session.user_id==user.id).values(revoked=True))
    db.execute(update(Token).where(Token.user_id==user.id,Token.purpose.in_(['mfa','confirm-login'])).values(used=True))
def check_otp(settings,user,code):
    if not user.totp:return False
    secret=decrypt(settings,user.totp);step=now()//30
    for candidate in [step-1,step,step+1]:
        if candidate>user.totp_last and hmac.compare_digest(pyotp.TOTP(secret).at(candidate*30),code):user.totp_last=candidate;return True
    recovery=json.loads(user.recovery);hashed=digest(code)
    if hashed in recovery:recovery.remove(hashed);user.recovery=json.dumps(recovery);return True
    return False
