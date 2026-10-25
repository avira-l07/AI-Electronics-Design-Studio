// Verify starter projects survive the same validation used for JSON imports.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const fakeNode={onclick:null,textContent:'',classList:{add(){},remove(){}},style:{}};
let storageFails=false;
const context=vm.createContext({document:{querySelector:()=>fakeNode,addEventListener(){}},localStorage:{getItem:()=>null,setItem:()=>{if(storageFails)throw Error('Storage full')}},structuredClone,crypto:webcrypto,console,assertLocalProjectWrite:()=>{}});
vm.runInContext(fs.readFileSync('dist/solid-model.js','utf8'),context);
 vm.runInContext(fs.readFileSync('dist/assembly-data.js','utf8'),context);
vm.runInContext(fs.readFileSync('dist/drone-template.js','utf8'),context);
vm.runInContext(fs.readFileSync('dist/project-format.js','utf8'),context);
vm.runInContext(fs.readFileSync('dist/app.js','utf8').replace(/render\(\);\s*$/,''),context);
vm.runInContext(fs.readFileSync('dist/advanced.js','utf8').split('render=function()')[0],context);
const ui=fs.readFileSync('dist/studio-ui.js','utf8');
vm.runInContext(ui.slice(ui.indexOf('const studioTemplates='),ui.indexOf('function templateCards()')),context);
vm.runInContext('var productRoutes=[],accountMenu=[],bindProduct=()=>{}',context);
vm.runInContext(fs.readFileSync('dist/project-types.js','utf8'),context);
const run=code=>vm.runInContext(code,context);
(async()=>{
 const payloads=run("studioTemplates.map(t=>buildStudioTemplate(t.id,t.name))");
 for(const p of payloads){context.candidate=p;assert.equal(run('validProject(candidate)'),true,p.name);}
 for(const id of ['car-engine','ship','lora','robot-arm','drone','cnc','enclosure','electric-vehicle','pump','weather-station','solar','custom']){
  context.category=id;const p=run('StudioProjectTypes.buildProject(category,"  Independent project  ")');context.candidate=p;assert.equal(run('validProject(candidate)'),true,id);assert.equal(p.name,'Independent project');assert.notEqual(p.id,run('current.id'));
  if(id==='drone')assert.equal(p.assembly3d.objects.length,136);
  else{assert.equal(p.assembly3d.objects.length,0,id+' starts empty');assert.equal(p.parts.length,0);assert.equal(p.sketch.length,0);assert.equal(p.revisions.length,0);assert.ok(p.notes[0].body.includes('No category-specific model'));}
 }
 assert.throws(()=>run('StudioProjectTypes.buildProject("not-a-type","Bad")'),/Unknown project type/);assert.throws(()=>run('StudioProjectTypes.buildProject("car-engine","  ")'),/project name/);
 run('const engineA=StudioProjectTypes.buildProject("car-engine","A"),engineB=StudioProjectTypes.buildProject("car-engine","B");engineA.buildTasks[0].done=true;engineA.assembly3d.objects.push({})');assert.equal(run('engineB.buildTasks[0].done'),false);assert.equal(run('engineB.assembly3d.objects.length'),0);
 assert.equal(run("buildStudioTemplate('dc','  Circuit A  ').name"),'Circuit A');
 run("const a=buildStudioTemplate('slider','A'); const b=buildStudioTemplate('slider','B'); a.parts[0].price=999; a.buildTasks[0].done=true");
 assert.notEqual(run('b.parts[0].price'),999);assert.equal(run('b.buildTasks[0].done'),false);
 const originalCount=run('projects.length'),originalId=run('current.id');storageFails=true;
 await assert.rejects(run("saveNewStudioProject(buildStudioTemplate('dc','Not saved'))"),/could not be saved/);
 assert.equal(run('projects.length'),originalCount);assert.equal(run('current.id'),originalId);
 storageFails=false;await run("saveNewStudioProject(buildStudioTemplate('enclosure','Saved'))");
 assert.equal(run('projects.length'),originalCount+1);assert.equal(run('current.name'),'Saved');
 if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(payloads));
 else console.log('PASS: six starters, 12 category projects, empty workspace isolation, independent copies, and persistence rollback.');
})().catch(e=>{console.error(e);process.exitCode=1});
