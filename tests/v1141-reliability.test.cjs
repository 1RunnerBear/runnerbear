const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');

class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.values=[]}bind(...values){const next=new Statement(this.db,this.sql);next.values=values;return next}async run(){const result=this.db.prepare(this.sql).run(...this.values);return{success:true,meta:{changes:Number(result.changes||0)}}}async first(){return this.db.prepare(this.sql).get(...this.values)||null}async all(){return{success:true,results:this.db.prepare(this.sql).all(...this.values)}}}
class LocalD1{constructor(){this.sqlite=new DatabaseSync(':memory:')}prepare(sql){return new Statement(this.sqlite,sql)}close(){this.sqlite.close()}}
const sse=raw=>new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(raw));controller.close()}});

test('Coach Live normalizes Chat Completions streaming without losing spaces',async()=>{
  const {runCoachInference}=await import('../cloud/runnerbear-cloud/src/v112/coach-live.js');let calls=0;
  const ai={run:async(_model,input)=>{calls++;assert.equal(input.max_completion_tokens,700);assert.equal('max_tokens' in input,false);assert.equal(input.chat_template_kwargs.enable_thinking,false);return sse('data: {"choices":[{"delta":{"content":"Mitt råd"}}]}\n\ndata: {"choices":[{"delta":{"content":": løp rolig."}}]}\n\ndata: [DONE]\n\n')}};
  const result=await runCoachInference(ai,'model',[{role:'user',content:'Hei'}]);
  assert.equal(result.content,'Mitt råd: løp rolig.');assert.equal(result.mode,'stream');assert.equal(calls,1);
});

test('Coach Live falls back when the reasoning stream has no user-facing answer',async()=>{
  const {runCoachInference}=await import('../cloud/runnerbear-cloud/src/v112/coach-live.js');const inputs=[];
  const ai={run:async(_model,input)=>{inputs.push(input);if(input.stream)return sse('data: {"choices":[{"delta":{"reasoning_content":"tenker"}}]}\n\ndata: [DONE]\n\n');return{choices:[{message:{content:'Mitt råd\n\nTa den planlagte rolige økten.'}}]}}};
  const result=await runCoachInference(ai,'model',[{role:'user',content:'Bør jeg løpe?'}]);
  assert.equal(result.mode,'fallback');assert.match(result.content,/Mitt råd/);assert.equal(inputs.length,2);assert.equal(inputs[1].stream,false);
});

test('failed Coach Live runs survive reload as retryable turn state',async()=>{
  const {threadMessages}=await import('../cloud/runnerbear-cloud/src/v112/coach-live.js'),db=new LocalD1();
  for(const file of fs.readdirSync('cloud/runnerbear-cloud/migrations').sort())db.sqlite.exec(fs.readFileSync(`cloud/runnerbear-cloud/migrations/${file}`,'utf8'));
  db.sqlite.prepare("INSERT INTO rb_users(id,created_at,updated_at) VALUES('primary','2026-08-30T08:00:00Z','2026-08-30T08:00:00Z')").run();
  db.sqlite.prepare("INSERT INTO rb_coach_live_threads(user_id,thread_id,created_at,updated_at,last_message_at) VALUES('primary','thread-1','2026-08-30T08:00:00Z','2026-08-30T08:00:00Z','2026-08-30T08:00:00Z')").run();
  db.sqlite.prepare("INSERT INTO rb_coach_live_messages(user_id,message_id,thread_id,role,content,created_at) VALUES('primary','user-1','thread-1','user','Bør jeg løpe i dag?','2026-08-30T08:00:00Z')").run();
  db.sqlite.prepare("INSERT INTO rb_coach_live_runs(user_id,run_id,thread_id,user_message_id,status,model,prompt_version,error_code,created_at,completed_at) VALUES('primary','run-1','thread-1','user-1','failed','model','coach-live-no-4','EMPTY_MODEL_RESPONSE','2026-08-30T08:00:00Z','2026-08-30T08:00:05Z')").run();
  const rows=await threadMessages({DB:db},'primary','thread-1');
  assert.equal(rows.length,2);assert.equal(rows[1].role,'assistant');assert.equal(rows[1].status,'failed');assert.equal(rows[1].retryable,true);assert.equal(rows[1].in_reply_to,'user-1');assert.match(rows[1].content,/prøve igjen/i);db.close();
});

test('weekly review never says volume was lower when completed distance was higher',async()=>{
  const {buildWeeklyReview}=await import('../cloud/runnerbear-cloud/src/v1031/review-engine.js'),plan={planRevisionId:'plan-1',items:[
    {workoutId:'run-1',localDate:'2026-08-18',sport:'running',workoutType:'easy',status:'scheduled',title:'Rolig',plannedDistanceM:5000},
    {workoutId:'run-2',localDate:'2026-08-20',sport:'running',workoutType:'easy',status:'scheduled',title:'Rolig',plannedDistanceM:5000},
  ]},activities=[{source_id:'activity-1',date:'2026-08-18',sport_type:'running',distance_m:12000,duration_seconds:4200}];
  const review=buildWeeklyReview({plan,activities,today:'2026-08-24'});
  assert.equal(review.totals.completedDistanceM,12000);assert.equal(review.totals.plannedDistanceM,10000);assert.match(review.coachComment,/høyere enn planen/i);assert.doesNotMatch(review.coachComment,/lavere enn planlagt/i);
});

test('v11.6 removes chat retry UX while preserving direct sync action and read-only health',async()=>{
  const ui=fs.readFileSync('runnerbear-ui-v11-source.js','utf8'),css=fs.readFileSync('runnerbear-v116-contextual-coach.css','utf8'),entry=fs.readFileSync('cloud/runnerbear-cloud/src/index-v1141.js','utf8'),health=fs.readFileSync('cloud/runnerbear-cloud/src/index-v11.js','utf8'),config=fs.readFileSync('cloud/runnerbear-cloud/wrangler.jsonc','utf8'),workflow=fs.readFileSync('.github/workflows/runnerbear-cloud-deploy.yml','utf8'),manifest=JSON.parse(fs.readFileSync('runnerbear-v11-assets.json','utf8'));
  const healthBlock=health.slice(health.indexOf("if(request.method==='GET'&&path==='/health')"),health.indexOf('const response = await legacy.fetch'));
  assert.doesNotMatch(ui,/data-rb1141-coach-retry|Coach Live|coachLive|coach-live|data-rb108-publish-plan/);assert.match(ui,/Kalenderen oppdateres automatisk/);assert.match(css,/min-height:44px/);assert.ok(manifest.styles.includes('runnerbear-v116-contextual-coach.css'));assert.match(entry,/healthReadOnly:true/);assert.match(config,/src\/index-v118\.js/);assert.match(workflow,/verify-v116-health\.mjs/);assert.doesNotMatch(healthBlock,/repairAccidentalGoalState|repairBakkenV11Plan|processPendingSync|reconcileActiveSyncProjection/);
});

test('v11.4.1 preserves locked coach authority and bounded adjustment',()=>{
  const entry=fs.readFileSync('cloud/runnerbear-cloud/src/index-v1141.js','utf8'),coach=fs.readFileSync('cloud/runnerbear-cloud/src/v112/coach-live.js','utf8');
  assert.match(entry,/planWritesByAi:false/);assert.match(entry,/maximumReductionPercent:20/);assert.match(entry,/emptyResponsesAccepted:false/);assert.match(entry,/retiredChatRuntime:false/);assert.doesNotMatch(coach,/(INSERT INTO|UPDATE|DELETE FROM) rb_plan_/);
});
