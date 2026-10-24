const {test:base,expect}=require('@playwright/test'),{spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const test=base.extend({liveOrigin:[async({},use)=>{const port=await new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});}),dir=fs.mkdtempSync(path.join(os.tmpdir(),'studio-team-')),python=process.env.STUDIO_PYTHON||(process.platform==='win32'?'.venv/Scripts/python.exe':'python'),child=spawn(python,['tests/live-server.py',String(port),dir],{cwd:path.resolve('.'),stdio:['ignore','pipe','pipe'],windowsHide:true}),origin='http://127.0.0.1:'+port;let logs='';child.stdout.on('data',v=>logs+=v);child.stderr.on('data',v=>logs+=v);try{await expect.poll(async()=>{if(child.exitCode!==null)throw Error(logs);try{return (await fetch(origin+'/api/config')).status;}catch{return 0;}},{timeout:30000}).toBe(200);await use(origin);}finally{if(logs.includes('ERROR'))process.stderr.write(logs);child.kill();await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);});}}, {scope:'worker'}]});
async function send(context,origin,url,method='POST',data={}){const token=(await(await context.request.get(origin+'/api/csrf')).json()).token;return context.request.fetch(origin+'/api'+url,{method,data,headers:{Origin:origin,'X-CSRF-Token':token}});}
async function account(browser,origin,name,viewport){const context=await browser.newContext({viewport}),page=await context.newPage();await page.goto(origin+'/#/login');await page.locator('#secureEmail').fill(name+'@example.com');await page.locator('#securePassword').fill('Synthetic test password 739!');await page.locator('#secureAuth button[type=submit]').click();await expect(page.locator('[data-team-inbox]')).toBeVisible();return {context,page};}

test('free-beta account screens disclose no charging and expiring complimentary access',async({browser,liveOrigin},info)=>{
 const context=await browser.newContext({viewport:info.project.use.viewport});
 try{
  await context.route(liveOrigin+'/api/config',async route=>{const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),free_beta:true,payments_enabled:false}});});
  const page=await context.newPage();await page.goto(liveOrigin+'/#/login');await page.locator('#secureEmail').fill('owner@example.com');await page.locator('#securePassword').fill('Synthetic test password 739!');await page.locator('#secureAuth button[type=submit]').click();
  await expect(page.locator('.modeBadge')).toHaveText('FREE BETA · NO CHARGES');await expect(page.locator('.freeBetaNotice')).toContainText('no payments are collected');await expect(page.locator('.freeBetaNotice')).toContainText('expires automatically');
  await page.goto(liveOrigin+'/#/confirmation');await expect(page.locator('.confirmationMain')).toContainText('No payment was collected.');await expect(page.locator('.confirmationMain')).not.toContainText('confirmed your access with Stripe');
 }finally{await context.close();}
});

