const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('dist/project-format.js','utf8');
const sample={id:'test',name:'Test',kind:'Concept sketch',designType:'sketch',stroke:80,rod:150,rpm:600,material:'Steel',parts:[],notes:[],revisions:[],sketch:[{type:'text',x:10,y:20,text:'<script>test</script>',layer:'Annotations'},{type:'dimension',x:0,y:0,x2:10,y2:0}]};
function context(raw,blocked=false){const writes=[];const c=vm.createContext({structuredClone,console,TextEncoder,localStorage:{getItem:()=>{if(blocked)throw Error('Blocked');return raw},setItem:(...args)=>writes.push(args)}});vm.runInContext(source,c);return {c,writes,run:s=>vm.runInContext(s,c)}}
let {c,run,writes}=context('{broken');c.sample=sample;
assert.equal(run('studioStorage.projects([sample]).length'),0);assert.equal(run("studioStorage.problems.get('engineering-studio-v1').raw"),'{broken');assert.equal(writes.length,0);
({c,run,writes}=context(null,true));c.sample=sample;assert.equal(run('studioStorage.projects([sample]).length'),0);assert.equal(writes.length,0);
({c,run}=context('[]'));c.sample=sample;assert.equal(run('studioStorage.projects([sample]).length'),0,'explicit empty library is retained');
({c,run}=context(null));c.sample=sample;assert.equal(run('studioStorage.projects([sample]).length'),1,'only a new library receives a sample');
assert.equal(run('StudioProjectData.validate(sample)'),true);
for(const bad of [{...sample,name:' '},{...sample,parts:[{name:'x',material:'y',qty:1.5,price:0}]},{...sample,parts:[{name:'x',material:'y',qty:100001,price:0}]},{...sample,sketch:[{type:'rect',x:0,y:0,w:-2,h:5}]},{...sample,sketch:[{type:'text',x:0,y:0,text:'x',layer:'x'.repeat(51)}]},{...sample,circuit:{voltage:1e308,resistance:1e-300,rating:1}},{...sample,revisions:Array(51).fill({label:'x',date:'today',snapshot:{...sample,revisions:[]}})}]){c.bad=bad;assert.equal(run('StudioProjectData.validate(bad)'),false);}
const snapshot=structuredClone(sample);delete snapshot.revisions;const revised={...sample,revisions:[{label:'Sketch checkpoint',date:new Date().toISOString(),snapshot}]};c.revised=revised;assert.equal(run('StudioProjectData.validate(revised)'),true,'extended shapes work inside old snapshot format');
c.nested={...sample,revisions:[{label:'bad',date:'today',snapshot:revised}]};assert.equal(run('StudioProjectData.validate(nested)'),false);
for(const value of ['=HYPERLINK("bad")','+SUM(A1)','-1+2','@SUM(A1)',' \t=1','\tlabel','\n=1']){c.value=value;assert.ok(run('StudioProjectData.csvCell(value)').startsWith('"\''));}
assert.equal(run("StudioProjectData.csvCell('Resistor, 1kΩ')"),'"Resistor, 1kΩ"');
assert.equal(run("StudioProjectData.csvCell('a\"b')"),'"a""b"');
assert.equal(run("Object.hasOwn(StudioProjectData.parse('{\"__proto__\":{\"polluted\":true},\"constructor\":{}}'),'__proto__')"),false);
const quality=fs.readFileSync('dist/studio-quality.js','utf8');
vm.runInContext(quality.slice(quality.indexOf('function parseStudioBackup('),quality.indexOf('function backupCenter(')),c);
c.backup=JSON.stringify({format:'engineering-studio-backup',version:1,projects:[sample,revised,sample],trash:[{project:sample}]});
assert.equal(run('parseStudioBackup(backup).projects.length'),3,'all projects are checked without treating array indexes as recursion depth');
assert.equal(run('parseStudioBackup(backup).projects[1].revisions[0].snapshot.sketch[0].text'),sample.sketch[0].text);
assert.throws(()=>run("parseStudioBackup('{\"format\":\"engineering-studio-backup\",\"version\":2,\"projects\":[],\"trash\":[]}')"));
console.log('PASS: corrupt/blocked storage preservation, empty libraries, import/revision limits, backup round-trip, prototype filtering and CSV formula protection.');

for(const [value,expected] of [['../../bad\\name\n.json','_.._bad_name.json'],['CON.json','_CON.json'],['LPT1.csv','_LPT1.csv'],[' report. ','report'],['...','export'],['part\u202egpj.stl','partgpj.stl'],['Résistance 日本語.stl','Résistance 日本語.stl']]){c.filename=value;assert.equal(run('StudioProjectData.downloadFilename(filename)'),expected);}
c.filename='🙂'.repeat(200)+'.json';const safe=run('StudioProjectData.downloadFilename(filename)');assert.ok(new TextEncoder().encode(safe).length<=180);assert.ok(safe.endsWith('.json'));assert.ok(!safe.includes('�'));
