/* Recovery, navigation and presentation improvements shared by both modes. */
let localUnsaved=false;
function assertLocalProjectWrite(){
  if(studioStorage.problems.has('engineering-studio-v1')||studioStorage.problems.has('studio-trash-v1'))throw Error('Open Backups & recovery before changing saved projects.');
  if(localUnsaved)throw Error('Export or correct your unsaved edits before changing the project collection.');
  if(localConflict||studioStorage.read('engineering-studio-v1')!==localStorageVersion){localConflict=true;throw Error('Projects changed in another tab. Export your edits before reloading.');}
}
function projectPreview(p){
  if(p.assembly3d?.objects.some(o=>StudioDrone.stage(o.id)))return templateArt('drone');
  if(projectCategory(p)==='sketch'){
    const shapes=(p.sketch||[]);
    return shapes.length?`<svg viewBox="0 0 800 440" aria-hidden="true" fill="none" stroke="currentColor">${sketchShapesMarkup(shapes)}</svg>`:templateArt('sketch');
  }
  return templateArt(projectCategory(p)==='electronics'?'circuit':'mechanical');
}
function renderEmptyWorkspace(){
  playback=false;cancelAnimationFrame(raf);
  $('#title').textContent='A place for your next idea';$('#crumbTitle').textContent='No project selected';
  $('#tabs').innerHTML='';$('#projectNav').innerHTML='';$('#editControls')?.remove();if($('#workspaceOptions'))$('#workspaceOptions').disabled=true;
  $('#content').innerHTML=`<section class="studioPanel emptyWorkspace"><span>${studioIcon('sketch')}</span><span class="eyebrow">YOUR NEXT CONCEPT</span><h2>Start with a question.<br>Make it something you can explore.</h2><p>Choose a starter with editable dimensions, or create a blank mechanism, circuit or sketch.</p><div class="heroActions"><button class="primary" data-empty-create>Create a project ↗</button>${routeLink('templates','Browse templates','pbutton')}<button data-backup-center>Backups & recovery</button></div></section>`;
  $('#content').removeAttribute('aria-labelledby');$('#content').setAttribute('role','region');$('#content').setAttribute('aria-label','Start a project');
  $('#content [data-empty-create]').onclick=newProject;
  for(const id of ['export','saveRevision'])$('#'+id).disabled=true;
  $('#saved').textContent=studioBackend.enabled?'Account connected':'No project open';
  bindQualityControls();showStorageHealth();
}
function backupPayload(){return {format:'engineering-studio-backup',version:1,exportedAt:new Date().toISOString(),projects:structuredClone(projects),trash:structuredClone(studioTrash),recovery:[...studioStorage.problems].map(([key,value])=>({key,...value}))};}
function exportStudioBackup(){download('engineering-studio-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(backupPayload(),null,2),'application/json');toast('Backup downloaded. Store it somewhere you can find again.');}
function parseStudioBackup(raw){
  const data=StudioProjectData.parse(raw);
  if(!data||data.format!=='engineering-studio-backup'||data.version!==1||!Array.isArray(data.projects)||!Array.isArray(data.trash)||data.projects.length+data.trash.length>1000||!data.projects.every(p=>StudioProjectData.validate(p))||!data.trash.every(r=>r&&StudioProjectData.validate(r.project)))throw Error('Choose a valid Studio backup. No saved data was changed.');
  return data;
}
function backupCenter(){
  const server=studioBackend.enabled;
  modal('Backups & recovery',`<div class="backupIntro">${studioIcon('library')}<div><h3>Keep your ideas with you.</h3><p>${server?'Export account data, including all profiles and projects.':'A full backup includes your projects, revision snapshots and Trash. Imported projects become new copies.'}</p></div></div><div class="backupStats"><span><b>${projects.length}</b> projects</span>${server?'':`<span><b>${studioTrash.length}</b> in Trash</span>`}</div><div class="backupActions"><button type="button" class="primary" id="exportFullBackup">${server?'Export account data':'Download full backup'} ↓</button>${server?'':'<button type="button" id="chooseStudioBackup">Import backup copies ↑</button><input id="restoreStudioBackup" type="file" accept=".json,application/json" hidden>'}</div><p class="tiny">${server?'Keep this file private; it contains your account and project data.':'Browser data can be lost when you clear site storage or change devices. Keep a downloaded copy outside this browser.'}</p><div id="backupStatus" role="status"></div>${!server&&studioStorage.problems.size?'<section class="recoverySection"><h3>Saved data needs attention</h3><p>The original data has been kept. Download it before recovery.</p><button type="button" id="exportRecoveryData">Download original saved data</button><button type="button" id="recoverLocalProjects">Recover readable projects</button><p class="tiny">Recovery keeps an additional original copy in this browser. Unreadable entries stay in that copy.</p></section>':''}`,()=>{});
  $('#modalForm>button[type=submit]').style.display='none';
  $('#exportFullBackup').onclick=async()=>{try{if(server)download('studio-account-export.json',JSON.stringify(await studioBackend.request('/account/export'),null,2),'application/json');else exportStudioBackup()}catch(e){$('#backupStatus').textContent=e.message}};
  if(server)return;
  $('#chooseStudioBackup').onclick=()=>$('#restoreStudioBackup').click();
  if($('#exportRecoveryData'))$('#exportRecoveryData').onclick=()=>download('studio-original-storage.json',JSON.stringify([...studioStorage.problems].map(([key,value])=>({key,...value})),null,2),'application/json');
  if($('#recoverLocalProjects'))$('#recoverLocalProjects').onclick=()=>{try{
    const raw=studioStorage.problems.get('engineering-studio-v1')?.raw;
    if(raw===null||studioStorage.problems.get('studio-trash-v1')?.raw===null)throw Error('Browser storage is blocked. Allow storage for this site, then reload.');
    const originals=[...studioStorage.problems].map(([key,value])=>({key,...value}));
    localStorage.setItem('studio-original-'+crypto.randomUUID(),JSON.stringify(originals));
    if(studioStorage.problems.has('engineering-studio-v1')){let rows=[];try{const parsed=StudioProjectData.parse(raw);if(Array.isArray(parsed))rows=parsed.filter(p=>StudioProjectData.validate(p)).map(p=>({...p,id:crypto.randomUUID()}))}catch{}localStorage.setItem('engineering-studio-v1',JSON.stringify(rows));projects=rows;current=rows[0]||current;studioStorage.problems.delete('engineering-studio-v1');localStorageVersion=localStorage.getItem('engineering-studio-v1');}
    if(studioStorage.problems.has('studio-trash-v1')){let rows=[];try{const parsed=StudioProjectData.parse(studioStorage.problems.get('studio-trash-v1').raw);if(Array.isArray(parsed))rows=parsed.filter(r=>r&&StudioProjectData.validate(r.project)).map(r=>({...r,project:{...r.project,id:crypto.randomUUID()}}))}catch{}localStorage.setItem('studio-trash-v1',JSON.stringify(rows));studioTrash=rows;studioStorage.problems.delete('studio-trash-v1');}
    localTrashVersion=studioStorage.read('studio-trash-v1');localConflict=false;localUnsaved=false;$('#dialog').close();location.hash='/library';showProductRoute();toast('Readable projects recovered. Original data remains in the recovery copy.');
  }catch(e){$('#backupStatus').textContent=e.message||'Recovery could not be saved. Download the original data and check browser storage.'}};
  $('#restoreStudioBackup').onchange=async e=>{try{
    const file=e.target.files[0];if(!file)return;if(file.size>20e6)throw Error('Choose a backup smaller than 20 MB.');
    const data=parseStudioBackup(await file.text());
    $('#backupStatus').innerHTML=`<p>${data.projects.length} projects and ${data.trash.length} Trash projects are ready to import as editable copies. Existing projects are kept.</p><button type="button" id="confirmBackupImport">Import ${data.projects.length+data.trash.length} project ${data.projects.length+data.trash.length===1?'copy':'copies'}</button>`;
    $('#confirmBackupImport').onclick=()=>{try{assertLocalProjectWrite();const copies=[...data.projects,...data.trash.map(r=>r.project)].map(p=>({...structuredClone(p),id:crypto.randomUUID(),name:p.name.slice(0,180)+' (restored)'}));if(projects.length+copies.length>1000)throw Error('The library limit is 1000 projects. Export or use another browser workspace.');const next=[...projects,...copies];localStorage.setItem('engineering-studio-v1',JSON.stringify(next));projects=next;current=copies[0]||current;localStorageVersion=localStorage.getItem('engineering-studio-v1');$('#dialog').close();location.hash='/library';showProductRoute();toast('Backup imported as new project copies.')}catch(error){$('#backupStatus').textContent=error.message}};
  }catch(error){$('#backupStatus').textContent=error.message}finally{e.target.value=''}};
}
function showStorageHealth(){
  if(studioBackend.enabled||!studioStorage.problems.size)return;
  const parent=document.body.classList.contains('productMode')?$('.accountMain'):$('#workspaceMain');
  if(parent&&!$('#storageHealth')){parent.insertAdjacentHTML('afterbegin','<div class="storageHealth" id="storageHealth" role="alert"><div><b>Your saved data needs attention</b><p>Some browser data could not be loaded. Originals are preserved; recover or download them before continuing.</p></div><button type="button" data-backup-center>Backups & recovery →</button></div>');}
  document.querySelectorAll('[data-backup-center]').forEach(b=>b.onclick=backupCenter);
}
function bindQualityControls(){document.querySelectorAll('[data-backup-center]').forEach(b=>b.onclick=backupCenter);if(localUnsaved&&!studioBackend.enabled)showSaveProblem('Saving is paused. Export a full backup or your current project before reloading.');}
const qualityBindProduct=bindProduct;
bindProduct=function(){qualityBindProduct();bindQualityControls();showStorageHealth();};
const qualitySettings=settingsPage;
settingsPage=function(){return qualitySettings().replace('</main>','<section class="studioPanel backupPanel"><div><span class="eyebrow">YOUR IDEAS, PRESERVED</span><h2>Back up your studio.</h2><p>Download your projects and keep a copy outside this browser.</p></div><button data-backup-center>Backups & recovery ↗</button></section></main>');};
const qualityLibrary=libraryPage;
libraryPage=function(){return qualityLibrary().replace('<button id="dashboardImport">','<button data-backup-center>Backups</button><button id="dashboardImport">');};
const qualityAccountShell=accountShell;
accountShell=function(...args){return qualityAccountShell(...args).replace('<div class="accountHeading">','<div class="deviceNotice"><span>◉ Device workspace · Keep a backup of your projects</span><button data-backup-center>Back up studio ↗</button></div><div class="accountHeading">');};
const qualityRender=render;
render=function(){for(const id of ['export','saveRevision'])$('#'+id).disabled=!projects.length;if($('#workspaceOptions'))$('#workspaceOptions').disabled=!projects.length;qualityRender();showStorageHealth();if($('#electrical'))$('#electrical').maxLength=10000;document.querySelectorAll('#modalFields input[type=text]').forEach(el=>el.maxLength=200);};
function notFoundPage(){return `${publicHeader()}<main class="confirmationMain"><span class="eyebrow">404 / PAGE NOT FOUND</span><h1>Let’s get you back to your studio.</h1><p>This page does not exist. Your saved projects are still in your library.</p><div class="heroActions">${routeLink('dashboard','Open dashboard','pbutton primary')}${routeLink('library','Project library','pbutton')}</div></main>${publicFooter()}`;}
const qualityRoute=showProductRoute;
showProductRoute=function(){const name=location.hash.replace(/^#\/?/,'').split(/[?#]/)[0]||'landing';if(!productRoutes.includes(name)&&name!=='workspace'){document.body.classList.add('productMode');productRoot.innerHTML=notFoundPage();document.title='Page not found · Engineering Studio';return;}qualityRoute();};
window.addEventListener('hashchange',e=>{const name=location.hash.replace(/^#\/?/,'').split(/[?#]/)[0]||'landing';if(!studioBackend.enabled&&!productRoutes.includes(name)&&name!=='workspace'){e.stopImmediatePropagation();showProductRoute();}},true);
const qualityPersist=persist;
persist=function(){const result=qualityPersist();localUnsaved=result===false;return result;};
window.addEventListener('beforeunload',e=>{if(localUnsaved||studioBackend.pending||studioBackend.saveFailed){e.preventDefault();e.returnValue='';}});
document.addEventListener('click',e=>{const skip=e.target.closest('[data-workspace-skip]');if(skip){e.preventDefault();$('#workspaceMain').focus();}});
document.body.insertAdjacentHTML('afterbegin','<a href="#workspaceMain" class="skipLink workspaceSkip" data-workspace-skip>Skip to workspace</a>');
