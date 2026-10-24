// Run after the explicit local-ai-acceptance.py experiment. Uses the actual kernel.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
(async()=>{
 const proposal=JSON.parse(fs.readFileSync('tmp/local-ai-acceptance/proposal.json','utf8'));
 const {default:Module}=await import(pathToFileURL(path.resolve('dist/vendor/manifold/manifold.js')).href),kernel=await Module();kernel.setup();
 const context=vm.createContext({structuredClone,Float32Array,Uint32Array});vm.runInContext(fs.readFileSync('dist/solid-model.js','utf8'),context);
 const model=vm.runInContext('StudioSolidModel',context);model.setKernel(kernel);
 assert.ok(model.validate(proposal.model,proposal.depth));const mesh=model.evaluate(proposal.model,proposal.depth);
 const expected=(80*50-2*Math.PI*3*3)*8;
 assert.ok(Math.abs(mesh.volume-expected)<2,'generated geometry matches the requested plate and holes within polygon approximation');
 const edges=new Map();for(let i=0;i<mesh.indices.length;i+=3)for(const [a,b] of [[0,1],[1,2],[2,0]]){const k=[mesh.indices[i+a],mesh.indices[i+b]].sort((a,b)=>a-b).join(':');edges.set(k,(edges.get(k)||0)+1);}
 assert.ok([...edges.values()].every(n=>n===2));
 console.log('PASS: actual local-model proposal builds closed kernel geometry and matches the requested volume. One sample; no general AI/manufacturing acceptance claimed.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
