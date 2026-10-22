"""Validate the portable 3D assembly at the API boundary; no geometry execution."""
import json,math,re
from pathlib import Path
from fastapi import HTTPException
from .solid_data import validate_solid

SCHEMA=json.loads(Path(__file__).with_name('assembly_schema.json').read_text())
def validate_assembly(a):
    def invalid():raise HTTPException(422,'Invalid 3D assembly data')
    def number(v,limit=5000):
        try:return type(v) in (int,float) and math.isfinite(v) and abs(v)<=limit
        except OverflowError:return False
    if not isinstance(a,dict) or set(a)!={'version','units','objects'} or type(a['version'])!=int or a['version']!=1 or a['units']!='mm' or not isinstance(a['objects'],list) or len(a['objects'])>200:invalid()
    ids=set()
    for o in a['objects']:
        fields={'id','partId','name','dims','material','position','rotation','visible','wireframe'}
        if not isinstance(o,dict) or set(o) not in (fields,fields|{'model'}):invalid()
        if not isinstance(o['id'],str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}',o['id']) or o['id'] in ids:invalid()
        ids.add(o['id'])
        if not isinstance(o['name'],str) or not 1<=len(o['name'])<=80 or o['material'] not in SCHEMA['materials'] or type(o['visible'])!=bool or type(o['wireframe'])!=bool:invalid()
        if not isinstance(o['partId'],str) or o['partId'] not in SCHEMA['parts']:invalid()
        d=o['dims']
        if not isinstance(d,dict) or set(d)!=set(SCHEMA['parts'][o['partId']]) or any(not number(v) or v<0.1 for v in d.values()):invalid()
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
        if 'flangeDiameter' in d and d['flangeDiameter']<d['outerDiameter']:invalid()
        for key,limit in [('position',100000),('rotation',3600)]:
            if not isinstance(o[key],list) or len(o[key])!=3 or any(not number(v,limit) for v in o[key]):invalid()
    return a
