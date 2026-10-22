const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'tests/browser',timeout:30000,use:{baseURL:'http://127.0.0.1:4176',trace:'retain-on-failure'},
 projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'phone',use:{viewport:{width:390,height:844}}}],
 webServer:{command:'python -m http.server 4176 --bind 127.0.0.1 --directory dist',url:'http://127.0.0.1:4176',reuseExistingServer:!process.env.CI}});
