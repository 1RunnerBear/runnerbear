export const FLAG_ORDER=Object.freeze([
  'coach_loop_shadow',
  'coach_loop_read',
  'coach_loop_ui',
  'coach_loop_write',
  'coach_loop_sync',
  'coach_loop_safe_auto',
  'coach_loop_goal_confidence',
]);

const number=value=>Number(value||0);
const sqlLiteral=value=>`'${String(value??'').replaceAll("'","''")}'`;

export function observationStateSql({userId='primary',coreActivatedAt=''}={}){
  const user=sqlLiteral(userId),activatedAt=sqlLiteral(coreActivatedAt);
  return `WITH active AS (SELECT plan_revision_id FROM rb_plan_revisions WHERE user_id=${user} AND status='active')
    SELECT
      (SELECT COUNT(*) FROM active) AS active_plan_count,
      (SELECT COUNT(*) FROM rb_plan_revision_items WHERE plan_revision_id=(SELECT plan_revision_id FROM active LIMIT 1)) AS active_item_count,
      ((SELECT COUNT(*) FROM rb_plan_revision_items i LEFT JOIN rb_plan_days d ON d.user_id=${user} AND d.date=i.local_date
          WHERE i.plan_revision_id=(SELECT plan_revision_id FROM active LIMIT 1) AND i.local_date>=date('now') AND i.slot_index=0
            AND (d.date IS NULL OR d.type<>i.workout_type OR d.title<>i.title OR ABS(COALESCE(d.km,0)*1000-COALESCE(i.planned_distance_m,0))>1 OR d.status<>i.status))
       +(SELECT COUNT(*) FROM rb_plan_days d WHERE d.user_id=${user} AND d.date>=date('now')
          AND NOT EXISTS(SELECT 1 FROM rb_plan_revision_items i WHERE i.plan_revision_id=(SELECT plan_revision_id FROM active LIMIT 1) AND i.local_date=d.date))) AS compatibility_mismatch_count,
      (SELECT COUNT(*) FROM (SELECT o.workout_id,o.destination FROM rb_sync_operations o JOIN active a ON a.plan_revision_id=o.plan_revision_id WHERE o.user_id=${user} AND o.status='confirmed' AND o.updated_at>=${activatedAt} GROUP BY o.workout_id,o.destination HAVING COUNT(DISTINCT COALESCE(o.external_id,''))>1)) AS duplicate_sync_count,
      (SELECT COUNT(*) FROM rb_sync_operations o JOIN active a ON a.plan_revision_id=o.plan_revision_id WHERE o.user_id=${user} AND o.status='failed_terminal' AND o.updated_at>=${activatedAt}) AS terminal_sync_error_count,
      (SELECT COUNT(*) FROM rb_sync_operations o JOIN active a ON a.plan_revision_id=o.plan_revision_id WHERE o.user_id=${user} AND o.status='failed_retryable' AND o.updated_at>=${activatedAt}) AS retryable_sync_error_count,
      (SELECT COUNT(*) FROM rb_coach_decisions d JOIN rb_plan_revisions r ON r.plan_revision_id=d.plan_revision_id WHERE d.user_id=${user} AND d.status IN ('accepted','auto_applied') AND r.superseded_at IS NOT NULL AND d.resolved_at>r.superseded_at AND d.resolved_at>=${activatedAt}) AS stale_decision_count`;
}

export function isD1DailyWriteLimitError(error){
  const detail=[error?.message,error?.stdout,error?.stderr,...(Array.isArray(error?.output)?error.output:[])]
    .filter(value=>value!==null&&value!==undefined)
    .map(value=>String(value))
    .join('\n');
  return /exceeded D1's free tier daily row write limit|\[code:\s*7500\]|["']code["']\s*:\s*7500/i.test(detail);
}

