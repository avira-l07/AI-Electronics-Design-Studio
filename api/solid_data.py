"""Bounded declarative solid recipes; no user code or native kernel runs on the API."""
import math,re

def validate_solid(model,depth):
    def exact(v,keys):return isinstance(v,dict) and set(v)==set(keys)
    def number(v,maximum=5000):
        try:return type(v) in (int,float) and math.isfinite(v) and abs(v)<=maximum
        except OverflowError:return False
    def vector(v,maximum=5000):return isinstance(v,list) and len(v)==3 and all(number(n,maximum) for n in v)
    def orient(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    def on(a,b,c):return abs(orient(a,b,c))<1e-8 and min(a[0],b[0])-1e-8<=c[0]<=max(a[0],b[0])+1e-8 and min(a[1],b[1])-1e-8<=c[1]<=max(a[1],b[1])+1e-8
    def intersects(a,b,c,d):return orient(a,b,c)*orient(a,b,d)<0 and orient(c,d,a)*orient(c,d,b)<0 or on(a,b,c) or on(a,b,d) or on(c,d,a) or on(c,d,b)
    if not isinstance(model,dict) or not {'version','plane','outline','features'}<=set(model) or set(model)-{'version','plane','outline','features','base','constraints','modifiers'} or type(model['version'])!=int or model['version']!=1 or model['plane'] not in ['XZ','XY','YZ'] or not number(depth) or depth<.1:return False
    points=model['outline']
    if not isinstance(points,list) or not 3<=len(points)<=64 or any(not isinstance(p,list) or len(p)!=2 or not all(number(n) for n in p) for p in points):return False
    area=0
    for i,a in enumerate(points):
        b=points[(i+1)%len(points)]
        if math.hypot(a[0]-b[0],a[1]-b[1])<.1:return False
        area+=a[0]*b[1]-b[0]*a[1]
        for j in range(i+1,len(points)):
            if j!=i+1 and not(i==0 and j==len(points)-1) and intersects(a,b,points[j],points[(j+1)%len(points)]):return False
    if abs(area)<.02:return False
    if 'constraints' in model:
        cs=model['constraints']
        if not isinstance(cs,list) or len(cs)>32:return False
        for c in cs:
            if not isinstance(c,dict) or type(c.get('a'))!=int or not 0<=c['a']<len(points):return False
            a=points[c['a']]
            if c.get('type')=='fixed':
                if not exact(c,['type','a','value']) or not isinstance(c['value'],list) or len(c['value'])!=2 or not all(number(n) for n in c['value']) or math.dist(a,c['value'])>.005:return False
            else:
                if not exact(c,['type','a','b','value']) or c['type'] not in ['horizontal','vertical','length'] or type(c['b'])!=int or not 0<=c['b']<len(points) or c['a']==c['b'] or not number(c['value']):return False
                b=points[c['b']]
                if c['type']=='length':
                    if c['value']<.1 or abs(math.dist(a,b)-c['value'])>.005:return False
                elif c['value']!=0 or abs(a[1]-b[1] if c['type']=='horizontal' else a[0]-b[0])>.005:return False
    if 'base' in model:
        base=model['base']
        if not exact(base,['type','angle','twist','scale']) or base['type'] not in ['extrude','revolve'] or not number(base['angle'],360) or base['angle']<1 or not number(base['twist'],360) or not number(base['scale'],4) or base['scale']<.1 or base['type']=='revolve' and any(p[0]<0 for p in points):return False
    if 'modifiers' in model:
        mods=model['modifiers'];copies=1
        if not isinstance(mods,list) or len(mods)>4:return False
        for m in mods:
            if not isinstance(m,dict):return False
            if m.get('type')=='mirror':
                if not exact(m,['type','axis']) or m['axis'] not in ['U','V','W']:return False
            elif m.get('type')=='pattern':
                if not exact(m,['type','count','step']) or type(m['count'])!=int or not 2<=m['count']<=8 or not vector(m['step']) or math.hypot(*m['step'])<.1:return False
                copies*=m['count']
            else:return False
        if copies>32:return False
    features=model['features']
    if not isinstance(features,list) or len(features)>16:return False
    ids=set()
    for f in features:
        if not exact(f,['id','name','enabled','operation','shape','dims','position','rotation','through']):return False
        if not isinstance(f['id'],str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}',f['id']) or f['id'] in ids:return False
        ids.add(f['id'])
        if not isinstance(f['name'],str) or not f['name'].strip() or len(f['name'])>80 or type(f['enabled'])!=bool or type(f['through'])!=bool or f['operation'] not in ['union','subtract','intersect'] or f['shape'] not in ['box','cylinder'] or not vector(f['position']) or not vector(f['rotation'],3600):return False
        keys=['width','height','depth'] if f['shape']=='box' else ['diameter','depth']
        if not exact(f['dims'],keys) or any(not number(v) or v<.1 for v in f['dims'].values()):return False
        if f['through'] and (f['operation']!='subtract' or f['rotation'][0]!=0 or f['rotation'][1]!=0):return False
        if f['through'] and model.get('base',{}).get('type')=='revolve':return False
    return True
