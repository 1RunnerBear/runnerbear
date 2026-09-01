import { DEFAULT_FLAGS,FLAGS,POLICY_VERSION } from './constants.js';
import { newId,eventStatement } from './events.js';
import { supersedeInactiveSyncOperationsStatement } from './sync-projection.js';
const parse=(value,fallback)=>{try{return JSON.parse(value)}catch{return fallback}};
function safeProjection(row){
  const prescription=parse(row.prescription_json,{}),legacy={...(prescription.legacy||{})},title=String(row.title||''),alternative=/alternativ eller hvile/i.test(title),rest=/hvile · økten utgår/i.test(title),placeholder=alternative||rest,runCopy=/\b(?:jogg|løp|drag|nedjogg|oppvarming)\b|totalt\s+ca\.?\s*\d+(?:[.,]\d+)?\s*km/i;
  if(!placeholder)return{sport:row.sport,workoutType:row.workout_type,intent:row.intent,prescription:{...prescription,legacy},plannedDurationSeconds:row.planned_duration_seconds,plannedDistanceM:row.planned_distance_m};
  if(runCopy.test(String(legacy.desc||'')))legacy.desc='';
  if(runCopy.test(String(legacy.detail||'')))legacy.detail='';
  return{sport:alternative?'cross':'rest',workoutType:alternative?'cross':'rest',intent:'recovery',prescription:{...prescription,main:{kind:'recovery'},legacy},plannedDurationSeconds:null,plannedDistanceM:0};
}
export const itemFromRow=(row,planRevisionId)=>{const plannedLoad=parse(row.planned_load_json,{}),safe=safeProjection(row);return{workoutId:row.workout_id,lineageId:row.lineage_id,planRevisionId,localDate:row.local_date,slotIndex:Number(row.slot_index),status:row.status,sport:safe.sport,workoutType:safe.workoutType,title:row.title,intent:safe.intent,prescription:safe.prescription,plannedDurationSeconds:safe.plannedDurationSeconds,plannedDistanceM:safe.plannedDistanceM,plannedLoad,source:row.source,lockLevel:row.lock_level,flexible:plannedLoad.flexible===true,explicitChoice:plannedLoad.explicitChoice===true}};
export async function flags(db,userId){
  const rows=await db.prepare('SELECT flag,enabled,payload_json FROM rb_feature_flags WHERE user_id=?1').bind(userId).all(),result={...DEFAULT_FLAGS};
  for(const row of rows.results||[])if(FLAGS.includes(row.flag))result[row.flag]=!!row.enabled;
  return result;
}
export function flagConfigurationError(value={},migrationCommitted=true){
  if(value.coach_loop_read&&!migrationCommitted)return'coach_loop_read requires a committed migration';
  if(value.coach_loop_ui&&!value.coach_loop_read)return'coach_loop_ui requires coach_loop_read';
  if(value.coach_loop_write&&!value.coach_loop_read)return'coach_loop_write requires coach_loop_read';
  if(value.coach_loop_sync&&!value.coach_loop_write)return'coach_loop_sync requires coach_loop_write';
  if(value.coach_loop_safe_auto&&!(value.coach_loop_read&&value.coach_loop_ui&&value.coach_loop_write&&value.coach_loop_sync))return'coach_loop_safe_auto requires read, UI, write and sync';
  if(value.coach_loop_goal_confidence&&!(value.coach_loop_read&&value.coach_loop_ui))return'coach_loop_goal_confidence requires read and UI';
  return'';
}
export async function athleteConfig(db,userId){
  const row=await db.prepare('SELECT revision,timezone,profile_json,constraints_json,goal_json,updated_at FROM rb_athlete_config WHERE user_id=?1').bind(userId).first();
  return row?{revision:Number(row.revision),timezone:row.timezone,profile:parse(row.profile_json,{}),constraints:parse(row.constraints_json,{}),goal:parse(row.goal_json,{}),updatedAt:row.updated_at}:null;
}
export async function activePlan(db,userId){
  const revision=await db.prepare("SELECT * FROM rb_plan_revisions WHERE user_id=?1 AND status='active' LIMIT 1").bind(userId).first();if(!revision)return null;
  const today=new Date().toISOString().slice(0,10),[rows,history,legacy,sourceEvent]=await Promise.all([
    db.prepare(`SELECT i.*,w.lineage_id FROM rb_plan_revision_items i JOIN rb_workouts w ON w.workout_id=i.workout_id WHERE i.plan_revision_id=?1 ORDER BY i.local_date,i.slot_index`).bind(revision.plan_revision_id).all(),
    db.prepare(`SELECT i.*,w.lineage_id,r.activated_at,r.created_at AS revision_created_at FROM rb_plan_revision_items i JOIN rb_workouts w ON w.workout_id=i.workout_id JOIN rb_plan_revisions r ON r.plan_revision_id=i.plan_revision_id WHERE r.user_id=?1 AND r.status<>'draft' AND i.local_date<?2 ORDER BY CASE WHEN i.status='completed' THEN 0 WHEN i.status IN ('replaced','cancelled','skipped') THEN 1 ELSE 2 END,COALESCE(r.activated_at,r.created_at) DESC,i.local_date`).bind(userId,today).all(),
    db.prepare('SELECT date,type,title,km,status,payload_json,updated_at FROM rb_plan_days WHERE user_id=?1 AND date<?2 ORDER BY date').bind(userId,today).all(),
    revision.source_event_id?db.prepare('SELECT payload_json FROM rb_training_events WHERE user_id=?1 AND event_id=?2 LIMIT 1').bind(userId,revision.source_event_id).first():Promise.resolve(null),
  ]);
  const active=(rows.results||[]).map(row=>itemFromRow(row,revision.plan_revision_id)),future=active.filter(row=>row.localDate>=today),activeByLineage=new Map(active.map(row=>[String(row.lineageId||row.workoutId),row])),preserved=[],seenLineage=new Set(),seenSlots=new Set();
  for(const row of history.results||[]){const lineage=String(row.lineage_id||row.workout_id),slot=`${row.local_date}:${Number(row.slot_index||0)}`,activeItem=activeByLineage.get(lineage),terminal=['completed','replaced','cancelled','skipped'].includes(row.status);if(activeItem?.localDate>=today&&row.plan_revision_id!==revision.plan_revision_id&&!terminal)continue;if(seenLineage.has(lineage)||seenSlots.has(slot))continue;seenLineage.add(lineage);seenSlots.add(slot);preserved.push(itemFromRow(row,revision.plan_revision_id))}
  for(const row of legacy.results||[]){const slot=`${row.date}:0`;if(seenSlots.has(slot))continue;const payload=parse(row.payload_json,{}),workoutId=payload.workoutId||`legacy-${row.date}`;preserved.push({...payload,workoutId,lineageId:payload.lineageId||workoutId,planRevisionId:revision.plan_revision_id,localDate:row.date,slotIndex:0,status:row.status||'scheduled',sport:payload.sport||(['easy','quality','race'].includes(row.type)?'running':row.type||'rest'),workoutType:row.type||payload.workoutType||'easy',title:row.title||payload.title||'Historisk økt',intent:payload.intent||'',prescription:payload.prescription||{version:1,legacy:payload},plannedDurationSeconds:payload.plannedDurationSeconds??null,plannedDistanceM:Number(row.km||0)*1000,plannedLoad:payload.plannedLoad||{},source:payload.source||'legacy-history',lockLevel:payload.lockLevel||'system'});seenSlots.add(slot)}
  const metadata=parse(sourceEvent?.payload_json,{}),visibleFuture=future.filter(row=>!seenLineage.has(String(row.lineageId||row.workoutId))&&!seenSlots.has(`${row.localDate}:${Number(row.slotIndex||0)}`)),items=[...preserved,...visibleFuture].sort((a,b)=>a.localDate.localeCompare(b.localDate)||a.slotIndex-b.slotIndex);return{planRevisionId:revision.plan_revision_id,parentRevisionId:revision.parent_revision_id,status:revision.status,reasonCode:revision.reason_code,sourceEventId:revision.source_event_id,policyVersion:revision.policy_version,createdAt:revision.created_at,generatedAt:revision.activated_at||revision.created_at,generatedFromDate:metadata.generatedFromDate||revision.created_at.slice(0,10),trigger:metadata.trigger||revision.reason_code,items};
}
export async function planByRevision(db,userId,planRevisionId){
  const revision=await db.prepare('SELECT * FROM rb_plan_revisions WHERE user_id=?1 AND plan_revision_id=?2 LIMIT 1').bind(userId,planRevisionId).first();if(!revision)return null;
  const rows=await db.prepare(`SELECT i.*,w.lineage_id FROM rb_plan_revision_items i JOIN rb_workouts w ON w.workout_id=i.workout_id WHERE i.plan_revision_id=?1 ORDER BY i.local_date,i.slot_index`).bind(planRevisionId).all();
  return{planRevisionId:revision.plan_revision_id,parentRevisionId:revision.parent_revision_id,status:revision.status,reasonCode:revision.reason_code,sourceEventId:revision.source_event_id,policyVersion:revision.policy_version,createdAt:revision.created_at,items:(rows.results||[]).map(row=>itemFromRow(row,revision.plan_revision_id))};
}
export async function latestDecision(db,userId,planRevisionId){
  const row=await db.prepare(`SELECT * FROM rb_coach_decisions WHERE user_id=?1 AND plan_revision_id=?2 AND status IN ('proposed','auto_applied','accepted','rejected') ORDER BY created_at DESC LIMIT 1`).bind(userId,planRevisionId).first();
  return row?{decisionId:row.decision_id,planRevisionId:row.plan_revision_id,inputCursor:row.input_cursor,type:row.decision_type,status:row.status,confidence:row.confidence,reasonCodes:parse(row.reason_codes_json,[]),evidence:parse(row.evidence_json,[]),action:parse(row.action_json,{}),explanation:parse(row.explanation_json,{}),policyVersion:row.policy_version,validUntil:row.valid_until,createdAt:row.created_at}:null;
}
export async function recentDecisionHistory(db,userId,limit=8){
  const rows=await db.prepare(`SELECT decision_id,plan_revision_id,input_cursor,decision_type,status,confidence,reason_codes_json,evidence_json,action_json,explanation_json,policy_version,valid_until,created_at,resolved_at,undo_plan_revision_id
    FROM rb_coach_decisions WHERE user_id=?1 ORDER BY created_at DESC LIMIT ?2`).bind(userId,Math.max(1,Math.min(8,Number(limit)||8))).all();
  return(rows.results||[]).map(row=>({decisionId:row.decision_id,planRevisionId:row.plan_revision_id,inputCursor:row.input_cursor,type:row.decision_type,status:row.status,confidence:row.confidence,reasonCodes:parse(row.reason_codes_json,[]),evidence:parse(row.evidence_json,[]),action:parse(row.action_json,{}),explanation:parse(row.explanation_json,{}),policyVersion:row.policy_version,validUntil:row.valid_until,createdAt:row.created_at,resolvedAt:row.resolved_at,undoPlanRevisionId:row.undo_plan_revision_id}));
}
export async function syncStatus(db,userId){const rows=await db.prepare(`SELECT o.*,i.local_date,i.title,i.workout_type,i.sport
  FROM rb_sync_operations o
  LEFT JOIN rb_plan_revision_items i ON i.plan_revision_id=o.plan_revision_id AND i.workout_id=o.workout_id
  WHERE o.user_id=?1 ORDER BY o.updated_at DESC LIMIT 100`).bind(userId).all();return rows.results||[]}