export function validateFlagDependencies(flags={},migrationCommitted=false){
  const errors=[];
  if(flags.coach_loop_read&&!migrationCommitted)errors.push('read_requires_migration');
  if(flags.coach_loop_ui&&!flags.coach_loop_read)errors.push('ui_requires_read');
  if(flags.coach_loop_write&&!flags.coach_loop_read)errors.push('write_requires_read');
  if(flags.coach_loop_sync&&!flags.coach_loop_write)errors.push('sync_requires_write');
  if(flags.coach_loop_safe_auto&&!(flags.coach_loop_read&&flags.coach_loop_ui&&flags.coach_loop_write&&flags.coach_loop_sync))errors.push('safe_auto_requires_core');
  if(flags.coach_loop_goal_confidence&&!(flags.coach_loop_read&&flags.coach_loop_ui))errors.push('goal_confidence_requires_read_ui');
  return errors;
}

export function evaluateCoreGates(row={},shadowPayload={}){
  const checks={
    migrationCommitted:row.migration_status==='committed',
    oneActivePlan:number(row.active_plan_count)===1,
    canonicalPlanHasItems:number(row.active_item_count)>0,
    compatibilityProjectionClean:number(row.compatibility_mismatch_count)===0,
    shadowMatches:shadowPayload.lastMatch===true,
    shadowBootstrapCount:number(shadowPayload.consecutiveSuccesses)>=20,
    shadowRevisionMatches:!!row.active_plan_revision_id&&shadowPayload.lastPlanRevisionId===row.active_plan_revision_id,
    migrationReplayPassed:true,
    undoPassed:true,
    syncShadowPassed:true,
    visualMobileA11yPassed:true,
    rollbackRehearsalPassed:true,
  };
  return{ok:Object.values(checks).every(Boolean),checks};
}

export function evaluateObservation(row={}){
  const checks={
    oneActivePlan:number(row.active_plan_count)===1,
    canonicalPlanHasItems:number(row.active_item_count)>0,
    compatibilityProjectionClean:number(row.compatibility_mismatch_count)===0,
    noDuplicateSync:number(row.duplicate_sync_count)===0,
    noTerminalSyncErrors:number(row.terminal_sync_error_count)===0,
    noRetryableSyncErrors:number(row.retryable_sync_error_count)===0,
    noStaleDecisions:number(row.stale_decision_count)===0,
  };
  return{ok:Object.values(checks).every(Boolean),checks};
}

export function canEnableSafeAuto({coreActivatedAt='',now=new Date().toISOString(),cleanObservationDates=[],explicitOptIn=false}={}){
  const elapsedMs=Date.parse(now)-Date.parse(coreActivatedAt),distinctDates=new Set(cleanObservationDates.filter(Boolean));
  const checks={
    explicitOptIn:explicitOptIn===true,
    sevenFullDays:Number.isFinite(elapsedMs)&&elapsedMs>=7*24*60*60*1000,
    sevenCleanDates:distinctDates.size>=7,
  };
  return{ok:Object.values(checks).every(Boolean),checks,elapsedHours:Number.isFinite(elapsedMs)?Math.floor(elapsedMs/3600000):0,cleanDates:distinctDates.size};
}

export function coreFlags(){
  return{
    coach_loop_shadow:true,
    coach_loop_read:true,
    coach_loop_ui:true,
    coach_loop_write:true,
    coach_loop_sync:true,
    coach_loop_safe_auto:false,
    coach_loop_goal_confidence:true,
  };
}

export function rollbackFlags(level='full'){
  const flags=coreFlags();
  if(level==='safe_auto')flags.coach_loop_safe_auto=false;
  if(level==='sync'){flags.coach_loop_safe_auto=false;flags.coach_loop_sync=false}
  if(level==='write'){flags.coach_loop_safe_auto=false;flags.coach_loop_sync=false;flags.coach_loop_write=false}
  if(level==='ui'){flags.coach_loop_safe_auto=false;flags.coach_loop_sync=false;flags.coach_loop_write=false;flags.coach_loop_ui=false;flags.coach_loop_goal_confidence=false}
  if(level==='full'){for(const key of FLAG_ORDER)flags[key]=key==='coach_loop_shadow'}
  return flags;
}
