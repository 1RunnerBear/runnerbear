const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');

class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.values=[]}bind(...values){const next=new Statement(this.db,this.sql);next.values=values;return next}async run(){return this._run()}_run(){const result=this.db.sqlite.prepare(this.sql).run(...this.values);return{success:true,meta:{changes:Number(result.changes||0)}}}async first(){return this.db.sqlite.prepare(this.sql).get(...this.values)||null}async all(){return{success:true,results:this.db.sqlite.prepare(this.sql).all(...this.values)}}}
class LocalD1{constructor(){this.sqlite=new DatabaseSync(':memory:')}prepare(sql){return new Statement(this,sql)}async batch(statements){this.sqlite.exec('BEGIN IMMEDIATE');try{const out=statements.map(statement=>statement._run());this.sqlite.exec('COMMIT');return out}catch(error){this.sqlite.exec('ROLLBACK');throw error}}close(){this.sqlite.close()}}

test('Coach Live migration is additive, owner-scoped and keeps turns immutable',()=>{
  const sql=fs.readFileSync('cloud/runnerbear-cloud/migrations/0008_coach_live.sql','utf8'),db=new DatabaseSync(':memory:');
  for(const file of fs.readdirSync('cloud/runnerbear-cloud/migrations').sort())db.exec(fs.readFileSync(`cloud/runnerbear-cloud/migrations/${file}`,'utf8'));
  const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'rb_coach_live_%' ORDER BY name").all().map(row=>row.name);
  assert.deepEqual(names,['rb_coach_live_messages','rb_coach_live_runs','rb_coach_live_threads']);assert.doesNotMatch(sql,/DROP TABLE/i);assert.match(sql,/PRIMARY KEY\(user_id,thread_id\)/);assert.match(sql,/coach_live_messages_immutable/);
  db.prepare("INSERT INTO rb_users(id,created_at,updated_at) VALUES('primary','2026-08-28T12:00:00Z','2026-08-28T12:00:00Z')").run();
  db.prepare("INSERT INTO rb_coach_live_threads(user_id,thread_id,created_at,updated_at) VALUES('primary','thread-1','2026-08-28T12:00:00Z','2026-08-28T12:00:00Z')").run();
  db.prepare("INSERT INTO rb_coach_live_messages(user_id,message_id,thread_id,role,content,created_at) VALUES('primary','message-1','thread-1','user','Hei','2026-08-28T12:00:00Z')").run();
  assert.throws(()=>db.prepare("UPDATE rb_coach_live_messages SET content='Endret' WHERE user_id='primary' AND message_id='message-1'").run(),/immutable/);db.close();
});

test('input and context are bounded before inference',async()=>{
  const {sanitizeMessage,sanitizeContext}=await import('../cloud/runnerbear-cloud/src/v112/coach-live.js');
  assert.equal(sanitizeMessage(`  hei\r\ncoach\u0000  `),'hei\ncoach');assert.equal(sanitizeMessage('a'.repeat(1400)).length,1200);
  const context=sanitizeContext({surface:'admin',workoutId:'w'.repeat(200),shoes:Array.from({length:20},(_,i)=>({name:`Sko ${i}`,km:99999}))});
  assert.equal(context.surface,'today');assert.equal(context.workoutId.length,120);assert.equal(context.shoes.length,12);assert.equal(context.shoes[0].km,5000);
});

test('red flags bypass inference with Norwegian urgent-care guidance',async()=>{
  const {medicalBoundaryReply}=await import('../cloud/runnerbear-cloud/src/v112/coach-live.js');
  assert.equal(medicalBoundaryReply('Hvilke sko passer til terskel?'),'');const reply=medicalBoundaryReply('Jeg fikk brystsmerter og besvimte på løpeturen');assert.match(reply,/Stopp aktiviteten/);assert.match(reply,/113/);assert.match(reply,/116 117/);
});

