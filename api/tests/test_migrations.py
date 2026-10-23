from sqlalchemy import inspect,text
from api.models import Base,database,User,Profile,Project,Share,ProjectMember,ProjectComment,ProjectPresence
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
    assert {'project_shares','project_members','project_comments','project_presence'}<=set(inspect(engine).get_table_names());engine.dispose()
