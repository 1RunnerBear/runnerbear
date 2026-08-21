const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');

const migration=name=>fs.readFileSync(`cloud/runnerbear-cloud/migrations/${name}`,'utf8');

test('0001 plus additive 0002 applies twice and enforces canonical invariants',()=>{
  const db=new DatabaseSync(':memory:');
  db.exec(migration('0001_runnerbear_cloud.sql'));
  db.exec(migration('0002_coach_loop.sql'));
  db.exec(migration('0002_coach_loop.sql'));
  db.exec("INSERT INTO rb_users(id,created_at,updated_at) VALUES('primary','2026-08-21T00:00:00Z','2026-08-21T00:00:00Z')");
  const revision="INSERT INTO rb_plan_revisions(plan_revision_id,user_id,status,reason_code,policy_version,created_at) VALUES(?,?,'active','test','coach-loop-1','2026-08-21T00:00:00Z')";
  db.prepare(revision).run('pr-1','primary');
  assert.throws(()=>db.prepare(revision).run('pr-2','primary'),/UNIQUE/);
  db.exec("INSERT INTO rb_plan_revisions(plan_revision_id,user_id,parent_revision_id,status,reason_code,policy_version,created_at) VALUES('pr-draft','primary','pr-1','draft','preview','coach-loop-1','2026-08-21T00:00:00Z')");
  db.exec("INSERT INTO rb_workouts(workout_id,user_id,lineage_id,created_at) VALUES('w1','primary','l1','2026-08-21T00:00:00Z'),('w2','primary','l2','2026-08-21T00:00:00Z'),('w3','primary','l3','2026-08-21T00:00:00Z')");
  const item="INSERT INTO rb_plan_revision_items(plan_revision_id,workout_id,local_date,slot_index,status,sport,workout_type,title,created_at) VALUES('pr-draft',?, '2026-08-25',?,'scheduled','running','easy','Rolig','2026-08-21T00:00:00Z')";
  db.prepare(item).run('w1',0);db.prepare(item).run('w2',1);
  assert.throws(()=>db.prepare(item).run('w3',1),/UNIQUE/);
  db.exec("INSERT INTO rb_sync_operations(operation_id,user_id,workout_id,plan_revision_id,destination,operation_type,idempotency_key,status,created_at,updated_at) VALUES('op1','primary','w1','pr-draft','tredict','create','tredict:w1:pr-draft:create','queued','2026-08-21T00:00:00Z','2026-08-21T00:00:00Z')");
  assert.throws(()=>db.exec("INSERT INTO rb_sync_operations(operation_id,user_id,workout_id,plan_revision_id,destination,operation_type,idempotency_key,status,created_at,updated_at) VALUES('op2','primary','w1','pr-draft','tredict','create','tredict:w1:pr-draft:create','queued','2026-08-21T00:00:00Z','2026-08-21T00:00:00Z')"),/UNIQUE/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name LIKE 'rb_%'").get().n>=18,true);
  db.close();
});
