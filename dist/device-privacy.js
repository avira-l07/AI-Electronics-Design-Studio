/* Explicit local-data removal. Never clears cloud projects or auth cookies. */
const StudioDevicePrivacy=(()=>{
 const keys=new Set(['engineering-studio-v1','studio-active-project-v1','studio-profile-v1','studio-demo-orders','studio-trash-v1','studio-personal-parts-v1','studio-theme-v1','studio-ui-v1','studio-library-layout-v1']);
 const owns=key=>keys.has(key)||key.startsWith('studio-3d-')||key.startsWith('studio-original-');
 function snapshot(){return Object.keys(localStorage).filter(owns).map(key=>({key,value:localStorage.getItem(key)}));}
 function leave(){localConflict=true;localUnsaved=false;signedIn=false;try{sessionStorage.removeItem('studio-demo-session');}catch{}history.replaceState(null,'',location.pathname+location.search+'#/landing');location.reload();}
 function open(){
  if(studioBackend.enabled)return toast('This control is for device preview data. It does not delete account projects.');
  modal('Clear Studio data from this browser',`<p>This permanently removes this browser profile’s saved Studio projects, Trash, personal parts, local profile, appearance settings and recovery copies. Export anything you need first, including unsaved edits. Close older Studio tabs.</p><p>It does not erase downloaded files, browser history, other browser profiles, backups or cloud data. Current preview tabs will reload. This is not forensic secure erasure.</p><button type="button" id="exportDeviceArchive">Download saved device archive first</button><p class="tiny">The archive contains private raw saved data, including personal parts and recovery copies. Keep it private; use project JSON exports for normal project imports.</p>${field('clearDeviceConfirm','Type CLEAR to confirm','')}<label><input id="clearDeviceAcknowledged" name="acknowledged" type="checkbox" required> I have exported what I need and understand this removes the saved Studio data.</label>`,form=>{
   if(form.get('clearDeviceConfirm')!=='CLEAR'||!form.get('acknowledged'))throw Error('Type CLEAR and acknowledge the data removal.');
   const rows=snapshot();localConflict=true;localUnsaved=false;
   for(const {key} of rows)localStorage.removeItem(key);
   if(rows.some(({key})=>localStorage.getItem(key)!==null))throw Error('Some data could not be removed. Check browser storage before leaving.');
   localStorage.setItem('engineering-studio-v1','[]');
   localStorage.setItem('studio-device-cleared-v1',Date.now()+':'+crypto.randomUUID());
   leave();return false;
  });
  const submit=document.querySelector('#modalForm>button[type=submit]');submit.style.display='';submit.textContent='Clear Studio data and end preview session';
  document.getElementById('exportDeviceArchive').onclick=()=>{try{download('engineering-studio-device-archive.json',JSON.stringify({format:'engineering-studio-device-archive',version:1,entries:snapshot()},null,2),'application/json');}catch(error){toast(error.message);}};
 }
 window.addEventListener('storage',event=>{if(event.key==='studio-device-cleared-v1'&&event.newValue&&!studioBackend.enabled)leave();});
 return {open};
})();
