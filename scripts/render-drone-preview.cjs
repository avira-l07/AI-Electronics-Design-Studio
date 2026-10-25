/* Regenerate the gallery thumbnail from the actual editable starter, not a mockup.
   Start scripts/preview.cjs first. Requires the developer's installed Chrome. */
const {chromium}=require('@playwright/test'),path=require('node:path');
(async()=>{
 const origin=process.env.STUDIO_PREVIEW_ORIGIN||'http://127.0.0.1:4177',url=new URL(origin);
 if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname))throw Error('Use the local preview server.');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:780},deviceScaleFactor:1});
  await page.goto(origin+'/#/templates');await page.locator('[data-use-template="drone"]').click();await page.locator('#modalForm>button[type=submit]').click();await page.locator('#v3dLoad').waitFor({state:'hidden',timeout:90000});
  await page.locator('#presentWorkbench').click();await page.locator('[data-camera="fit"]').click();
  await page.addStyleTag({content:'.viewport3d-overlay,.viewportCameraDock{visibility:hidden!important}'});await page.waitForTimeout(1200);
  const file=path.resolve('dist/drone-showcase.png');await page.locator('#v3dCanvas').screenshot({path:file});
  console.log('Rendered the '+await page.evaluate(()=>current.assembly3d.objects.length)+'-component starter to '+file);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
