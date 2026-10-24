const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 let posts=0,stops=0,mode='ok';const timers=new Set();
 class Worker{
  constructor(){queueMicrotask(()=>this.onmessage({data:{ready:true}}));}
  postMessage({id}){posts++;if(mode==='hang')return;queueMicrotask(()=>this.onmessage({data:{id,result:{positions:new Float32Array(1024*1024),indices:new Uint32Array(1024*1024),volume:1}}}));}
  terminate(){stops++;}
 }
 const context=vm.createContext({Float32Array,Uint32Array,URL,Worker,document:{baseURI:'https://studio.test/'},setTimeout(fn){const t={fn};timers.add(t);return t;},clearTimeout(t){timers.delete(t);}});
 vm.runInContext(fs.readFileSync('dist/solid-model.js','utf8'),context);const client=vm.runInContext('StudioSolidModel',context),model=client.defaultModel();
 await Promise.all(Array.from({length:12},()=>client.prepare(model,10)));assert.equal(posts,1,'identical simultaneous rebuilds share a worker job');
 for(let depth=11;depth<=15;depth++)await client.prepare(model,depth);
 assert.throws(()=>client.evaluate(model,10),/rebuilt/,'cache is evicted by bytes, not just item count');assert.equal(client.evaluate(model,15).volume,1);
 mode='hang';const attempts=Array.from({length:9},(_,i)=>client.prepare(model,100+i));const results=Promise.allSettled(attempts);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(timers.size,8,'at most eight independent rebuilds enter the worker queue');
 [...timers][0].fn();const settled=await results;assert.ok(settled.every(v=>v.status==='rejected'));assert.equal(stops,1,'watchdog terminates the stalled worker');assert.equal(timers.size,0);
 mode='ok';await client.prepare(model,200);assert.equal(client.evaluate(model,200).volume,1,'a new worker recovers after a timeout');
 console.log('PASS: byte-bounded solid cache, same-recipe deduplication, queue budget, timeout rejection and fresh-worker recovery.');
})().catch(error=>{console.error(error);process.exitCode=1;});
