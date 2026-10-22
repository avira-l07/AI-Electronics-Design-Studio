// Verify starter projects survive the same validation used for JSON imports.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const fakeNode={onclick:null,textContent:'',classList:{add(){},remove(){}},style:{}};
let storageFails=false;
const context=vm.createContext({document:{querySelector:()=>fakeNode,addEventListener(){}},localStorage:{getItem:()=>null,setItem:()=>{if(storageFails)throw Error('Storage full')}},structuredClone,crypto:webcrypto,console,assertLocalProjectWrite:()=>{}});
vm.runInContext(fs.readFileSync('dist/assembly-data.js','utf8'),context);
vm.runInContext(fs.readFileSync('dist/drone-template.js','utf8'),context);
vm.runInContext(fs.readFileSync('dist/project-format.js','utf8'),context);
vm.runInContext(fs.readFileSync('dist/app.js','utf8').replace(/render\(\);\s*$/,''),context);
vm.runInContext(fs.readFileSync('dist/advanced.js','utf8').split('render=function()')[0],context);
const ui=fs.readFileSync('dist/studio-ui.js','utf8');
vm.runInContext(ui.slice(ui.indexOf('const studioTemplates='),ui.indexOf('function templateCards()')),context);
const run=code=>vm.runInContext(code,context);
(async()=>{
 const payloads=run("studioTemplates.map(t=>buildStudioTemplate(t.id,t.name))");
 for(const p of payloads){context.candidate=p;assert.equal(run('validProject(candidate)'),true,p.name);}
 assert.equal(run("buildStudioTemplate('dc','  Circuit A  ').name"),'Circuit A');
 run("const a=buildStudioTemplate('slider','A'); const b=buildStudioTemplate('slider','B'); a.parts[0].price=999; a.buildTasks[0].done=true");
 assert.notEqual(run('b.parts[0].price'),999);assert.equal(run('b.buildTasks[0].done'),false);
 const originalCount=run('projects.length'),originalId=run('current.id');storageFails=true;
 await assert.rejects(run("saveNewStudioProject(buildStudioTemplate('dc','Not saved'))"),/could not be saved/);
 assert.equal(run('projects.length'),originalCount);assert.equal(run('current.id'),originalId);
 storageFails=false;await run("saveNewStudioProject(buildStudioTemplate('enclosure','Saved'))");
 assert.equal(run('projects.length'),originalCount+1);assert.equal(run('current.name'),'Saved');
 if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(payloads));
 else console.log('PASS: five valid starter payloads, independent copies, and persistence rollback.');
})().catch(e=>{console.error(e);process.exitCode=1});
