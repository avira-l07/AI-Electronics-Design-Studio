/* Small explicit constraint system for polygon sketches, not a general CAD solver. */
const StudioSketch=(()=>{
  const valid=(cs,n)=>Array.isArray(cs)&&cs.length<=32&&cs.every(c=>c&&Number.isInteger(c.a)&&c.a>=0&&c.a<n&&(['horizontal','vertical','length'].includes(c.type)?Object.keys(c).sort().join(',')==='a,b,type,value'&&Number.isInteger(c.b)&&c.b>=0&&c.b<n&&c.a!==c.b&&typeof c.value==='number'&&Number.isFinite(c.value)&&(c.type==='length'?c.value>=.1&&c.value<=5000:c.value===0):c.type==='fixed'&&Object.keys(c).sort().join(',')==='a,type,value'&&Array.isArray(c.value)&&c.value.length===2&&c.value.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=5000)));
  function residual(points,c){const a=points[c.a];if(c.type==='fixed')return Math.hypot(a[0]-c.value[0],a[1]-c.value[1]);const b=points[c.b];return c.type==='horizontal'?Math.abs(a[1]-b[1]):c.type==='vertical'?Math.abs(a[0]-b[0]):Math.abs(Math.hypot(a[0]-b[0],a[1]-b[1])-c.value);}
  function solve(outline,constraints){
    if(!valid(constraints,outline.length))throw Error('Invalid sketch constraints.');
    const p=outline.map(v=>[...v]),fixed=new Map();for(const c of constraints)if(c.type==='fixed'){if(fixed.has(c.a)&&Math.hypot(...c.value.map((v,i)=>v-fixed.get(c.a)[i]))>.001)throw Error('Conflicting fixed-point constraints.');fixed.set(c.a,c.value);}
    for(let step=0;step<300;step++){
      for(const [i,value] of fixed)p[i]=[...value];
      for(const c of constraints){if(c.type==='fixed')continue;const a=p[c.a],b=p[c.b],wa=fixed.has(c.a)?0:1,wb=fixed.has(c.b)?0:1,total=wa+wb;if(!total)continue;let dx=b[0]-a[0],dy=b[1]-a[1];if(c.type==='horizontal')dx=0;else if(c.type==='vertical')dy=0;else{const d=Math.hypot(dx,dy);if(d<1e-10){dx=-c.value;dy=0;}else{dx*=1-c.value/d;dy*=1-c.value/d;}}a[0]+=dx*wa/total;a[1]+=dy*wa/total;b[0]-=dx*wb/total;b[1]-=dy*wb/total;}
      if(constraints.every(c=>residual(p,c)<1e-5))return p;
    }
    throw Error('Constraints conflict or did not converge. Remove a constraint or adjust its value; the saved solid is unchanged.');
  }
  function curve(points,edge,control,segments){
    if(!Number.isInteger(edge)||edge<0||edge>=points.length||!Array.isArray(control)||control.length!==2||control.some(n=>!Number.isFinite(n)||Math.abs(n)>5000)||!Number.isInteger(segments)||segments<2||segments>16||points.length+segments-1>64)throw Error('Choose an edge, a finite control point and 2–16 segments within the 64-vertex limit.');
    const a=points[edge],b=points[(edge+1)%points.length],insert=[];for(let i=1;i<segments;i++){const t=i/segments;insert.push([0,1].map(k=>(1-t)**2*a[k]+2*(1-t)*t*control[k]+t*t*b[k]));}
    return [...points.slice(0,edge+1),...insert,...points.slice(edge+1)];
  }
  return {valid,residual,solve,curve};
})();
