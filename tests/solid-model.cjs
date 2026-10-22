const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const {default:Module}=await import(pathToFileURL(path.resolve('dist/vendor/manifold/manifold.js')).href),kernel=await Module();kernel.setup();
 const context=vm.createContext({structuredClone,Float32Array,Uint32Array});vm.runInContext(fs.readFileSync('dist/solid-model.js','utf8'),context);const model=vm.runInContext('StudioSolidModel',context);model.setKernel(kernel);
 const feature=patch=>({id:'feature-1',name:'Test feature',enabled:true,operation:'subtract',shape:'box',dims:{width:20,height:10,depth:5},position:[0,0,5],rotation:[0,0,0],through:false,...patch});
 const base=model.defaultModel();assert.ok(model.validate(base,10));assert.equal(model.evaluate(base,10).volume,40000);
 const solid=ops=>({...structuredClone(base),features:ops});
 assert.equal(model.evaluate(solid([feature({})]),10).volume,39000,'a pocket removes the actual intersection volume');
 assert.equal(model.evaluate(solid([feature({operation:'union',position:[0,0,9]})]),10).volume,40800,'union fuses overlapping solid volume');
 assert.equal(model.evaluate(solid([feature({operation:'intersect',position:[0,0,0]})]),10).volume,1000,'intersection retains the common volume');
 assert.equal(model.evaluate(solid([feature({enabled:false})]),10).volume,40000,'suppressed features do not affect geometry');
 const hole=feature({shape:'cylinder',dims:{diameter:6,depth:1},position:[0,0,0],through:true}),cut=solid([hole]);
 const result=model.evaluate(cut,10);assert.ok(Math.abs(result.volume-(40000-Math.PI*9*10))<1,'48-sided circular tool approximation');assert.ok(Math.abs(model.evaluate(cut,20).volume-result.volume*2)<1e-5,'through cuts follow edited extrusion depth');
 const edges=new Map();for(let i=0;i<result.indices.length;i+=3)for(const [a,b] of [[0,1],[1,2],[2,0]]){const edge=[result.indices[i+a],result.indices[i+b]].sort((a,b)=>a-b).join(':');edges.set(edge,(edges.get(edge)||0)+1);}assert.ok([...edges.values()].every(n=>n===2),'result has closed indexed topology');
 assert.equal(model.evaluate({...base,outline:[...base.outline].reverse()},10).volume,40000,'both outline windings work');
 assert.ok(model.profileError([[0,0],[10,10],[0,10],[10,0]]));assert.ok(model.profileError([[0,0],[10,0],[10,10],[0,0]]));assert.ok(model.profileError([[0,0],[1,0],[2,0]]));
 for(const invalid of [{...base,features:Array(17).fill(hole)},{...base,features:[hole,hole]},{...base,outline:Array(65).fill([1,1])},{...base,plane:'eval'},{...base,script:'alert(1)'},{...base,features:[feature({through:true,operation:'union'})]}])assert.equal(model.validate(invalid,10),false);
 const before=JSON.stringify(base);assert.throws(()=>model.evaluate(solid([feature({dims:{width:200,height:200,depth:50},position:[0,0,-10]})]),10),/empty or invalid/);assert.equal(JSON.stringify(base),before,'failed operations do not mutate the input');
 const THREE=await import(pathToFileURL(path.resolve('dist/vendor/three/three.module.js')).href);
 for(const [plane,expected] of [['XZ',[80,10,50]],['XY',[80,50,10]],['YZ',[10,80,50]]]){const geometry=model.geometry(THREE,{...base,plane},10);geometry.computeBoundingBox();const size=geometry.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(10).toArray();assert.deepEqual(size,expected);geometry.dispose();}
 const demo=model.demoAssembly();assert.ok(model.validate(demo.objects[0].model,12));assert.ok(model.evaluate(demo.objects[0].model,12).volume>0);
 const renamed=structuredClone(demo.objects[0].model);renamed.features[0].name='Renamed';renamed.features[0].id='new-id';assert.equal(model.signature(renamed),model.signature(demo.objects[0].model),'labels do not reset geometry-based BOM prices');
 vm.runInContext(fs.readFileSync('dist/assembly-data.js','utf8'),context);const assembly=vm.runInContext('StudioAssembly',context);assert.ok(assembly.validate(demo));
 const duplicate=structuredClone(demo.objects[0]);duplicate.id='second';demo.objects.push(duplicate);const bom=assembly.bom(demo,[]);assert.equal(bom.length,1);assert.equal(bom[0].qty,2);demo.objects[1].model.features[0].dims.diameter=10;assert.equal(assembly.bom(demo,[]).length,2,'different recipes are different BOM variants');
 class MockWorker{constructor(){setImmediate(()=>this.onmessage({data:{ready:true}}));}postMessage({id,model:recipe,depth}){setImmediate(()=>{try{this.onmessage({data:{id,result:model.evaluate(recipe,depth)}})}catch(e){this.onmessage({data:{id,error:e.message}})}});}terminate(){}}
 const browser=vm.createContext({structuredClone,Float32Array,Uint32Array,URL,Worker:MockWorker,document:{baseURI:'https://studio.test/'},setTimeout,clearTimeout});vm.runInContext(fs.readFileSync('dist/solid-model.js','utf8'),browser);const client=vm.runInContext('StudioSolidModel',browser);await client.prepare(base,10);
 for(let i=0;i<3;i++){const geo=client.geometry(THREE,base,10);geo.computeBoundingBox();assert.equal(geo.boundingBox.max.x-geo.boundingBox.min.x,8,'reusing worker cache must not repeatedly scale the shared vertices');geo.dispose();}
 await assert.rejects(client.prepare(solid([feature({dims:{width:200,height:200,depth:50},position:[0,0,-10]})]),10),/empty or invalid/);
 console.log('PASS: actual kernel extrusion, cuts, pockets, union, intersection, feature suppression, watertight topology, all work planes, invalid profiles/limits, failure isolation and custom-solid BOM variants.');
})().catch(e=>{console.error(e.message,e.stack?.split('\n').slice(1,4).join('\n'));process.exitCode=1});
