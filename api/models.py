import time
import uuid
from sqlalchemy import String, Integer, BigInteger, Text, Boolean, ForeignKey, UniqueConstraint, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

def now(): return int(time.time())
def uid(): return str(uuid.uuid4())
class Base(DeclarativeBase): pass
class User(Base):
    __tablename__='users'
    id: Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    email: Mapped[str]=mapped_column(String(254),unique=True)
    password: Mapped[str|None]=mapped_column(Text,nullable=True)
    name: Mapped[str]=mapped_column(String(100))
    role: Mapped[str]=mapped_column(String(16),default='member')
    verified: Mapped[bool]=mapped_column(Boolean,default=False)
    banned: Mapped[bool]=mapped_column(Boolean,default=False)
    deleted: Mapped[bool]=mapped_column(Boolean,default=False)
    epoch: Mapped[int]=mapped_column(Integer,default=0)
    failures: Mapped[int]=mapped_column(Integer,default=0)
    locked_until: Mapped[int]=mapped_column(Integer,default=0)
    google_sub: Mapped[str|None]=mapped_column(String(255),unique=True,nullable=True)
    totp: Mapped[str|None]=mapped_column(Text,nullable=True)
    totp_pending: Mapped[str|None]=mapped_column(Text,nullable=True)
    totp_last: Mapped[int]=mapped_column(Integer,default=0)
    recovery: Mapped[str]=mapped_column(Text,default='[]')
    customer: Mapped[str|None]=mapped_column(String(255),unique=True,nullable=True)
    trial_used: Mapped[bool]=mapped_column(Boolean,default=False)
    checkout_id: Mapped[str|None]=mapped_column(String(255),nullable=True)
    checkout_url: Mapped[str|None]=mapped_column(Text,nullable=True)
    checkout_expires: Mapped[int]=mapped_column(Integer,default=0)
    checkout_price: Mapped[str|None]=mapped_column(String(255),nullable=True)
    created: Mapped[int]=mapped_column(Integer,default=now)
class Plan(Base):
    __tablename__='plans'
    id: Mapped[str]=mapped_column(String(24),primary_key=True)
    profile_limit: Mapped[int]=mapped_column(Integer)
