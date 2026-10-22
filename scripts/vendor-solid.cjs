const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),src=path.join(root,'node_modules/manifold-3d'),out=path.join(root,'dist/vendor/manifold');
if(JSON.parse(fs.readFileSync(path.join(src,'package.json'),'utf8')).version!=='3.5.1')throw Error('Review the solid kernel version before updating.');
fs.mkdirSync(out,{recursive:true});
for(const name of ['manifold.js','manifold.wasm','LICENSE'])fs.copyFileSync(path.join(src,name),path.join(out,name));
fs.writeFileSync(path.join(out,'package.json'),'{"type":"module","private":true}\n');
console.log('Vendored Manifold 3.5.1 JS/WASM and Apache 2.0 license.');
