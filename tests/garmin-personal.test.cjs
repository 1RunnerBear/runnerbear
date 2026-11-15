const test=require('node:test');
const assert=require('node:assert/strict');
function dbStub(){const state={token:null,health:[],sync:null};return{state,prepare(sql){let args=[];return{bind(...values){args=values;return this},async first(){return sql.includes('rb_garmin_token_cache')?state.token:null},async run(){if(sql.includes('rb_garmin_token_cache'))state.token={access_token:args[1],expires_at:args[2]};else if(sql.includes('rb_garmin_shadow'))state.health.push(args);else if(sql.includes('rb_sync_sources'))state.sync=args;return{success:true}}}}}}
test('Garmin sync caches token, reads bounded days and validates metrics',async()=>{const{syncGarminPersonal}=await import('../cloud/runnerbear-cloud/src/v1027/garmin-personal.js');const DB=dbStub();let tokenCalls=0,apiCalls=0;const original=global.fetch;global.fetch=async(url,options)=>{if(String(url).includes('/personalapitoken-service/')){tokenCalls++;assert.equal(options.headers.Authorization,'ApiKey secret');return new Response('header.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.sig')}apiCalls++;const path=String(url);if(path.includes('dailySleep'))return Response.json({sleepTimeSeconds:25200,averageSpO2Value:97,lowestSpO2Value:91,averageRespirationValue:15,sleepScores:{overall:{value:82}}});if(path.includes('dailyHeartRate'))return Response.json({restingHeartRate:49});if(path.includes('/hrv/'))return Response.json({lastNightAvg:42});return Response.json({averageSpO2:96,lowestSpO2:44})};try{const result=await syncGarminPersonal({DB,GARMIN_API_KEY:'secret',PRIMARY_USER_ID:'primary'},{days:1});assert.equal(tokenCalls,1);assert.equal(apiCalls,8);assert.equal(result.saved,2);assert.equal(DB.state.health.length,2);assert.equal(JSON.parse(DB.state.health[0][2]).spo2Avg,96);assert.equal(JSON.parse(DB.state.health[0][2]).spo2Min,null);assert.equal(JSON.parse(DB.state.health[0][2]).sleepSpo2Avg,97);assert.equal(JSON.parse(DB.state.health[0][2]).sleepSpo2Min,91);assert.equal(JSON.parse(DB.state.health[0][2]).respiration,15);assert.equal(JSON.parse(DB.state.health[0][2]).sleepScore,82);assert.equal(DB.state.sync[2].includes('shadow-read-only'),true)}finally{global.fetch=original}});
test('Garmin API failures do not write health or success sync state',async()=>{const{syncGarminPersonal}=await import('../cloud/runnerbear-cloud/src/v1027/garmin-personal.js');const DB=dbStub(),original=global.fetch;global.fetch=async()=>new Response('denied',{status:401});try{await assert.rejects(()=>syncGarminPersonal({DB,GARMIN_API_KEY:'secret'},{days:1}),/GARMIN_API_HTTP_401/);assert.equal(DB.state.health.length,0);assert.equal(DB.state.sync,null)}finally{global.fetch=original}});
test('Garmin sync fails closed without secret',async()=>{const{syncGarminPersonal}=await import('../cloud/runnerbear-cloud/src/v1027/garmin-personal.js');await assert.rejects(()=>syncGarminPersonal({DB:dbStub()},{days:1}),/GARMIN_KEY_MISSING/)});

test('partial activity imports preserve prior metrics and FIT across retries and accept corrected zero watts',async()=>{
 const {DatabaseSync}=require('node:sqlite');
 const {importGarminActivities}=await import('../cloud/runnerbear-cloud/src/v1027/garmin-personal.js');
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('CREATE TABLE rb_garmin_activity_shadow(user_id TEXT,activity_id TEXT,local_date TEXT,summary_json TEXT,fit_analysis TEXT,PRIMARY KEY(user_id,activity_id))');
 const env={GARMIN_API_KEY:'secret',DB:{
  prepare(sql){return {bind(...args){return {first:async()=>null,run:()=>sqlite.prepare(sql).run(Object.fromEntries(args.map((v,i)=>[String(i+1),v])))}}}},
  batch(stmts){for(const stmt of stmts)stmt.run()}
 }};
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo'}).format(new Date());
 const base={activityId:101,startTimeLocal:day+' 12:30:00',duration:1800};
 let input={...base,startTimeGMT:day+' 11:30:00',activityType:{typeKey:'virtual_ride'},averageHR:145,avgPower:205};
 const original=global.fetch;
 global.fetch=async url=>String(url).includes('personalapitoken-service')?new Response('header.'+Buffer.from(JSON.stringify({exp:Date.now()/1000+3600})).toString('base64url')+'.sig'):Response.json([input]);
 try{
  await importGarminActivities(env);
  sqlite.exec("UPDATE rb_garmin_activity_shadow SET fit_analysis='existing-fit'");
  input={...base,avgPower:0};
  for(let i=0;i<3;i++)await importGarminActivities(env);
  const [record,...duplicates]=sqlite.prepare('SELECT * FROM rb_garmin_activity_shadow').all(),m=JSON.parse(record.summary_json);
  assert.equal(duplicates.length,0);assert.equal(m.startUtc,day+'T11:30:00.000Z');
  assert.equal(m.avgHr,145);assert.equal(m.sport,'virtual_ride');assert.equal(m.avgWatts,0);
  assert.equal(record.fit_analysis,'existing-fit');
 }finally{global.fetch=original;sqlite.close()}
});
