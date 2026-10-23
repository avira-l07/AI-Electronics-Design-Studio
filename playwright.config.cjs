const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'tests/browser',timeout:45000,use:{baseURL:'http://127.0.0.1:4177',trace:'retain-on-failure',...(process.env.STUDIO_BROWSER_CHANNEL?{channel:process.env.STUDIO_BROWSER_CHANNEL}:{})},
 projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'phone',use:{viewport:{width:390,height:844}}}],
 webServer:{command:'node scripts/preview.cjs',url:'http://127.0.0.1:4177',reuseExistingServer:!process.env.CI}});
