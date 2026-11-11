const {test,expect}=require('@playwright/test');
test.use({viewport:{width:390,height:844}});
async function snapshot({healthChange=true}={}){
 const {buildAgentSnapshot}=await import('../../cloud/runnerbear-cloud/src/v22/agent.js'),{localDay,addDays}=await import('../../cloud/runnerbear-cloud/src/v22/health.js'),today=localDay(new Date());
 const rows=Array.from({length:35},(_,i)=>({date:addDays(today,-i),hrv_ms:healthChange&&i<7?30:45,sleep_seconds:healthChange&&i<7?21000:28000,rhr_bpm:healthChange&&i<7?58:50,health_source:'test-fixture'}));
 const a={source:'fixture',source_id:'ride-one',date:addDays(today,-1),sport_type:'cycling',duration_seconds:3000,distance_m:30000,payload:{id:'ride-one',title:'Zwift · 3 × 10 min',detail:{garminFit:{laps:[...Array.from({length:3},()=>[{intensity:'active',seconds:600,avgPower:235,avgHr:160},{intensity:'rest',seconds:60,avgPower:100}]).flat()]}}}};
 const value=buildAgentSnapshot({rows,activities:[a],today});value.primary.inputRevision='a'.repeat(64);value.inputRevision='b'.repeat(64);value.history=[];return{value,a};
}
async function fixture(page,options){
 const {value,a}=await snapshot(options);
 await page.route('**/api/v2/agent',r=>r.fulfill({json:{ok:true,enabled:true,snapshot:value,stale:false,receipt:null}}));
 await page.route('**/api/v2/bootstrap*',async r=>{const response=await r.fetch(),data=await response.json();data.recentActivities=[{...a,payload:a.payload}];data.activityHistory={version:'activity-history-1',state:'current',syncedAt:new Date().toISOString(),truncated:false};await r.fulfill({response,json:data})});
 await page.goto('/');await page.locator('html.rb107-ready').waitFor();return value;
}
for(const colorScheme of ['light','dark'])test(`proactive health insight is useful and visible on mobile in ${colorScheme}`,async({page})=>{
 await page.emulateMedia({colorScheme});await fixture(page);
 await expect(page.locator('.rb22-hero')).toContainText('Kroppens mønster har endret seg');const action=page.locator('[data-rb22-health]');await expect(action).toBeVisible();
 const r=await action.boundingBox(),nav=await page.locator('.bottom-nav').boundingBox();expect(r.y+r.height).toBeLessThanOrEqual(nav.y);
 await action.click();await expect(page.locator('.rb22-response')).toContainText('Lavere enn referansen');await expect(page.locator('.rb20-lead')).not.toContainText('venter');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
});
test('workout analysis includes observed next-night response and source-bound work facts',async({page})=>{
 await fixture(page,{healthChange:false});await page.locator('[data-rb20-analysis]').click();await expect(page.locator('.rb22-workout')).toContainText('30 minutter');await page.locator('.rb22-workout summary').click();await expect(page.locator('.rb22-workout')).toContainText('1 av 2');await expect(page.locator('.rb22-workout')).toContainText('ikke at økten forårsaket');
});
test('receipt save failure is truthful and a successful retry marks read without changing plan',async({page})=>{
 await fixture(page);await page.locator('.bottom-nav [data-tab=health]').click();let fail=true;
 await page.route('**/api/v2/agent/receipt',r=>r.fulfill({status:fail?503:200,json:{ok:!fail,planChanged:false}}));
 await page.locator('[data-rb22-seen]').click();await expect(page.locator('[data-rb22-save-status]')).toContainText('Kunne ikke lagre');await expect(page.locator('[data-rb22-seen]')).toBeEnabled();
 fail=false;await page.locator('[data-rb22-seen]').click();await expect(page.locator('[data-rb22-seen]')).toHaveCount(0);
});
test('unavailable agent does not block canonical plan, health metrics or navigation',async({page})=>{
 await page.route('**/api/v2/agent',r=>r.fulfill({status:503,json:{ok:false}}));await page.goto('/');await page.locator('html.rb107-ready').waitFor();await page.locator('.bottom-nav [data-tab=health]').click();await expect(page.locator('.rb20-metrics')).toBeVisible();await page.locator('.bottom-nav [data-tab=plan]').click();await expect(page.locator('#plan')).toBeVisible();
});
