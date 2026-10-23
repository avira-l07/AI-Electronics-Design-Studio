/* Geometric estimates in mm. Closed topology is necessary, not manufacturing certification. */
const StudioManufacturing=(()=>{
 const densities={'Steel':7850,'Aluminium 6061':2700,'ABS polymer':1040,'Brass':8500,'FR4':1850,'Carbon fibre':1600};
 function inspect(positions,density=null){
  if(!Array.isArray(positions)||positions.length%9||positions.length>900000||positions.some(n=>!Number.isFinite(n)))throw Error('Inspection requires finite triangles, at most 100,000 per part.');
  if(density!==null&&(!Number.isFinite(density)||density<=0||density>50000))throw Error('Density must be 0–50,000 kg/m³, excluding zero.');
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<positions.length;i++){const k=i%3;min[k]=Math.min(min[k],positions[i]);max[k]=Math.max(max[k],positions[i]);}
  if(!positions.length)throw Error('No triangles to inspect.');
  const origin=min.map((v,i)=>(v+max[i])/2),edges=new Map(),faces=new Set();let area=0,signed=0,degenerate=0,duplicates=0;const moment=[0,0,0];
  const key=v=>v.map(n=>Math.round(n*100000)).join(',');
  for(let i=0;i<positions.length;i+=9){const vertices=[0,3,6].map(j=>positions.slice(i+j,i+j+3)),[a,b,c]=vertices.map(p=>p.map((v,k)=>v-origin[k])),ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],twice=Math.hypot(...cross);area+=twice/2;if(twice<1e-9){degenerate++;continue;}
   const ids=vertices.map(key),face=[...ids].sort().join('|');if(faces.has(face))duplicates++;faces.add(face);
   for(let k=0;k<3;k++){const x=ids[k],y=ids[(k+1)%3],edge=x<y?x+'|'+y:y+'|'+x,record=edges.get(edge)||{count:0,balance:0};record.count++;record.balance+=x<y?1:-1;edges.set(edge,record);}
   const v=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;signed+=v;for(let k=0;k<3;k++)moment[k]+=v*(a[k]+b[k]+c[k])/4;
  }
  const boundary=[...edges.values()].filter(e=>e.count===1).length,nonmanifold=[...edges.values()].filter(e=>e.count>2).length,inconsistent=[...edges.values()].filter(e=>e.count===2&&e.balance!==0).length;
  const closed=positions.length>0&&!boundary&&!nonmanifold&&!inconsistent&&!degenerate&&!duplicates&&Math.abs(signed)>1e-8;
  return {triangles:positions.length/9,boundsMm:{min,max,size:min.map((v,k)=>max[k]-v)},areaMm2:area,boundaryEdges:boundary,nonmanifoldEdges:nonmanifold,inconsistentEdges:inconsistent,degenerateTriangles:degenerate,duplicateTriangles:duplicates,closed,globallyReversed:signed<0,volumeMm3:closed?Math.abs(signed):null,centroidMm:closed?moment.map((m,k)=>m/signed+origin[k]):null,densityKgM3:density,massKg:closed&&density!==null?Math.abs(signed)*density/1e9:null};
 }
 function aggregate(rows){const valid=rows.length>0&&rows.every(r=>r.massKg!==null),mass=valid?rows.reduce((n,r)=>n+r.massKg,0):null;return {massKg:mass,centreOfMassMm:valid?rows.reduce((sum,r)=>sum.map((n,k)=>n+r.centroidMm[k]*r.massKg/mass),[0,0,0]):null};}
 return {densities,inspect,aggregate};
})();