class Profile(Base):
    __tablename__='profiles'
    id: Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    user_id: Mapped[str]=mapped_column(ForeignKey('users.id'),index=True)
    name: Mapped[str]=mapped_column(String(100))
    bio: Mapped[str]=mapped_column(String(1000),default='')
    created: Mapped[int]=mapped_column(BigInteger,default=lambda:time.time_ns()//1000)
class Session(Base):
    __tablename__='sessions'
    id: Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    user_id: Mapped[str]=mapped_column(ForeignKey('users.id'),index=True)
    profile_id: Mapped[str|None]=mapped_column(String(36),nullable=True)
    refresh: Mapped[str]=mapped_column(String(64),unique=True)
    expires: Mapped[int]=mapped_column(Integer)
    revoked: Mapped[bool]=mapped_column(Boolean,default=False)
    device: Mapped[str]=mapped_column(String(200))
    ip_hash: Mapped[str]=mapped_column(String(64))
    created: Mapped[int]=mapped_column(Integer,default=now)
    authenticated: Mapped[int]=mapped_column(Integer,default=now)
class Project(Base):
    __tablename__='projects'
    id: Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    user_id: Mapped[str]=mapped_column(ForeignKey('users.id'),index=True)
    profile_id: Mapped[str]=mapped_column(ForeignKey('profiles.id'),index=True)
    data: Mapped[str]=mapped_column(Text)
    updated: Mapped[int]=mapped_column(Integer,default=now)
    version: Mapped[int]=mapped_column(Integer,default=1,server_default='1')
    trashed: Mapped[bool]=mapped_column(Boolean,default=False,server_default='false')
class Share(Base):
    __tablename__='project_shares'
    id: Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    project_id: Mapped[str]=mapped_column(ForeignKey('projects.id',ondelete='CASCADE'),index=True)
    token_hash: Mapped[str]=mapped_column(String(64),unique=True)
    snapshot: Mapped[str]=mapped_column(Text)
    expires: Mapped[int]=mapped_column(Integer)
    revoked: Mapped[bool]=mapped_column(Boolean,default=False)
class UsedRefresh(Base):
    __tablename__='used_refresh_tokens'
    digest: Mapped[str]=mapped_column(String(64),primary_key=True)
    session_id: Mapped[str]=mapped_column(ForeignKey('sessions.id'),index=True)
    expires: Mapped[int]=mapped_column(Integer)
class Token(Base):
    __tablename__='action_tokens'
    digest: Mapped[str]=mapped_column(String(64),primary_key=True)
    user_id: Mapped[str|None]=mapped_column(ForeignKey('users.id'),nullable=True,index=True)
    purpose: Mapped[str]=mapped_column(String(30))
    data: Mapped[str]=mapped_column(Text,default='')
    expires: Mapped[int]=mapped_column(Integer)
    used: Mapped[bool]=mapped_column(Boolean,default=False)
    attempts: Mapped[int]=mapped_column(Integer,default=0)
class Subscription(Base):
    __tablename__='subscriptions'
    id: Mapped[str]=mapped_column(String(255),primary_key=True)
    user_id: Mapped[str]=mapped_column(ForeignKey('users.id'),index=True)
    status: Mapped[str]=mapped_column(String(30))
    price: Mapped[str]=mapped_column(String(255))
    ends: Mapped[int]=mapped_column(Integer,default=0)
    cancel_at_end: Mapped[bool]=mapped_column(Boolean,default=False)
    updated: Mapped[int]=mapped_column(Integer,default=now)
    refunded_invoice: Mapped[str|None]=mapped_column(String(255),nullable=True)
    disputed: Mapped[bool]=mapped_column(Boolean,default=False)
class Payment(Base):
    __tablename__='payments'
    id: Mapped[str]=mapped_column(String(255),primary_key=True)
    user_id: Mapped[str]=mapped_column(ForeignKey('users.id'),index=True)
    subscription_id: Mapped[str|None]=mapped_column(String(255),nullable=True)
    status: Mapped[str]=mapped_column(String(30))
    amount: Mapped[int]=mapped_column(Integer,default=0)
    refunded: Mapped[int]=mapped_column(Integer,default=0)
    currency: Mapped[str]=mapped_column(String(8),default='inr')
    invoice_url: Mapped[str|None]=mapped_column(Text,nullable=True)
    created: Mapped[int]=mapped_column(Integer,default=now)
class Webhook(Base):
    __tablename__='webhook_events'
    id: Mapped[str]=mapped_column(String(255),primary_key=True)
    kind: Mapped[str]=mapped_column(String(100))
    created: Mapped[int]=mapped_column(Integer,default=now)
class Notice(Base):
    __tablename__='notifications'
    id: Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    user_id: Mapped[str]=mapped_column(ForeignKey('users.id'),index=True)
    message: Mapped[str]=mapped_column(String(1000))
    read: Mapped[bool]=mapped_column(Boolean,default=False)
    created: Mapped[int]=mapped_column(Integer,default=now)
class Mail(Base):
    __tablename__='mail_outbox'
    id: Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    user_id: Mapped[str|None]=mapped_column(String(36),nullable=True,index=True)
    payload: Mapped[str]=mapped_column(Text)
    attempts: Mapped[int]=mapped_column(Integer,default=0)
    available: Mapped[int]=mapped_column(Integer,default=now)
    sent: Mapped[bool]=mapped_column(Boolean,default=False)
class Audit(Base):
    __tablename__='audit_logs'
    id: Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    user_id: Mapped[str|None]=mapped_column(String(36),nullable=True,index=True)
    action: Mapped[str]=mapped_column(String(100))
    ip_hash: Mapped[str]=mapped_column(String(64),default='')
    created: Mapped[int]=mapped_column(Integer,default=now)
class Rate(Base):
    __tablename__='rate_limits'
    id: Mapped[str]=mapped_column(String(100),primary_key=True)
    count: Mapped[int]=mapped_column(Integer,default=0)
    expires: Mapped[int]=mapped_column(Integer)

def database(url):
    engine=create_engine(url,connect_args={'check_same_thread':False,'timeout':30} if url.startswith('sqlite') else {},pool_pre_ping=True)
    if url.startswith('sqlite'):
        @event.listens_for(engine,'connect')
        def pragmas(conn,_):
            conn.execute('PRAGMA foreign_keys=ON');conn.execute('PRAGMA journal_mode=WAL')
    return engine,sessionmaker(engine,expire_on_commit=False)

def seed(db):
    for name,limit in [('free',1),('premium',5)]:
        if not db.get(Plan,name): db.add(Plan(id=name,profile_limit=limit))

