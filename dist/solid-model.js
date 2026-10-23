/* Portable modelling recipe. No user scripts or serialized executable geometry. */
const StudioSolidModel=(()=>{
  let kernel=null,promise=null,worker=null,workerReady=null,request=0;
  const pending=new Map(),cache=new Map();
  const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const exact=(v,keys)=>obj(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
  const number=(v,max=5000)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=max;
  const vector=(v,max=5000)=>Array.isArray(v)&&v.length===3&&v.every(n=>number(n,max));
  const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  function intersects(a,b,c,d){
    const on=(a,b,c)=>Math.abs(orient(a,b,c))<1e-8&&c[0]>=Math.min(a[0],b[0])-1e-8&&c[0]<=Math.max(a[0],b[0])+1e-8&&c[1]>=Math.min(a[1],b[1])-1e-8&&c[1]<=Math.max(a[1],b[1])+1e-8;
    return orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
  }
  function profileError(points){
    if(!Array.isArray(points)||points.length<3||points.length>64||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(v=>number(v))))return 'Use 3–64 vertices, each with two finite coordinates within ±5000 mm.';
    let area=0;
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];
      if(Math.hypot(a[0]-b[0],a[1]-b[1])<.1)return 'Adjacent vertices must be at least 0.1 mm apart. Do not repeat the first point.';
      area+=a[0]*b[1]-b[0]*a[1];
      for(let j=i+1;j<points.length;j++)if(j!==i+1&&!(i===0&&j===points.length-1)&&intersects(a,b,points[j],points[(j+1)%points.length]))return 'The outline crosses or touches itself. Move or remove a vertex.';
    }
    if(Math.abs(area)<.02)return 'The outline needs a non-zero enclosed area.';
    return '';
  }
  function featureValid(f){
    if(!exact(f,['id','name','enabled','operation','shape','dims','position','rotation','through'])||typeof f.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(f.id)||typeof f.name!=='string'||!f.name.trim()||f.name.length>80||typeof f.enabled!=='boolean'||typeof f.through!=='boolean'||!['union','subtract','intersect'].includes(f.operation)||!['box','cylinder'].includes(f.shape)||!vector(f.position)||!vector(f.rotation,3600))return false;
    const keys=f.shape==='box'?['width','height','depth']:['diameter','depth'];
    return exact(f.dims,keys)&&Object.values(f.dims).every(v=>number(v)&&v>=.1)&&(!f.through||f.operation==='subtract'&&f.rotation[0]===0&&f.rotation[1]===0);
  }
  function validate(m,depth){
    if(!obj(m)||!['version','plane','outline','features'].every(k=>Object.hasOwn(m,k))||Object.keys(m).some(k=>!['version','plane','outline','features','base','constraints','modifiers'].includes(k))||m.version!==1||!['XZ','XY','YZ'].includes(m.plane)||!number(depth)||depth<.1||profileError(m.outline)||!Array.isArray(m.features)||m.features.length>16)return false;
    if(m.constraints!==undefined&&(!StudioSketch.valid(m.constraints,m.outline.length)||m.constraints.some(c=>StudioSketch.residual(m.outline,c)>.005)))return false;
    if(m.base!==undefined&&(!exact(m.base,['type','angle','twist','scale'])||!['extrude','revolve'].includes(m.base.type)||!number(m.base.angle,360)||m.base.angle<1||!number(m.base.twist,360)||!number(m.base.scale,4)||m.base.scale<.1||m.base.type==='revolve'&&m.outline.some(p=>p[0]<0)))return false;
    if(m.modifiers!==undefined&&(!Array.isArray(m.modifiers)||m.modifiers.length>4||m.modifiers.some(f=>f?.type==='mirror'?!exact(f,['type','axis'])||!['U','V','W'].includes(f.axis):f?.type==='pattern'?!exact(f,['type','count','step'])||!Number.isInteger(f.count)||f.count<2||f.count>8||!vector(f.step)||Math.hypot(...f.step)<.1:true)))return false;
    if((m.modifiers||[]).reduce((n,f)=>n*(f.type==='pattern'?f.count:1),1)>32||m.base?.type==='revolve'&&m.features.some(f=>f.through))return false;
    const ids=new Set();return m.features.every(f=>featureValid(f)&&!ids.has(f.id)&&!!ids.add(f.id));
  }
  function defaultModel(){return {version:1,plane:'XZ',outline:[[-40,-25],[40,-25],[40,25],[-40,25]],features:[]};}
  function demoAssembly(){const model=defaultModel();model.outline=[[-40,-25],[25,-25],[40,-10],[40,25],[-40,25]];for(const [i,x] of [-25,25].entries())model.features.push({id:'hole-'+i,name:'Mounting hole '+(i+1),enabled:true,operation:'subtract',shape:'cylinder',dims:{diameter:8,depth:12},position:[x,0,0],rotation:[0,0,0],through:true});model.features.push({id:'boss-1',name:'Raised mounting boss',enabled:true,operation:'union',shape:'box',dims:{width:20,height:18,depth:4},position:[0,0,11.9],rotation:[0,0,0],through:false});return {version:1,units:'mm',objects:[{id:'solid-demo',partId:'custom_solid',name:'Custom mounting plate',dims:{depth:12},model,material:'Aluminium 6061',position:[0,0,0],rotation:[0,0,0],visible:true,wireframe:false}]};}
  // Recipe fingerprint for BOM grouping, never an authentication/authorization token.
  function signature(m){const canonical=v=>Array.isArray(v)?v.map(canonical):obj(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;const text=JSON.stringify(canonical({...m,features:m.features.map(({id,name,...feature})=>feature)}));let hash=144066263297769815596495629667062367629n;for(let i=0;i<text.length;i++)hash=BigInt.asUintN(128,(hash^BigInt(text.charCodeAt(i)))*309485009821345068724781371n);return hash.toString(16).padStart(32,'0');}
  function setKernel(value){kernel=value;}
  async function initKernel(){
    if(kernel)return;
    if(!promise)promise=import('./vendor/manifold/manifold.js').then(m=>m.default({locateFile:name=>new URL('./vendor/manifold/'+name,typeof document==='undefined'?self.location.href:document.baseURI).href})).then(m=>{m.setup();kernel=m;}).catch(e=>{promise=null;throw Error('Solid modelling could not load: '+e.message)});
    return promise;
  }
  async function init(){
    if(kernel)return;
    if(!workerReady)workerReady=new Promise((resolve,reject)=>{
      worker=new Worker(new URL('./solid-worker.js',document.baseURI));
      const boot=setTimeout(()=>stop('The solid worker took too long to start.'),20000);
      const stop=message=>{clearTimeout(boot);worker?.terminate();worker=null;workerReady=null;reject(Error(message));for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(message));}pending.clear();};
      worker.onerror=e=>stop('Solid worker could not start: '+e.message);
      worker.onmessage=e=>{const m=e.data;if(m.ready){clearTimeout(boot);resolve();return;}if(m.bootError){stop(m.bootError);return;}const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);if(m.error)p.reject(Error(m.error));else p.resolve(m.result);};
    });
    return workerReady;
  }
  const recipeKey=(model,depth)=>depth+':'+signature(model);
  async function prepare(model,depth){
    if(!validate(model,depth))throw Error('Invalid solid recipe.');
    if(kernel)return;
    const key=recipeKey(model,depth);if(cache.has(key))return;
    await init();const id=++request;
    const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker?.terminate();worker=null;workerReady=null;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Model rebuild exceeded 20 seconds. Simplify the profile or features.'));}pending.clear();},20000);pending.set(id,{resolve,reject,timer});worker.postMessage({id,model,depth});});
    if(cache.size>=256)cache.delete(cache.keys().next().value);cache.set(key,result);
  }
  function evaluate(model,depth){
    if(!validate(model,depth))throw Error('Invalid solid recipe. Check the outline, dimensions and feature limits.');
    if(!kernel){const result=cache.get(recipeKey(model,depth));if(result)return result;throw Error('The solid needs to be rebuilt before it can be displayed.');}
    const allocated=[],keep=o=>{allocated.push(o);return o;};
    try{
      const section=keep(new kernel.CrossSection([model.outline.map(([x,y])=>({x,y}))],'NonZero'));
      const base=model.base||{type:'extrude',twist:0,scale:1};
      let solid=keep(base.type==='revolve'?section.revolve(96,base.angle):section.extrude(depth,base.twist?32:0,base.twist,{x:base.scale,y:base.scale}));
      for(const f of model.features){
        if(!f.enabled)continue;
        const h=f.through?depth+.2:f.dims.depth;
        let tool;
        if(f.shape==='cylinder')tool=keep(kernel.Manifold.cylinder(h,f.dims.diameter/2,f.dims.diameter/2,48));
        else{tool=keep(kernel.Manifold.cube({x:f.dims.width,y:f.dims.height,z:h}));tool=keep(tool.translate({x:-f.dims.width/2,y:-f.dims.height/2,z:0}));}
        tool=keep(tool.rotate(...f.rotation));tool=keep(tool.translate({x:f.position[0],y:f.position[1],z:f.through?-.1:f.position[2]}));
        solid=keep(f.operation==='union'?solid.add(tool):f.operation==='subtract'?solid.subtract(tool):solid.intersect(tool));
        if(solid.status()!=='NoError'||solid.isEmpty())throw Error('Feature “'+f.name+'” leaves an empty or invalid solid. Adjust its size or position.');
      }
      if(solid.status()!=='NoError'||solid.isEmpty())throw Error('The profile did not produce a solid.');
      for(const modifier of model.modifiers||[]){if(modifier.type==='mirror'){const normal=[0,0,0];normal['UVW'.indexOf(modifier.axis)]=1;solid=keep(solid.mirror({x:normal[0],y:normal[1],z:normal[2]}));}else{const original=solid;for(let i=1;i<modifier.count;i++){const copy=keep(original.translate({x:modifier.step[0]*i,y:modifier.step[1]*i,z:modifier.step[2]*i}));solid=keep(solid.add(copy));}}if(solid.status()!=='NoError'||solid.isEmpty())throw Error('The modifier leaves an invalid solid.');}
      const mesh=solid.getMesh(),volume=solid.volume(),area=solid.surfaceArea();
      if(!Number.isFinite(volume)||volume<=0||mesh.triVerts.length>300000)throw Error('The resulting model is empty or exceeds the geometry limit.');
      const positions=new Float32Array(mesh.numVert*3);
      for(let i=0;i<mesh.numVert;i++){
        const u=mesh.vertProperties[i*mesh.numProp],v=mesh.vertProperties[i*mesh.numProp+1],w=mesh.vertProperties[i*mesh.numProp+2];
        positions.set(model.plane==='XZ'?[u,w,-v]:model.plane==='YZ'?[w,u,v]:[u,v,w],i*3);
      }
      return {positions,indices:new Uint32Array(mesh.triVerts),volume,area,triangles:mesh.numTri};
    }finally{for(let i=allocated.length-1;i>=0;i--)allocated[i].delete();}
  }
  function geometry(THREE,model,depth){
    const data=evaluate(model,depth),geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(data.positions),3));geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(data.indices),1));geometry.scale(.1,.1,.1);
    const flat=geometry.toNonIndexed();geometry.dispose();flat.computeVertexNormals();flat.userData={volumeMm3:data.volume,areaMm2:data.area,triangles:data.triangles};return flat;
  }
  return {defaultModel,demoAssembly,profileError,featureValid,validate,signature,init,initKernel,prepare,setKernel,evaluate,geometry};
})();