test('local AI disclosure identifies Ollama without claiming a cloud request',async({browser,liveOrigin},info)=>{
 const context=await browser.newContext({viewport:info.project.use.viewport});
 try{
  await context.route(liveOrigin+'/api/config',async route=>{const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),free_beta:true,demo_mode:true,ai_enabled:true,ai_provider:'ollama',payments_enabled:false}});});
  const page=await context.newPage();await page.goto(liveOrigin+'/#/login');await page.locator('#secureEmail').fill('owner@example.com');await page.locator('#securePassword').fill('Synthetic test password 739!');await page.locator('#secureAuth button[type=submit]').click();
  await expect(page.locator('.freeBetaNotice')).toContainText('Optional AI runs on this computer');
  await page.goto(liveOrigin+'/#/workspace?tool=3d');await expect(page.locator('#v3dLoad')).toBeHidden();await page.locator('#projectServices').click();
  await expect(page.locator('#modalFields')).toContainText('Ollama model running on this computer');await expect(page.locator('#modalFields')).toContainText('No cloud fallback');await expect(page.locator('#requestModelProposal')).toBeEnabled();
 }finally{await context.close();}
});
test('shared geometry failure keeps project data and healthy parts available, then recovers on retry',async({browser,liveOrigin},info)=>{
 const owner=await account(browser,liveOrigin,'owner',info.project.use.viewport),page=owner.page;let createdId;
 try{
  const body=await page.evaluate(()=>({name:'Geometry recovery check',material:'Steel',stroke:80,rod:150,rpm:600,parts:[],notes:[],revisions:[],assembly3d:{version:1,units:'mm',objects:[{id:'solid',partId:'custom_solid',name:'Custom solid',dims:{depth:10},model:StudioSolidModel.defaultModel(),material:'Steel',position:[0,0,0],rotation:[0,0,0],visible:true,wireframe:false},{id:'plate',partId:'plate_flat',name:'Healthy plate',dims:{width:80,height:60,thickness:3},material:'Steel',position:[100,0,0],rotation:[0,0,0],visible:true,wireframe:false}]}}));
  const response=await send(owner.context,liveOrigin,'/projects','POST',body);expect(response.status()).toBe(201);const {id}=await response.json();createdId=id;
  await page.evaluate(async id=>{window.__realSolidPrepare=StudioSolidModel.prepare;StudioSolidModel.prepare=async()=>{throw Error('Synthetic worker failure');};await StudioTeamWorkspace.open(id);},id);
  await expect(page.locator('#liveGeometryStatus')).toContainText('position markers, not geometry');await expect(page.locator('#liveApply')).toBeDisabled();await expect(page.locator('#liveRetryGeometry')).toBeVisible();await page.locator('#livePart').selectOption('plate');await expect(page.locator('#liveApply')).toBeEnabled();
  expect((await(await owner.context.request.get(liveOrigin+'/api/team/projects/'+id)).json()).project.assembly3d).toEqual(body.assembly3d);
  await page.evaluate(()=>{StudioSolidModel.prepare=window.__realSolidPrepare;});await page.locator('#liveRetryGeometry').click();await expect(page.locator('#liveGeometryStatus')).toHaveText('');await expect(page.locator('#liveRetryGeometry')).toBeHidden();await page.locator('#livePart').selectOption('solid');await expect(page.locator('#liveApply')).toBeEnabled();
  expect((await(await owner.context.request.get(liveOrigin+'/api/team/projects/'+id)).json()).project.version).toBe(1);
 }finally{if(createdId)await send(owner.context,liveOrigin,'/projects/'+createdId,'DELETE',{version:1});await owner.context.close();}
});
test('locked owner completes email confirmation without a password reset or automatic link login',async({browser,liveOrigin},info)=>{
 const context=await browser.newContext({viewport:info.project.use.viewport}),page=await context.newPage();
 try{
  await page.goto(liveOrigin+'/#/login');await page.locator('#secureEmail').fill('locked@example.com');await page.locator('#securePassword').fill('Synthetic test password 739!');await page.locator('#secureAuth button[type=submit]').click();
  await expect(page.locator('#secureStatus')).toContainText('Check your email');await expect(page).toHaveURL(/#\/login$/);expect((await context.request.get(liveOrigin+'/api/me')).status()).toBe(401);
  await page.goto(liveOrigin+'/#/confirm-login?token=test-only-confirmation-token-for-locked-user');await expect(page.getByRole('heading',{name:'Confirm your sign-in',exact:true})).toBeVisible();expect((await context.request.get(liveOrigin+'/api/me')).status()).toBe(401);
  await page.locator('#recoveryForm button[type=submit]').click();await expect(page.locator('[data-team-inbox]')).toBeVisible();await expect(page).toHaveURL(/#\/dashboard$/);expect((await context.request.get(liveOrigin+'/api/me')).status()).toBe(200);
 }finally{await context.close();}
});
test('team manager displays and cancels an invitation for an unregistered email',async({browser,liveOrigin},info)=>{
 const owner=await account(browser,liveOrigin,'owner',info.project.use.viewport);
 try{
  await owner.page.goto(liveOrigin+'/#/workspace?tool=3d');await expect(owner.page.locator('#v3dLoad')).toBeHidden();await owner.page.locator('#projectServices').click();await owner.page.locator('#manageProjectTeam').click();
  await owner.page.locator('#teamEmail').fill('notregistered@example.com');await owner.page.locator('#inviteProjectMember').click();await expect(owner.page.locator('[data-revoke-invite]')).toHaveCount(1);await expect(owner.page.locator('#modalFields')).toContainText('notregistered@example.com');
  const members=await(await owner.context.request.get(liveOrigin+'/api/team/projects/shared-browser-project/members')).json();expect(members.some(m=>m.email==='notregistered@example.com')).toBe(false);
  await owner.page.locator('[data-revoke-invite]').click();await expect(owner.page.locator('#modalFields')).toContainText('No pending invitations.');await expect(owner.page.locator('[data-revoke-invite]')).toHaveCount(0);
 }finally{await owner.context.close();}
});
test('independent real account sessions share 3D edits and presence, preserve conflicts, and enforce viewer/revoke',async({browser,liveOrigin},testInfo)=>{
 const origin=liveOrigin,owner=await account(browser,origin,'owner',{width:1440,height:1000}),editor=await account(browser,origin,'editor',{width:390,height:844}),viewer=await account(browser,origin,'viewer',{width:1024,height:768}),url='/team/projects/shared-browser-project';
 try{
  for(const [who,role] of [[editor,'editor'],[viewer,'viewer']]){expect((await send(owner.context,origin,url+'/members','POST',{email:(who===editor?'editor':'viewer')+'@example.com',role})).status()).toBe(202);await who.page.locator('[data-team-inbox]').click();await who.page.locator('[data-accept-team]').click();await who.page.locator('[data-open-team]').click();await expect(who.page.locator('#liveVersion')).toContainText('version 1');}
  await owner.page.goto(origin+'/#/workspace?tool=3d');await expect(owner.page.locator('#v3dLoad')).toBeHidden();await owner.page.locator('#projectServices').click();await owner.page.locator('#openLiveTeam').click();await expect(owner.page.locator('#livePresence')).toContainText('editor');await expect(viewer.page.locator('#liveApply')).toBeDisabled();
  // Both clients base their drafts on version one; independent part edits must merge.
  await editor.page.locator('#liveName').fill('Editor renamed base');await owner.page.locator('#livePart').selectOption('part-b');await owner.page.locator('#live_position_1').fill('30');await owner.page.locator('#liveApply').click();await expect(owner.page.locator('#liveStatus')).toContainText('saved');await editor.page.locator('#liveApply').click();await expect(editor.page.locator('#liveStatus')).toContainText('saved');
  await expect(viewer.page.locator('#liveVersion')).toContainText('version 3');await expect(viewer.page.locator('#liveName')).toHaveValue('Editor renamed base');
  await owner.page.locator('#livePart').selectOption('part-a');await owner.page.locator('#liveName').fill('Owner draft retained');await editor.page.locator('#liveName').fill('Editor latest');await editor.page.locator('#liveApply').click();await expect(editor.page.locator('#liveVersion')).toContainText('version 4');await owner.page.locator('#liveApply').click();await expect(owner.page.locator('#liveStatus')).toContainText('nothing was overwritten');await expect(owner.page.locator('#liveName')).toHaveValue('Owner draft retained');
  const members=await(await owner.context.request.get(origin+'/api'+url+'/members')).json(),guest=members.find(m=>m.email==='editor@example.com');expect((await send(owner.context,origin,url+'/members/'+guest.user_id,'DELETE')).status()).toBe(200);await expect(editor.page.locator('#liveStatus')).toContainText('Connection paused');
  if(testInfo.project.name==='desktop')await viewer.page.screenshot({path:testInfo.outputPath('shared-workspace-v12.png'),fullPage:true});
 }finally{await Promise.all([owner.context.close(),editor.context.close(),viewer.context.close()]);}
});
