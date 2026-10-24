import base64, hashlib, hmac, json, secrets
from pathlib import Path
from urllib.parse import urlencode
import httpx, pyotp
from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import select, update, delete, func, text
from sqlalchemy.exc import IntegrityError
from api.config import Settings
from api.models import *
from api.security import *
from api.billing import StripeGateway, process_event, sync_subscription
from api.project_data import project_data
from api.middleware import BodyLimitMiddleware
from api.static_files import PublicFrontend

class Input(BaseModel):model_config=ConfigDict(extra='forbid')
class Signup(Input):
    email:EmailStr
    password:str=Field(min_length=12,max_length=128)
    name:str=Field(min_length=1,max_length=100)
class Login(Input):
    email:EmailStr
    password:str=Field(max_length=128)
class EmailInput(Input):email:EmailStr
class TokenInput(Input):token:str=Field(min_length=20,max_length=200)
class Reset(TokenInput):password:str=Field(min_length=12,max_length=128)
class ProfileInput(Input):
    name:str=Field(min_length=1,max_length=100)
    bio:str=Field(default='',max_length=1000)
class Credentials(Input):
    password:str=Field(default='',max_length=128)
    code:str=Field(default='',max_length=100)
class OTPInput(TokenInput):code:str=Field(min_length=6,max_length=100)
class CodeInput(Input):code:str=Field(min_length=6,max_length=100)
class CheckoutInput(Input):period:str=Field(pattern='^(monthly|annual)$')
class BanInput(Input):banned:bool

