/* Surface mating in world millimetres. A geometric placement aid, not fit validation. */
const StudioPlacement=(()=>{
 function matrix(T,p,r){return new T.Matrix4().compose(new T.Vector3(...p),new T.Quaternion().setFromEuler(new T.Euler(...r.map(v=>v*Math.PI/180))),new T.Vector3(1,1,1));}
 function pose(T,m){const p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();m.decompose(p,q,s);const e=new T.Euler().setFromQuaternion(q);return {position:p.toArray(),rotation:[e.x,e.y,e.z].map(v=>v*180/Math.PI)};}
 function moving(data,selected){const ids=new Set(selected);if(!ids.size||[...ids].some(id=>!data.objects.some(o=>o.id===id)))throw Error('Select a moving part first.');let changed=true;while(changed){changed=false;for(const j of data.joints||[])if(ids.has(j.parent)&&!ids.has(j.child)){ids.add(j.child);changed=true;}}for(const j of data.joints||[])if(ids.has(j.child)&&!ids.has(j.parent))throw Error('This part is already attached. Choose Detach before moving it.');return ids;}
 function mate(T,data,options){const {sourceId,targetId,sourcePoint,sourceNormal,targetPoint,targetNormal,gapMm=0,spinDegrees=0,align=true,lock=false}=options;
  const vector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=100000);
  if(![sourcePoint,sourceNormal,targetPoint,targetNormal].every(vector)||!Number.isFinite(gapMm)||Math.abs(gapMm)>1000||!Number.isFinite(spinDegrees)||Math.abs(spinDegrees)>3600||typeof align!=='boolean'||typeof lock!=='boolean')throw Error('Use valid surface picks, a gap within ±1000 mm and a finite rotation.');
  const ids=moving(data,options.movingIds||[sourceId]);if(!ids.has(sourceId))throw Error('The picked face must belong to the moving selection.');if(targetId!==null&&(!data.objects.some(o=>o.id===targetId)||ids.has(targetId)))throw Error('Choose a stationary target outside the moving assembly.');
  const normal=new T.Vector3(...targetNormal),from=new T.Vector3(...sourceNormal);if(normal.length()<1e-8||from.length()<1e-8)throw Error('A picked face has no usable normal.');normal.normalize();from.normalize();
  const rotation=align?new T.Quaternion().setFromUnitVectors(from,normal.clone().negate()):new T.Quaternion();if(align)rotation.premultiply(new T.Quaternion().setFromAxisAngle(normal,spinDegrees*Math.PI/180));
  const destination=new T.Vector3(...targetPoint).addScaledVector(normal,gapMm),delta=new T.Matrix4().makeTranslation(...destination.toArray()).multiply(new T.Matrix4().makeRotationFromQuaternion(rotation)).multiply(new T.Matrix4().makeTranslation(...sourcePoint.map(v=>-v))),next=structuredClone(data);
  for(const record of next.objects)if(ids.has(record.id))Object.assign(record,pose(T,delta.clone().multiply(matrix(T,record.position,record.rotation))));
  if(lock&&targetId!==null){const parent=next.objects.find(o=>o.id===targetId),linked=new Set((next.joints||[]).map(j=>j.child));for(const record of next.objects.filter(o=>ids.has(o.id)&&!linked.has(o.id))){const local=pose(T,matrix(T,parent.position,parent.rotation).invert().multiply(matrix(T,record.position,record.rotation)));(next.joints||=[]).push({id:'attach-'+crypto.randomUUID(),parent:targetId,child:record.id,type:'fixed',axis:'Y',offset:local.position,orientation:local.rotation,value:0,min:0,max:0});}}
  if(!StudioAssembly.validate(next))throw Error('This attachment exceeds assembly limits. The original has not changed.');return next;
 }
 return {matrix,pose,moving,mate};
})();
