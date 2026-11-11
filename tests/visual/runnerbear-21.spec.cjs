const {test,expect}=require('@playwright/test');
const cp=require('node:child_process');
test.use({viewport:{width:390,height:844}});
test('health preserves period, focused controls and open evidence after retry',async({page})=>{
 await page.goto('/');await page.locator('html.rb107-ready').waitFor();
 await page.locator('.bottom-nav [data-tab=health]').click();await expect(page.locator('.rb20-metrics')).toBeVisible();
 await page.locator('[data-rb20-range="90"]').click();await expect(page.locator('.rb20-metrics')).toContainText('90 av 90');
 await page.locator('.rb20-source-details summary').click();await page.locator('[data-rb20-metric=hrvMs]').focus();
 await page.evaluate(()=>window.RunnerBearV20Health.loadRange(90,true));
 await expect(page.locator('.rb20-source-details')).toHaveAttribute('open','');await expect(page.locator('[data-rb20-metric=hrvMs]')).toBeFocused();
 await page.locator('[data-rb20-page=breathing]').click();await expect(page.locator('.rb20-spo2')).toBeVisible();
 await page.locator('.bottom-nav [data-tab=race]').click();await page.locator('.bottom-nav [data-tab=health]').click();
 await expect(page.getByRole('heading',{name:'Se mønsteret over tid.'})).toBeVisible();
});
test('20 warm health opens avoid repeated requests with an identical delayed API fixture',async({page},info)=>{
 test.setTimeout(60000);
 const baseline=cp.execFileSync('git',['-c','safe.directory='+process.cwd(),'show','41b95e931f1ef7c96879743e78bf20b12d6a3ff9:runnerbear-v20-health.js'],{encoding:'utf8'});
 const results={};
 for(const variant of ['baseline','release']){
  let requests=0;
  await page.unrouteAll({behavior:'wait'});
  if(variant==='baseline')await page.route('**/runnerbear-v20-health.js*',r=>r.fulfill({contentType:'text/javascript',body:baseline}));
  await page.route('**/api/v2/health/**',async r=>{requests++;await new Promise(resolve=>setTimeout(resolve,100));await r.continue()});
  await page.goto('/');await page.locator('html.rb107-ready').waitFor();
  await page.locator('.bottom-nav [data-tab=health]').click();await expect(page.locator('.rb20-metrics')).toBeVisible();await expect(page.locator('.rb20-feedback')).toHaveCount(0);
  const times=[];
  for(let i=0;i<20;i++){
   const start=await page.evaluate(()=>{const start=performance.now();window.RunnerBearV20Health.open();return start});
   await expect(page.locator('.rb20-feedback')).toHaveCount(0);
   times.push(await page.evaluate(start=>performance.now()-start,start));
  }
  times.sort((a,b)=>a-b);results[variant]={requests,medianMs:times[10],p95Ms:times[18],samples:20};
 }
 expect(results.release.requests).toBe(1);expect(results.baseline.requests).toBe(21);
 expect(results.release.p95Ms).toBeLessThan(results.baseline.p95Ms*.8);
 await info.attach('health-performance',{body:JSON.stringify(results,null,2),contentType:'application/json'});
 console.log('RB21_HEALTH_PERF '+JSON.stringify(results));
});
