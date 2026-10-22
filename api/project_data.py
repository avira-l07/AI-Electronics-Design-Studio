"""Validate imported projects at the trust boundary, including revision snapshots."""
import json, math
from fastapi import HTTPException

def project_data(data,depth=0):
    def invalid():raise HTTPException(422,'Invalid engineering project data')
    def string(v,n=1000):return isinstance(v,str) and len(v)<=n
    def number(v):
        try:return type(v) in (int,float) and math.isfinite(v)
        except OverflowError:return False
    if not isinstance(data,dict) or depth>1:invalid()
    if not all(string(data.get(k),200) for k in ['name','material']) or not data['name'].strip():invalid()
    if not string(data.get('kind',''),100):invalid()
    if data.get('designType','slider-crank') not in ['slider-crank','electronics','sketch']:invalid()
    if data.get('currency','INR') not in ['INR','USD','EUR','GBP','JPY']:invalid()
    if not all(number(data.get(k)) and 0<data[k]<1e8 for k in ['stroke','rod','rpm']):invalid()
    for key,maximum in [('parts',1000),('notes',1000),('revisions',50),('sketch',1000),('buildTasks',1000)]:
        if not isinstance(data.get(key,[]),list) or len(data.get(key,[]))>maximum:invalid()
    for p in data.get('parts',[]):
        if not isinstance(p,dict) or not all(string(p.get(k),200) for k in ['name','material']) or type(p.get('qty'))!=int or not 1<=p['qty']<=100000 or not number(p.get('price')) or not 0<=p['price']<1e12:invalid()
    for n in data.get('notes',[]):
        if not isinstance(n,dict) or not all(string(n.get(k),10000) for k in ['title','body','type','date']) or not string(n.get('signature',''),100000):invalid()
    for shape in data.get('sketch',[]):
        if not isinstance(shape,dict) or shape.get('type') not in ['rect','circle','line','text','dimension']:invalid()
        if set(shape)-{'type','x','y','w','h','r','x2','y2','text','layer'}:invalid()
        if any(not number(v) or abs(v)>10000 for k,v in shape.items() if k not in ['type','text','layer']):invalid()
        if not string(shape.get('text',''),200) or not string(shape.get('layer','Concept'),50):invalid()
        required={'rect':['x','y','w','h'],'circle':['x','y','r'],'line':['x','y','x2','y2'],'text':['x','y','text'],'dimension':['x','y','x2','y2']}[shape['type']]
        if any(k not in shape for k in required) or any(shape.get(k,0)<0 for k in ['w','h','r']):invalid()
    for task in data.get('buildTasks',[]):
        if not isinstance(task,dict) or not string(task.get('name'),500) or type(task.get('done'))!=bool:invalid()
    for k,fields in [('circuit',['voltage','resistance','rating']),('costSettings',['quantity','labor','tooling','overhead'])]:
        if k in data:
            if not isinstance(data[k],dict) or any(not number(data[k].get(f)) or data[k][f]<0 for f in fields):invalid()
            if k=='circuit' and any(data[k][f]<=0 for f in fields):invalid()
            if k=='circuit':
                current=data[k]['voltage']/data[k]['resistance']
                if not math.isfinite(current) or not math.isfinite(data[k]['voltage']*current):invalid()
            if k=='costSettings' and (type(data[k]['quantity'])!=int or data[k]['quantity']<1):invalid()
    if 'resistorNetwork' in data:
        net=data['resistorNetwork']
        if not isinstance(net,dict) or net.get('mode') not in ['series','parallel'] or not number(net.get('voltage')) or not 0<net['voltage']<=100000:invalid()
        if not isinstance(net.get('resistors'),list) or not 1<=len(net['resistors'])<=20 or any(not number(r) or not 0<r<=1e12 for r in net['resistors']):invalid()
    revisions=[]
    for rev in data.get('revisions',[]):
        if not isinstance(rev,dict) or not string(rev.get('label'),200) or not string(rev.get('date'),100):invalid()
        if not isinstance(rev.get('snapshot'),dict):invalid()
        if rev.get('snapshot',{}).get('revisions'):invalid()
        revisions.append({'label':rev['label'],'date':rev['date'],'snapshot':json.loads(project_data(rev['snapshot'],depth+1))})
    if not string(data.get('electrical',''),10000):invalid()
    allowed=['name','kind','stroke','rod','rpm','material','parts','notes','revisions','sketch','buildTasks','circuit','costSettings','electrical','designType','currency','resistorNetwork']
    clean={k:data[k] for k in allowed if k in data}
    clean['revisions']=revisions
    for k in ['parts','notes','revisions']:clean.setdefault(k,[])
    return json.dumps(clean,allow_nan=False)
