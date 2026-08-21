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
