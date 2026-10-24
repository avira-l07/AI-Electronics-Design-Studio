const {test,expect}=require('@playwright/test'),fs=require('node:fs');
test('owner can export an unchanged project when a solid worker fails to prepare',async({page})=>{
 await page.goto('/#/workspace?tool=design');await expect(page.locator('#kinematicScene')).toBeVisible();
 const before=await page.evaluate(()=>{current.assembly3d=StudioSolidModel.demoAssembly();StudioSolidModel.prepare=async()=>{throw Error('Synthetic unavailable solid worker');};return JSON.parse(JSON.stringify(current));});
 await page.getByRole('tab',{name:/3D Editor/}).click();await expect(page.locator('#v3dError')).toContainText('Synthetic unavailable solid worker');
 const event=page.waitForEvent('download');await page.locator('#exportBlocked3d').click();const restored=JSON.parse(fs.readFileSync(await(await event).path(),'utf8'));expect(restored).toEqual(before);
});