test('urgent safety route works without inference or a bootstrapped plan',async()=>{
  const {handleCoachLive}=await import('../cloud/runnerbear-cloud/src/v112/coach-live.js'),db=new LocalD1();for(const file of fs.readdirSync('cloud/runnerbear-cloud/migrations').sort())db.sqlite.exec(fs.readFileSync(`cloud/runnerbear-cloud/migrations/${file}`,'utf8'));db.sqlite.prepare("INSERT INTO rb_users(id,created_at,updated_at) VALUES('primary','2026-08-28T12:00:00Z','2026-08-28T12:00:00Z')").run();let background=Promise.resolve();
  const request=new Request('https://runnerbear.test/api/v2/coach-live/messages',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'Jeg har sterke brystsmerter og får ikke puste',context:{surface:'today'}})}),response=await handleCoachLive(request,{DB:db},{waitUntil:task=>{background=task}},{userId:'primary'});assert.equal(response.status,200);assert.match(await response.text(),/113/);await background;assert.equal(db.sqlite.prepare("SELECT status FROM rb_coach_live_runs").get().status,'safety_redirect');assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM rb_coach_live_messages").get().n,2);db.close();
});

test('system prompt keeps the model advisory and the canonical plan authoritative',async()=>{
  const {buildSystemPrompt}=await import('../cloud/runnerbear-cloud/src/v112/coach-live.js'),prompt=buildSystemPrompt({planRevisionId:'plan-1'});
  assert.match(prompt,/aldri endre planen/);assert.match(prompt,/Ett lavt HRV-signal/);assert.match(prompt,/Ikke øk varighet/);assert.match(prompt,/Ikke diagnostiser/);assert.match(prompt,/plan-1/);
});

test('Cloudflare SSE deltas are extracted without storing protocol frames',async()=>{
  const {extractTextFromSse}=await import('../cloud/runnerbear-cloud/src/v112/coach-live.js'),raw='data: {"response":"Mitt råd"}\n\ndata: {"response":": rolig."}\n\ndata: [DONE]\n\n';
  assert.equal(extractTextFromSse(raw),'Mitt råd: rolig.');
});

test('Concept 1 UI adds contextual Coach Live without a fifth navigation tab',()=>{
  const ui=fs.readFileSync('runnerbear-ui-v11-source.js','utf8'),css=fs.readFileSync('runnerbear-v112-coach-live.css','utf8'),html=fs.readFileSync('index.html','utf8'),manifest=JSON.parse(fs.readFileSync('runnerbear-v11-assets.json','utf8'));
  assert.match(ui,/function coachLiveCardHtml/);assert.match(ui,/function coachLiveModalHtml/);assert.match(ui,/aria-labelledby="rb112CoachTitle"/);assert.match(ui,/coachLiveContextButtonHtml\('workout'/);assert.match(ui,/coachLiveContextButtonHtml\('body_response'/);assert.match(ui,/planen endres ikke i samtalen/);assert.match(css,/locked Concept 1/);assert.match(css,/min-height:48px/);assert.match(css,/@media\(max-width:680px\)/);assert.ok(manifest.styles.includes('runnerbear-v112-coach-live.css'));assert.doesNotMatch(html,/data-tab="coach"|>Coach Live<\/button>/);
});

test('production entrypoint binds Workers AI and cannot mutate the canonical plan',()=>{
  const config=fs.readFileSync('cloud/runnerbear-cloud/wrangler.jsonc','utf8'),entry=fs.readFileSync('cloud/runnerbear-cloud/src/index-v112.js','utf8'),routes=fs.readFileSync('cloud/runnerbear-cloud/src/v112/coach-live.js','utf8'),workflow=fs.readFileSync('.github/workflows/runnerbear-cloud-deploy.yml','utf8');
  assert.match(config,/src\/index-v1141\.js/);assert.match(config,/"binding": "AI"/);assert.match(config,/@cf\/zai-org\/glm-4\.7-flash/);assert.match(entry,/coachLiveInference:!!env\.AI/);assert.match(routes,/runCoachInference\(env\.AI/);assert.match(routes,/ai\.run/);assert.doesNotMatch(routes,/(INSERT INTO|UPDATE|DELETE FROM) rb_plan_/);assert.match(workflow,/coachLiveAudit\?\.ok!==true/);assert.match(workflow,/schemaVersion!==4/);
});
