const {test,expect}=require('@playwright/test');
async function create(page){
 await page.goto('/#/templates');const original=await page.evaluate(()=>({id:current.id,data:JSON.stringify(current)}));
 const preview=page.locator('.dronePreview');await preview.scrollIntoViewIfNeeded();await expect(preview).toBeVisible();await expect.poll(()=>preview.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await page.locator('[data-use-template="drone"]').click();await page.locator('#starterName').fill('FPV showcase test');await page.locator('#modalForm>button[type=submit]').click();await expect(page.locator('#v3dLoad')).toBeHidden();await expect(page.locator('#droneAssemblyGuide')).toBeVisible();
 expect(await page.evaluate(()=>current.id)).not.toBe(original.id);expect(await page.evaluate(id=>JSON.stringify(projects.find(p=>p.id===id)),original.id)).toBe(original.data);
}
test('FPV starter, stages, editable camera, material and BOM survive reload',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await create(page);
 expect(await page.evaluate(()=>current.assembly3d.objects.length)).toBe(136);const before=await page.evaluate(()=>JSON.stringify(current.assembly3d));
 for(const step of ['1','4','6']){await page.locator('#droneStage').selectOption(step);await expect(page.locator('#droneStageDescription')).toContainText('components visible');expect(await page.evaluate(()=>JSON.stringify(current.assembly3d))).toBe(before);}
 await page.locator('#assemblySearch').fill('camera and optical lens');await page.locator('#asmList [data-select-asm]').filter({hasText:'camera and optical lens'}).click();
 await page.locator('#dim_width').fill('22');await page.locator('#applyDims').click();await page.locator('[data-mat="Aluminium 6061"]').click();await expect(page.locator('[data-mat="Aluminium 6061"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#tb-syncbom').click();await page.locator('#tb-syncbom').click();expect(await page.evaluate(()=>current.parts.reduce((n,p)=>n+p.qty,0))).toBe(136);
 await page.reload();await expect(page.locator('#v3dLoad')).toBeHidden();await page.locator('#assemblySearch').fill('camera and optical lens');await page.locator('#asmList [data-select-asm]').filter({hasText:'camera and optical lens'}).click();await expect(page.locator('#dim_width')).toHaveValue('22');await expect(page.locator('[data-mat="Aluminium 6061"]')).toHaveAttribute('aria-pressed','true');
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#tb-obj').click()]);const stream=await download.createReadStream();let output='';for await(const chunk of stream)output+=chunk;expect(output.split('\no ').length-1).toBe(136);expect(output).not.toMatch(/NaN|Infinity/);expect(errors).toEqual([]);
});
test('presentation fits the live model, restores editing and never changes project data',async({page})=>{
 await create(page);const before=await page.evaluate(()=>JSON.stringify(current.assembly3d));await page.locator('#presentWorkbench').click();await expect(page.locator('#editor3d')).toHaveClass(/isPresentation/);await expect(page.locator('.editor3d-parts')).toBeHidden();await expect(page.locator('.editor3d-inspector')).toBeHidden();await expect(page.locator('#presentWorkbench')).toContainText('Back to editing');
 const canvas=await page.locator('#v3dCanvas').boundingBox();expect(canvas.width).toBeGreaterThan(300);expect(canvas.height).toBeGreaterThan(350);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('[data-camera="top"]').click();await page.locator('[data-camera="iso"]').click();await page.locator('#presentWorkbench').click();await expect(page.locator('#editor3d')).not.toHaveClass(/isPresentation/);await expect(page.locator('body')).not.toHaveClass(/studioFocus/);expect(await page.evaluate(()=>JSON.stringify(current.assembly3d))).toBe(before);
 await page.locator('#presentWorkbench').click();await page.keyboard.press('Escape');await expect(page.locator('#editor3d')).not.toHaveClass(/isPresentation/);await expect(page.locator('#presentWorkbench')).toHaveAttribute('aria-pressed','false');
});
