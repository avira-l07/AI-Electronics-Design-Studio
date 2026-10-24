from sqlalchemy import inspect,text
from api.models import Base,database,User,Profile,Project,Share,ProjectMember,ProjectInvitation,ProjectComment,ProjectPresence
from api.config import Settings
from api.security import random_token
from cryptography.fernet import Fernet
import api.migrate as migration

def test_additive_upgrade_preserves_projects_and_is_repeatable(tmp_path,monkeypatch):
    s=Settings(database_url='sqlite:///'+str(tmp_path/'legacy.db'),environment='test',origin='http://testserver',jwt_key=random_token(),encryption_key=Fernet.generate_key().decode())
    engine,Factory=database(s.database_url);Base.metadata.create_all(engine)
    with Factory.begin() as db:
        user=User(email='legacy@example.com',name='Legacy');db.add(user);db.flush()
        profile=Profile(user_id=user.id,name='Main');db.add(profile);db.flush()
        row=Project(user_id=user.id,profile_id=profile.id,data='{"name":"Keep this project"}');db.add(row);db.flush();id=row.id
    with engine.begin() as conn:
        ProjectPresence.__table__.drop(conn)
        Share.__table__.drop(conn)
        ProjectComment.__table__.drop(conn);ProjectMember.__table__.drop(conn)
        conn.execute(text('ALTER TABLE projects DROP COLUMN version'))
        conn.execute(text('ALTER TABLE projects DROP COLUMN trashed'))
    engine.dispose();monkeypatch.setattr(migration,'Settings',lambda:s)
    migration.migrate();migration.migrate()
    engine,Factory=database(s.database_url)
    with Factory() as db:
        row=db.get(Project,id);assert row.version==1 and row.trashed==False and row.data=='{"name":"Keep this project"}'
    assert {'project_shares','project_members','project_invitations','project_comments','project_presence'}<=set(inspect(engine).get_table_names());engine.dispose()

def test_legacy_pending_members_convert_without_losing_accepted_grants(tmp_path,monkeypatch):
    s=Settings(database_url='sqlite:///'+str(tmp_path/'pending.db'),environment='test',origin='http://testserver',jwt_key=random_token(),encryption_key=Fernet.generate_key().decode())
    engine,Factory=database(s.database_url);Base.metadata.create_all(engine)
    with Factory.begin() as db:
        owner=User(email='owner@example.com',name='Owner');guest=User(email='guest@example.com',name='Guest');accepted=User(email='accepted@example.com',name='Accepted');db.add_all([owner,guest,accepted]);db.flush()
        profile=Profile(user_id=owner.id,name='Main');db.add(profile);db.flush();p=Project(user_id=owner.id,profile_id=profile.id,data='{}');db.add(p);db.flush();pid=p.id;gid=guest.id;aid=accepted.id
        db.add_all([ProjectMember(project_id=pid,user_id=gid,role='viewer',accepted=False),ProjectMember(project_id=pid,user_id=aid,role='editor',accepted=True)])
    ProjectInvitation.__table__.drop(engine);engine.dispose();monkeypatch.setattr(migration,'Settings',lambda:s)
    migration.migrate();migration.migrate();engine,Factory=database(s.database_url)
    with Factory() as db:
        assert db.get(ProjectMember,(pid,gid)) is None
        assert db.get(ProjectMember,(pid,aid)).accepted
        invitations=db.query(ProjectInvitation).all();assert len(invitations)==1 and invitations[0].email=='guest@example.com'
    engine.dispose()
