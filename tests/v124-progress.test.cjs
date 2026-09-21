const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const progress=require('../runnerbear-v124-progress.js'),analysis=require('../runnerbear-v1012-analysis.js'),intelligence=require('../runnerbear-v1025-intelligence.js');
const now=Date.parse('2026-09-14T10:00:00Z'),stamp=new Date(now).toISOString(),date='2026-09-12';
const work={workDuration:1800,workPace:255,workHr:155,hrDrift:4,paceFade:12,confidence:'high',workBlocks:Array.from({length:10},(_,i)=>({index:i+1,duration:180,pace:255,hr:155}))};
const a={id:'run',ds:date,date,sportType:'running',duration:3600,distance:12000,heartrate:150,detail:{analysis:work}};
const raw={source:'tredict',source_id:'run',date,sport_type:'running',updated_at:stamp,duration_seconds:3600,distance_m:12000,avg_hr:150,payload:{id:'run',detail:a.detail}};
const correction={eventId:'correction-1',rank:1,activityId:'run',activitySource:'tredict',activityVersion:stamp,scope:'work',mode:'set',paceSeconds:240,savedAt:stamp};
const data=()=>({ok:true,correctionCapture:true,paceCorrections:[correction],planRevisionId:'pr',flags:{coach_loop_read:false,coach_loop_ui:false},activePlan:{planRevisionId:'pr',items:[]},recentActivities:[raw],activityHistory:{version:'activity-history-1',state:'current',syncedAt:stamp,truncated:false},generatedAt:stamp});
test('work pace correction is a read-only overlay; raw total, intervals, time and pulse are unchanged',()=>{
 const snapshot=data(),before=JSON.stringify({a,snapshot}),projected=progress.project(a,snapshot);assert.equal(projected.detail.analysis.workPace,240);assert.equal(projected.detail.analysis.paceFade,null);assert.equal(projected.distance,12000);assert.equal(projected.duration,3600);assert.equal(projected.heartrate,150);assert.deepEqual(projected.detail.analysis.workBlocks,work.workBlocks);assert.equal(JSON.stringify({a,snapshot}),before);
 const plan={type:'quality',title:'10 × 3 min terskel',km:12,ds:date};const assessment=analysis.assessSession({plan,activity:projected});assert.equal(assessment.work.workPace,240);const evidence=intelligence.thresholdEvidenceFromSessions([{plan,activity:projected,assessment}]);assert.equal(evidence[0].pace,240);assert.equal(evidence[0].paceBasis,'reported');assert.match(evidence[0].source,/Oppgitt av deg/);
});
test('unreliable and stale corrected pace are excluded, undo restores the original and ambiguous provider IDs are rejected',()=>{
 for(const change of [{mode:'unreliable'},{activityVersion:'old'}]){const d=data();d.paceCorrections=[{...correction,...change}];const projected=progress.project(a,d);assert.equal(projected.detail.analysis.workPace,null);assert.deepEqual(intelligence.thresholdEvidenceFromSessions([{plan:{type:'quality'},activity:projected,feedback:{paceSeconds:240,hr:155}}]),[])}
 const d=data();d.paceCorrections=[{...correction,mode:'clear'}];assert.equal(progress.project(a,d),a);d.recentActivities.push({...raw,source:'garmin'});assert.equal(progress.context(a,d),null);
});
test('pace parser rejects units, malformed time and out of bounds values',()=>{
 assert.equal(progress.parsePace('4:00'),240);for(const value of ['4.00','15 km/h','4:99','0:59','21:00','',null])assert.equal(progress.parsePace(value),null);
});
const evidence=[{date:'2026-09-03',family:'10x180',paceBasis:'measured',confidence:'high',pace:250,hr:155,workDuration:1800,activityId:'first',label:'10 × 3 min'},{date:'2026-09-12',family:'10x180',paceBasis:'measured',confidence:'high',pace:245,hr:156,workDuration:1800,activityId:'last',label:'10 × 3 min'}];
const input=()=>({today:'2026-09-14',history:{current:true,truncated:false},activities:[raw],evidence,next:{ds:'2026-09-15',title:'Neste ordinære økt'}});
test('progress has at most two sourced observations and uses actual activity rather than future plans',()=>{
 const m=progress.progress(input());assert.equal(m.observations.length,2);assert.match(m.observations[0].copy,/1 løpeøkt/);assert.match(m.observations[1].title,/5 sek\/km raskere/);assert.deepEqual(m.observations[1].activityIds,['first','last']);assert.equal(m.next.ds,'2026-09-15');assert.equal(m.from,'2026-08-17');assert.equal(m.through,'2026-09-13');
});
test('progress cannot claim a trend across sport, source, work volume, pulse or uncertain history',()=>{
 for(const patch of [{paceBasis:'reported'},{workDuration:1000},{hr:165},{family:'6x360'},{confidence:'limited'}]){const i=input();i.evidence=[evidence[0],{...evidence[1],...patch}];assert.equal(progress.progress(i).observations.length,1)}
 for(const history of [{current:false},{current:true,truncated:true,oldestDate:'2026-09-01'}]){const m=progress.progress({...input(),history});assert.equal(m.ready,false);assert.deepEqual(m.observations,[]);assert.match(m.reason,/oppdateres/)}
 const i=input();i.activities=[{...raw,sport_type:'rowing'}];assert.match(progress.progress(i).observations[0].title,/0 av 4/);
});
function storage(){const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}}
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
function ui(snapshot){const window={RunnerBearProgress:progress,RunnerBearV1012:analysis,RunnerBearV1025:intelligence,RunnerBearDataTrust:require('../runnerbear-v1222-data-trust.js'),RunnerBearCloudV11:{snapshot:()=>snapshot},RunnerBearCoachEngine:{schedule:()=>[{ds:date,type:'quality',title:'10 × 3 min terskel',km:12,week:1,label:'test'}]},addEventListener(){},dispatchEvent(){}},document={readyState:'loading',addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};const source=fs.readFileSync('runnerbear-ui-v11-source.js','utf8').replace("  if(document.readyState==='loading')","  window.audit={correctionHtml,goalHeroFidelityHtml,goalPremiumSummaryHtml,completedRows,completedDetailHtml,resultMetrics,comparisonHtml};\n  if(document.readyState==='loading')");vm.runInNewContext(source,{window,document,Date:Clock,localStorage:storage(),sessionStorage:storage(),performance:{now:()=>0},console,setTimeout:()=>0,clearTimeout(){},CustomEvent:class{}});return{api:window.audit,os:window.RunnerBearCoachOS}}
test('actual production-flag UI shows correction provenance, original total and a reversible form',()=>{
 const d=data(),{api,os}=ui(d),p=os.planFor(date),html=api.completedDetailHtml(api.completedRows()[0]);assert.match(html,/Korriger grunnlaget/);assert.match(html,/4:00\/km · oppgitt av deg/);assert.match(html,/Angre korrigeringen/);assert.match(html,/Korrigeringshistorikk/);assert.match(api.comparisonHtml(p,a),/12 km|12,0 km/);assert.match(api.comparisonHtml(p,a),/4:00/);assert.equal(os.sessionAssessment(p,a).work.workPace,240);
 const goal=api.goalPremiumSummaryHtml({targetSeconds:4980});assert.match(goal,/Dette har utviklet seg/);assert.match(api.goalHeroFidelityHtml({targetSeconds:4980,date:'2026-10-03',distance:'half',name:'Runfest'}),/1:23:00/);assert.doesNotMatch(goal,/Målkorridor|Innen rekkevidde/);
 d.paceCorrections=[];assert.doesNotMatch(api.correctionHtml(p,a),/ checked/);
});
function client(fetch){const window={RunnerBearV1026:require('../runnerbear-v1026-coach-loop.js'),addEventListener(){},dispatchEvent(){}};vm.runInNewContext(fs.readFileSync('runnerbear-cloud-v11.js','utf8'),{window,document:{documentElement:{classList:{remove(){},add(){},toggle(){}}},querySelector:()=>null},fetch,AbortController,CustomEvent:class{},localStorage:storage(),console:{warn(){},info(){},error(){}},setTimeout:()=>0,clearTimeout(){}});return window.RunnerBearCloudV11}
test('confirmed correction survives refresh failure and never writes a plan or provider',async()=>{
 const requests=[],d=data();d.activePlan.status='active';d.paceCorrections=[];const api=client(async(path,options)=>{requests.push(path);if(requests.length===1)return{ok:true,json:async()=>d};if(options.method==='POST')return{ok:true,json:async()=>({ok:true,planChanged:false,correction})};throw Error('offline')});await api.start();const result=await api.submitPaceCorrection({mode:'set'},'stable-key');assert.equal(result.planChanged,false);assert.equal(api.snapshot().paceCorrections[0].eventId,correction.eventId);assert.deepEqual(requests,['/api/v2/bootstrap?scope=home','/api/v2/pace-corrections','/api/v2/bootstrap?scope=full']);
});
test('failed correction save cannot produce a receipt',async()=>{
 const d=data();d.activePlan.status='active';d.paceCorrections=[];const api=client(async(path,options)=>options.method==='POST'?{ok:false,json:async()=>({message:'Lagring feilet'})}:{ok:true,json:async()=>d});await api.start();await assert.rejects(api.submitPaceCorrection({},'key'),/Lagring feilet/);assert.equal(api.snapshot().paceCorrections.length,0);
});
