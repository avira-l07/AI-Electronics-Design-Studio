const {test,expect}=require('@playwright/test');
test('electronics design, network and session undo',async({page})=>{
 await page.goto('/#/templates');await page.getByRole('article').filter({hasText:'DC resistor experiment'}).getByRole('button',{name:'Use this template'}).click();
 await page.getByRole('textbox',{name:'Project name',exact:true}).fill('Browser circuit');await page.getByRole('button',{name:'Create project',exact:true}).click();
 await page.getByLabel('Topology',{exact:true}).selectOption('parallel');await page.getByRole('button',{name:'Calculate network',exact:true}).click();
 await expect(page.getByText('666.67 Ω',{exact:true})).toBeVisible();await page.getByRole('tab',{name:'◈ Design',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your circuit, connected.'})).toBeVisible();await expect(page.locator('#kinematicScene')).toHaveCount(0);
 await page.getByRole('button',{name:'↶ Undo',exact:true}).click();await expect(page.getByLabel('Topology',{exact:true})).toHaveValue('series');
 await page.getByRole('button',{name:'↷ Redo',exact:true}).click();await expect(page.getByLabel('Topology',{exact:true})).toHaveValue('parallel');
});
test('project trash can restore an editable copy',async({page})=>{
 await page.goto('/#/templates');await page.getByRole('article').filter({hasText:'Enclosure concept'}).getByRole('button',{name:'Use this template'}).click();
 await page.getByRole('textbox',{name:'Project name',exact:true}).fill('Restore test');await page.getByRole('button',{name:'Create project',exact:true}).click();
 await page.getByRole('button',{name:'⌫ Move to Trash',exact:true}).click();await page.getByRole('button',{name:'Move to Trash',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Restore test',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'⌫ Trash',exact:true}).click();
 await page.getByRole('button',{name:'Restore',exact:true}).click();await expect(page.getByRole('heading',{name:'Restore test',exact:true})).toBeVisible();
});
test('dark theme persists and workspace tabs support arrow keys',async({page})=>{
 await page.goto('/#/settings');await page.getByLabel('Color theme').selectOption('dark');await page.getByRole('button',{name:'Save preferences',exact:true}).click();await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.getByRole('link',{name:'Design workspace',exact:true}).click();
 await page.getByRole('tab',{name:'◈ Design',exact:true}).press('ArrowRight');await expect(page.getByRole('tab',{name:'⬡ Assembly',exact:true})).toHaveAttribute('aria-selected','true');
});
