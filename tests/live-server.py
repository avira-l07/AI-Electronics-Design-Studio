"""Loopback-only browser-test server. Never imported by the product application.
Synthetic verified users and entitlement are isolated in a temporary SQLite DB.
No provider, email, webhook or public account is contacted.
"""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import uvicorn
from cryptography.fernet import Fernet
from api.app import create_app
from api.config import Settings
from api.models import Base,User,Profile,Project,Subscription,seed,now
from api.security import random_token,passwords

port=int(sys.argv[1]);directory=Path(sys.argv[2]).resolve();directory.mkdir(parents=True,exist_ok=True)
s=Settings(database_url='sqlite:///'+str(directory/'browser.db'),environment='test',origin=f'http://127.0.0.1:{port}',jwt_key=random_token(),encryption_key=Fernet.generate_key().decode(),monthly_price='price_synthetic',annual_price='price_synthetic_year',billing_enabled=False,ai_enabled=False,sharing_enabled=False)
app=create_app(s);Base.metadata.create_all(app.state.engine)
with app.state.Factory.begin() as db:
    seed(db)
    for name in ['owner','editor','viewer']:
        u=User(id=name,email=f'{name}@example.com',name=name,verified=True,password=passwords.hash('Synthetic test password 739!'));db.add(u);db.flush();db.add(Profile(id=name+'-profile',user_id=name,name='Main'))
    db.flush();db.add(Subscription(id='synthetic-test-only',user_id='owner',status='active',price=s.monthly_price,ends=now()+3600))
    part={'id':'part-a','partId':'plate_flat','name':'Base plate','dims':{'width':80,'height':60,'thickness':3},'material':'Aluminium 6061','position':[0,0,0],'rotation':[0,0,0],'visible':True,'wireframe':False}
    second={**part,'id':'part-b','name':'Top plate','position':[0,20,0]}
    data={'name':'Shared browser assembly','material':'Aluminium 6061','stroke':80,'rod':150,'rpm':600,'parts':[],'notes':[],'revisions':[],'assembly3d':{'version':1,'units':'mm','objects':[part,second]}}
    db.add(Project(id='shared-browser-project',user_id='owner',profile_id='owner-profile',data=json.dumps(data)))
uvicorn.run(app,host='127.0.0.1',port=port,log_level='warning')
