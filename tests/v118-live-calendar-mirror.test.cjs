const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const row=(id,date,externalId,fingerprint='f1',extra={})=>({id,date:`${date}T15:00:00.000Z`,title:'Quality',notes:`[RB:${externalId}] [PLAN:rb-plan-primary] [REV:pr-2] [FPR:${fingerprint}]`,...extra});
const operation=(overrides={})=>({operationType:'update',externalId:'rb-workout-w1',canonicalPlanId:'rb-plan-primary',planRevisionId:'pr-2',date:'2026-09-03',previousDate:'2026-09-02',today:'2026-09-01',windowStart:'2026-09-01',windowEnd:'2026-09-14',title:'Quality',fingerprint:'f2',structuredWorkout:{title:'Quality',notes:'[RB:rb-workout-w1] [PLAN:rb-plan-primary] [REV:pr-2] [FPR:f2]'},...overrides});

class FakeProvider{
  constructor(rows=[],capabilities={supportsMove:true,supportsCreate:true,supportsUpdate:true,supportsDelete:true,supportsReplace:true}){this.rows=rows;this.capabilities=capabilities;this.calls=[];this.next=2}
  async discoverCapabilities(){return this.capabilities}
  async listPlannedWorkouts(){return this.rows}
  async createWorkout(op){this.calls.push('create');if(this.failCreate)throw new Error('create failed');const created=row(`td-${this.next++}`,op.date,op.externalId,op.fingerprint);created.notes=op.structuredWorkout.notes;this.rows.push(created);return created}
  async moveWorkout(remote,op){this.calls.push('move');remote.date=`${op.date}T15:00:00.000Z`;return remote}
  async updateWorkout(remote,op){this.calls.push('update');remote.title=op.title;remote.notes=op.structuredWorkout.notes;return remote}
  async updateOwnedMetadata(remote,op){this.calls.push('metadata-update');remote.title=op.title;remote.notes=op.structuredWorkout.notes;return remote}
  async deleteWorkout(remote){this.calls.push(`delete:${remote.id}`);this.rows=this.rows.filter(item=>item!==remote)}
}

