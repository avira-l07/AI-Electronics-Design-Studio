const {test,expect}=require('@playwright/test'),fs=require('node:fs');
test('custom assembly opens when each preparation evicts the previous recipe result',async({page})=>{
 await page.goto('/#/workspace?tool=design');await expect(page.locator('#kinematicScene')).toBeVisible();
 const before=await page.evaluate(()=>{
  const model=StudioSolidModel.demoAssembly(),part=model.objects[0];model.objects.push({...structuredClone(part),id:'second-solid',dims:{depth:18},position:[100,0,0]});current.assembly3d=model;
  const prepare=StudioSolidModel.prepare,geometry=StudioSolidModel.geometry;let available=null;
  StudioSolidModel.prepare=async(model,depth)=>{await prepare(model,depth);available=depth;};
  StudioSolidModel.geometry=(three,model,depth)=>{if(depth!==available)throw Error('Synthetic earlier recipe eviction');return geometry(three,model,depth);};
  return JSON.parse(JSON.stringify(model));
 });
 await page.getByRole('tab',{name:/3D Editor/}).click();await expect(page.locator('#v3dLoad')).toBeHidden();await expect(page.locator('#v3dCount')).toContainText('2 objects');
 await page.evaluate(()=>{location.hash='/workspace?tool=design';});await expect(page.locator('#kinematicScene')).toBeVisible();await page.getByRole('tab',{name:/3D Editor/}).click();await expect(page.locator('#v3dLoad')).toBeHidden();
 expect(await page.evaluate(()=>current.assembly3d)).toEqual(before);
});
test('owner can export an unchanged project when a solid worker fails to prepare',async({page})=>{
 await page.goto('/#/workspace?tool=design');await expect(page.locator('#kinematicScene')).toBeVisible();
 const before=await page.evaluate(()=>{current.assembly3d=StudioSolidModel.demoAssembly();StudioSolidModel.prepare=async()=>{throw Error('Synthetic unavailable solid worker');};return JSON.parse(JSON.stringify(current));});
 await page.getByRole('tab',{name:/3D Editor/}).click();await expect(page.locator('#v3dError')).toContainText('Synthetic unavailable solid worker');
 const event=page.waitForEvent('download');await page.locator('#exportBlocked3d').click();const restored=JSON.parse(fs.readFileSync(await(await event).path(),'utf8'));expect(restored).toEqual(before);
});
