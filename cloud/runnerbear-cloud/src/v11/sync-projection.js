import { newId } from './events.js';
const addDays=(date,days)=>new Date(Date.parse(`${date}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);
export const stableExternalId=workoutId=>`rb-workout-${String(workoutId||'').replace(/[^a-z0-9._-]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()}`;
const operation=(item,planRevisionId,destination,operationType,payload={})=>({operationId:newId('sync'),workoutId:item.workoutId,planRevisionId,destination,operationType,idempotencyKey:`${destination}:${item.workoutId}:${planRevisionId}:${operationType}`,status:operationType==='replace'?'review_required':'queued',payload:{date:item.localDate,title:item.title,lineageId:item.lineageId,...payload}});
export function projectSync(items=[],planRevisionId,today=new Date().toISOString().slice(0,10),destination='tredict',previousItems=[]){
  const end=addDays(today,9),inHorizon=item=>item.localDate>=today&&item.localDate<=end,isPublishable=item=>inHorizon(item)&&item.status==='scheduled'&&item.sport==='running',current=new Map(items.map(item=>[item.workoutId,item])),previous=new Map(previousItems.map(item=>[item.workoutId,item])),rows=[];
  for(const item of items.filter(isPublishable)){const before=previous.get(item.workoutId),lineageReplacement=!before&&previousItems.find(old=>old.lineageId&&old.lineageId===item.lineageId&&old.workoutId!==item.workoutId&&isPublishable(old));let operationType=!previousItems.length?'create':lineageReplacement?'replace':!before?'create':before.localDate!==item.localDate?'move':before.title!==item.title||JSON.stringify(before.prescription||{})!==JSON.stringify(item.prescription||{})?'update':'';if(!operationType)continue;rows.push(operation(item,planRevisionId,destination,operationType,{previousDate:before?.localDate||lineageReplacement?.localDate||'',prescription:item.prescription}))}
  for(const before of previousItems.filter(isPublishable)){const after=current.get(before.workoutId);if(after&&isPublishable(after))continue;if(items.some(item=>item.lineageId&&item.lineageId===before.lineageId&&item.workoutId!==before.workoutId&&isPublishable(item)))continue;rows.push({...operation(before,planRevisionId,destination,'cancel'),status:'review_required'})}
  return rows;
}
export function projectRollingSync(items=[],planRevisionId,today=new Date().toISOString().slice(0,10),destination='tredict',bindings=[]){
  const end=addDays(today,9),published=new Map((bindings||[]).map(row=>[String(row.workout_id||row.workoutId||''),row])),rows=[];
  for(const item of items.filter(row=>row.localDate>=today&&row.localDate<=end&&row.status==='scheduled'&&row.sport==='running')){
    const binding=published.get(String(item.workoutId));
    if(!binding||binding.status==='cancelled')rows.push(operation(item,planRevisionId,destination,'create'));
    else if(['pending','conflict'].includes(String(binding.status||'')))continue;
    else if(String(binding.confirmed_date||binding.confirmedDate||'')!==item.localDate)rows.push(operation(item,planRevisionId,destination,'move',{previousDate:String(binding.confirmed_date||binding.confirmedDate||'')}));
  }
  return rows;
}
export function syncOperationStatements(db,userId,operations=[],now=new Date().toISOString()){
  if(!operations.length)return[];const statements=[];
  for(const op of operations)statements.push(db.prepare("UPDATE rb_sync_operations SET status='superseded',updated_at=?1 WHERE user_id=?2 AND workout_id=?3 AND plan_revision_id<>?4 AND status IN ('queued','processing','failed_retryable','review_required')").bind(now,userId,op.workoutId,op.planRevisionId));
  statements.push(...operations.map(op=>db.prepare(`INSERT INTO rb_sync_operations(operation_id,user_id,workout_id,plan_revision_id,destination,operation_type,idempotency_key,status,created_at,updated_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?9) ON CONFLICT(idempotency_key) DO NOTHING`).bind(op.operationId,userId,op.workoutId,op.planRevisionId,op.destination,op.operationType,op.idempotencyKey,op.status,now)));
  return statements;
}
export function supersedeInactiveSyncOperationsStatement(db,userId,activePlanRevisionId,now=new Date().toISOString()){
  return db.prepare(`UPDATE rb_sync_operations
    SET status='superseded',next_retry_at=NULL,updated_at=?1
    WHERE user_id=?2
      AND plan_revision_id<>?3
      AND status IN ('queued','processing','failed_retryable','review_required')
      AND NOT EXISTS (
        SELECT 1 FROM rb_plan_revisions r
        WHERE r.user_id=rb_sync_operations.user_id
          AND r.plan_revision_id=rb_sync_operations.plan_revision_id
          AND r.status='active'
      )`).bind(now,userId,activePlanRevisionId);
}
export async function storeSyncOperations(db,userId,operations=[],now=new Date().toISOString()){
  if(!operations.length)return[];await db.batch(syncOperationStatements(db,userId,operations,now));return operations;
}
