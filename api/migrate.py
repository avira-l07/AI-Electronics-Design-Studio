"""Explicit additive schema upgrade; never run implicitly on a web request."""
from sqlalchemy import inspect, text, select, delete
from api.config import Settings
from api.models import Base, Share, ProjectMember, ProjectInvitation, ProjectComment, ProjectPresence, User, database, seed, uid, now

def migrate():
    s=Settings();s.validate();engine,Factory=database(s.database_url)
    with engine.begin() as conn:
        if engine.dialect.name=='postgresql':conn.execute(text('SELECT pg_advisory_xact_lock(68421106)'))
        tables=inspect(conn).get_table_names()
        if 'projects' not in tables:
            if tables and set(tables)-{'schema_migrations'}:raise RuntimeError('Unexpected partial schema; inspect it before migrating.')
            Base.metadata.create_all(conn)
        else:
            columns={c['name'] for c in inspect(conn).get_columns('projects')}
            if 'version' not in columns:conn.execute(text('ALTER TABLE projects ADD COLUMN version INTEGER NOT NULL DEFAULT 1'))
            if 'trashed' not in columns:conn.execute(text('ALTER TABLE projects ADD COLUMN trashed BOOLEAN NOT NULL DEFAULT false'))
            Share.__table__.create(conn,checkfirst=True)
            ProjectMember.__table__.create(conn,checkfirst=True)
            ProjectComment.__table__.create(conn,checkfirst=True)
            ProjectPresence.__table__.create(conn,checkfirst=True)
            ProjectInvitation.__table__.create(conn,checkfirst=True)
        # Preserve legacy invitations without disclosing a target account ID.
        pending=conn.execute(select(ProjectMember.project_id,ProjectMember.role,User.email).join(User,User.id==ProjectMember.user_id).where(ProjectMember.accepted==False)).all()
        for project_id,role,email in pending:
            exists=conn.scalar(select(ProjectInvitation.id).where(ProjectInvitation.project_id==project_id,ProjectInvitation.email==email))
            if not exists:conn.execute(ProjectInvitation.__table__.insert().values(id=uid(),project_id=project_id,email=email,role=role,expires=now()+7*86400))
        conn.execute(delete(ProjectMember).where(ProjectMember.accepted==False))
        conn.execute(text('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(30) PRIMARY KEY)'))
        for version in ['0001','0002','0003','0004','0005']:
            if not conn.scalar(text('SELECT version FROM schema_migrations WHERE version=:version'),{'version':version}):conn.execute(text('INSERT INTO schema_migrations(version) VALUES (:version)'),{'version':version})
    with Factory.begin() as db:seed(db)
    engine.dispose();print('Schema ready at version 0005.')

if __name__=='__main__':migrate()