def create_app(settings=None,gateway=None):
    s=settings or Settings();s.validate();engine,Factory=database(s.database_url)
    app=FastAPI(title='Engineering Studio API',docs_url='/api/docs' if s.environment!='production' else None,redoc_url=None,openapi_url='/api/openapi.json' if s.environment!='production' else None)
    app.state.settings=s;app.state.engine=engine;app.state.Factory=Factory;app.state.gateway=gateway or StripeGateway(s)
    if s.free_beta:
        from api.middleware import FreeBetaCapacity
        app.add_middleware(FreeBetaCapacity)
    if s.inline_mail:
        from api.mail_delivery import RequestOutbox
        app.add_middleware(RequestOutbox,factory=Factory,settings=s)
    app.add_middleware(CORSMiddleware,allow_origins=[s.origin],allow_credentials=True,allow_methods=['GET','POST','PATCH','DELETE'],allow_headers=['Content-Type','X-CSRF-Token'])
    from urllib.parse import urlparse
    app.add_middleware(TrustedHostMiddleware,allowed_hosts=[urlparse(s.origin).hostname,'testserver'] if s.environment=='test' else [urlparse(s.origin).hostname])
    app.add_middleware(BodyLimitMiddleware)

    @app.middleware('http')
    async def hardening(request,call_next):
        try:
            if int(request.headers.get('content-length','0'))>1024*1024:return JSONResponse({'detail':'Request too large'},413)
        except ValueError:return JSONResponse({'detail':'Invalid Content-Length'},400)
        if s.environment=='production' and request.url.scheme!='https':return JSONResponse({'detail':'HTTPS required'},400)
        if request.url.path.startswith('/api/') and request.method not in ['GET','HEAD','OPTIONS'] and request.url.path!='/api/payments/webhook':
            try:verify_csrf(s,request)
            except HTTPException as e:return JSONResponse({'detail':e.detail},e.status_code)
        if request.url.path.startswith('/api/') and request.method in ['POST','PATCH','DELETE'] and request.url.path!='/api/payments/webhook':
            scope=request.url.path
            if scope.startswith('/api/projects'):scope='/api/projects'
            live=scope.startswith('/api/team/projects/') and scope.endswith(('/presence','/assembly'))
            if live:scope='/api/team/live'
            cap=6000 if live else 1000 if scope=='/api/projects' else 5 if scope.endswith(('/forgot','/resend')) else 6 if scope.endswith('/signup') else 120 if scope.endswith('/refresh') else 20
            # SQLite can wait on another request's transaction. Never block the
            # ASGI event loop: that request needs it to complete and release locks.
            def enforce_request_limit():
                with Factory() as guard:
                    limit(guard,ip_hash(s,request)+scope,cap);guard.commit()
            try:await run_in_threadpool(enforce_request_limit)
            except HTTPException as e:return JSONResponse({'detail':e.detail},e.status_code)
        response=await call_next(request)
        response.headers['X-Content-Type-Options']='nosniff';response.headers['X-Frame-Options']='DENY';response.headers['Referrer-Policy']='no-referrer';response.headers['Permissions-Policy']='camera=(), microphone=(), geolocation=()'
        response.headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
        if request.url.path=='/solid-worker.js':response.headers['Content-Security-Policy']="default-src 'none'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; connect-src 'self'"
        if s.secure_cookies:response.headers['Strict-Transport-Security']='max-age=31536000; includeSubDomains'
        if request.url.path.startswith('/api/'):response.headers['Cache-Control']='no-store'
        return response

    def db_session():
        db=Factory()
        try:
            if engine.dialect.name=='sqlite':db.execute(text('BEGIN IMMEDIATE'))
            yield db;db.commit()
        except Exception:db.rollback();raise
        finally:db.close()
    def auth(request:Request,db=Depends(db_session)):return principal(db,s,request)
    def locked_user(db,id):return db.scalar(select(User).where(User.id==id).with_for_update())
    def rate(db,request,scope,max=30):pass  # Persistent IP limits run before request transactions.
    def recent(user,session):
        if now()-session.authenticated>300:fail(403,'Reauthentication required')
    def reauthenticate(user,credentials):
        if not user.password or not verify_password(user.password,credentials.password):fail(403,'Password reauthentication required')
        if user.totp and not check_otp(s,user,credentials.code):fail(403,'Second factor required')
    def login_result(db,user,request,response):
        if user.totp:
            challenge=action_token(db,user,'mfa',300);return {'mfa_required':True,'challenge':challenge}
        new_session(db,s,user,request,response);return {'authenticated':True}
    def public_user(db,user,session):
        plan=effective_plan(db,s,user);profiles=list(db.scalars(select(Profile).where(Profile.user_id==user.id).order_by(Profile.created,Profile.id)));eligible={p.id for p in profiles[:plan.profile_limit]}
        return {'id':user.id,'name':user.name,'email':user.email,'role':user.role,'plan':plan.id,'profile_limit':plan.profile_limit,'active_profile':session.profile_id,'mfa_enabled':bool(user.totp),'profiles':[{'id':p.id,'name':p.name,'bio':p.bio,'available':p.id in eligible} for p in profiles]}

    @app.get('/api/config')
    def config():return {'mode':'server','free_beta':s.free_beta,'demo_mode':bool(getattr(app.state,'local_demo',False)),'google_enabled':bool(s.google_client and s.google_secret),'payments_enabled':bool(s.billing_enabled and s.stripe_key and s.webhook_key and s.monthly_price and s.annual_price),'trial_days':s.trial_days,'ai_enabled':s.ai_ready,'ai_provider':s.ai_provider if s.ai_ready else None,'sharing_enabled':s.sharing_enabled}
    @app.get('/api/csrf')
    def csrf(request:Request,response:Response):return {'token':issue_csrf(s,response,csrf_binding(s,request))}
    @app.post('/api/auth/signup',status_code=202)
    def signup(body:Signup,request:Request,db=Depends(db_session)):
        rate(db,request,'signup',6);email=str(body.email).lower();user=db.scalar(select(User).where(User.email==email))
        if not user:
            user=User(email=email,name=body.name,password=passwords.hash(body.password));db.add(user);db.flush();db.add(Profile(user_id=user.id,name=body.name))
            raw=action_token(db,user,'verify',86400);notify(db,s,user,'Verify your Studio email',s.origin+'/#/verify?token='+raw);audit(db,user,'signup',request,s)
        else:verify_password(dummy_hash,body.password)
        return {'message':'If this address is eligible, a verification email will arrive.'}
    @app.post('/api/auth/verify')
    def verify(body:TokenInput,request:Request,db=Depends(db_session)):
        rate(db,request,'verify',20);user,token=account_token(db,body.token,'verify')
        if not token or token.used or token.expires<=now():fail(400,'Token expired or invalid')
        if not user or user.deleted:fail(400,'Token expired or invalid')
        token.used=True;user.verified=True;audit(db,user,'email.verified',request,s);return {'verified':True}
    @app.post('/api/auth/resend',status_code=202)
    def resend(body:EmailInput,request:Request,db=Depends(db_session)):
        rate(db,request,'resend',5);user=db.scalar(select(User).where(User.email==str(body.email).lower()))
        if user and not user.verified and not user.deleted:
            raw=action_token(db,user,'verify',86400);notify(db,s,user,'Verify your Studio email',s.origin+'/#/verify?token='+raw)
        return {'message':'If eligible, a verification email will arrive.'}
    @app.post('/api/auth/login')
    def login(body:Login,request:Request,response:Response,db=Depends(db_session)):
        rate(db,request,'login',30);user=db.scalar(select(User).where(User.email==str(body.email).lower()).with_for_update())
        valid=verify_password(user.password if user else None,body.password)
        if not user or not valid or user.deleted or user.banned:
            if user and user.locked_until<=now():
                user.failures+=1
                if user.failures>=5:user.locked_until=now()+900
                audit(db,user,'login.failed',request,s)
                if user.failures==5:notify(db,s,user,'Unsuccessful sign-in attempts detected','Repeated unsuccessful attempts were detected. You can still sign in with your password and an email confirmation or your enabled second factor. Reset your password if these attempts were not yours.')
            db.commit();fail(401,'Invalid credentials or account unavailable')
        if not user.verified:fail(403,'Verify your email before signing in')
        # Keep account-wide attack detection without allowing an unknown party
        # to deny the owner access. A correct password can use a bound factor.
        if user.locked_until>now():
            if user.totp:return login_result(db,user,request,response)
            pending=db.scalar(select(Token).where(Token.user_id==user.id,Token.purpose=='confirm-login',Token.used==False,Token.expires>now()))
            if not pending:
                raw=action_token(db,user,'confirm-login',s.login_confirmation_ttl,str(user.epoch))
                notify(db,s,user,'Confirm your Studio sign-in','Someone entered your correct password after unsuccessful attempts. Only continue if you are signing in. This link opens a session in the browser where you confirm it. Use it within '+str(s.login_confirmation_ttl//60)+' minutes of your request: '+s.origin+'/#/confirm-login?token='+raw)
            return {'confirmation_required':True,'message':'Check your email to confirm this sign-in. Links expire '+str(s.login_confirmation_ttl//60)+' minutes after they are requested; requesting again does not replace an unexpired link. If mail is delayed, use your enabled authenticator or password recovery and contact support.'}
        user.failures=0;user.locked_until=0
        if passwords.check_needs_rehash(user.password):user.password=passwords.hash(body.password)
        return login_result(db,user,request,response)
    @app.post('/api/auth/confirm-login')
    def confirm_login(body:TokenInput,request:Request,response:Response,db=Depends(db_session)):
        # Lock the account before its token, matching session revocation/reset.
        # Read only the ID initially, avoiding a stale cached Token on a retry.
        user,token=account_token(db,body.token,'confirm-login')
        if not token or token.used or token.expires<=now() or not user or user.deleted or user.banned or not user.verified or token.data!=str(user.epoch):fail(400,'Sign-in confirmation expired or invalid')
        token.used=True
        user.failures=0;user.locked_until=0;audit(db,user,'login.email_confirmed',request,s)
        return login_result(db,user,request,response)
    @app.post('/api/auth/mfa')
    def finish_mfa(body:OTPInput,request:Request,response:Response,db=Depends(db_session)):
        rate(db,request,'mfa',10);user,token=account_token(db,body.token,'mfa')
        if not token or token.used or token.expires<=now():fail(401,'Challenge expired')
        if not user or user.banned or user.deleted or not user.verified or not check_otp(s,user,body.code):
            token.attempts+=1
            if token.attempts>=5:token.used=True
            db.commit();fail(401,'Invalid second factor')
        token.used=True;user.failures=0;user.locked_until=0;new_session(db,s,user,request,response);return {'authenticated':True}
    @app.post('/api/auth/refresh')
    def refresh(request:Request,response:Response,db=Depends(db_session)):
        rate(db,request,'refresh',120);hashed=digest(request.cookies.get(cookie_name(s,'refresh'),''))
        candidate=db.scalar(select(Session).where(Session.refresh==hashed))
        if candidate:locked_user(db,candidate.user_id)
        session=db.scalar(select(Session).where(Session.refresh==hashed).with_for_update().execution_options(populate_existing=True))
        if not session:
            used=db.get(UsedRefresh,hashed)
            if used:
                old=db.get(Session,used.session_id)
                if old:old.revoked=True;audit(db,db.get(User,old.user_id),'refresh.replay',request,s)
                db.commit()
            fail()
        user=locked_user(db,session.user_id)
        if session.revoked or session.expires<=now() or user.banned or user.deleted or not user.verified:fail()
        db.add(UsedRefresh(digest=hashed,session_id=session.id,expires=session.expires));raw=random_token();session.refresh=digest(raw);set_auth(s,response,user,session,raw);return {'refreshed':True}
    @app.post('/api/auth/logout')
    def logout(response:Response,who=Depends(auth),db=Depends(db_session)):
        user,session=who;session.revoked=True;clear_auth(s,response);return {'logged_out':True}
    @app.post('/api/auth/logout-all')
    def logout_all(response:Response,who=Depends(auth),db=Depends(db_session)):
        user,_=who;revoke_all(db,user);clear_auth(s,response);audit(db,user,'logout.everywhere');return {'logged_out':True}
    @app.post('/api/auth/forgot',status_code=202)
    def forgot(body:EmailInput,request:Request,db=Depends(db_session)):
        rate(db,request,'forgot',5);user=db.scalar(select(User).where(User.email==str(body.email).lower()).with_for_update())
        if user and not user.deleted and user.password:
            raw=action_token(db,user,'reset',1800);notify(db,s,user,'Reset your Studio password',s.origin+'/#/reset?token='+raw)
        return {'message':'If eligible, a reset email will arrive.'}
    @app.post('/api/auth/reset')
    def reset(body:Reset,request:Request,response:Response,db=Depends(db_session)):
        rate(db,request,'reset',10);user,token=account_token(db,body.token,'reset')
        if not token or token.used or token.expires<=now():fail(400,'Token expired or invalid')
        if not user or user.deleted:fail(400,'Token expired or invalid')
        token.used=True
        user.password=passwords.hash(body.password);user.failures=0;user.locked_until=0;revoke_all(db,user)
        db.execute(update(Token).where(Token.user_id==user.id,Token.purpose.in_(['reset','mfa'])).values(used=True));clear_auth(s,response);audit(db,user,'password.reset',request,s);notify(db,s,user,'Your password changed','All sessions were revoked. If this was not you, contact support.');return {'reset':True}
    @app.get('/api/me')
    def me(who=Depends(auth),db=Depends(db_session)):return public_user(db,*who)
    @app.post('/api/auth/reauth')
    def reauth(body:Credentials,request:Request,who=Depends(auth),db=Depends(db_session)):
        rate(db,request,'reauth',10);user,session=who;reauthenticate(user,body);session.authenticated=now();return {'reauthenticated':True}
    @app.post('/api/profiles',status_code=201)
    def create_profile(body:ProfileInput,who=Depends(auth),db=Depends(db_session)):
        user,_=who;count=db.scalar(select(func.count()).select_from(Profile).where(Profile.user_id==user.id));plan=effective_plan(db,s,user)
        if count>=plan.profile_limit:fail(403,'Profile limit reached for your current plan')
        row=Profile(user_id=user.id,name=body.name,bio=body.bio);db.add(row);db.flush();audit(db,user,'profile.created');return {'id':row.id,'name':row.name}
    @app.patch('/api/profiles/{id}')
    def edit_profile(id:str,body:ProfileInput,who=Depends(auth),db=Depends(db_session)):
        user,_=who;profile=db.scalar(select(Profile).where(Profile.id==id,Profile.user_id==user.id))
        if not profile:fail(404,'Profile not found')
        profile.name=body.name;profile.bio=body.bio;return {'saved':True}
    @app.post('/api/profiles/{id}/switch')
    def switch_profile(id:str,who=Depends(auth),db=Depends(db_session)):
        user,session=who
        if id not in [p.id for p in allowed_profiles(db,s,user)]:fail(403,'Profile unavailable')
        session.profile_id=id;audit(db,user,'profile.switched');return {'active_profile':id}
    @app.delete('/api/profiles/{id}')
    def delete_profile(id:str,who=Depends(auth),db=Depends(db_session)):
        user,session=who;recent(user,session);profiles=list(db.scalars(select(Profile).where(Profile.user_id==user.id).order_by(Profile.created,Profile.id)))
        if len(profiles)<=1:fail(400,'Keep at least one profile')
        profile=next((p for p in profiles if p.id==id),None)
        if not profile:fail(404,'Profile not found')
        db.execute(delete(Project).where(Project.profile_id==id,Project.user_id==user.id));fallback=next(p for p in profiles if p.id!=id);db.execute(update(Session).where(Session.user_id==user.id,Session.profile_id==id).values(profile_id=fallback.id));db.delete(profile);audit(db,user,'profile.deleted');return {'deleted':True}
    @app.get('/api/workspace')
    def workspace(who=Depends(auth),db=Depends(db_session)):
        require_profile(db,s,*who);return {'authorized':True,'profile_id':who[1].profile_id}
    @app.get('/api/premium')
    def premium(who=Depends(auth),db=Depends(db_session)):
        from api.product import PLANS
        require_premium(db,s,who[0]);require_profile(db,s,*who);return {'authorized':True,'profile_limit':5,'features':PLANS['premium']['features']}
    @app.get('/api/entitlements')
    def account_entitlements(who=Depends(auth),db=Depends(db_session)):
        from api.product import entitlements
        return entitlements(db,s,who[0])
    @app.get('/api/projects')
    def projects(trash:bool=False,who=Depends(auth),db=Depends(db_session)):
        user,session=who;require_profile(db,s,user,session)
        return [{**json.loads(p.data),'id':p.id,'version':p.version} for p in db.scalars(select(Project).where(Project.user_id==user.id,Project.profile_id==session.profile_id,Project.trashed==trash).order_by(Project.updated.desc()))]
    @app.post('/api/projects',status_code=201)
    def create_project(body:dict,who=Depends(auth),db=Depends(db_session)):
        user,session=who;require_profile(db,s,user,session)
        if db.scalar(select(func.count()).select_from(Project).where(Project.user_id==user.id))>=1000:fail(403,'Account project capacity reached')
        row=Project(user_id=user.id,profile_id=session.profile_id,data=project_data(body));db.add(row);db.flush();return {'id':row.id,'version':row.version}
    @app.patch('/api/projects/{id}')
    def update_project(id:str,body:dict,who=Depends(auth),db=Depends(db_session)):
        user,session=who;require_profile(db,s,user,session)
        row=db.scalar(select(Project).where(Project.id==id,Project.user_id==user.id,Project.profile_id==session.profile_id,Project.trashed==False).with_for_update())
        if not row:fail(404,'Project not found')
        if type(body.get('version'))!=int or body['version']!=row.version:fail(409,'A newer project version exists. Export your edits, then reload the server version.')
        row.data=project_data(body);row.updated=now();row.version+=1;return {'saved':True,'version':row.version}
    @app.get('/api/sessions')
    def sessions(who=Depends(auth),db=Depends(db_session)):
        user,current=who;rows=db.scalars(select(Session).where(Session.user_id==user.id,Session.revoked==False,Session.expires>now()))
        return [{'id':row.id,'device':row.device,'created':row.created,'expires':row.expires,'current':row.id==current.id} for row in rows]
    @app.delete('/api/sessions/{id}')
    def revoke_session(id:str,who=Depends(auth),db=Depends(db_session)):
        row=db.scalar(select(Session).where(Session.id==id,Session.user_id==who[0].id))
        if not row:fail(404,'Session not found')
        row.revoked=True;audit(db,who[0],'session.revoked');return {'revoked':True}
    @app.post('/api/mfa/setup')
    def mfa_setup(who=Depends(auth),db=Depends(db_session)):
        user,session=who;recent(user,session)
        if user.totp:fail(409,'Two-factor authentication is already enabled')
        secret=pyotp.random_base32();user.totp_pending=encrypt(s,json.dumps({'secret':secret,'expires':now()+600}));return {'secret':secret,'uri':pyotp.TOTP(secret).provisioning_uri(user.email,issuer_name='Engineering Studio')}
    @app.post('/api/mfa/enable')
    def mfa_enable(body:CodeInput,request:Request,who=Depends(auth),db=Depends(db_session)):
        rate(db,request,'mfa-enable',10);user,session=who;recent(user,session)
        if not user.totp_pending:fail(400,'Start enrollment first')
        pending=json.loads(decrypt(s,user.totp_pending))
        if pending['expires']<now() or not pyotp.TOTP(pending['secret']).verify(body.code,valid_window=0):fail(400,'Enrollment expired or code invalid')
        db.execute(update(Session).where(Session.user_id==user.id,Session.id!=session.id).values(revoked=True));user.totp=encrypt(s,pending['secret']);user.totp_pending=None;user.totp_last=now()//30;codes=[secrets.token_hex(8) for _ in range(8)];user.recovery=json.dumps([digest(c) for c in codes]);audit(db,user,'mfa.enabled');return {'recovery_codes':codes}
    @app.post('/api/mfa/disable')
    def mfa_disable(body:Credentials,request:Request,who=Depends(auth),db=Depends(db_session)):
        rate(db,request,'mfa-disable',10);user,session=who;recent(user,session)
        if user.password:reauthenticate(user,body)
        elif not check_otp(s,user,body.code):fail(403,'Second factor required')
        user.totp=None;user.totp_pending=None;user.recovery='[]';revoke_all(db,user);audit(db,user,'mfa.disabled');return {'disabled':True,'sign_in_again':True}

    @app.post('/api/payments/checkout')
    def checkout(body:CheckoutInput,request:Request,who=Depends(auth),db=Depends(db_session)):
        rate(db,request,'checkout',10);user,_=who;price=s.monthly_price if body.period=='monthly' else s.annual_price
        if not s.billing_enabled:fail(503,'Paid billing has not been launched')
        if not price:fail(503,'Pricing has not been configured')
        if effective_plan(db,s,user).id=='premium':fail(409,'You already have an active subscription. Use Billing.')
        # Reuse a pending session; never create overlapping subscriptions on repeated clicks.
        if user.checkout_expires>now() and user.checkout_url:return {'url':user.checkout_url}
        if not user.customer:user.customer=app.state.gateway.customer(user);db.flush()
        if app.state.gateway.active_subscriptions(user.customer):fail(409,'An existing subscription requires attention. Manage it in Billing.')
        if user.checkout_expires<=now():
            user.checkout_id='checkout-'+uid();user.checkout_price=price;user.checkout_expires=now()+86400;user.checkout_url=None
            db.commit()  # Persist provider idempotency key BEFORE remote creation; survives a process crash.
        user=locked_user(db,user.id)
        price=user.checkout_price or price
        obj=app.state.gateway.checkout(user,price,body.period,user.checkout_id);user.checkout_url=obj['url'];user.checkout_expires=int(obj['expires_at']);db.flush()
        return {'url':obj['url']}
    @app.post('/api/payments/portal')
    def portal(who=Depends(auth)):
        if not s.billing_enabled:fail(503,'Paid billing has not been launched')
        if not who[0].customer:fail(400,'No billing account yet')
        return {'url':app.state.gateway.portal(who[0].customer)}
    @app.post('/api/payments/cancel')
    def cancel(who=Depends(auth),db=Depends(db_session)):
        if not s.billing_enabled:fail(503,'Paid billing has not been launched')
        user,_=who;rows=list(db.scalars(select(Subscription).where(Subscription.user_id==user.id,Subscription.status.in_(['active','trialing','past_due']))))
        for row in rows:app.state.gateway.cancel(row.id);sync_subscription(db,s,app.state.gateway,user,row.id)
        audit(db,user,'subscription.cancel_requested');return {'cancel_at_period_end':True}
    @app.post('/api/payments/webhook')
    async def webhook(request:Request,db=Depends(db_session)):
        raw=await request.body()
        if len(raw)>1024*1024:fail(413,'Request too large')
        event=app.state.gateway.verify_event(raw,request.headers.get('stripe-signature',''))
        return process_event(db,s,app.state.gateway,event)
    @app.get('/api/billing')
    def billing(who=Depends(auth),db=Depends(db_session)):
        user,_=who;rows=db.scalars(select(Payment).where(Payment.user_id==user.id).order_by(Payment.created.desc()).limit(100))
        subs=db.scalars(select(Subscription).where(Subscription.user_id==user.id))
        return {'plan':effective_plan(db,s,user).id,'payments':[{'id':p.id,'amount':p.amount,'refunded':p.refunded,'currency':p.currency,'status':p.status,'invoice_url':p.invoice_url,'created':p.created} for p in rows],'subscriptions':[{'id':p.id,'status':p.status,'ends':p.ends,'cancel_at_end':p.cancel_at_end} for p in subs]}
    @app.get('/api/notifications')
    def notifications(who=Depends(auth),db=Depends(db_session)):
        return [{'id':n.id,'message':n.message,'read':n.read,'created':n.created} for n in db.scalars(select(Notice).where(Notice.user_id==who[0].id).order_by(Notice.created.desc()).limit(100))]
    @app.post('/api/notifications/{id}/read')
    def read_notice(id:str,who=Depends(auth),db=Depends(db_session)):
        row=db.scalar(select(Notice).where(Notice.id==id,Notice.user_id==who[0].id))
        if not row:fail(404,'Notification not found')
        row.read=True;return {'read':True}
    @app.get('/api/admin')
    def admin(q:str='',offset:int=0,who=Depends(auth),db=Depends(db_session)):
        user,session=who;require_admin(user);recent(user,session)
        if not user.totp:fail(403,'Administrators must enable two-factor authentication')
        if len(q)>100 or not 0<=offset<=1000000:fail(422,'Invalid search or page')
        criteria=[User.deleted==False]
        if q:criteria.append(func.lower(User.email).contains(q.lower(),autoescape=True))
        users=list(db.scalars(select(User).where(*criteria).order_by(User.created,User.id).offset(offset).limit(50)))
        money=db.execute(select(Payment.currency,func.sum(Payment.amount-Payment.refunded)).where(Payment.status.in_(['paid','partially_refunded','refunded'])).group_by(Payment.currency)).all()
        return {'users':[{'id':u.id,'email':u.email,'name':u.name,'banned':u.banned,'role':u.role} for u in users],'total':db.scalar(select(func.count()).select_from(User).where(*criteria)),'offset':offset,'revenue_minor_units':{c:int(a or 0) for c,a in money},'recent_payments':[{'id':p.id,'status':p.status,'amount':p.amount,'currency':p.currency} for p in db.scalars(select(Payment).order_by(Payment.created.desc()).limit(100))]}
    @app.post('/api/admin/users/{id}/ban')
    def ban(id:str,body:BanInput,who=Depends(auth),db=Depends(db_session)):
        user,session=who;require_admin(user);recent(user,session)
        if not user.totp:fail(403,'Two-factor authentication required')
        if id==user.id:fail(400,'Cannot ban your own account')
        target=locked_user(db,id)
        if not target:fail(404,'User not found')
        target.banned=body.banned;revoke_all(db,target);audit(db,user,'admin.ban.'+id);return {'banned':target.banned}
    @app.get('/api/account/export')
    def export_account(who=Depends(auth),db=Depends(db_session)):
        user,session=who;recent(user,session)
        return {'account':public_user(db,user,session),'team_invitations':[{'project_id':i.project_id,'email':i.email,'role':i.role,'expires':i.expires} for i in db.scalars(select(ProjectInvitation).where((ProjectInvitation.email==user.email)|(ProjectInvitation.project_id.in_(select(Project.id).where(Project.user_id==user.id)))))],'team_comments':[{'project_id':c.project_id,'body':c.body,'created':c.created} for c in db.scalars(select(ProjectComment).where(ProjectComment.user_id==user.id))],'team_memberships':[{'project_id':m.project_id,'role':m.role,'accepted':m.accepted} for m in db.scalars(select(ProjectMember).where(ProjectMember.user_id==user.id))],'notifications':[{'message':n.message,'created':n.created} for n in db.scalars(select(Notice).where(Notice.user_id==user.id))],'billing':[{'id':p.id,'amount':p.amount,'currency':p.currency,'status':p.status,'refunded':p.refunded} for p in db.scalars(select(Payment).where(Payment.user_id==user.id))],'projects':[{**json.loads(p.data),'id':p.id,'profile_id':p.profile_id,'version':p.version,'trashed':p.trashed} for p in db.scalars(select(Project).where(Project.user_id==user.id))]}
    @app.delete('/api/account')
    def delete_account(body:Credentials,request:Request,response:Response,who=Depends(auth),db=Depends(db_session)):
        rate(db,request,'delete-account',5);user,session=who;recent(user,session)
        reauthenticate(user,body) if user.password else (None if check_otp(s,user,body.code) else fail(403,'Enable and verify a second factor before deleting a Google-only account'))
        # If provider cancellation fails, the transaction aborts; never leave a deleted user renewing silently.
        for sub in db.scalars(select(Subscription).where(Subscription.user_id==user.id,Subscription.status.not_in(['canceled','incomplete_expired']))):
            from api.beta_access import BETA_PRICE
            if not (sub.id.startswith('beta_') and sub.price==BETA_PRICE):app.state.gateway.cancel(sub.id,immediate=True)
            sub.status='canceled';sub.ends=now()
        revoke_all(db,user);db.execute(delete(ProjectInvitation).where(ProjectInvitation.email==user.email));db.execute(delete(ProjectPresence).where(ProjectPresence.user_id==user.id));db.execute(delete(ProjectComment).where(ProjectComment.user_id==user.id));db.execute(delete(ProjectMember).where(ProjectMember.user_id==user.id));db.execute(delete(Token).where(Token.user_id==user.id));db.execute(delete(Notice).where(Notice.user_id==user.id));db.execute(delete(Mail).where(Mail.user_id==user.id));db.execute(delete(Project).where(Project.user_id==user.id));db.execute(delete(Profile).where(Profile.user_id==user.id))
        user.deleted=True;user.email='deleted-'+user.id+'@invalid.example';user.name='Deleted account';user.password=None;user.google_sub=None;user.totp=None;user.totp_pending=None;user.recovery='[]';user.checkout_url=None
        audit(db,user,'account.deleted',request,s);clear_auth(s,response);return {'deleted':True,'retained':'Pseudonymous payment and audit records are retained under the deployment retention policy.'}

    # OAuth uses state + PKCE + nonce; no automatic linking solely by matching email.
    @app.get('/api/auth/google/start')
    def google_start(request:Request,db=Depends(db_session)):
        rate(db,request,'google',20)
        if not s.google_client or not s.google_secret:fail(503,'Google sign-in is not configured')
        verifier=random_token();nonce=random_token();state=action_token(db,None,'oauth',600,data=encrypt(s,json.dumps({'verifier':verifier,'nonce':nonce})))
        challenge=base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
        url='https://accounts.google.com/o/oauth2/v2/auth?'+urlencode({'client_id':s.google_client,'redirect_uri':s.origin+'/api/auth/google/callback','response_type':'code','scope':'openid email profile','state':state,'nonce':nonce,'code_challenge':challenge,'code_challenge_method':'S256'})
        response=RedirectResponse(url);response.set_cookie(cookie_name(s,'oauth'),digest(state),max_age=600,secure=s.secure_cookies,httponly=True,samesite='lax',path='/');return response
    @app.get('/api/auth/google/callback')
    def google_callback(request:Request,code:str='',state:str='',db=Depends(db_session)):
        rate(db,request,'google-callback',20)
        if not state or not hmac.compare_digest(request.cookies.get(cookie_name(s,'oauth'),''),digest(state)):fail(400,'OAuth state mismatch')
        token=consume_token(db,state,'oauth');data=json.loads(decrypt(s,token.data))
        r=httpx.post('https://oauth2.googleapis.com/token',data={'code':code,'client_id':s.google_client,'client_secret':s.google_secret,'redirect_uri':s.origin+'/api/auth/google/callback','grant_type':'authorization_code','code_verifier':data['verifier']},timeout=15)
        if r.status_code!=200:fail(400,'Google sign-in failed')
        from google.oauth2 import id_token
        from google.auth.transport.requests import Request as GoogleRequest
        try:claims=id_token.verify_oauth2_token(r.json()['id_token'],GoogleRequest(),s.google_client)
        except Exception:fail(400,'Google token verification failed')
        if claims.get('nonce')!=data['nonce'] or not claims.get('email_verified') or claims.get('iss') not in ['https://accounts.google.com','accounts.google.com']:fail(400,'Google identity invalid')
        user=db.scalar(select(User).where(User.google_sub==claims['sub']).with_for_update())
        if not user:
            if db.scalar(select(User).where(User.email==claims['email'].lower())):fail(409,'Sign in using your existing account. Automatic email-based linking is disabled.')
            user=User(email=claims['email'].lower(),name=claims.get('name','Engineer')[:100],google_sub=claims['sub'],verified=True);db.add(user);db.flush();db.add(Profile(user_id=user.id,name=user.name));db.flush()
        if user.banned or user.deleted:fail()
        response=RedirectResponse(s.origin+'/#/dashboard',status_code=303);response.delete_cookie(cookie_name(s,'oauth'),path='/')
        if user.totp:
            challenge=action_token(db,user,'mfa',300);response=RedirectResponse(s.origin+'/#/mfa?token='+challenge,status_code=303);response.delete_cookie(cookie_name(s,'oauth'),path='/')
        else:new_session(db,s,user,request,response)
        return response

    @app.exception_handler(IntegrityError)
    async def integrity_error(request,exc):return JSONResponse({'detail':'Conflicting update. Retry the request.'},409)
    from api.features import install_features
    install_features(app,auth,db_session)
    from api.ai_modelling import install_ai_modelling
    from api.collaboration import install_collaboration
    install_ai_modelling(app,auth,db_session)
    install_collaboration(app,auth,db_session)
    # Static mount is last. The standalone API can serve this same frontend under one origin.
    app.mount('/',PublicFrontend(directory=Path(__file__).resolve().parent.parent/'dist',html=True),name='frontend')
    return app

def run_app():return create_app()
