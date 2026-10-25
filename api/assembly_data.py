"""Validate the portable 3D assembly at the API boundary; no geometry execution."""
import json,math,re
from pathlib import Path
from fastapi import HTTPException
from .solid_data import validate_solid
from .mesh_data import validate_mesh

SCHEMA=json.loads(Path(__file__).with_name('assembly_schema.json').read_text())
def validate_assembly(a):
    def invalid():raise HTTPException(422,'Invalid 3D assembly data')
    def number(v,limit=5000):
        try:return type(v) in (int,float) and math.isfinite(v) and abs(v)<=limit
        except OverflowError:return False
    if not isinstance(a,dict) or not {'version','units','objects'}<=set(a) or set(a)-{'version','units','objects','groups','joints'} or type(a['version'])!=int or a['version']!=1 or a['units']!='mm' or not isinstance(a['objects'],list) or len(a['objects'])>200:invalid()
    ids=set();triangles=0
    for o in a['objects']:
        fields={'id','partId','name','dims','material','position','rotation','visible','wireframe'}
        if not isinstance(o,dict) or not fields<=set(o) or set(o)-fields-{'model','mesh'}:invalid()
        if not isinstance(o['id'],str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}',o['id']) or o['id'] in ids:invalid()
        ids.add(o['id'])
        if not isinstance(o['name'],str) or not 1<=len(o['name'])<=80 or o['material'] not in SCHEMA['materials'] or type(o['visible'])!=bool or type(o['wireframe'])!=bool:invalid()
        if not isinstance(o['partId'],str) or o['partId'] not in [*SCHEMA['parts'],'imported_mesh']:invalid()
        d=o['dims']
        if not isinstance(d,dict) or set(d)!=set({'scale':1} if o['partId']=='imported_mesh' else SCHEMA['parts'][o['partId']]) or any(not number(v) or v<0.1 for v in d.values()):invalid()
        if o['partId']=='imported_mesh':
            if not validate_mesh(o.get('mesh')) or d['scale']>20:invalid()
            triangles+=len(o['mesh']['positions'])//9
        elif 'mesh' in o:invalid()
        if o['partId']=='custom_solid':
            if not validate_solid(o.get('model'),d['depth']):invalid()
        elif 'model' in o:invalid()
        if 'teeth' in d and (type(d['teeth'])!=int or not 6<=d['teeth']<=120):invalid()
        if all(k in d for k in ['thickness','width','height']) and d['thickness']>=min(d['width'],d['height'])/2:invalid()
        if 'wallThickness' in d and d['wallThickness']>=min(d['width'],d['height'],d['depth'])/2:invalid()
        if 'innerDiameter' in d and d['innerDiameter']>=d.get('outerDiameter',d.get('diameter',0)):invalid()
        if 'boreDiameter' in d and d['boreDiameter']>=d['diameter']:invalid()
        if 'headDiameter' in d and d['headDiameter']<=d['diameter']:invalid()
        if 'acrossFlats' in d and d['acrossFlats']<=d['diameter']:invalid()
        if o['partId']=='arm_bumper' and d['thickness']>=min(d['diameter']/2,d['height']):invalid()
        if 'flangeDiameter' in d and d['flangeDiameter']<d['outerDiameter']:invalid()
        for key,limit in [('position',100000),('rotation',3600)]:
            if not isinstance(o[key],list) or len(o[key])!=3 or any(not number(v,limit) for v in o[key]):invalid()
    if triangles>12000:invalid()
    groups=a.get('groups',[]);group_ids=set();members=set()
    if not isinstance(groups,list) or len(groups)>100:invalid()
    for g in groups:
        if not isinstance(g,dict) or set(g)!={'id','name','members'} or not isinstance(g['id'],str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}',g['id']) or g['id'] in group_ids or not isinstance(g['name'],str) or not g['name'].strip() or len(g['name'])>80 or not isinstance(g['members'],list) or not 2<=len(g['members'])<=200:invalid()
        group_ids.add(g['id'])
        for id in g['members']:
            if not isinstance(id,str) or id not in ids or id in members:invalid()
            members.add(id)
    joints=a.get('joints',[]);joint_ids=set();parents={}
    if not isinstance(joints,list) or len(joints)>199:invalid()
    for j in joints:
        if not isinstance(j,dict) or set(j)!={'id','parent','child','type','axis','offset','orientation','value','min','max'} or not isinstance(j['id'],str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}',j['id']) or j['id'] in joint_ids or not isinstance(j['parent'],str) or not isinstance(j['child'],str) or j['parent'] not in ids or j['child'] not in ids or j['parent']==j['child'] or j['child'] in parents or j['type'] not in ['fixed','hinge','slider'] or j['axis'] not in ['X','Y','Z']:invalid()
        for key,limit in [('offset',100000),('orientation',3600)]:
            if not isinstance(j[key],list) or len(j[key])!=3 or not all(number(v,limit) for v in j[key]):invalid()
        if not all(number(j[k],100000 if j['type']=='slider' else 360) for k in ['value','min','max']) or j['min']>j['max'] or not j['min']<=j['value']<=j['max'] or j['type']=='fixed' and any(j[k]!=0 for k in ['value','min','max']):invalid()
        joint_ids.add(j['id']);parents[j['child']]=j['parent']
    for child in parents:
        seen={child};node=parents.get(child)
        while node:
            if node in seen:invalid()
            seen.add(node);node=parents.get(node)
    return a
