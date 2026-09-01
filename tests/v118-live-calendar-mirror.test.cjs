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
  async updateWorkout(remote,op){this.calls.push('update');remote.notes=op.structuredWorkout.notes;return remote}
  async deleteWorkout(remote){this.calls.push(`delete:${remote.id}`);this.rows=this.rows.filter(item=>item!==remote)}
}

test('canonical identity and fingerprint survive date and structure revisions',async()=>{
  const {canonicalWorkoutProjection}=await import('../cloud/runnerbear-cloud/src/v11/sync-projection.js'),item={workoutId:'stable',lineageId:'stable',localDate:'2026-09-02',status:'scheduled',sport:'running',workoutType:'quality',title:'5 × 6 min',intent:'threshold',prescription:{repetitions:5,workSeconds:360}};
  const first=canonicalWorkoutProjection(item,'pr-1','rb-plan-primary'),moved=canonicalWorkoutProjection({...item,localDate:'2026-09-03'},'pr-2','rb-plan-primary'),changed=canonicalWorkoutProjection({...item,title:'4 × 8 min',prescription:{repetitions:4,workSeconds:480}},'pr-3','rb-plan-primary');
  assert.equal(first.externalId,moved.externalId);assert.equal(first.externalId,changed.externalId);assert.notEqual(first.fingerprint,moved.fingerprint);assert.notEqual(first.fingerprint,changed.fingerprint);assert.match(changed.structuredWorkout.notes,/\[PLAN:rb-plan-primary\].*\[FPR:/);
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
  const {classifyDesiredState}=await import('../cloudflare/tredict-calendar-sync.mjs'),completed=classifyDesiredState(operation({date:'2026-09-03'}),[row('td-1','2026-09-03','rb-workout-w1','f2',{completed:true})]),manual=classifyDesiredState(operation({date:'2026-09-03'}),[{id:'manual',date:'2026-09-03T15:00:00.000Z',title:'Quality',notes:'my own workout'}]);
  assert.equal(completed.code,'IMMUTABLE_HISTORY');assert.equal(manual.code,'OWNERSHIP_REQUIRED');
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
  const [{syncErrorDisposition,syncRetryDelaySeconds},{projectRollingSync}]=await Promise.all([import('../cloud/runnerbear-cloud/src/v11/routes.js'),import('../cloud/runnerbear-cloud/src/v11/sync-projection.js')]),item={workoutId:'retry-stable',lineageId:'retry-stable',localDate:'2026-09-03',status:'scheduled',sport:'running',workoutType:'easy',title:'Easy',intent:'easy',prescription:{}},first=projectRollingSync([item],'pr-2','2026-09-01','tredict',[],'rb-plan-primary')[0],again=projectRollingSync([item],'pr-2','2026-09-01','tredict',[],'rb-plan-primary')[0];
  assert.deepEqual([1,2,3,4,8].map(syncRetryDelaySeconds),[30,120,600,1800,1800]);assert.deepEqual(syncErrorDisposition({status:429},1),{status:'failed_retryable',delaySeconds:30});assert.deepEqual(syncErrorDisposition({status:500},2),{status:'failed_retryable',delaySeconds:120});assert.deepEqual(syncErrorDisposition({status:401},1),{status:'failed_terminal',delaySeconds:null});assert.equal(first.idempotencyKey,again.idempotencyKey);
});

test('app bootstrap and cron both provide automatic reconciliation safety nets',()=>{
  const routes=fs.readFileSync('cloud/runnerbear-cloud/src/v11/routes.js','utf8'),entry=fs.readFileSync('cloud/runnerbear-cloud/src/index-v11.js','utf8');assert.match(routes,/ctx\?\.waitUntil\)ctx\.waitUntil\(reconcileActiveSyncProjection/);assert.match(entry,/reconcileActiveSyncProjection\(env,userId\).*processPendingSync\(env,userId\)/s);
});

test('missing provider writes fail closed without templates or destructive fallback',async()=>{
  const {reconcileDesiredState}=await import('../cloudflare/tredict-calendar-sync.mjs'),capabilities={supportsMove:true,supportsCreate:false,supportsUpdate:false,supportsDelete:false,supportsReplace:false},existing=row('td-1','2026-09-03','rb-workout-w1','f1'),updateProvider=new FakeProvider([existing],capabilities),createProvider=new FakeProvider([],capabilities),updated=await reconcileDesiredState(updateProvider,operation({date:'2026-09-03'})),created=await reconcileDesiredState(createProvider,operation({operationType:'create',date:'2026-09-04'}));
  assert.equal(updated.code,'CONTENT_UPDATE_UNSUPPORTED');assert.equal(created.code,'CREATE_UNSUPPORTED');assert.deepEqual(updateProvider.rows,[existing]);assert.deepEqual(updateProvider.calls,[]);assert.deepEqual(createProvider.calls,[]);
});
