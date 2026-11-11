const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
test('active Worker creates and revises read-only agent snapshots with local D1, receipts and kill switch',async()=>{
 const {build}=require('../cloud/runnerbear-cloud/node_modules/esbuild'),{Miniflare,convertV4MiniflareOptions}=require('../cloud/runnerbear-cloud/node_modules/miniflare');
 const cloud=path.join(__dirname,'../cloud/runnerbear-cloud'),config=JSON.parse(fs.readFileSync(path.join(cloud,'wrangler.jsonc'),'utf8')),dir=fs.mkdtempSync(path.join(os.tmpdir(),'rb22-worker-')),bundle=path.join(dir,'worker.mjs');
 await build({entryPoints:[path.join(cloud,config.main)],outfile:bundle,bundle:true,format:'esm',platform:'browser',external:['cloudflare:workers','node:*'],logLevel:'silent'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,modulesRoot:dir,scriptPath:bundle,compatibilityDate:'2026-08-11',compatibilityFlags:config.compatibility_flags,d1Databases:['DB'],bindings:{RUNNERBEAR_API_KEY:'fixture-key',PRIMARY_USER_ID:'primary'}}));
 try{
 const db=await mf.getD1Database('DB'),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo'}).format(new Date()),headers={'X-RunnerBear-Key':'fixture-key'};
 const definitions=[
 'CREATE TABLE rb_users(id TEXT PRIMARY KEY,created_at TEXT,updated_at TEXT)',
 'CREATE TABLE rb_feature_flags(user_id TEXT,flag TEXT,enabled INTEGER,payload_json TEXT)',
 'CREATE TABLE rb_migrations(user_id TEXT,migration_key TEXT,status TEXT)',
 'CREATE TABLE rb_health_daily(user_id TEXT,date TEXT,hrv_ms REAL,sleep_seconds REAL,rhr_bpm REAL,spo2_avg_pct REAL,spo2_min_pct REAL,health_source TEXT,health_quality TEXT,updated_at TEXT)',
 'CREATE TABLE rb_garmin_shadow(user_id TEXT,date TEXT,metrics TEXT,updated_at TEXT)',
 'CREATE TABLE rb_activities(user_id TEXT,source TEXT,source_id TEXT,date TEXT,sport_type TEXT,duration_seconds REAL,distance_m REAL,avg_hr REAL,payload_json TEXT,updated_at TEXT)',
 'CREATE TABLE rb_garmin_activity_shadow(user_id TEXT,activity_id TEXT,local_date TEXT,summary_json TEXT,fit_analysis TEXT)',
 'CREATE TABLE rb_subjective_checkins(user_id TEXT,source_id TEXT,local_date TEXT,state TEXT,reasons_json TEXT,occurred_at TEXT)',
 'CREATE TABLE rb_training_events(user_id TEXT,event_type TEXT,payload_json TEXT)',
 ...['0018_proactive_agent.sql','0019_agent_focus.sql'].flatMap(file=>fs.readFileSync(path.join(cloud,'migrations',file),'utf8').split(';').map(s=>s.trim()).filter(Boolean))];
 await db.batch(definitions.map(sql=>db.prepare(sql)));
 const get=()=>mf.dispatchFetch('https://app.runnerbear.workers.dev/api/v2/agent',{headers});
 assert.equal((await mf.dispatchFetch('https://app.runnerbear.workers.dev/api/v2/agent')).status,401);
 const initial=await (await get()).json();assert.equal(initial.warming,true);
 let record;for(let i=0;i<40;i++){record=await db.prepare('SELECT input_revision,payload_json FROM rb_agent_snapshots WHERE user_id=?').bind('primary').first();if(record)break;await new Promise(r=>setTimeout(r,100));}assert.ok(record,'background analysis persisted');
 const body=await (await get()).json();assert.equal(body.snapshot.mode,'observed-only');assert.equal(body.snapshot.planAuthority,false);assert.equal(body.snapshot.health.domains[0].state,'missing');
 const primary=body.snapshot.primary;
 const mark=await mf.dispatchFetch('https://app.runnerbear.workers.dev/api/v2/agent/receipt',{method:'POST',headers:{...headers,'Content-Type':'application/json','Idempotency-Key':'seen-fixture'},body:JSON.stringify({itemId:primary.id,inputRevision:primary.inputRevision,action:'seen'})});assert.equal(mark.status,200);assert.equal((await (await get()).json()).receipt,'seen');
 const stale=await mf.dispatchFetch('https://app.runnerbear.workers.dev/api/v2/agent/receipt',{method:'POST',headers:{...headers,'Content-Type':'application/json','Idempotency-Key':'stale-fixture'},body:JSON.stringify({itemId:primary.id,inputRevision:'0'.repeat(64),action:'seen'})});assert.equal(stale.status,409);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM rb_agent_items').first()).n,1);
 await db.prepare('INSERT INTO rb_garmin_shadow(user_id,date,metrics,updated_at) VALUES(?1,?2,?3,?4)').bind('primary',today,JSON.stringify({hrvMs:42,sleepSeconds:28000,rhr:50}),new Date().toISOString()).run();
 await db.prepare("UPDATE rb_agent_snapshots SET checked_at='2000-01-01T00:00:00Z'").run();await get();
 let revised;for(let i=0;i<40;i++){revised=await db.prepare('SELECT input_revision,payload_json FROM rb_agent_snapshots WHERE user_id=?').bind('primary').first();if(revised.input_revision!==record.input_revision)break;await new Promise(r=>setTimeout(r,100));}
 assert.notEqual(revised.input_revision,record.input_revision);const updated=JSON.parse(revised.payload_json);assert.equal(updated.health.domains[0].current,42);assert.equal(updated.health.domains[0].measuredAt,null);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM rb_agent_snapshots').first()).n,1,'new evidence revises the same day');
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM rb_agent_history').first()).n,2,'the previous explanation is retained');
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM rb_agent_items').first()).n,1,'new evidence does not create a second daily card');

 assert.equal((await db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='rb_plan_revisions'").first()).n,0,'agent works without a plan and creates no plan table');
 const isolated=await db.prepare('SELECT COUNT(*) n FROM rb_agent_snapshots WHERE user_id=?').bind('someone-else').first();assert.equal(isolated.n,0);
 const focusRequest=body=>mf.dispatchFetch('https://app.runnerbear.workers.dev/api/v2/agent/focus',{method:'POST',headers:{...headers,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(body)});
 const focused=await (await focusRequest({action:'start',kind:'body_response'})).json();assert.equal(focused.ok,true);assert.equal(focused.focus.status,'active');assert.equal(focused.planChanged,false);
 await focusRequest({action:'start',kind:'sleep_routine'});assert.equal((await db.prepare("SELECT COUNT(*) n FROM rb_agent_focus WHERE status='active'").first()).n,1);
 const finished=await (await focusRequest({action:'complete',focusId:focused.focus.id})).json();assert.equal(finished.focus.status,'completed');assert.equal((await (await get()).json()).focus.status,'completed');
 const {addDays}=await import('../cloud/runnerbear-cloud/src/v22/health.js');
 await db.batch(Array.from({length:75},(_,i)=>db.prepare('INSERT INTO rb_activities(user_id,source,source_id,date,sport_type,duration_seconds,distance_m,payload_json) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)').bind('primary','fixture','history-'+i,addDays(today,-80+i),'running',1800,5000,JSON.stringify({title:'Historical fixture'}))));
 await db.prepare("UPDATE rb_agent_snapshots SET checked_at='2000-01-01T00:00:00Z'").run();await get();
 for(let i=0;i<80;i++){const record=await db.prepare('SELECT payload_json FROM rb_agent_snapshots WHERE user_id=?').bind('primary').first();if(JSON.parse(record.payload_json).activityCount===75)break;await new Promise(r=>setTimeout(r,100));}
 const full=await (await get()).json();assert.equal(full.snapshot.activityCount,75);assert.equal(full.snapshot.activities.length,12);
 const historical=await mf.dispatchFetch('https://app.runnerbear.workers.dev/api/v2/agent/workout?source=fixture&sourceId=history-0',{headers});assert.equal(historical.status,200);assert.equal((await historical.json()).workout.sourceId,'history-0');
 const beforeRepeat=(await db.prepare('SELECT COUNT(*) n FROM rb_agent_history').first()).n;
 await db.prepare("UPDATE rb_agent_snapshots SET checked_at='2000-01-01T00:00:00Z'").run();await get();await new Promise(r=>setTimeout(r,300));assert.equal((await db.prepare('SELECT COUNT(*) n FROM rb_agent_history').first()).n,beforeRepeat,'query timing metadata does not create a new analysis revision');

 }finally{await mf.dispose();fs.rmSync(dir,{recursive:true,force:true})}
});
