/* Only this DOM-free worker permits the vendored engine's generated bindings.
   Recipes are data, never executable strings. Main-page JavaScript eval stays blocked. */
importScripts('./solid-model.js');
StudioSolidModel.initKernel().then(()=>postMessage({ready:true})).catch(e=>postMessage({bootError:e.message}));
onmessage=e=>{
  const {id,model,depth}=e.data;
  try{const result=StudioSolidModel.evaluate(model,depth);postMessage({id,result},[result.positions.buffer,result.indices.buffer]);}
  catch(error){postMessage({id,error:error.message||'Solid rebuild failed.'});}
};
