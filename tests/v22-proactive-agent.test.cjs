const {test}=require('node:test'),assert=require('node:assert/strict');
const modules=Promise.all([import('../cloud/runnerbear-cloud/src/v22/health.js'),import('../cloud/runnerbear-cloud/src/v22/workout.js'),import('../cloud/runnerbear-cloud/src/v22/agent.js')]);
const today='2026-11-11';
const makeRows=addDays=>Array.from({length:35},(_,i)=>({date:addDays(today,-i),hrv_ms:i<7?30:45,sleep_seconds:i<7?21000:28000,rhr_bpm:i<7?57:50,health_source:'garmin',updated_at:'2026-11-11T09:00:00Z'}));
test('health uses disjoint calendar windows, domain coverage and actual date precision',async()=>{
 const [{analyzeHealth,addDays}]=await modules;const h=analyzeHealth(makeRows(addDays),{today});
 assert.deepEqual(h.changedDomains,['hrv','sleep','rhr']);assert.equal(h.domains[0].referenceCoverage,28);assert.equal(h.domains[0].coverage,7);assert.equal(h.domains[0].baseline,45);assert.equal(h.domains[0].value,30);assert.equal(h.domains[0].measuredAt,null);assert.equal(h.planAuthority,false);
});
test('data gaps and a well-covered HRV domain never make missing sleep normal',async()=>{
 const [{analyzeHealth,addDays}]=await modules;const rows=makeRows(addDays).map(r=>({...r,sleep_seconds:null}));
 rows.splice(0,7);rows.unshift({date:today,hrv_ms:30});const h=analyzeHealth(rows,{today});
 assert.equal(h.domains[0].state,'building');assert.equal(h.domains[0].coverage,1);assert.equal(h.domains[1].state,'missing');assert.equal(h.domains[1].baseline,null);
});
test('duplicate dates count once and old rows do not stand in for consecutive nights',async()=>{
 const [{analyzeHealth,addDays}]=await modules;const row={date:today,hrv_ms:40};
 const h=analyzeHealth([row,row,...Array.from({length:28},(_,i)=>({date:addDays(today,-60-i),hrv_ms:40}))],{today});assert.equal(h.domains[0].coverage,1);assert.equal(h.domains[0].referenceCoverage,0);
});
test('source-specific receipt time does not borrow direct Garmin freshness for a canonical metric',async()=>{
 const [{healthEvidence}]=await modules;const rows=healthEvidence([{date:today,sleep_seconds:26000,health_source:'tredict',updated_at:'2026-11-10T09:00:00Z'}],[{date:today,metrics:JSON.stringify({hrvMs:42}),updated_at:'2026-11-11T09:00:00Z'}]);assert.equal(rows[0].metricEvidence.sleep_seconds.receivedAt,'2026-11-10T09:00:00Z');assert.equal(rows[0].metricEvidence.hrv_ms.receivedAt,'2026-11-11T09:00:00Z');
});
test('Oslo calendar and daylight saving boundaries preserve local days',async()=>{
 const [{localDay,addDays}]=await modules;assert.equal(localDay('2026-03-28T23:30:00Z'),'2026-03-29');assert.equal(localDay('2026-10-25T23:30:00Z'),'2026-10-26');assert.equal(addDays('2026-03-29',1),'2026-03-30');
});
test('follow-up uses next two actual nights, excludes future data and closes without enough evidence',async()=>{
 const [{responseAfter}]=await modules,a={date:'2026-11-10'};
 assert.equal(responseAfter(a,[{date:'2026-11-12',hrv_ms:40}],today).values.length,0);
 assert.equal(responseAfter(a,[],'2026-11-14').status,'closed_insufficient');
 assert.equal(responseAfter(a,[{date:'2026-11-11',hrv_ms:40},{date:'2026-11-12',sleep_seconds:28000}],'2026-11-12').status,'observed');
});
for(const [n,seconds] of [[6,360],[4,480],[3,600],[20,45]])test(`agent analysis ${n}x${seconds} excludes warmup and recovery`,async()=>{
 const [, {analyzeWorkout}]=await modules;const laps=[{intensity:'warmup',seconds:600,avgPower:100},...Array.from({length:n},()=>[{intensity:'active',seconds,avgPower:240,avgHr:160},{intensity:'rest',seconds:60,avgPower:80}]).flat()];const a=analyzeWorkout({source:'garmin',source_id:'one',date:today,sport_type:'cycling',duration_seconds:3600,payload:{title:'Intervals',detail:{garminFit:{laps}}}});
 assert.equal(a.structure,'intervals');assert.equal(a.workSeconds,n*seconds);assert.equal(a.workPower,240);assert.equal(a.workHr,160);assert.ok(a.findings.every(f=>f.factIds.every(id=>a.facts.some(fact=>fact.id===id))));
});
test('ramps, unknown structures, zeros and user pace corrections stay honest',async()=>{
 const [, {analyzeWorkout}]=await modules,base={source_id:'a',date:today,sport_type:'cycling',payload:{title:'FTP Ramp Test',detail:{garminFit:{laps:[{intensity:'active',seconds:60,avgPower:200},{intensity:'active',seconds:60,avgPower:0}]}}}};
 const a=analyzeWorkout(base);assert.equal(a.structure,'ramp');assert.equal(a.workPower,100);assert.match(a.findings.at(-1).text,/Verken.*FTP/);
 const run=analyzeWorkout({...base,sport_type:'running',payload:{title:'Run',paceCorrection:{mode:'set',paceSeconds:240},detail:{garminFit:{laps:[{intensity:'active',seconds:600,distanceM:1900}]}}}});assert.equal(run.workPace,240);
});
test('subjective safety takes precedence and repeated windows do not assert causation',async()=>{
 const [{addDays},,{buildAgentSnapshot}]=await modules;const s=buildAgentSnapshot({today,rows:makeRows(addDays),activities:[],subjective:{local_date:today,state:'heavy',source_id:'check',reasons_json:'["achilles"]'}});assert.equal(s.primary.priority,'attention');assert.equal(s.primary.factIds[0],'checkin:check');assert.equal(s.planAuthority,false);assert.equal(s.aiMode,'verified-templates');
});
test('agent kill switches stop analysis and rendering without reading private rows',async()=>{
 const [,,{runAgentCycle,agentRead}]=await modules;const env={RUNNERBEAR_AGENT_INSIGHTS:'false',DB:{prepare(){throw Error('should not read')}}};assert.equal((await runAgentCycle(env)).status,'disabled');const response=await agentRead(new Request('https://example.test/api/v2/agent'),env,{userId:'primary'});assert.equal((await response.json()).enabled,false);
});
test('impossible source dates do not count towards reference coverage',async()=>{
 const [{healthEvidence}]=await modules;assert.equal(healthEvidence([{date:'2026-02-31',hrv_ms:40}]).length,0);
});
