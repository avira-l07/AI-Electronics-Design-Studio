const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'dist/assembly-data.js'),'utf8'),context);
const schema=vm.runInContext('({materials:StudioAssembly.materials,parts:Object.fromEntries(StudioAssembly.parts.map(p=>[p.id,p.dims]))})',context);
fs.writeFileSync(path.join(root,'api/assembly_schema.json'),JSON.stringify(schema,null,2)+'\n');
