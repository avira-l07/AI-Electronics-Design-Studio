const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context=vm.createContext({console});
const source=fs.readFileSync('dist/studio-tools.js','utf8');
vm.runInContext(fs.readFileSync('dist/advanced.js','utf8').split(/\r?\n/).find(line=>line.startsWith('function kinematics(')),context);
vm.runInContext(source.slice(source.indexOf('function seriesParallel('),source.indexOf('function motionPlot(')),context);
vm.runInContext(source.slice(source.indexOf('function sketchDXF('),source.indexOf('function sketchProperties(')),context);
const run=s=>vm.runInContext(s,context);
assert.equal(run("seriesParallel(12,[1000,2000],'series').equivalent"),3000);
assert.equal(run("seriesParallel(12,[1000,1000],'parallel').equivalent"),500);
for(const mode of ['series','parallel']){
 context.mode=mode;const r=run('seriesParallel(12,[100,200,300],mode)');
 assert.ok(Math.abs(r.branches.reduce((n,b)=>n+b.power,0)-r.power)<1e-12);
 assert.ok(Math.abs((mode==='series'?r.branches.reduce((n,b)=>n+b.voltage,0):r.branches.reduce((n,b)=>n+b.current,0))-(mode==='series'?12:r.current))<1e-12);
}
assert.throws(()=>run("seriesParallel(12,[0,1],'parallel')"));assert.throws(()=>run("motionSample(80,30,600,45)"));
for(let a=5;a<360;a+=5){const omega=600*2*Math.PI/60,delta=.0001;const analytic=run(`motionSample(80,150,600,${a}).acceleration`),derivative=(run(`kinematics(80,150,${a+delta},600).velocity`)-run(`kinematics(80,150,${a-delta},600).velocity`))/(2*delta*Math.PI/180)*omega;assert.ok(Math.abs(analytic-derivative)<1e-5)}
vm.runInContext('let current={stroke:80,rod:150,rpm:600}',context);
assert.equal(run('motionSamples(0,360,90).length'),5);assert.equal(run('motionSamples(0,10,3).at(-1).degrees'),10);assert.throws(()=>run('motionSamples(90,0,3)'));
const dxf=run("sketchDXF([{type:'rect',x:0,y:0,w:10,h:5},{type:'circle',x:5,y:5,r:2},{type:'dimension',x:0,y:0,x2:10,y2:0}])");assert.equal((dxf.match(/\r\nLINE\r\n/g)||[]).length,5);assert.ok(dxf.includes('10.0 mm'));assert.ok(dxf.endsWith('EOF'));
console.log('PASS: circuit conservation, 71 acceleration derivative checks, sampling bounds, and DXF entities.');

for(const bad of [[{type:'circle',x:0,y:0,r:NaN}],[{type:'line',x:0,y:0,x2:10}],[{type:'rect',x:Infinity,y:0,w:2,h:3}],[{type:'circle',x:0,y:0,r:-1}],[{type:'line',x:0,y:0,x2:10001,y2:0}],[{type:'unknown',x:0,y:0}],Array(1001).fill({type:'circle',x:0,y:0,r:1})]){context.bad=bad;assert.throws(()=>run('sketchDXF(bad)'),/DXF/);}
context.annotated=[{type:'text',x:1,y:2,text:'safe\n0\rEOF\u0000',layer:'Notes\n0\rEOF'}];const cleaned=run('sketchDXF(annotated)');assert.ok(!cleaned.includes('\u0000'));assert.ok(cleaned.includes('safe 0 EOF '));
