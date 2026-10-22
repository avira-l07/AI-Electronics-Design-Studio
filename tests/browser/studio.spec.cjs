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

test('an empty library stays empty and offers a starting point',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('engineering-studio-v1','[]'));
 await page.goto('/#/workspace');
 await expect(page.getByRole('heading',{name:'Start with a question. Make it something you can explore.'})).toBeVisible();
 await expect(page.getByRole('button',{name:'↗ Export project',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('engineering-studio-v1')))).toEqual([]);
});

test('corrupt storage remains available for recovery',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('engineering-studio-v1','{broken'));
 await page.goto('/#/dashboard');
 await expect(page.getByText('Your saved data needs attention',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Backups & recovery →',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download original saved data',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('engineering-studio-v1'))).toBe('{broken');
 await page.getByRole('button',{name:'Recover readable projects',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Project library',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('studio-original-')))).toBe(true);
});

test('backup copies preserve existing projects and sketch previews',async({page})=>{
 await page.goto('/#/library');await page.getByRole('button',{name:'Backups',exact:true}).click();
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download full backup ↓',exact:true}).click();
 const file=await(await downloadEvent).path();
 await page.locator('#restoreStudioBackup').setInputFiles(file);
 await page.getByRole('button',{name:'Import 1 project copy',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Slider-crank mechanism (restored)',exact:true})).toBeVisible();
 await expect(page.locator('.studioProject')).toHaveCount(2);
});
