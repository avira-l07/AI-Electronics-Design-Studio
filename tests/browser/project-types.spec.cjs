const {test,expect}=require('@playwright/test');

test('browsing categories preserves a placed assembly and explicitly resuming opens it',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#/workspace?tool=3d');await expect(page.locator('#v3dLoad')).toBeHidden();await page.locator('[data-insert="plate_flat"]').click();
 const stored=await page.evaluate(()=>localStorage.getItem('engineering-studio-v1'));
 await page.locator('#openProjectTypes').click();await expect(page.locator('#studioMain h1')).toHaveText('3D project types');
 await page.locator('#projectTypeSearch').fill('LoRa');await expect(page.locator('[data-project-type]')).toHaveCount(1);
 await page.locator('[data-project-type="lora"]').focus();await page.keyboard.press('Enter');await expect(page.locator('#projectTypeTitle')).toHaveText('LoRa device');await expect(page).toHaveURL(/type=lora$/);
 await expect(page.locator('.projectTypesNotice')).toContainText('does not generate');
 expect(await page.evaluate(()=>localStorage.getItem('engineering-studio-v1'))).toBe(stored);
 await expect(page.locator('.projectTypeResume')).toContainText('Slider-crank mechanism');await expect(page.locator('[data-start-project-type="lora"]')).toContainText('Start new LoRa device project');
 await page.getByRole('link',{name:/Resume current project/}).click();await expect(page.locator('#v3dLoad')).toBeHidden();await expect(page.locator('#v3dCount')).toContainText('1 object');
 expect(await page.evaluate(()=>localStorage.getItem('engineering-studio-v1'))).toBe(stored);expect(errors).toEqual([]);
});

test('starting a car engine project cannot inherit or replace the previously active drone',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#/templates');await page.locator('[data-use-template="drone"]').click();await page.locator('#starterName').fill('Keep my drone');await page.locator('#modalForm>button[type=submit]').click();await expect(page.locator('#v3dLoad')).toBeHidden();
 const drone=await page.evaluate(()=>structuredClone(current));expect(drone.assembly3d.objects).toHaveLength(136);
 await page.goto('/#/project-types?type=car-engine');await expect(page.locator('.projectTypeResume')).toContainText('Keep my drone');await expect(page.locator('.projectTypeStartInfo')).toContainText('No ready-made Car engine model');
 await page.locator('[data-start-project-type="car-engine"]').click();await expect(page.locator('#modalFields')).toContainText('empty 3D workspace');await page.locator('#closeDialog').click();expect(await page.evaluate(()=>current.id)).toBe(drone.id);
 await page.locator('[data-start-project-type="car-engine"]').click();await page.locator('#projectTypeName').fill('My car engine');await page.locator('#modalForm>button[type=submit]').click();await expect(page.locator('#v3dLoad')).toBeHidden();await expect(page.locator('.workbenchIdentity strong')).toHaveText('My car engine');await expect(page.locator('#v3dCount')).toContainText('0 objects');
 const engineId=await page.evaluate(()=>current.id);expect(engineId).not.toBe(drone.id);expect(await page.evaluate(id=>projects.find(p=>p.id===id),drone.id)).toEqual(drone);
 await page.reload();await expect(page.locator('#v3dLoad')).toBeHidden();expect(await page.evaluate(()=>current.id)).toBe(engineId);await expect(page.locator('#v3dCount')).toContainText('0 objects');
 await page.goto('/#/library');await page.locator(`[data-open-project="${drone.id}"]`).click();await expect(page.locator('#v3dLoad')).toBeHidden();await expect(page.locator('#v3dCount')).toContainText('136 objects');expect(await page.evaluate(()=>current)).toEqual(drone);expect(errors).toEqual([]);
});

test('new category workspaces stay empty after adding geometry elsewhere and drone uses its real starter',async({page})=>{
 for(const [id,name] of [['car-engine','Engine'],['ship','Ship'],['lora','Radio']]){
  await page.goto('/#/project-types?type='+id);await page.locator(`[data-start-project-type="${id}"]`).click();await page.locator('#projectTypeName').fill(name);await page.locator('#modalForm>button[type=submit]').click();await expect(page.locator('#v3dLoad')).toBeHidden();await expect(page.locator('.workbenchIdentity strong')).toHaveText(name);await expect(page.locator('#v3dCount')).toContainText('0 objects');await page.locator('[data-insert="plate_flat"]').click();await expect(page.locator('#v3dCount')).toContainText('1 object');
 }
 await page.goto('/#/project-types?type=drone');await expect(page.locator('.projectTypeStatus')).toContainText('STARTER AVAILABLE');await page.locator('[data-start-project-type="drone"]').click();await page.locator('#modalForm>button[type=submit]').click();await expect(page.locator('#v3dLoad')).toBeHidden();await expect(page.locator('#v3dCount')).toContainText('136 objects');
});

test('category filters, empty recovery and selected deep links work without generation requests',async({page},info)=>{
 const writes=[];page.on('request',r=>{if(['POST','PATCH','DELETE'].includes(r.method()))writes.push(r.url());});
 await page.goto('/#/project-types?type=ship');await expect(page.locator('#projectTypeTitle')).toHaveText('Ship & boat');await expect(page.locator('#projectTypeCount')).toHaveText('12 of 12 project types');
 await page.locator('#projectTypeGroup').selectOption('Electronics & IoT');await expect(page.locator('[data-project-type]')).toHaveCount(3);
 await page.locator('#projectTypeSearch').fill('no such category 739');await expect(page.locator('.projectTypesEmpty')).toBeVisible();await page.getByRole('button',{name:'Show all project types'}).click();await expect(page.locator('[data-project-type]')).toHaveCount(12);
 await page.locator('[data-project-type="car-engine"]').click();await page.reload();await expect(page.locator('#projectTypeTitle')).toHaveText('Car engine');await expect(page.locator('[data-project-type="car-engine"]')).toHaveAttribute('aria-pressed','true');
 await page.goto('/#/project-types?type=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');await expect(page.locator('#projectTypeTitle')).toHaveText('Car engine');expect(await page.locator('#studioMain img').count()).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(writes).toEqual([]);
 for(const theme of ['light','dark']){await page.evaluate(theme=>{studioTheme=theme;applyStudioTheme();},theme);await page.screenshot({path:info.outputPath('project-types-'+theme+'.png'),fullPage:true,animations:'disabled'});}
});

test('project types are reachable from the public navigation and tool finder',async({page})=>{
 await page.goto('/#/landing');
 if(await page.getByRole('link',{name:'3D project types',exact:true}).isVisible())await page.getByRole('link',{name:'3D project types',exact:true}).click();
 else await page.goto('/#/project-types');
 await expect(page.locator('#projectTypeTitle')).toHaveText('Car engine');await page.goto('/#/workspace?tool=3d');await expect(page.locator('#v3dLoad')).toBeHidden();await page.locator('#findWorkbenchTool').click();await page.locator('#workbenchToolQuery').fill('LoRa');await expect(page.locator('[data-run-workbench]')).toHaveCount(1);await page.locator('[data-run-workbench]').click();await expect(page.locator('#studioMain h1')).toHaveText('3D project types');
});
