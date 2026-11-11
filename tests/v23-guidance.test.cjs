const {test}=require('node:test'),assert=require('node:assert/strict');
const modules=Promise.all([import('../cloud/runnerbear-cloud/src/v22/health.js'),import('../cloud/runnerbear-cloud/src/v22/workout.js'),import('../cloud/runnerbear-cloud/src/v22/agent.js')]);
const today='2026-11-11';
const activity=(id,date=today,sport='running',powers=[240,240,240],device=null)=>({source:'fixture',source_id:id,date,sport_type:sport,duration_seconds:2100,distance_m:7000,payload:{title:'Arbeid',detail:{garminFit:{device,laps:powers.flatMap(avgPower=>[{intensity:'active',seconds:600,avgPower,distanceM:2500,avgHr:160},{intensity:'rest',seconds:60,avgPower:80}])}}}});
test('running comparisons use work pace and disclose unknown measurement context',async()=>{
 const [,{analyzeWorkout,compareWorkouts}]=await modules;
 const current=analyzeWorkout(activity('new')),previous=analyzeWorkout(activity('old','2026-11-04'));
 const result=compareWorkouts(current,[current,previous]);assert.equal(result.status,'descriptive');assert.equal(result.count,1);assert.equal(result.contextQuality,'unknown');assert.match(result.text,/ikke bekreftet like/);assert.match(result.text,/dokumenterer ikke fremgang/);
});
test('known equipment differences and changed recovery prevent comparison',async()=>{
 const [,{analyzeWorkout,compareWorkouts}]=await modules;
 const current=analyzeWorkout(activity('new',today,'cycling',undefined,'trainer-a'));
 const different=analyzeWorkout(activity('old','2026-11-04','cycling',undefined,'trainer-b'));
 assert.equal(compareWorkouts(current,[different]).count,0);
 const changed=activity('changed','2026-11-02','cycling',undefined,'trainer-a');changed.payload.detail.garminFit.laps[1].seconds=180;
 assert.equal(compareWorkouts(current,[analyzeWorkout(changed)]).excluded[0].reason,'ulike drag eller pauser');
});
test('different duration repeats do not masquerade as an even interval prescription',async()=>{
 const [,{analyzeWorkout}]=await modules;
 const input=activity('mixed');input.payload.detail.garminFit.laps[2].seconds=300;
 const a=analyzeWorkout(input);assert.equal(a.spread,null);assert.doesNotMatch(a.headline,/liten variasjon/);
 assert.ok(a.takeawayFacts.every(id=>a.facts.some(f=>f.id===id)));
});
test('next-night coverage is separate from domain-specific response and uses a prior reference',async()=>{
 const [{responseAfter,addDays}]=await modules;
 const rows=Array.from({length:28},(_,i)=>({date:addDays('2026-11-08',-i),hrv_ms:40,sleep_seconds:27000,rhr_bpm:50}));
 rows.push({date:'2026-11-10',hrv_ms:30},{date:'2026-11-11',sleep_seconds:24000});
 const partial=responseAfter({date:'2026-11-09',source:'fixture',sourceId:'one'},rows,today);
 assert.equal(partial.status,'observed');assert.equal(partial.completeDomains,0);assert.equal(partial.outcome,'pending');assert.equal(partial.domains[0].reference,40);assert.equal(partial.referenceThrough,'2026-11-08');
 rows.find(r=>r.date==='2026-11-11').hrv_ms=32;
 const described=responseAfter({date:'2026-11-09'},rows,today);assert.equal(described.completeDomains,1);assert.equal(described.domains[0].value,31);assert.match(described.summary,/31 ms/);assert.match(described.limitation,/ikke.*forårsaket/);
});
test('expired partial follow-up closes truthfully even when one night is present',async()=>{
 const [{responseAfter}]=await modules;
 const r=responseAfter({date:'2026-11-01'},[{date:'2026-11-02',hrv_ms:40}],today);assert.equal(r.status,'closed_insufficient');assert.equal(r.outcome,'not_evaluable');assert.equal(r.nextReviewDate,null);
});
test('health synthesis treats higher HRV differently from a combined load signal',async()=>{
 const [{analyzeHealth,addDays}]=await modules;
 const rows=Array.from({length:35},(_,i)=>({date:addDays(today,-i),hrv_ms:i<7?50:40,sleep_seconds:27000,rhr_bpm:50}));
 const one=analyzeHealth(rows,{today});assert.equal(one.guidance.kind,'observe');assert.equal(one.loadSignals.length,0);
 const strain=analyzeHealth(rows.map((r,i)=>({...r,hrv_ms:i<7?30:40,rhr_bpm:i<7?57:50})),{today});assert.equal(strain.guidance.action,'checkin');assert.match(strain.brief,/egenfølelsen/);assert.equal(strain.planAuthority,false);
});
test('check-ins remain attached to their own dates after a later report',async()=>{
 const [,,{buildAgentSnapshot}]=await modules;
 const s=buildAgentSnapshot({today,activities:[activity('earlier','2026-11-08')],checkins:[{local_date:'2026-11-09',source_id:'old',state:'tired',reasons_json:'["achilles"]'},{local_date:today,source_id:'latest',state:'fresh',reasons_json:'[]'}]});
 assert.equal(s.activities[0].response.subjective.sourceId,'old');assert.equal(s.subjective.sourceId,'latest');assert.notEqual(s.primary.priority,'attention');
});
test('a health insight with an old activity cites health evidence, not that activity',async()=>{
 const [,,{buildAgentSnapshot}]=await modules;const s=buildAgentSnapshot({today,activities:[activity('old','2026-10-01')]});
 assert.equal(s.primary.type,'health');assert.ok(s.primary.factIds.every(id=>id.startsWith('health:')));assert.equal(s.primary.action,'health');
});
test('disabled comparison gate cannot leak comparisons into weekly learning or personal patterns',async()=>{
 const [,,{buildAgentSnapshot}]=await modules;const s=buildAgentSnapshot({today,activities:[activity('new'),activity('old','2026-11-04')],comparisonsEnabled:false});
 assert.ok(s.activities.every(a=>a.comparison.status==='validation_pending'));assert.equal(s.patterns.length,0);assert.ok(s.review.learningFactIds.every(id=>id.startsWith('health:')));
});
test('compact snapshots retain reasoning without raw work arrays',async()=>{
 const [,,{buildAgentSnapshot}]=await modules;const s=buildAgentSnapshot({today,activities:[activity('new')]});
 assert.equal(s.activities[0].workBlocks,undefined);assert.equal(s.activities[0].structureSignature,undefined);assert.ok(s.activities[0].advice);assert.ok(s.primary.advice);assert.ok(s.review.learning);
});
