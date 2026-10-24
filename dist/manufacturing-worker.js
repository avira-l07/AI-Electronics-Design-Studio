/* Numerical review stays off the UI thread. Closing the dialog terminates us. */
'use strict';
importScripts('manufacturing.js?v=15.5');
self.onmessage=({data})=>{
 try{
  const {operation,a,b,tolerance}=data || {};
  let result;
  if(operation==='clearance')result=StudioManufacturing.clearance(a,b);
  else if(operation==='wall')result=StudioManufacturing.wall(a);
  else if(operation==='repair'){
   if(!Array.isArray(a)||a.length>54000)throw Error('Repair supports at most 6,000 triangles.');
   result=StudioManufacturing.repair(a,tolerance);
  }else throw Error('Unknown manufacturing operation.');
  self.postMessage({result});
 }catch(error){self.postMessage({error:error.message || 'Manufacturing check failed.'});}
};