function itemStatements(db,{userId,planRevisionId,items,now}){const statements=[];for(const item of items){const workoutId=item.workoutId||newId('wo'),lineageId=item.lineageId||workoutId,plannedLoad={...(item.plannedLoad||{}),...(item.flexible===true?{flexible:true}:{}),...(item.explicitChoice===true?{explicitChoice:true}:{})};statements.push(db.prepare('INSERT INTO rb_workouts(workout_id,user_id,lineage_id,created_at) VALUES(?1,?2,?3,?4) ON CONFLICT(workout_id) DO NOTHING').bind(workoutId,userId,lineageId,now));statements.push(db.prepare(`INSERT INTO rb_plan_revision_items(plan_revision_id,workout_id,local_date,slot_index,status,sport,workout_type,title,intent,prescription_json,planned_duration_seconds,planned_distance_m,planned_load_json,source,lock_level,created_at)
      VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)`).bind(planRevisionId,workoutId,item.localDate,Number(item.slotIndex||0),item.status||'scheduled',item.sport||'running',item.workoutType||'easy',item.title||'Planlagt økt',item.intent||'',JSON.stringify(item.prescription||{}),item.plannedDurationSeconds??null,item.plannedDistanceM??0,JSON.stringify(plannedLoad),item.source||'runnerbear',item.lockLevel||'none',now))}return statements}
