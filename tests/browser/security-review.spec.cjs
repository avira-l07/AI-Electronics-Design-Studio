const {test,expect}=require('@playwright/test');
const payload='<img src=x onerror="window.__studioInjected=1">';
async function imported(page,data){
 await page.goto('/#/library');const chooser=page.waitForEvent('filechooser');await page.locator('#dashboardImport').click();
 await(await chooser).setFiles({name:'review-project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
}
async function source(page){await page.goto('/#/workspace?tool=design');await expect(page.locator('#kinematicScene')).toBeVisible();return page.evaluate(()=>JSON.parse(JSON.stringify(projects[0])));}
test('imported project names, sketch text and layers remain literal text',async({page})=>{
 const sample=await source(page);sample.name=payload;sample.designType='sketch';sample.sketch=[{type:'text',x:100,y:100,text:payload,layer:payload.slice(0,45)}];sample.notes=[{title:payload,body:payload,type:'Research note',date:'today'}];
 sample.assembly3d={version:1,units:'mm',objects:[{id:'review-part',partId:'plate_flat',name:payload,dims:{width:80,height:60,thickness:3},material:'Steel',position:[0,0,0],rotation:[0,0,0],visible:true,wireframe:false}]};
 await imported(page,sample);await expect(page.locator('#title')).toContainText(payload);await page.goto('/#/workspace?tool=sketch');
 await expect(page.locator('#shapes text')).toHaveText(payload);await expect(page.locator('#content img[src="x"]')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__studioInjected)).toBeUndefined();
 await page.goto('/#/workspace?tool=evidence');await expect(page.locator('#content')).toContainText(payload);await expect(page.locator('#content img[src="x"]')).toHaveCount(0);expect(await page.evaluate(()=>window.__studioInjected)).toBeUndefined();
 await page.goto('/#/workspace?tool=3d');await expect(page.locator('#v3dLoad')).toBeHidden();await expect(page.locator('#asmList')).toContainText(payload);await expect(page.locator('#content img[src="x"]')).toHaveCount(0);expect(await page.evaluate(()=>window.__studioInjected)).toBeUndefined();
});
test('attribute payload in a numeric sketch field is rejected at import',async({page})=>{
 const sample=await source(page);sample.name='Rejected unsafe geometry';sample.sketch=[{type:'rect',x:'0" onload="window.__studioInjected=1',y:0,w:50,h:40}];
 await imported(page,sample);await expect(page.locator('#toast')).toContainText('not a valid');
 expect(await page.evaluate(()=>projects.some(p=>p.name.startsWith('Rejected unsafe geometry')))).toBe(false);expect(await page.evaluate(()=>window.__studioInjected)).toBeUndefined();
});
test('static account screens explain that local preview login does not secure data',async({page})=>{
 await page.goto('/#/login');await expect(page.locator('.previewNotice')).toContainText('Preview login does not protect or encrypt');
 await page.goto('/#/dashboard');await expect(page.locator('.deviceNotice')).toContainText('Anyone using this browser profile');
 await page.goto('/#/workspace?tool=sketch');await expect(page.locator('.app footer')).toContainText('preview login is not a security lock');
});
