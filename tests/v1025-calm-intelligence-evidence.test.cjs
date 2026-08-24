const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const model=require('../runnerbear-v1025-intelligence.js');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('VO2 history accepts only real Garmin values and deduplicates activities',()=>{
  const existing=[{date:'2026-08-17',value:51.2,source:'Garmin',activityId:'run-1',syncedAt:'2026-08-17T12:00:00Z'}];
  const activities=[
    {id:'run-1',date:'2026-08-16T07:00:00Z',detail:{summary:{vo2max:49}}},
    {id:'run-2',date:'2026-08-19T07:00:00Z',detail:{summary:{vo2max:52.36}}},
    {id:'bad-low',date:'2026-08-19',detail:{summary:{vo2max:12}}},
    {id:'missing',date:'2026-08-20',detail:{summary:{}}}
  ];
  const history=model.mergeVo2History(existing,activities,'2026-08-20T10:00:00Z');
  assert.deepEqual(history.map(row=>[row.activityId,row.date,row.value]),[['run-1','2026-08-17',51.2],['run-2','2026-08-19',52.4]]);
  assert.equal(model.latestVo2(history).activityId,'run-2');
  assert.equal(model.latestVo2([]),null);
});

test('moved threshold workout uses the actual Garmin work section without manual feedback',()=>{
  const rows=model.thresholdEvidenceFromSessions([{
    plan:{baseDs:'2026-08-18',ds:'2026-08-19',type:'quality',title:'6 × 6 min terskel'},
    activity:{id:'garmin-42',date:'2026-08-19T18:00:00Z',sportType:'running',detail:{analysis:{workBlocks:[{duration:360},{duration:360},{duration:360}],workDuration:1080,workPace:241.7,workHr:166,confidence:'high'}}},
    feedback:{},assessment:{confidence:{code:'high'}},family:'6x6 threshold'
  }]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].date,'2026-08-19');
  assert.equal(rows[0].pace,242);
  assert.equal(rows[0].hr,166);
  assert.equal(rows[0].source,'Garmin arbeidsdel');
  assert.equal(rows[0].activityId,'garmin-42');
});

test('retired shoes never enter future prescriptions but remain in history',()=>{
  const shoes=[
    {name:'Old Tempo',role:'Terskel · tempo',active:false},
    {name:'Daily Soft',role:'Rolig · langtur',active:true},
    {name:'Fast Active',role:'Terskel · kvalitet',active:true}
  ];
  const plan={type:'quality',title:'Terskel 4 × 10 min',shoe:'Old Tempo'};
  assert.deepEqual(model.activeShoes(shoes).map(row=>row.name),['Daily Soft','Fast Active']);
  assert.equal(model.ensureActiveShoe(plan,shoes).shoe,'Fast Active');
  assert.equal(model.ensureActiveShoe(plan,shoes,{historical:true}).shoe,'Old Tempo');
  const fallback=model.ensureActiveShoe(plan,shoes.map(row=>({...row,active:false})));
  assert.equal(fallback.shoe,'Terskel-/temposko');
  assert.equal(fallback.fallback,true);
});

test('v10.25 UI is calm by default and exposes honest evidence and settings',()=>{
  const ui=read('runnerbear-ui-v1025.js'),cloud=read('runnerbear-data-v1025.js');
  assert.doesNotMatch(ui,/aria-label=["']Varsler/);
  assert.doesNotMatch(ui,/Spør coachen/);
  assert.match(ui,/Coachens råd/);
  assert.match(ui,/Dagens vurdering og det viktigste akkurat nå/);
  assert.match(ui,/Uken så langt/);
  assert.match(ui,/Planfase/);
  assert.doesNotMatch(ui,/Treningsbelastning<\/h2>|Fremdrift<\/h2>/);
  assert.match(ui,/Hvordan kjennes kroppen i dag\?/);
  assert.match(ui,/return flexible\(p\)\?'run'/);
  assert.match(ui,/runnerbear_v1024_tredict_sync/);
  assert.match(ui,/replaceRetiredShoeInFuturePlan/);
  assert.match(cloud,/mergeVo2History/);
  assert.match(cloud,/runfest26_vo2_history/);
});

test('PWA manifest ships installable PNG and maskable icon sizes',()=>{
  const manifest=JSON.parse(read('site.webmanifest'));
  assert.equal(manifest.start_url,'/?app=v10311');
  const expected=new Map([['rb-icon-192.png','192x192'],['rb-icon-512.png','512x512'],['rb-icon-maskable-512.png','512x512']]);
  for(const [name,size] of expected){
    const icon=manifest.icons.find(row=>row.src.startsWith(name));
    assert.equal(icon?.sizes,size);
    const png=fs.readFileSync(path.join(root,name));
    assert.equal(png.toString('ascii',1,4),'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`,size);
  }
  assert.match(read('index.html'),/apple-touch-icon[^>]+rb-icon-180\.png/);
  assert.match(read('runnerbear-app-icon-v1025.svg'),/RB-monogram/);
});
