const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');

class Statement{
  constructor(db,sql){this.db=db;this.sql=sql;this.values=[]}
  bind(...values){const next=new Statement(this.db,this.sql);next.values=values;return next}
  async run(){const result=this.db.prepare(this.sql).run(...this.values);return{success:true,meta:{changes:Number(result.changes||0)}}}
}
class LocalD1{constructor(sqlite){this.sqlite=sqlite}prepare(sql){return new Statement(this.sqlite,sql)}}

const migration=name=>fs.readFileSync(`cloud/runnerbear-cloud/migrations/${name}`,'utf8');
const seed=()=>{
  const db=new DatabaseSync(':memory:');
  db.exec(migration('0001_runnerbear_cloud.sql'));
  db.exec(migration('0002_coach_loop.sql'));
  db.exec("INSERT INTO rb_users(id,created_at,updated_at) VALUES('primary','2026-08-31T08:00:00Z','2026-08-31T08:00:00Z')");
  db.exec("INSERT INTO rb_plan_revisions(plan_revision_id,user_id,status,reason_code,policy_version,created_at,activated_at) VALUES('pr-old','primary','superseded','old','coach-loop-1','2026-08-20T08:00:00Z','2026-08-20T08:00:00Z'),('pr-active','primary','active','current','coach-loop-1','2026-08-31T08:00:00Z','2026-08-31T08:00:00Z')");
  db.exec("INSERT INTO rb_workouts(workout_id,user_id,lineage_id,created_at) VALUES('wo-old','primary','line-old','2026-08-20T08:00:00Z'),('wo-active','primary','line-active','2026-08-31T08:00:00Z')");
  db.exec("INSERT INTO rb_sync_operations(operation_id,user_id,workout_id,plan_revision_id,destination,operation_type,idempotency_key,status,last_error,next_retry_at,created_at,updated_at) VALUES('op-old','primary','wo-old','pr-old','tredict','cancel','tredict:wo-old:pr-old:cancel','review_required','STRUCTURAL_CHANGE_REQUIRES_REVIEW','2026-09-01T08:00:00Z','2026-08-20T08:00:00Z','2026-08-20T08:00:00Z'),('op-old-terminal','primary','wo-old','pr-old','tredict','move','tredict:wo-old:pr-old:move','failed_terminal','PROVIDER_REJECTED',NULL,'2026-08-30T08:00:00Z','2026-08-30T08:00:00Z'),('op-active','primary','wo-active','pr-active','tredict','move','tredict:wo-active:pr-active:move','review_required','SOURCE_NOT_FOUND',NULL,'2026-08-31T08:00:00Z','2026-08-31T08:00:00Z'),('op-active-terminal','primary','wo-active','pr-active','tredict','cancel','tredict:wo-active:pr-active:cancel','failed_terminal','PROVIDER_REJECTED',NULL,'2026-08-31T08:00:00Z','2026-08-31T08:00:00Z')");
  return db;
};

test('cleanup preserves audit rows while superseding only inactive revision work',async()=>{
  const db=seed(),d1=new LocalD1(db),{supersedeInactiveSyncOperationsStatement}=await import('../cloud/runnerbear-cloud/src/v11/sync-projection.js');
  await supersedeInactiveSyncOperationsStatement(d1,'primary','pr-active','2026-08-31T09:00:00Z').run();
  const old=db.prepare("SELECT status,last_error,next_retry_at FROM rb_sync_operations WHERE operation_id='op-old'").get(),oldTerminal=db.prepare("SELECT status,last_error FROM rb_sync_operations WHERE operation_id='op-old-terminal'").get(),active=db.prepare("SELECT status,last_error FROM rb_sync_operations WHERE operation_id='op-active'").get(),activeTerminal=db.prepare("SELECT status,last_error FROM rb_sync_operations WHERE operation_id='op-active-terminal'").get();
  assert.deepEqual({...old},{status:'superseded',last_error:'STRUCTURAL_CHANGE_REQUIRES_REVIEW',next_retry_at:null});
  assert.deepEqual({...oldTerminal},{status:'superseded',last_error:'PROVIDER_REJECTED'});
  assert.deepEqual({...active},{status:'review_required',last_error:'SOURCE_NOT_FOUND'});
  assert.deepEqual({...activeTerminal},{status:'failed_terminal',last_error:'PROVIDER_REJECTED'});
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM rb_sync_operations').get().total,4);db.close();
});

test('production workflow performs cleanup and rejects stale review work',()=>{
  const workflow=fs.readFileSync('.github/workflows/runnerbear-cloud-deploy.yml','utf8');
  assert.match(workflow,/name: Supersede inactive Tredict sync work/);
  assert.match(workflow,/SET status='superseded',next_retry_at=NULL/);
  assert.match(workflow,/failed_terminal/);
  assert.match(workflow,/r\.status='active'/);
  assert.match(workflow,/stale_review_required\|\|0\)!==0/);
});

test('active v11 repository applies cleanup whenever a revision becomes active',()=>{
  const repository=fs.readFileSync('cloud/runnerbear-cloud/src/v11/repository.js','utf8');
  assert.match(repository,/supersedeInactiveSyncOperationsStatement\(db,userId,planRevisionId,now\)/);
});