export async function createDraft(db,{userId,parentRevisionId=null,reasonCode='plan-preview',sourceEvent=null,items=[],now=new Date().toISOString(),planRevisionId=newId('pr')}={}){
  const statements=[];if(sourceEvent)statements.push(eventStatement(db,sourceEvent));statements.push(db.prepare(`INSERT INTO rb_plan_revisions(plan_revision_id,user_id,parent_revision_id,status,reason_code,source_event_id,policy_version,created_at)
    VALUES(?1,?2,?3,'draft',?4,?5,?6,?7)`).bind(planRevisionId,userId,parentRevisionId,reasonCode,sourceEvent?.eventId||null,POLICY_VERSION,now),...itemStatements(db,{userId,planRevisionId,items,now}));await db.batch(statements);return planRevisionId;
}
export async function activateDraft(db,{userId,planRevisionId,parentRevisionId=null,reasonCode='plan-change',sourceEvent,config=null,timezone='Europe/Oslo',now=new Date().toISOString(),extraStatements=[]}={}){
  const statements=[];if(sourceEvent)statements.push(eventStatement(db,sourceEvent));if(config)statements.push(db.prepare(`INSERT INTO rb_athlete_config(user_id,revision,timezone,profile_json,constraints_json,goal_json,created_at,updated_at)
    VALUES(?1,1,?2,?3,?4,?5,?6,?6) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1,timezone=excluded.timezone,profile_json=excluded.profile_json,constraints_json=excluded.constraints_json,goal_json=excluded.goal_json,updated_at=excluded.updated_at`).bind(userId,timezone,JSON.stringify(config.profile||{}),JSON.stringify(config.constraints||{}),JSON.stringify(config.goal||{}),now));if(parentRevisionId)statements.push(db.prepare("UPDATE rb_plan_revisions SET status='superseded',superseded_at=?1 WHERE user_id=?2 AND plan_revision_id=?3 AND status='active'").bind(now,userId,parentRevisionId));statements.push(db.prepare("UPDATE rb_plan_revisions SET status='active',reason_code=?1,source_event_id=?2,activated_at=?3 WHERE user_id=?4 AND plan_revision_id=?5 AND status='draft' AND (parent_revision_id IS ?6 OR parent_revision_id=?6)").bind(reasonCode,sourceEvent?.eventId||null,now,userId,planRevisionId,parentRevisionId));statements.push(supersedeInactiveSyncOperationsStatement(db,userId,planRevisionId,now),...extraStatements);await db.batch(statements);const active=await activePlan(db,userId);if(active?.planRevisionId!==planRevisionId)throw new Error('PLAN_REVISION_CONFLICT');return planRevisionId;
}
export async function commitPlan(db,{userId,parentRevisionId=null,reasonCode='plan-change',sourceEvent=null,items=[],config=null,timezone='Europe/Oslo',now=new Date().toISOString(),planRevisionId=newId('pr')}={}){
  const statements=[];if(sourceEvent)statements.push(eventStatement(db,sourceEvent));
  if(config)statements.push(db.prepare(`INSERT INTO rb_athlete_config(user_id,revision,timezone,profile_json,constraints_json,goal_json,created_at,updated_at)
    VALUES(?1,1,?2,?3,?4,?5,?6,?6) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1,timezone=excluded.timezone,profile_json=excluded.profile_json,constraints_json=excluded.constraints_json,goal_json=excluded.goal_json,updated_at=excluded.updated_at`).bind(userId,timezone,JSON.stringify(config.profile||{}),JSON.stringify(config.constraints||{}),JSON.stringify(config.goal||{}),now));
  if(parentRevisionId)statements.push(db.prepare("UPDATE rb_plan_revisions SET status='superseded',superseded_at=?1 WHERE user_id=?2 AND plan_revision_id=?3 AND status='active'").bind(now,userId,parentRevisionId));
  statements.push(db.prepare(`INSERT INTO rb_plan_revisions(plan_revision_id,user_id,parent_revision_id,status,reason_code,source_event_id,policy_version,created_at,activated_at)
    VALUES(?1,?2,?3,'active',?4,?5,?6,?7,?7)`).bind(planRevisionId,userId,parentRevisionId,reasonCode,sourceEvent?.eventId||null,POLICY_VERSION,now));
  statements.push(...itemStatements(db,{userId,planRevisionId,items,now}));
  statements.push(supersedeInactiveSyncOperationsStatement(db,userId,planRevisionId,now));
  await db.batch(statements);return planRevisionId;
}
export async function saveDecision(db,userId,decision){const now=new Date().toISOString();await db.batch([db.prepare("UPDATE rb_coach_decisions SET status='superseded',resolved_at=?1 WHERE user_id=?2 AND plan_revision_id=?3 AND status='proposed' AND input_cursor<>?4").bind(now,userId,decision.planRevisionId,decision.inputCursor),db.prepare(`INSERT INTO rb_coach_decisions(decision_id,user_id,plan_revision_id,input_cursor,decision_type,status,confidence,reason_codes_json,evidence_json,action_json,explanation_json,policy_version,valid_until,created_at)
  VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)`).bind(decision.decisionId,userId,decision.planRevisionId,decision.inputCursor,decision.type,decision.status,decision.confidence,JSON.stringify(decision.reasonCodes||[]),JSON.stringify(decision.evidence||[]),JSON.stringify(decision.action||{}),JSON.stringify(decision.explanation||{}),decision.policyVersion,decision.validUntil||null,now)]);return decision}
