const {test,expect}=require('@playwright/test');
async function design(page){await page.goto('/#/workspace?tool=design');await expect(page.locator('#stroke')).toBeVisible();}
async function command(page,query,name){await page.keyboard.press('Control+k');await page.locator('#commandSearch').fill(query);await page.getByRole('button',{name:new RegExp('^'+name)}).click();}

test('static public resource routes already work and landing starters reach the gallery',async({page})=>{
 await page.goto('/#/landing');await page.locator('.landingStarterGrid a').first().click();await expect(page.locator('#studioMain h1')).toHaveText('Starter templates');
 for(const [route,title] of [['guide','Studio guide'],['settings','Preferences'],['library','Project library']]){await page.goto('/#/'+route);await expect(page.locator('#studioMain h1')).toHaveText(title);}
});

test('palette retains functional create import export and revision actions',async({page})=>{
 await design(page);await command(page,'new','Create new project');await expect(page.locator('#modalTitle')).toHaveText('Create an engineering project');await page.locator('#closeDialog').click();
 const chooser=page.waitForEvent('filechooser');await command(page,'import','Import project JSON');await(await chooser).setFiles([]);
 const download=page.waitForEvent('download');await command(page,'export','Export project JSON');expect((await download).suggestedFilename()).toMatch(/\.json$/);await expect(page.locator('#toast')).toContainText('Download requested:');
 await command(page,'save','Save revision');await expect(page.locator('#modalTitle')).toHaveText('Save project revision');
});

test('decimal dimensions and prices are accepted while quantities stay integral',async({page})=>{
 await design(page);await page.locator('#stroke').fill('80.5');await page.locator('#rod').fill('145.2');expect(await page.locator('#stroke').evaluate(el=>el.checkValidity())).toBe(true);await page.locator('#apply').click();
 expect(await page.evaluate(()=>[current.stroke,current.rod])).toEqual([80.5,145.2]);
 await page.goto('/#/workspace?tool=assembly');await page.locator('#addPart').click();await page.locator('#name').fill('Fractional price test');await page.locator('#price').fill('0.25');await page.locator('#qty').fill('1.5');
 expect(await page.locator('#qty').evaluate(el=>el.checkValidity())).toBe(false);expect(await page.locator('#price').evaluate(el=>el.checkValidity())).toBe(true);
 await page.locator('#qty').fill('2');await page.locator('#modalForm>button[type=submit]').click();await expect(page.locator('#dialog')).toBeHidden();expect(await page.evaluate(()=>current.parts.at(-1).price)).toBe(.25);
 await page.reload();expect(await page.evaluate(()=>current.parts.at(-1).price)).toBe(.25);
});

test('unapplied dimensions and notes survive tabs without entering saved project data',async({page})=>{
 await design(page);await page.locator('#stroke').fill('120.5');await page.locator('#rod').fill('175.25');await page.locator('#material').selectOption('Steel');
 await page.goto('/#/workspace?tool=analysis');expect(await page.evaluate(()=>current.stroke)).toBe(80);
 await page.goto('/#/workspace?tool=design');await expect(page.locator('#stroke')).toHaveValue('120.5');await expect(page.locator('#rod')).toHaveValue('175.25');await expect(page.locator('#material')).toHaveValue('Steel');
 await page.goto('/#/workspace?tool=electronics');await page.locator('#electrical').fill('Unapplied wiring brief');await page.locator('#voltage').fill('5.5');
 await page.goto('/#/workspace?tool=cost');await page.goto('/#/workspace?tool=electronics');await expect(page.locator('#electrical')).toHaveValue('Unapplied wiring brief');await expect(page.locator('#voltage')).toHaveValue('5.5');
 expect(await page.evaluate(()=>current.electrical||'')).toBe('');await page.locator('#saveElectrical').click();await page.locator('#electrical').fill('New draft after saving');await page.goto('/#/workspace?tool=cost');await page.goto('/#/workspace?tool=electronics');await expect(page.locator('#electrical')).toHaveValue('New draft after saving');
 await page.getByRole('button',{name:'Discard visible draft',exact:true}).click();await expect(page.locator('#electrical')).toHaveValue('Unapplied wiring brief');await expect(page.locator('#voltage')).toHaveValue('12');
 await page.goto('/#/workspace?tool=design');await page.locator('#apply').click();await expect(page.locator('#workspaceDraftNotice')).toHaveCount(0);expect(await page.evaluate(()=>current.stroke)).toBe(120.5);
 await page.locator('#undoEdit').click();await expect(page.locator('#stroke')).toHaveValue('80');
});

test('form drafts stay with their project and do not leak into a new project',async({page})=>{
 await design(page);const original=await page.evaluate(()=>current.id);await page.locator('#stroke').fill('333.5');await page.locator('#newProject').click();await page.locator('#newConceptName').fill('Independent draft scope');await page.locator('#modalForm>button[type=submit]').click();
 await expect(page.locator('#stroke')).toHaveValue('80');await page.goto('/#/library');await page.locator(`[data-open-project="${original}"]`).click();await expect(page.locator('#stroke')).toHaveValue('333.5');expect(await page.evaluate(()=>current.stroke)).toBe(80);
});

