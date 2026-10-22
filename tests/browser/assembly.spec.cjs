const {test,expect}=require('@playwright/test');
test('3D dimensions, BOM and project isolation',async({page})=>{
 await page.goto('/#/workspace?tool=3d');
 await expect(page.locator('#v3dLoad')).toBeHidden();
 await page.getByRole('button',{name:'Flat Plate Base plate',exact:true}).click();
 await page.getByLabel('Width mm',{exact:true}).fill('120');await page.getByRole('button',{name:'↻ Rebuild geometry',exact:true}).click();
 await page.locator('#pos_x').fill('25');await page.getByRole('button',{name:'Apply position',exact:true}).click();
 await page.getByRole('tab',{name:'◈ Design',exact:true}).click();await page.getByRole('tab',{name:'◇ 3D Editor',exact:true}).click();
 await expect(page.getByLabel('Width mm',{exact:true})).toHaveValue('120');await expect(page.locator('#pos_x')).toHaveValue('25.00');
 await page.locator('#tb-syncbom').click();await page.locator('#tb-syncbom').click();
 const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('engineering-studio-v1'))[0]);expect(data.parts.filter(p=>p.source3dKey)).toHaveLength(1);expect(data.parts.find(p=>p.source3dKey).qty).toBe(1);expect(data.assembly3d.objects).toHaveLength(1);
 await page.getByRole('button',{name:'＋ New project',exact:true}).click();await page.getByRole('textbox',{name:'Project name',exact:true}).fill('Separate assembly');await page.getByRole('button',{name:'Create project',exact:true}).click();await page.getByRole('tab',{name:'◇ 3D Editor',exact:true}).click();
 await expect(page.locator('#v3dCount')).toHaveText('0 objects · Click a part to place it');
});
test('clear and undo restore scene without reloading old storage',async({page})=>{
 await page.goto('/#/workspace?tool=3d');await expect(page.locator('#v3dLoad')).toBeHidden();
 await page.getByRole('button',{name:'Ball Bearing Envelope example',exact:true}).click();await page.locator('#tb-clear').click();await expect(page.locator('#v3dCount')).toHaveText('0 objects · Click a part to place it');
 await page.getByRole('tab',{name:'◈ Design',exact:true}).click();await page.getByRole('tab',{name:'◇ 3D Editor',exact:true}).click();await expect(page.locator('#v3dCount')).toHaveText('0 objects · Click a part to place it');
 await page.locator('#tb-undo').click();await expect(page.locator('#v3dCount')).toHaveText('1 object · Click to select');
});
