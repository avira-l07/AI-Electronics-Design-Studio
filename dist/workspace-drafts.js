/* Unapplied workspace forms survive tab changes in this session only.
   Never put credentials or these drafts in shared storage or server payloads. */
(()=>{
 const drafts=new WeakMap(),owners=new WeakMap();
 const definitions={
  stroke:p=>p.stroke,rod:p=>p.rod,rpm:p=>p.rpm,material:p=>p.material,
  electrical:p=>p.electrical||'',
  voltage:p=>p.circuit?.voltage??12,resistance:p=>p.circuit?.resistance??1000,rating:p=>p.circuit?.rating??.25,
  batchQuantity:p=>p.costSettings?.quantity??1,labor:p=>p.costSettings?.labor??0,
  tooling:p=>p.costSettings?.tooling??0,overhead:p=>p.costSettings?.overhead??0,
  networkVoltage:p=>p.resistorNetwork?.voltage??12,networkMode:p=>p.resistorNetwork?.mode??'series',
  networkResistors:p=>(p.resistorNetwork?.resistors??[1000,2000]).join(', ')
 };
 const numeric=new Set(Object.keys(definitions).filter(id=>!['material','electrical','networkMode','networkResistors'].includes(id)));
 const same=(id,a,b)=>id==='networkResistors'?a.replace(/\s/g,'')===b.replace(/\s/g,''):numeric.has(id)&&a!==''&&b!==''&&Number.isFinite(+a)&&Number.isFinite(+b)?+a===+b:a===b;
 function synchronize(project){
  const saved=drafts.get(project);if(!saved)return;
  for(const [id,draft] of saved){const applied=String(definitions[id](project));if(same(id,applied,draft.value)||!same(id,applied,draft.base))saved.delete(id);}
 }
 function notice(){
  const content=document.getElementById('content');if(!content)return;
  const saved=drafts.get(current),visible=[...content.querySelectorAll('input[id],select[id],textarea[id]')].filter(el=>saved?.has(el.id));
  let note=document.getElementById('workspaceDraftNotice');
  if(!visible.length){note?.remove();return;}
  if(!note){
   note=document.createElement('div');note.id='workspaceDraftNotice';note.className='workspaceDraftNotice';note.setAttribute('role','status');
   const message=document.createElement('span');message.textContent='Unapplied draft · kept while switching tabs. Apply or save before reloading.';
   const discard=document.createElement('button');discard.type='button';discard.textContent='Discard visible draft';
   discard.onclick=()=>{const saved=drafts.get(current);content.querySelectorAll('input[id],select[id],textarea[id]').forEach(el=>saved?.delete(el.id));render();};
   note.append(message,discard);content.prepend(note);
  }
 }
 function restore(){
  if(!current||!projects.includes(current))return;
  synchronize(current);const saved=drafts.get(current);
  for(const id of Object.keys(definitions)){
   const el=document.querySelector('#content #'+id);if(!el)continue;
   owners.set(el,current);if(saved?.has(id))el.value=saved.get(id).value;
  }
  notice();
 }
 function capture(event){
  const el=event.target,project=owners.get(el);if(!project||!definitions[el.id])return;
  let saved=drafts.get(project);if(!saved){saved=new Map();drafts.set(project,saved);}
  const base=String(definitions[el.id](project));
  if(same(el.id,base,el.value))saved.delete(el.id);else saved.set(el.id,{base,value:el.value});
  notice();
 }
 document.addEventListener('input',capture);document.addEventListener('change',capture);
 const previousRender=render;render=function(...args){const result=previousRender(...args);restore();return result;};
 const previousPersist=persist;persist=function(...args){const result=previousPersist(...args);if(current)synchronize(current);notice();return result;};
 // Retain core project actions; resolve their latest adapters at click time.
 const run=(action,needsProject=false)=>()=>{
  if(studioBackend.enabled&&!signedIn){location.hash='/login?next=workspace';return;}
  if(needsProject&&!projects.includes(current)){toast('Open a project before using this action.');return;}
  action();
 };
 for(const [name,action,needsProject] of [
  ['Create new project',()=>newProject(),false],['Import project JSON',()=>importProject(),false],
  ['Export project JSON',()=>document.getElementById('export').click(),true],
  ['Save revision',()=>document.getElementById('saveRevision').click(),true]
 ]){const command=quickActions.find(([label])=>label===name);if(command)command[1]=run(action,needsProject);}
 document.addEventListener('keydown',event=>{
  if(page!=='sketch'||document.body.classList.contains('productMode')||document.getElementById('dialog').open||event.target.closest('input,textarea,select,[contenteditable=true]'))return;
  if(['Delete','Backspace'].includes(event.key)&&document.getElementById('deleteShape')){event.preventDefault();document.getElementById('deleteShape').click();}
 });
 document.getElementById('toast').setAttribute('role','status');
 document.getElementById('toast').setAttribute('aria-live','polite');
 restore();
})();