test('empty BOM offers an add action and long tables keep headers visible',async({page})=>{
 await design(page);await page.evaluate(()=>{current.parts=[];persist();});await page.goto('/#/workspace?tool=cost');await expect(page.locator('.bomEmpty')).toContainText('No components yet');await page.getByRole('button',{name:'Add first component',exact:true}).click();await expect(page.locator('#modalTitle')).toHaveText('Add component');await page.locator('#closeDialog').click();
 await page.evaluate(()=>{current.parts=Array.from({length:40},(_,i)=>({name:'Test part '+i,material:'Steel',qty:1,price:.25}));persist();render();});
 const wrap=page.locator('#content .tableWrap').first();await wrap.scrollIntoViewIfNeeded();const before=await wrap.locator('th').first().boundingBox();
 await wrap.evaluate(el=>el.scrollTop=240);const after=await wrap.locator('th').first().boundingBox();expect(Math.abs(after.y-before.y)).toBeLessThan(2);expect(await wrap.evaluate(el=>el.scrollTop)).toBeGreaterThan(100);
 expect(await page.locator('#tabs').evaluate(el=>getComputedStyle(el).scrollbarWidth)).toBe('thin');
});

test('dark sketch and circuit drawing use dark surfaces and readable labels',async({page})=>{
 await page.emulateMedia({colorScheme:'dark'});await page.goto('/#/workspace?tool=sketch');
 const dark=async locator=>locator.evaluate(el=>getComputedStyle(el).fill.match(/[\d.]+/g).slice(0,3).map(Number).reduce((a,b)=>a+b,0));
 expect(await dark(page.locator('#sketchCanvas>rect').first())).toBeLessThan(400);
 await page.goto('/#/workspace?tool=electronics');expect(await dark(page.locator('.circuitDiagram circle'))).toBeLessThan(400);
 const contrast=await page.locator('.circuitDiagram').evaluate(el=>{const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number),lum=c=>c.map(v=>(v/=255)<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,b,i)=>a+b*[.2126,.7152,.0722][i],0),a=lum(rgb(getComputedStyle(el.querySelector('circle')).fill)),b=lum(rgb(getComputedStyle(el.querySelector('text')).fill));return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)});
 expect(contrast).toBeGreaterThanOrEqual(4.5);
});

test('embedded 3D wheel scrolls the page and expanded view retains wheel zoom',async({page},info)=>{
 await page.setViewportSize({width:1280,height:720});await page.goto('/#/workspace?tool=3d');await expect(page.locator('#v3dLoad')).toBeHidden();
 const editor=await page.locator('#editor3d').boundingBox();expect(editor.height).toBeLessThanOrEqual(689);expect(editor.height).toBeGreaterThanOrEqual(580);
 const canvas=page.locator('#vp3d canvas').first();await canvas.scrollIntoViewIfNeeded();const before=await page.evaluate(()=>scrollY),box=await canvas.boundingBox();await page.mouse.move(box.x+box.width/2,Math.max(20,Math.min(680,box.y+box.height/2)));await page.mouse.wheel(0,180);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(before);
 expect(await canvas.evaluate(el=>{const e=new WheelEvent('wheel',{deltaY:80,bubbles:true,cancelable:true,ctrlKey:true});el.dispatchEvent(e);return e.defaultPrevented})).toBe(true);
 await page.locator('#focusWorkbench').click();expect(await canvas.evaluate(el=>{const e=new WheelEvent('wheel',{deltaY:80,bubbles:true,cancelable:true});el.dispatchEvent(e);return e.defaultPrevented})).toBe(true);
 await page.locator('#partsCategory').selectOption('Structural');await page.locator('[data-insert="plate_flat"]').click();expect(await page.locator('.inspectorJump').evaluate(el=>getComputedStyle(el).zIndex)).toBe('4');
 if(info.project.name==='desktop')await page.screenshot({path:info.outputPath('laptop-workbench-v15-4.png')});
});

test('existing sketch selection supports keyboard deletion without deleting while typing',async({page})=>{
 await design(page);await page.evaluate(()=>{current.sketch=[{type:'rect',x:100,y:100,w:80,h:50},{type:'circle',x:300,y:100,r:20}];persist();});await page.goto('/#/workspace?tool=sketch');await page.locator('[data-pick-shape="0"]').click();
 await page.locator('#shape_x').focus();await page.keyboard.press('Delete');expect(await page.evaluate(()=>current.sketch.length)).toBe(2);
 await page.locator('#sketchCanvas').focus();await page.keyboard.press('Delete');expect(await page.evaluate(()=>current.sketch.length)).toBe(1);await page.locator('#undoShape').click();expect(await page.evaluate(()=>current.sketch.length)).toBe(2);
});