test('canonical identity and fingerprint survive date and structure revisions',async()=>{
  const {canonicalWorkoutProjection}=await import('../cloud/runnerbear-cloud/src/v11/sync-projection.js'),item={workoutId:'stable',lineageId:'stable',localDate:'2026-09-02',status:'scheduled',sport:'running',workoutType:'quality',title:'5 × 6 min',intent:'threshold',prescription:{repetitions:5,workSeconds:360}};
  const first=canonicalWorkoutProjection(item,'pr-1','rb-plan-primary'),same=canonicalWorkoutProjection({...item,plannedLoad:{generatedFromDate:'changed'}},'pr-2','rb-plan-primary'),moved=canonicalWorkoutProjection({...item,localDate:'2026-09-03'},'pr-2','rb-plan-primary'),changed=canonicalWorkoutProjection({...item,title:'4 × 8 min',prescription:{repetitions:4,workSeconds:480}},'pr-3','rb-plan-primary');
  assert.equal(first.externalId,moved.externalId);assert.equal(first.externalId,changed.externalId);assert.equal(first.fingerprint,same.fingerprint);assert.notEqual(first.fingerprint,moved.fingerprint);assert.notEqual(first.fingerprint,changed.fingerprint);assert.match(same.structuredWorkout.notes,/\[REV:pr-2\]/);assert.match(changed.structuredWorkout.notes,/\[PLAN:rb-plan-primary\].*\[FPR:/);
});

test('move and content update preserve exactly one remote workout',async()=>{
  const {reconcileDesiredState}=await import('../cloudflare/tredict-calendar-sync.mjs'),provider=new FakeProvider([row('td-1','2026-09-02','rb-workout-w1','f1')]),result=await reconcileDesiredState(provider,operation());
  assert.equal(result.status,'confirmed');assert.deepEqual(provider.calls,['move','update']);assert.equal(provider.rows.length,1);assert.equal(provider.rows[0].id,'td-1');assert.equal(provider.rows[0].date.slice(0,10),'2026-09-03');assert.match(provider.rows[0].notes,/\[FPR:f2\]/);
});

test('safe replace creates and verifies before deleting the old workout',async()=>{
  const {reconcileDesiredState}=await import('../cloudflare/tredict-calendar-sync.mjs'),provider=new FakeProvider([row('td-1','2026-09-03','rb-workout-w1','f1')],{supportsMove:true,supportsCreate:true,supportsUpdate:false,supportsDelete:true,supportsReplace:true}),result=await reconcileDesiredState(provider,operation({date:'2026-09-03'}));
  assert.equal(result.status,'confirmed');assert.deepEqual(provider.calls,['create','delete:td-1']);assert.equal(provider.rows.length,1);assert.notEqual(provider.rows[0].id,'td-1');
});

test('replacement create failure leaves the existing workout untouched',async()=>{
  const {reconcileDesiredState}=await import('../cloudflare/tredict-calendar-sync.mjs'),existing=row('td-1','2026-09-03','rb-workout-w1','f1'),provider=new FakeProvider([existing],{supportsMove:true,supportsCreate:true,supportsUpdate:false,supportsDelete:true,supportsReplace:true});provider.failCreate=true;
  await assert.rejects(()=>reconcileDesiredState(provider,operation({date:'2026-09-03'})),/create failed/);assert.equal(provider.rows.length,1);assert.equal(provider.rows[0],existing);assert.deepEqual(provider.calls,['create']);
});

test('duplicate cleanup removes only safe future RunnerBear copies',async()=>{
  const {reconcileDesiredState}=await import('../cloudflare/tredict-calendar-sync.mjs'),provider=new FakeProvider([row('td-1','2026-09-03','rb-workout-w1','f2'),row('td-2','2026-09-03','rb-workout-w1','f1')]),result=await reconcileDesiredState(provider,operation({date:'2026-09-03'}));
  assert.equal(result.status,'confirmed');assert.equal(provider.rows.length,1);assert.equal(provider.rows[0].id,'td-1');assert.ok(provider.calls.includes('delete:td-2'));
});

test('completed and user-created workouts are immutable',async()=>{
  const {classifyDesiredState,isCompletedWorkout}=await import('../cloudflare/tredict-calendar-sync.mjs'),completed=classifyDesiredState(operation({date:'2026-09-03'}),[row('td-1','2026-09-03','rb-workout-w1','f2',{completed:true})]),manual=classifyDesiredState(operation({date:'2026-09-03'}),[{id:'manual',date:'2026-09-03T15:00:00.000Z',title:'Quality',notes:'my own workout'}]);
  assert.equal(completed.code,'IMMUTABLE_HISTORY');assert.equal(isCompletedWorkout({executedTrainingId:'activity-1'}),true);assert.equal(manual.code,'OWNERSHIP_REQUIRED');
});

test('identical desired state is idempotent with zero writes',async()=>{
  const {reconcileDesiredState}=await import('../cloudflare/tredict-calendar-sync.mjs'),provider=new FakeProvider([row('td-1','2026-09-03','rb-workout-w1','f2')]),result=await reconcileDesiredState(provider,operation({date:'2026-09-03'}));
  assert.equal(result.status,'confirmed');assert.deepEqual(provider.calls,[]);
});

test('rolling mirror projects 14 days and never creates plan templates',async()=>{
  const {projectRollingSync,TREDICT_EXECUTION_DAYS}=await import('../cloud/runnerbear-cloud/src/v11/sync-projection.js'),items=[0,13,14].map((days,index)=>({workoutId:`w${index}`,lineageId:`w${index}`,localDate:new Date(Date.parse('2026-09-01T12:00:00Z')+days*86400000).toISOString().slice(0,10),status:'scheduled',sport:'running',workoutType:'easy',title:'Easy',intent:'easy',prescription:{}})),ops=projectRollingSync(items,'pr-2','2026-09-01','tredict',[],'rb-plan-primary');
  assert.equal(TREDICT_EXECUTION_DAYS,14);assert.equal(ops.length,2);assert.ok(ops.every(op=>op.operationType==='create'&&op.payload.canonicalPlanId==='rb-plan-primary'));
});

test('A-goal plan reaches the active goal and UI has no manual Tredict activation CTA',async()=>{
  const {generateGoalPlan}=await import('../cloud/runnerbear-cloud/src/v11/plan-engine.js'),plan=generateGoalPlan({profile:{baseKm:50,normalLow:50,normalHigh:54,upperLimit:60},constraints:{runDays:[1,2,3,4,6],qualityDays:[1,4],alternativeDays:[0,5],longRunDay:6},goal:{mode:'race',date:'2026-10-03',distance:'half',name:'RUNFEST 21K'}},'2026-09-01'),ui=fs.readFileSync('runnerbear-ui-v11-source.js','utf8');
  assert.equal(plan.goalDate,'2026-10-03');assert.equal(plan.rows.at(-1).localDate,'2026-10-03');assert.doesNotMatch(ui,/data-rb108-publish-plan|Aktiver én gang|10-dagersplan|rullerende 10-dagersperioden/);
});

test('release audit repairs scheduled rows beyond the active A goal',async()=>{
  const {auditBakkenPlan,clipPlanAtActiveGoal}=await import('../cloud/runnerbear-cloud/src/v11/routes.js'),config={goal:{mode:'race',date:'2026-10-03'}},completed={workoutId:'history',localDate:'2026-10-04',status:'completed',sport:'running',workoutType:'easy'},plan={items:[{workoutId:'race',localDate:'2026-10-03',status:'scheduled',sport:'running',workoutType:'race'},{workoutId:'after',localDate:'2026-10-04',status:'scheduled',sport:'rest',workoutType:'recovery'},completed]},audit=auditBakkenPlan(plan,'2026-09-01',config),clipped=clipPlanAtActiveGoal(plan.items,config,'2026-09-01');
  assert.equal(audit.ok,false);assert.deepEqual(audit.pastGoalWorkouts,['after']);assert.deepEqual(clipped.removedIds,['after']);assert.equal(clipped.rows.some(row=>row.workoutId==='after'),false);assert.equal(clipped.rows.includes(completed),true);assert.equal(auditBakkenPlan({items:clipped.rows},'2026-09-01',config).ok,true);
});

test('transient retries are capped and reuse the deterministic idempotency key',async()=>{
  const [{canRetryOwnedRelink,sameCanonicalWorkoutContent,syncErrorDisposition,syncRetryDelaySeconds},{projectRollingSync}]=await Promise.all([import('../cloud/runnerbear-cloud/src/v11/routes.js'),import('../cloud/runnerbear-cloud/src/v11/sync-projection.js')]),item={workoutId:'retry-stable',lineageId:'retry-stable',localDate:'2026-09-03',status:'scheduled',sport:'running',workoutType:'easy',title:'Easy',intent:'easy',prescription:{}},first=projectRollingSync([item],'pr-2','2026-09-01','tredict',[],'rb-plan-primary')[0],again=projectRollingSync([item],'pr-2','2026-09-01','tredict',[],'rb-plan-primary')[0];
  assert.deepEqual([1,2,3,4,8].map(syncRetryDelaySeconds),[30,120,600,1800,1800]);assert.deepEqual(syncErrorDisposition({status:429},1),{status:'failed_retryable',delaySeconds:30});assert.deepEqual(syncErrorDisposition({status:500},2),{status:'failed_retryable',delaySeconds:120});assert.deepEqual(syncErrorDisposition({status:401},1),{status:'failed_terminal',delaySeconds:null});assert.equal(first.idempotencyKey,again.idempotencyKey);
  const terminal={operation_type:'create',status:'failed_terminal',attempt_count:1,last_error:'CREATE_UNSUPPORTED'};assert.equal(canRetryOwnedRelink(terminal,{supportsOwnedRelink:true}),true);assert.equal(canRetryOwnedRelink({...terminal,attempt_count:2},{supportsOwnedRelink:true}),false);assert.equal(canRetryOwnedRelink(terminal,{supportsOwnedRelink:false}),false);
  const payload={date:'2026-09-03',title:'Easy',stimulus:'easy',prescription:{},plannedDurationSeconds:null,plannedDistanceM:5000,plannedLoad:{generatedFromDate:'new'}},previous={local_date:'2026-09-03',title:'Easy',intent:'easy',prescription_json:'{}',planned_duration_seconds:null,planned_distance_m:5000,planned_load_json:'{"generatedFromDate":"old"}'};assert.equal(sameCanonicalWorkoutContent(payload,previous),true);assert.equal(sameCanonicalWorkoutContent({...payload,title:'Changed'},previous),false);
});

test('metadata-only update refreshes ownership without claiming structure support',async()=>{
  const {reconcileDesiredState}=await import('../cloudflare/tredict-calendar-sync.mjs'),existing=row('td-1','2026-09-03','rb-workout-w1','old'),provider=new FakeProvider([existing],{supportsMove:true,supportsCreate:false,supportsUpdate:false,supportsDelete:false,supportsReplace:false,supportsOwnedRelink:true}),result=await reconcileDesiredState(provider,operation({date:'2026-09-03',metadataOnly:true}));
  assert.equal(result.status,'confirmed');assert.equal(result.code,'METADATA_REFRESHED');assert.deepEqual(provider.calls,['metadata-update']);assert.match(existing.notes,/\[FPR:f2\]/);
});

test('app bootstrap and cron both provide automatic reconciliation safety nets',()=>{
  const routes=fs.readFileSync('cloud/runnerbear-cloud/src/v11/routes.js','utf8'),entry=fs.readFileSync('cloud/runnerbear-cloud/src/index-v11.js','utf8');assert.match(routes,/ctx\?\.waitUntil\)ctx\.waitUntil\(reconcileActiveSyncProjection/);assert.match(entry,/reconcileActiveSyncProjection\(env,userId\).*processPendingSync\(env,userId\)/s);
});

test('missing provider writes fail closed without templates or destructive fallback',async()=>{
  const {reconcileDesiredState}=await import('../cloudflare/tredict-calendar-sync.mjs'),capabilities={supportsMove:true,supportsCreate:false,supportsUpdate:false,supportsDelete:false,supportsReplace:false,supportsOwnedRelink:false},existing=row('td-1','2026-09-03','rb-workout-w1','f1'),updateProvider=new FakeProvider([existing],capabilities),createProvider=new FakeProvider([],capabilities),updated=await reconcileDesiredState(updateProvider,operation({date:'2026-09-03'})),created=await reconcileDesiredState(createProvider,operation({operationType:'create',date:'2026-09-04'}));
  assert.equal(updated.code,'CONTENT_UPDATE_UNSUPPORTED');assert.equal(created.code,'CREATE_UNSUPPORTED');assert.deepEqual(updateProvider.rows,[existing]);assert.deepEqual(updateProvider.calls,[]);assert.deepEqual(createProvider.calls,[]);
});

test('unsupported create safely relinks one unbound legacy easy duplicate',async()=>{
  const {reconcileDesiredState}=await import('../cloudflare/tredict-calendar-sync.mjs'),capabilities={supportsMove:true,supportsCreate:false,supportsUpdate:true,supportsDelete:false,supportsReplace:true,supportsOwnedRelink:true},bound=row('td-bound','2026-09-09','rb-workout-current','current',{title:'5,5 km rolig'}),legacy=row('td-legacy','2026-09-09','runnerbear-2026-09-09-rolig','legacy',{title:'7 km rolig'}),provider=new FakeProvider([bound,legacy],capabilities),result=await reconcileDesiredState(provider,operation({operationType:'create',externalId:'rb-workout-new',date:'2026-09-19',title:'5 km rolig',stimulus:'easy',fingerprint:'new',reservedRemoteWorkoutIds:['td-bound'],structuredWorkout:{title:'5 km rolig',notes:'[RB:rb-workout-new] [PLAN:rb-plan-primary] [REV:pr-2] [STIMULUS:easy] [FPR:new]'}}));
  assert.equal(result.status,'confirmed');assert.equal(result.code,'OWNED_RELINKED');assert.equal(result.action,'RELINK');assert.deepEqual(provider.calls,['metadata-update','move']);assert.equal(legacy.id,'td-legacy');assert.equal(legacy.date.slice(0,10),'2026-09-19');assert.equal(legacy.title,'5 km rolig');assert.match(legacy.notes,/\[RB:rb-workout-new\]/);assert.equal(bound.date.slice(0,10),'2026-09-09');
});

test('owned relink never consumes quality workouts or ambiguous easy duplicates',async()=>{
  const {chooseOwnedRelinkCandidate}=await import('../cloudflare/tredict-calendar-sync.mjs'),bound=row('td-bound','2026-09-09','rb-workout-current','current',{title:'5 km rolig'}),quality=row('td-quality','2026-09-09','runnerbear-quality','old',{title:'4 × 8 min terskel'}),left=row('td-left','2026-09-08','runnerbear-left','old',{title:'6 km rolig'}),leftBound=row('td-left-bound','2026-09-08','rb-workout-left','current',{title:'Kvalitet'}),right=row('td-right','2026-09-10','runnerbear-right','old',{title:'7 km rolig'}),rightBound=row('td-right-bound','2026-09-10','rb-workout-right','current',{title:'Kvalitet'}),op=operation({operationType:'create',date:'2026-09-09',title:'5 km rolig',stimulus:'easy',reservedRemoteWorkoutIds:['td-bound','td-left-bound','td-right-bound']});
  assert.equal(chooseOwnedRelinkCandidate([bound,quality],op),null);assert.equal(chooseOwnedRelinkCandidate([left,leftBound,right,rightBound],op),null);
});

test('owned relink accepts only an exact distance-interval signature or an unstructured continuous workout',async()=>{
  const {chooseOwnedRelinkCandidate}=await import('../cloudflare/tredict-calendar-sync.mjs'),distanceTarget=operation({operationType:'create',date:'2026-09-17',title:'3 × 3000 m · kontrollert HM-rytme',stimulus:'race_specific',today:'2026-09-07',desiredCalendarDates:['2026-09-17'],structuredWorkout:{title:'3 × 3000 m · kontrollert HM-rytme',notes:'new',prescription:{main:{kind:'intervals',repetitions:3,workMeters:3000,recoverySeconds:120}}}}),gate=row('td-gate','2026-09-18','runnerbear-gate','old',{title:'GATE 2 · 3 × 3 km',notes:'[RB:runnerbear-gate] 2 min jogg',distance:9000,duration:2493}),wrong=row('td-wrong','2026-09-15','runnerbear-wrong','old',{title:'5 × 7 min subterskel',notes:'[RB:runnerbear-wrong] 60 sek jogg',duration:2400}),continuousTarget=operation({operationType:'create',date:'2026-09-20',title:'16,5 km rolig langtur',stimulus:'long',today:'2026-09-07',desiredCalendarDates:['2026-09-20'],structuredWorkout:{title:'16,5 km rolig langtur',notes:'new',prescription:{main:{kind:'continuous',intensity:'easy'}}}}),legacyLong=row('td-long','2026-09-20','runnerbear-long','old',{title:'18 km rolig langtur',notes:'[RB:runnerbear-long]'});
  assert.equal(chooseOwnedRelinkCandidate([gate,wrong],distanceTarget),gate);assert.equal(chooseOwnedRelinkCandidate([legacyLong],continuousTarget),legacyLong);
});

test('rollback bootstrap preserves a non-canonical client snapshot for legacy rendering',()=>{
  const client=fs.readFileSync('runnerbear-cloud-v11.js','utf8');assert.match(client,/coach_loop_read!==true.*snapshot=data;localStorage\.removeItem\(CACHE\).*return data/s);
});
