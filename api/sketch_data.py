"""Declarative curve and constraint validation, mirrored by sketch-constraints.js."""
import math

def number(n,maximum=5000):
    try:return type(n) in (int,float) and math.isfinite(n) and abs(n)<=maximum
    except OverflowError:return False

def constraints_valid(points,cs):
    if not isinstance(cs,list) or len(cs)>32:return False
    for c in cs:
        if not isinstance(c,dict):return False
        kind=c.get('type');indices=['a'] if kind=='fixed' else ['a','b','c','d'] if kind in ['equalLength','parallel','perpendicular'] else ['a','b']
        if set(c)!=set(indices+['type','value']) or any(type(c[k])!=int or not 0<=c[k]<len(points) for k in indices):return False
        a=points[c['a']];v=c['value']
        if kind=='fixed':
            if not isinstance(v,list) or len(v)!=2 or not all(number(n) for n in v) or math.dist(a,v)>.005:return False
            continue
        if kind not in ['horizontal','vertical','length','coincident','angle','equalLength','parallel','perpendicular'] or c['a']==c['b'] or not number(v):return False
        b=points[c['b']];dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy)
        if kind=='length':
            if v<.1:return False
            error=length-v
        elif kind=='angle':
            if abs(v)>180 or length<1e-8:return False
            delta=math.atan2(dy,dx)-v*math.pi/180;error=math.atan2(math.sin(delta),math.cos(delta))*length
        else:
            if v!=0:return False
            if kind=='horizontal':error=dy
            elif kind=='vertical':error=dx
            elif kind=='coincident':error=length
            else:
                if c['c']==c['d'] or length<1e-8:return False
                q=points[c['c']];r=points[c['d']];ux=r[0]-q[0];uy=r[1]-q[1];other=math.hypot(ux,uy)
                if other<1e-8:return False
                error=length-other if kind=='equalLength' else (dx*uy-dy*ux)/max(length,other) if kind=='parallel' else (dx*ux+dy*uy)/max(length,other)
        if abs(error)>.005:return False
    return True

def sample_curves(points,curves):
    if not isinstance(curves,list) or len(curves)>8:raise ValueError()
    edges=set()
    for c in curves:
        if not isinstance(c,dict) or set(c)!={'edge','type','control','segments'} or type(c['edge'])!=int or not 0<=c['edge']<len(points) or c['edge'] in edges or c['type'] not in ['quadratic','arc'] or not isinstance(c['control'],list) or len(c['control'])!=2 or not all(number(n) for n in c['control']) or type(c['segments'])!=int or not 2<=c['segments']<=16:raise ValueError()
        edges.add(c['edge'])
    if len(points)+sum(c['segments']-1 for c in curves)>128:raise ValueError()
    out=[]
    for edge,a in enumerate(points):
        out.append(a[:]);b=points[(edge+1)%len(points)];c=next((c for c in curves if c['edge']==edge),None)
        if not c:continue
        if c['type']=='arc':
            m=c['control'];d=2*(a[0]*(m[1]-b[1])+m[0]*(b[1]-a[1])+b[0]*(a[1]-m[1]))
            if abs(d)<1e-8:raise ValueError()
            aa=sum(v*v for v in a);mm=sum(v*v for v in m);bb=sum(v*v for v in b)
            centre=[(aa*(m[1]-b[1])+mm*(b[1]-a[1])+bb*(a[1]-m[1]))/d,(aa*(b[0]-m[0])+mm*(a[0]-b[0])+bb*(m[0]-a[0]))/d]
            radius=math.dist(a,centre);start=math.atan2(a[1]-centre[1],a[0]-centre[0]);end=(math.atan2(b[1]-centre[1],b[0]-centre[0])-start)%(math.pi*2);mid=(math.atan2(m[1]-centre[1],m[0]-centre[0])-start)%(math.pi*2);span=end if mid<end else end-math.pi*2
        for i in range(1,c['segments']):
            t=i/c['segments']
            out.append([(1-t)**2*a[k]+2*(1-t)*t*c['control'][k]+t*t*b[k] for k in [0,1]] if c['type']=='quadratic' else [centre[0]+radius*math.cos(start+span*t),centre[1]+radius*math.sin(start+span*t)])
    return out
