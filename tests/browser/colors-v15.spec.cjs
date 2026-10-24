const {test,expect}=require('@playwright/test');

async function preferences(page,theme,accent){
 await page.goto('/#/settings');await page.locator('#studioTheme').selectOption(theme);await page.locator(`input[name="accent"][value="${accent}"]`).check();await page.getByRole('button',{name:'Save preferences',exact:true}).click();
}
async function readable(page,selector,property='color'){
 const colors=await page.locator(selector).first().evaluate((el,property)=>{
  const rgb=s=>{const n=s.match(/[\d.]+/g)?.map(Number);if(!n||n.length<3)throw Error('Unsupported computed color: '+s);return [...n.slice(0,3),n[3]??1];};
  const chain=[];for(let node=el;node;node=node.parentElement)chain.unshift(node);
  let bg=[255,255,255];for(const node of chain){const c=rgb(getComputedStyle(node).backgroundColor);bg=bg.map((v,i)=>c[i]*c[3]+v*(1-c[3]));}
  const fg=rgb(getComputedStyle(el).getPropertyValue(property));const ink=bg.map((v,i)=>fg[i]*fg[3]+v*(1-fg[3]));
  const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
  const a=lum(ink),b=lum(bg);return {ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),fg:ink,bg};
 },property);
 expect(colors.ratio,selector+' '+JSON.stringify(colors)).toBeGreaterThanOrEqual(4.5);
}

for(const theme of ['light','dark'])for(const accent of ['forest','cobalt']){
 test(`${theme} ${accent} keeps design and workbench text readable and edits working`,async({page},info)=>{
  await preferences(page,theme,accent);await readable(page,'.accountSidebar .logo');await page.goto('/#/dashboard');await readable(page,'.studioWelcome h2 em');await readable(page,'.dashboardMetrics .metric label');await page.goto('/#/workspace?tool=design');await expect(page.locator('#kinematicScene')).toBeVisible();
  for(const selector of ['.inspector .field label','.workspaceBanner','.canvasFooter','.tab.active','#apply','.rail .nav.active','.metric strong','.metric strong em','.timeline label','.timeline strong','#playSpeed'])await readable(page,selector);
  await readable(page,'#kinematicScene g[font-family="monospace"] text','fill');
  await page.locator('#stroke').fill('100');await page.locator('#apply').click();await expect(page.locator('#stroke')).toHaveValue('100');
  if(accent==='forest'){await page.locator('.canvasCard').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('colors-v15-design-'+theme+'.png'),fullPage:true});}
  await page.goto('/#/workspace?tool=3d');await expect(page.locator('#v3dLoad')).toBeHidden();await page.locator('#partsCategory').selectOption('Structural');await page.locator('[data-insert="plate_flat"]').click();
  for(const selector of ['#partsCategory','.selectedPartTitle strong','.dim-field label','#applyDims','#attachFaces','.editor3d .part-item-info small','.workbenchHeader'])await readable(page,selector);
  await page.locator('#dim_width').fill('130');await page.locator('#applyDims').click();await expect(page.locator('#dim_width')).toHaveValue('130');await page.reload();await expect(page.locator('#v3dLoad')).toBeHidden();await page.locator('#asmList [data-select-asm]').first().click();await expect(page.locator('#dim_width')).toHaveValue('130');
  if(info.project.name==='desktop'){await page.locator('#partsCategory').selectOption('Structural');await page.locator('#focusWorkbench').click();await page.screenshot({path:info.outputPath('colors-v15-workbench-'+theme+'-'+accent+'.png'),fullPage:true});}
 });
}

test('operating-system and saved reduced-motion preferences suppress decorative effects',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#/workspace?tool=design');await page.keyboard.press('Control+k');expect(await page.locator('#dialog').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');expect(await page.locator('#dialog button').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');await page.locator('#closeDialog').click();
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/#/settings');await page.locator('input[name="motion"]').check();await page.getByRole('button',{name:'Save preferences',exact:true}).click();await page.reload();await expect(page.locator('html')).toHaveAttribute('data-motion','reduced');await page.goto('/#/workspace?tool=design');await page.keyboard.press('Control+k');expect(await page.locator('#dialog').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');expect(await page.locator('#dialog button').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
});
