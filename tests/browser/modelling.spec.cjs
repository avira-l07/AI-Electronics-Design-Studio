const {test,expect}=require('@playwright/test');
test('edit solid recipe, save, reload and undo without flattening history',async({page})=>{
 await page.goto('/#/templates');await page.locator('[data-use-template="solid"]').click();await page.getByRole('button',{name:'Create project',exact:true}).click();await expect(page.locator('#v3dLoad')).toBeHidden();
 await page.locator('#asmList').getByRole('button',{name:'Custom mounting plate',exact:true}).click();await page.locator('#insp-model').click();await expect(page.locator('#solidMetrics')).toContainText('Volume');
 await page.locator('[data-feature="0"]').click();await page.locator('#sfDiameter').fill('10');await page.locator('#solidApplyFeature').click();await expect(page.locator('#solidError')).toBeEmpty();await page.getByRole('button',{name:'Save solid changes',exact:true}).click();await expect(page.locator('#dialog')).toBeHidden();
 await page.reload();await expect(page.locator('#v3dLoad')).toBeHidden();await page.locator('#asmList').getByRole('button',{name:'Custom mounting plate',exact:true}).click();await page.locator('#insp-model').click();await page.locator('[data-feature="0"]').click();await expect(page.locator('#sfDiameter')).toHaveValue('10');await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.locator('#tb-dup').click();await expect(page.locator('#v3dCount')).toContainText('2 objects');await page.locator('#tb-undo').click();await expect(page.locator('#v3dCount')).toContainText('1 object');
});
test('original profile validates errors and adds only one solid',async({page})=>{
 await page.goto('/#/workspace?tool=3d');await expect(page.locator('#v3dLoad')).toBeHidden();await page.locator('#startCustomSolid').click();await page.getByText('Exact vertices & profile size',{exact:true}).click();
 await page.locator('#solidVertices').fill('0,0\n20,20\n0,20\n20,0');await page.locator('#solidApplyVertices').click();await expect(page.locator('#solidError')).toContainText('crosses');
 await page.locator('#solidVertices').fill('-30,-20\n30,-20\n30,0\n0,0\n0,20\n-30,20');await page.locator('#solidApplyVertices').click();await expect(page.locator('#solidError')).toBeEmpty();
 await page.locator('#solidDepth').fill('8');await page.getByRole('button',{name:'Add solid to assembly',exact:true}).click();await expect(page.locator('#dialog')).toBeHidden();await expect(page.locator('#v3dCount')).toContainText('1 object');await page.reload();await expect(page.locator('#v3dLoad')).toBeHidden();await expect(page.locator('#v3dCount')).toContainText('1 object');
});
