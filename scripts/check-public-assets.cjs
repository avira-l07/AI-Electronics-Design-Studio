/* Publishing guard: frontend assets must not include private/runtime files. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../dist');
let count=0;
function check(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const name=entry.name,file=path.join(dir,name);
 if(name.startsWith('.')||fs.lstatSync(file).isSymbolicLink()||/\.(?:env|db(?:-wal|-shm)?|sqlite3?|sqlite-(?:wal|shm)|py[co]?|sql|ya?ml|toml|pem|key|log)$/i.test(name))throw Error('Private/runtime file cannot be published: '+path.relative(root,file));
 if(entry.isDirectory())check(file);else if(entry.isFile())count++;
}}
try{check(root);console.log('PASS: '+count+' public assets; no hidden files, symlinks, server source or database/key files.');}catch(error){console.error(error.message);process.exitCode=1;}
