const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('v10.24 index loads only canonical versioned frontend assets',()=>{
  const html=read('index.html');
  const scripts=[...html.matchAll(/<script[^>]+src="([^"]+\.js)(?:\?[^"]*)?"/g)].map(match=>match[1]);
  const styles=[...html.matchAll(/<link[^>]+href="([^"]+\.css)(?:\?[^"]*)?"/g)].map(match=>match[1]);
  assert.deepEqual(scripts,['runnerbear-core-v1024.js','runnerbear-ui-v1024.js','runnerbear-data-v1024.js']);
  assert.deepEqual(styles,['runnerbear-v1024.css']);
  assert.doesNotMatch(html,/runnerbear-(?:v5|premium|v97|v100|v107|v1020)-/);
  assert.doesNotMatch(html,/http-equiv="(?:Cache-Control|Pragma|Expires)"/);
  assert.doesNotMatch(html,/rel="preload"/);
  const jsBytes=scripts.reduce((sum,file)=>sum+fs.statSync(path.join(root,file)).size,0);
  assert.ok(jsBytes<315000,'canonical JavaScript is '+jsBytes+' bytes');
  assert.ok(fs.statSync(path.join(root,styles[0])).size<220000);
});

test('v10.24 renders one active surface and lazy-renders inactive tabs',()=>{
  const ui=read('runnerbear-ui-v1024.js');
  assert.match(ui,/function renderToday\(\)/);
  assert.match(ui,/function renderPlan\(\)/);
  assert.match(ui,/function renderGoals\(\)/);
  assert.match(ui,/function renderMore\(\)/);
  assert.match(ui,/function renderAll\(\)\{return renderView\(activeView\(\)\)\}/);
  assert.match(ui,/migrateTrainingPreferences\(\);tredictSync\(\)\?\.init\?\.\(\);runAutopilot\(\);decorateNav\(\);decorateBrand\(\);renderToday\(\)/);
  assert.match(ui,/bind\(\$\(id\)\)/);
  assert.doesNotMatch(ui,/setTimeout\(renderAll,(?:500|1400)\)/);
  assert.doesNotMatch(ui,/setTimeout\(init,50\)/);
  assert.doesNotMatch(ui,/visibilitychange[^]*renderAll/);
  assert.equal((ui.match(/document\.addEventListener\('click'/g)||[]).length,1);
  assert.match(ui,/runtimeStats=\{startupAt:performance\.now\(\),renders:\{today:0,plan:0,goals:0,more:0\},fullRenders:0\}/);
});

test('cached recovery state works with and without cached data',()=>{
  const listeners={};
  const storage=new Map();
  const context={
    window:{RunnerBearTredict:{},addEventListener:(name,fn)=>{listeners[name]=fn}},
    localStorage:{getItem:key=>storage.get(key)||null},
    console:{error:()=>{}},
    JSON,Date,Number,String,Object,Array,Math,
  };
  vm.runInNewContext(read('runnerbear-runtime-v1021.js'),context);
  assert.equal(context.window.RunnerBearTredict.recoverySignal().level,'green');
  storage.set('runnerbear_tredict_cache_v1',JSON.stringify({
    hrv:{20260814:[40,60]},
    sleep:{20260814:[18000,28000]},
    body:Array.from({length:14},(_,index)=>({timestamp:'2026-08-'+String(index+1).padStart(2,'0'),hrRestDynamic:index===13?60:50})),
  }));
  assert.equal(context.window.RunnerBearTredict.recoverySignal().level,'red');
  assert.equal(typeof listeners.error,'function');
  assert.equal(typeof listeners.unhandledrejection,'function');
});

test('cloud startup is home-first, full data is lazy and persistence is dirty-state driven',()=>{
  const cloud=read('runnerbear-cloud-v1021.js');
  assert.match(cloud,/api\('\/api\/bootstrap\/home'\)/);
  assert.match(cloud,/runnerbear:view/);
  assert.match(cloud,/bootstrapFull\(view\)/);
  assert.match(cloud,/if\(active!==['"]today['"]\)bootstrapFull\(active\)/);
  assert.match(cloud,/runnerbear:state-dirty/);
  assert.match(cloud,/dirtyVersion===uploadedVersion/);
  assert.doesNotMatch(cloud,/document\.addEventListener\('click',scheduleUpload/);
  assert.doesNotMatch(cloud,/setInterval\(\(\)=>uploadLocal/);
  assert.match(cloud,/runnerbear_bootstrap_error/);
  assert.match(cloud,/Viser sist kjente data/);
});

test('home bootstrap uses indexed date windows without a read-path user write',()=>{
  const worker=read('cloud/runnerbear-cloud/src/index.js');
  const wrapper=read('cloud/runnerbear-cloud/src/index-v982.js');
  const migration=read('cloud/runnerbear-cloud/migrations/0001_runnerbear_cloud.sql');
  assert.match(worker,/function getHomeBootstrap/);
  assert.match(worker,/function homeLocalState/);
  assert.match(worker,/namespace = 'localStorage'/);
  assert.match(worker,/35 \* 86400000/);
  assert.match(worker,/21 \* 86400000/);
  assert.match(worker,/if \(!\['GET', 'HEAD'\]\.includes\(request\.method\)\) await ensureUser/);
  assert.match(worker,/runnerbear_bootstrap_home/);
  assert.match(worker,/runnerbear_bootstrap_full/);
  const bootstrapRoute=wrapper.slice(wrapper.indexOf("path==='/api/bootstrap/home'"),wrapper.indexOf("path==='/health'"));
  assert.doesNotMatch(bootstrapRoute,/syncTredict/);
  assert.match(migration,/idx_rb_activities_user_date ON rb_activities\(user_id, date DESC\)/);
  assert.match(migration,/idx_rb_health_user_date ON rb_health_daily\(user_id, date DESC\)/);
  assert.match(migration,/idx_rb_capacity_user_timestamp ON rb_capacity\(user_id, timestamp DESC\)/);
});

test('v10.20 state and integration contracts remain in the canonical runtime',()=>{
  const ui=read('runnerbear-ui-v1024.js');
  const core=read('runnerbear-core-v1024.js');
  const data=read('runnerbear-data-v1024.js');
  for(const key of ['runfest26_week_adjustments','runnerbear_v107_plan_moves','runnerbear_v107_plan_locks','runnerbear_v108_shoes','runnerbear_v109_goals','runfest26_training_profile_v10'])assert.match(ui,new RegExp(key));
  assert.match(core,/RunnerBearCoachEngine/);
  assert.match(core,/RunnerBearV1012/);
  assert.match(core,/RunnerBearV1020/);
  assert.match(core,/runnerbear:state-dirty/);
  assert.match(core,/RunnerBearCoachOS\?\.render/);
  assert.match(data,/RunnerBearTredictOutbound/);
  assert.match(data,/publishOutbound/);
  assert.match(ui,/Concept2/);
});

test('release metadata and production health gate agree on v10.24',()=>{
  assert.equal(JSON.parse(read('runnerbear-version.json')).build,'10.24');
  assert.match(read('site.webmanifest'),/v1024/);
  assert.match(read('cloud/runnerbear-cloud/src/index.js'),/const BUILD = '10\.24'/);
  assert.match(read('cloud/runnerbear-cloud/src/index-v982.js'),/const BUILD='10\.24'/);
  assert.match(read('.github/workflows/runnerbear-cloud-deploy.yml'),/cloudBuild!==\"10\.24\"/);
});
