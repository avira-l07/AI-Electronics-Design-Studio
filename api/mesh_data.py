"""Validate bounded imported triangles without parsing executable mesh extensions."""
import math

def validate_mesh(mesh):
    if not isinstance(mesh,dict) or set(mesh)!={'version','positions'} or type(mesh['version'])!=int or mesh['version']!=1:return False
    p=mesh['positions']
    if not isinstance(p,list) or not 9<=len(p)<=54000 or len(p)%9:return False
    for v in p:
        try:
            if type(v) not in (int,float) or not math.isfinite(v) or abs(v)>5000:return False
        except OverflowError:return False
    for i in range(0,len(p),9):
        a=[p[i+3+k]-p[i+k] for k in range(3)];b=[p[i+6+k]-p[i+k] for k in range(3)]
        if math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])<1e-9:return False
    return True
