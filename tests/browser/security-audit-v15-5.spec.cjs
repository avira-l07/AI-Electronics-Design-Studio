const {test,expect}=require('@playwright/test');
async function open(page){await page.goto('/#/workspace?tool=3d');await expect(page.locator('#v3dLoad')).toBeHidden();}

test('export filenames and both CSV handlers neutralize hostile project data',async({page})=>{
 await page.goto('/#/workspace?tool=assembly');
 await page.evaluate(()=>{current.parts=[{name:'=HYPERLINK("https://example.invalid")',material:'\t=1+1',qty:1,price:1}];persist();render();});
 const csvReady=page.waitForEvent('download');await page.locator('#csv').click();const csv=await csvReady;
 const fs=require('node:fs');const body=fs.readFileSync(await csv.path(),'utf8');expect(body).toContain('"\'=HYPERLINK');expect(body).toContain('"\'\t=1+1"');
 // Exercise the retained legacy binder directly as well as the active handler.
 await page.evaluate(()=>{bind();});
 const legacyReady=page.waitForEvent('download');await page.locator('#csv').click();const legacy=await legacyReady;expect(fs.readFileSync(await legacy.path(),'utf8')).toContain('"\'=HYPERLINK');
 const safeReady=page.waitForEvent('download');await page.evaluate(()=>download('../../CON\u202e/part\n.json','{}','application/json'));const safe=await safeReady;
 expect(safe.suggestedFilename()).not.toMatch(/[\/\\\r\n\u202e]/);expect(safe.suggestedFilename()).toMatch(/\.json$/);
});

test('DXF fails visibly on corrupt coordinates and valid sketches still export',async({page})=>{
 await page.goto('/#/workspace?tool=sketch');
 await page.evaluate(()=>{current.sketch=[{type:'line',x:0,y:0,x2:NaN,y2:10}];});
 const downloads=[];page.on('download',d=>downloads.push(d));await page.locator('#exportSketchDXF').click();await expect(page.locator('#toast')).toContainText('DXF export stopped');expect(downloads).toHaveLength(0);
 await page.evaluate(()=>{current.sketch=[{type:'circle',x:10,y:10,r:5}];});const ready=page.waitForEvent('download');await page.locator('#exportSketchDXF').click();expect((await ready).suggestedFilename()).toBe('concept-sketch.dxf');
});

test('300,000-pair manufacturing review leaves the interface responsive',async({page},info)=>{
 test.skip(info.project.name==='phone','Same worker implementation; heavy timing check runs once on desktop.');
 await open(page);
 await page.evaluate(()=>{
  const positions=(n,z)=>Array.from({length:n},(_,i)=>[i*.01,0,z,i*.01+1,0,z,i*.01,1,z]).flat();
  StudioManufacturingTools.open([{name:'A',positions:positions(500,0)},{name:'B',positions:positions(600,10)}],()=>{});
  window.__reviewTicks=0;window.__reviewTimer=setInterval(()=>window.__reviewTicks++,20);
 });
 await page.locator('#reviewClearance').click();await expect(page.locator('#reviewWall')).toBeDisabled();
 await expect(page.locator('#manufacturingResult')).toContainText('surfaceDistanceMm',{timeout:25000});
 expect(await page.evaluate(()=>{clearInterval(window.__reviewTimer);return window.__reviewTicks;})).toBeGreaterThan(5);
 await expect(page.locator('#manufacturingError')).toBeEmpty();await expect(page.locator('#reviewWall')).toBeEnabled();
});

test('closing a pending manufacturing review terminates its worker; timeout permits retry',async({page})=>{
 await open(page);await page.locator('[data-insert="plate_flat"]').click();await page.locator('[data-insert="plate_flat"]').click();
 await page.route('**/manufacturing-worker.js*',route=>route.fulfill({contentType:'application/javascript',body:'self.onmessage=()=>{};'}));
 await page.evaluate(()=>{const NativeWorker=Worker;window.__terminatedReviews=0;window.Worker=class extends NativeWorker{terminate(){window.__terminatedReviews++;super.terminate();}};});
 await page.locator('#manufacturingTools').click();await page.locator('#reviewClearance').click();await expect(page.locator('#manufacturingResult')).toContainText('Working');await page.locator('#closeDialog').click();
 await expect(page.locator('#dialog')).toBeHidden();expect(await page.evaluate(()=>window.__terminatedReviews)).toBe(1);
 await page.locator('#manufacturingTools').click();
 await page.evaluate(()=>{const native=window.setTimeout;window.setTimeout=(fn,delay,...args)=>native(fn,delay===20000?50:delay,...args);});
 await page.locator('#reviewClearance').click();await expect(page.locator('#manufacturingError')).toContainText('exceeded 20 seconds');await expect(page.locator('#reviewClearance')).toBeEnabled();await expect(page.locator('#applyMeshRepair')).toBeDisabled();
 expect(await page.evaluate(()=>window.__terminatedReviews)).toBe(2);
 await page.unroute('**/manufacturing-worker.js*');
 // Restore the ordinary timeout before retrying the real worker.
 await page.reload();await expect(page.locator('#v3dLoad')).toBeHidden();await page.locator('#manufacturingTools').click();await page.locator('#reviewClearance').click();await expect(page.locator('#manufacturingResult')).toContainText('surfaceDistanceMm');
});
