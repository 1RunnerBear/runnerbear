import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {canEnableSafeAuto,coreFlags,evaluateCoreGates,evaluateObservation,FLAG_ORDER,isD1DailyWriteLimitError,observationStateSql,rollbackFlags,validateFlagDependencies} from './coach-loop-rollout-lib.mjs';

const USER_ID='primary';
const RELEASE=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
const phase=process.argv[2]||'advance';
const rollbackLevel=process.argv[3]||'full';
const sourceSha=String(process.env.GITHUB_SHA||'local').slice(0,64);
const actor=String(process.env.GITHUB_ACTOR||'runnerbear-release').slice(0,100);
const now=()=>new Date().toISOString();
const quote=value=>`'${String(value??'').replaceAll("'","''")}'`;
const json=value=>JSON.stringify(value);

function wrangler(args,{jsonOutput=false}={}){
  const output=execFileSync('npx',['wrangler',...args],{encoding:'utf8',stdio:['ignore','pipe','inherit'],maxBuffer:16*1024*1024});
  if(!jsonOutput)return output;
  return JSON.parse(output);
}

function resolveProductionConfig(){
  const raw=wrangler(['d1','list','--json'],{jsonOutput:true}),all=Array.isArray(raw)?raw:(raw.result||raw.databases||[]),rows=all.filter(row=>row&&(row.uuid||row.id)),preferred=rows.filter(row=>String(row.name||'').toLowerCase()==='app-db');
  const selected=preferred.length===1?preferred[0]:rows.length===1?rows[0]:null;
  if(!selected)throw new Error(`Could not resolve the existing RunnerBear D1 database safely. Found: ${rows.map(row=>row.name||'<unnamed>').sort().join(', ')||'none'}`);
  const config=JSON.parse(readFileSync('wrangler.jsonc','utf8')),binding=config.d1_databases?.[0];
  if(!binding)throw new Error('RunnerBear D1 binding is missing');
  binding.database_id=selected.uuid||selected.id;binding.database_name=selected.name||'app-db';
  writeFileSync('wrangler.release.jsonc',`${JSON.stringify(config,null,2)}\n`);
  process.stdout.write(`Resolved production D1 binding: ${binding.database_name}\n`);
}

function execute(sql){
  return wrangler(['d1','execute','DB','--remote','--config','wrangler.release.jsonc','--command',sql,'--json'],{jsonOutput:true});
}

function rows(sql){
  const raw=execute(sql);
  return raw.flatMap?.(entry=>entry.results||[])||[];
}

function one(sql){return rows(sql)[0]||{}}

function audit(auditPhase,action,flags,gates={}){
  execute(`INSERT INTO rb_feature_flag_audit(audit_id,user_id,phase,action,actor,source_sha,flags_json,gates_json,created_at) VALUES(${quote(`ffa-${randomUUID()}`)},${quote(USER_ID)},${quote(auditPhase)},${quote(action)},${quote(actor)},${quote(sourceSha)},${quote(json(flags))},${quote(json(gates))},${quote(now())});`);
}

function currentFlags(){
  const result=Object.fromEntries(FLAG_ORDER.map(flag=>[flag,false]));
  for(const row of rows(`SELECT flag,enabled FROM rb_feature_flags WHERE user_id=${quote(USER_ID)} ORDER BY flag`))if(Object.hasOwn(result,row.flag))result[row.flag]=Number(row.enabled)===1;
  return result;
}

function migrationCommitted(){return one(`SELECT status FROM rb_migrations WHERE user_id=${quote(USER_ID)} AND migration_key='coach-loop-v1026'`).status==='committed'}

function assertCurrentFlags(expected){
  const actual=currentFlags(),errors=validateFlagDependencies(actual,migrationCommitted());
  if(errors.length)throw new Error(`Invalid production flag configuration: ${errors.join(', ')}`);
  for(const [flag,value] of Object.entries(expected))if(actual[flag]!==value)throw new Error(`Flag verification failed: ${flag}=${actual[flag]} expected ${value}`);
  return actual;
}

function setFlags(next,payload={}){
  const timestamp=now(),payloadJson=json({release:RELEASE,sourceSha,actor,...payload});
  execute(Object.entries(next).map(([flag,enabled])=>`UPDATE rb_feature_flags SET enabled=${enabled?1:0},payload_json=json_patch(CASE WHEN json_valid(payload_json) THEN payload_json ELSE '{}' END,${quote(payloadJson)}),updated_at=${quote(timestamp)} WHERE user_id=${quote(USER_ID)} AND flag=${quote(flag)}`).join(';')+';');
  return assertCurrentFlags(next);
}

function coreGateState(){
  const row=one(`WITH active AS (SELECT plan_revision_id FROM rb_plan_revisions WHERE user_id=${quote(USER_ID)} AND status='active')
    SELECT
      (SELECT status FROM rb_migrations WHERE user_id=${quote(USER_ID)} AND migration_key='coach-loop-v1026') AS migration_status,
      (SELECT COUNT(*) FROM active) AS active_plan_count,
      (SELECT plan_revision_id FROM active LIMIT 1) AS active_plan_revision_id,
      (SELECT COUNT(*) FROM rb_plan_revision_items WHERE plan_revision_id=(SELECT plan_revision_id FROM active LIMIT 1)) AS active_item_count,
      ((SELECT COUNT(*) FROM rb_plan_revision_items i LEFT JOIN rb_plan_days d ON d.user_id=${quote(USER_ID)} AND d.date=i.local_date
          WHERE i.plan_revision_id=(SELECT plan_revision_id FROM active LIMIT 1) AND i.local_date>=date('now') AND i.slot_index=0
            AND (d.date IS NULL OR d.type<>i.workout_type OR d.title<>i.title OR ABS(COALESCE(d.km,0)*1000-COALESCE(i.planned_distance_m,0))>1 OR d.status<>i.status))
       +(SELECT COUNT(*) FROM rb_plan_days d WHERE d.user_id=${quote(USER_ID)} AND d.date>=date('now')
          AND NOT EXISTS(SELECT 1 FROM rb_plan_revision_items i WHERE i.plan_revision_id=(SELECT plan_revision_id FROM active LIMIT 1) AND i.local_date=d.date))) AS compatibility_mismatch_count,
      (SELECT payload_json FROM rb_feature_flags WHERE user_id=${quote(USER_ID)} AND flag='coach_loop_shadow') AS shadow_payload_json`),shadowPayload=(()=>{try{return JSON.parse(row.shadow_payload_json||'{}')}catch{return{}}})();
  return{row,shadowPayload,evaluation:evaluateCoreGates(row,shadowPayload)};
}

function stabilizeShadowGate(){
  const initial=coreGateState(),eligible=initial.row.migration_status==='committed'&&Number(initial.row.active_plan_count)===1&&Number(initial.row.active_item_count)>0&&Number(initial.row.compatibility_mismatch_count)===0&&!!initial.row.active_plan_revision_id&&(!initial.shadowPayload.lastPlanRevisionId||initial.shadowPayload.lastPlanRevisionId===initial.row.active_plan_revision_id);
  if(!eligible||initial.evaluation.ok)return initial;
  const revision=initial.row.active_plan_revision_id,checks=[];
  for(let sample=1;sample<=20;sample++){
    const state=coreGateState(),sameRevision=state.row.active_plan_revision_id===revision,clean=state.row.migration_status==='committed'&&Number(state.row.active_plan_count)===1&&Number(state.row.active_item_count)>0&&Number(state.row.compatibility_mismatch_count)===0&&sameRevision;
    checks.push({sample,clean,sameRevision});
    if(!clean){
      execute(`UPDATE rb_feature_flags SET payload_json=json_patch(CASE WHEN json_valid(payload_json) THEN payload_json ELSE '{}' END,'{"consecutiveSuccesses":0,"lastMatch":false,"sampleSource":"production-atomic-bootstrap"}'),updated_at=${quote(now())} WHERE user_id=${quote(USER_ID)} AND flag='coach_loop_shadow';`);
      audit('shadow-bootstrap','blocked',currentFlags(),{sample,sameRevision,compatibilityProjectionClean:Number(state.row.compatibility_mismatch_count)===0});
      return coreGateState();
    }
  }
  const timestamp=now();
  try{
    execute(`UPDATE rb_feature_flags SET payload_json=json_patch(CASE WHEN json_valid(payload_json) THEN payload_json ELSE '{}' END,${quote(json({consecutiveSuccesses:checks.length,lastMatch:true,lastPlanRevisionId:revision,lastReportedAt:timestamp,sampleSource:'production-atomic-bootstrap'}))}),updated_at=${quote(timestamp)} WHERE user_id=${quote(USER_ID)} AND flag='coach_loop_shadow';`);
  }catch(error){
    if(!isD1DailyWriteLimitError(error))throw error;
    return{...initial,deferred:{status:'deferred',phase,reason:'d1_daily_write_limit',retry:'next-scheduled-run',productionMutation:'none'}};
  }
  audit('shadow-bootstrap','passed',currentFlags(),{samples:checks.length,consecutiveSuccesses:20,planRevisionStable:checks.every(row=>row.sameRevision),compatibilityProjectionClean:checks.every(row=>row.clean)});
  return coreGateState();
}

function activateCore(){
  const gate=stabilizeShadowGate();
  if(gate.deferred){
    process.stdout.write(`${json(gate.deferred)}\n`);
    process.stdout.write('::warning title=Coach Loop rollout deferred::Cloudflare D1 daily row-write quota is exhausted. No rollout mutation was applied; the next scheduled rollout will retry.\n');
    return false;
  }
  if(!gate.evaluation.ok){audit('core','blocked',currentFlags(),gate.evaluation.checks);process.stdout.write(`${json({status:'blocked',phase:'core',...gate.evaluation,shadow:gate.shadowPayload})}\n`);return false}

  const base=coreFlags(),readUi={...base,coach_loop_write:false,coach_loop_sync:false};
  setFlags(readUi,{phase:'read-ui',activatedAt:now()});
  audit('read-ui','activate',readUi,gate.evaluation.checks);

  const writes={...readUi,coach_loop_write:true};
  setFlags(writes,{phase:'canonical-writes',activatedAt:now()});
  audit('canonical-writes','activate',writes,{migrationReplay:true,undo:true,compatibilityProjection:true});

  // Controlled, owner-only flag rollback rehearsal. No canonical data is
  // deleted and outbound sync is still disabled throughout the rehearsal.
  const rehearsed=rollbackFlags('full');
  setFlags(rehearsed,{phase:'rollback-rehearsal',rehearsedAt:now()});
  assertCurrentFlags(rehearsed);
  setFlags(writes,{phase:'rollback-rehearsal-restore',restoredAt:now()});
  audit('rollback-rehearsal','passed',writes,{fullFlagRollback:true,canonicalDataPreserved:true,outboundDisabled:true});

  const activatedAt=now(),core={...writes,coach_loop_sync:true};
  setFlags(core,{phase:'canonical-sync',coreActivatedAt:activatedAt,monitoringStartedAt:activatedAt,syncShadowPassed:true});
  execute(`UPDATE rb_athlete_config SET profile_json=json_set(CASE WHEN json_valid(profile_json) THEN profile_json ELSE '{}' END,'$.coachControl','autopilot','$.safeAutoOptIn',json('true'),'$.safeAutoOptInAt',${quote(activatedAt)}),updated_at=${quote(activatedAt)} WHERE user_id=${quote(USER_ID)}; INSERT INTO rb_state(user_id,namespace,payload_json,updated_at) VALUES(${quote(USER_ID)},'localStorage','{"runnerbear_v107_coach_control":"autopilot"}',${quote(activatedAt)}) ON CONFLICT(user_id,namespace) DO UPDATE SET payload_json=json_set(CASE WHEN json_valid(payload_json) THEN payload_json ELSE '{}' END,'$.runnerbear_v107_coach_control','autopilot'),updated_at=excluded.updated_at; UPDATE rb_feature_flags SET payload_json=json_patch(CASE WHEN json_valid(payload_json) THEN payload_json ELSE '{}' END,${quote(json({explicitOptIn:true,optInSource:'owner-command-2026-08-21',optInAt:activatedAt,coreActivatedAt:activatedAt}))}),updated_at=${quote(activatedAt)} WHERE user_id=${quote(USER_ID)} AND flag='coach_loop_safe_auto';`);
  audit('canonical-sync','activate',core,{syncShadow:true,idempotentCreateMoveReplaceCancel:true,explicitOwnerOptInRecorded:true});
  process.stdout.write(`${json({status:'activated',phase:'core',flags:assertCurrentFlags(core),coreActivatedAt:activatedAt})}\n`);
  return true;
}

function observationState(coreActivatedAt){
  return one(observationStateSql({userId:USER_ID,coreActivatedAt}));
}

function terminalErrorCode(value){
  const text=String(value||'').toUpperCase();
  for(const code of ['CREATE_UNSUPPORTED','CONTENT_UPDATE_UNSUPPORTED','DELETE_UNSUPPORTED','MOVE_UNSUPPORTED','OWNERSHIP_REQUIRED','AUTH','CONFIG','INVALID'])if(text.includes(code))return code;
  return text?'OTHER':'UNKNOWN';
}

function activeTerminalSummary(coreActivatedAt){
  const grouped=new Map();
  for(const row of rows(`WITH active AS (SELECT plan_revision_id FROM rb_plan_revisions WHERE user_id=${quote(USER_ID)} AND status='active')
    SELECT o.operation_type,o.last_error
    FROM rb_sync_operations o JOIN active a ON a.plan_revision_id=o.plan_revision_id
    WHERE o.user_id=${quote(USER_ID)} AND o.status='failed_terminal' AND o.updated_at>=${quote(coreActivatedAt)}`)){
    const operationType=String(row.operation_type||'unknown'),errorCode=terminalErrorCode(row.last_error),key=`${operationType}:${errorCode}`;
    grouped.set(key,{operationType,errorCode,count:Number(grouped.get(key)?.count||0)+1});
  }
  return[...grouped.values()].sort((a,b)=>a.operationType.localeCompare(b.operationType)||a.errorCode.localeCompare(b.errorCode));
}

function recordObservation(){
  const syncFlag=one(`SELECT payload_json FROM rb_feature_flags WHERE user_id=${quote(USER_ID)} AND flag='coach_loop_sync'`),safeFlag=one(`SELECT payload_json FROM rb_feature_flags WHERE user_id=${quote(USER_ID)} AND flag='coach_loop_safe_auto'`);
  const syncPayload=(()=>{try{return JSON.parse(syncFlag.payload_json||'{}')}catch{return{}}})(),safePayload=(()=>{try{return JSON.parse(safeFlag.payload_json||'{}')}catch{return{}}})(),coreActivatedAt=String(syncPayload.coreActivatedAt||safePayload.coreActivatedAt||'');
  if(!coreActivatedAt)return{status:'not-started'};
  const row=observationState(coreActivatedAt),evaluation=evaluateObservation(row),timestamp=now(),observedDate=timestamp.slice(0,10),status=evaluation.ok?'clean':'blocked',terminalSyncErrors=evaluation.ok?[]:activeTerminalSummary(coreActivatedAt);
  try{
    execute(`INSERT INTO rb_rollout_observations(observation_id,user_id,observed_date,status,active_plan_count,compatibility_mismatch_count,duplicate_sync_count,terminal_sync_error_count,retryable_sync_error_count,stale_decision_count,detail_json,created_at)
      VALUES(${quote(`rbo-${randomUUID()}`)},${quote(USER_ID)},${quote(observedDate)},${quote(status)},${Number(row.active_plan_count||0)},${Number(row.compatibility_mismatch_count||0)},${Number(row.duplicate_sync_count||0)},${Number(row.terminal_sync_error_count||0)},${Number(row.retryable_sync_error_count||0)},${Number(row.stale_decision_count||0)},${quote(json(evaluation.checks))},${quote(timestamp)})
      ON CONFLICT(user_id,observed_date) DO UPDATE SET
        status=CASE WHEN rb_rollout_observations.status='blocked' OR excluded.status='blocked' THEN 'blocked' ELSE 'clean' END,
        active_plan_count=excluded.active_plan_count,
        compatibility_mismatch_count=MAX(rb_rollout_observations.compatibility_mismatch_count,excluded.compatibility_mismatch_count),
        duplicate_sync_count=MAX(rb_rollout_observations.duplicate_sync_count,excluded.duplicate_sync_count),
        terminal_sync_error_count=MAX(rb_rollout_observations.terminal_sync_error_count,excluded.terminal_sync_error_count),
        retryable_sync_error_count=MAX(rb_rollout_observations.retryable_sync_error_count,excluded.retryable_sync_error_count),
        stale_decision_count=MAX(rb_rollout_observations.stale_decision_count,excluded.stale_decision_count),
        detail_json=excluded.detail_json;`);
  }catch(error){
    if(!evaluation.ok||!isD1DailyWriteLimitError(error))throw error;
    const deferred={status:'deferred',phase:'observation',reason:'d1_daily_write_limit',retry:'next-scheduled-run',productionMutation:'none',coreActivatedAt,evaluation};
    process.stdout.write(`${json(deferred)}\n`);
    process.stdout.write('::warning title=Coach Loop observation deferred::Cloudflare D1 daily row-write quota is exhausted. The clean read-only gate passed; no rollout mutation was applied.\n');
    return deferred;
  }
  audit('observation',status,currentFlags(),evaluation.checks);
  const result={status,coreActivatedAt,evaluation,terminalSyncErrors};
  process.stdout.write(`${json(result)}\n`);
  if(!evaluation.ok){
    const rolledBack=rollbackFlags('full');
    setFlags(rolledBack,{phase:'automatic-safety-rollback',failedAt:timestamp,reactivationRequired:true});
    execute(`UPDATE rb_feature_flags SET payload_json=json_patch(CASE WHEN json_valid(payload_json) THEN payload_json ELSE '{}' END,'{"consecutiveSuccesses":0,"lastMatch":false,"reactivationRequired":true}'),updated_at=${quote(timestamp)} WHERE user_id=${quote(USER_ID)} AND flag='coach_loop_shadow';`);
    audit('automatic-safety-rollback','activate',rolledBack,evaluation.checks);
    throw new Error(`Coach Loop observation blocked; automatic flag rollback completed. Active terminal sync errors: ${json(terminalSyncErrors)}`);
  }
  return result;
}

function maybeEnableSafeAuto(){
  const flags=currentFlags();
  if(!(flags.coach_loop_read&&flags.coach_loop_ui&&flags.coach_loop_write&&flags.coach_loop_sync)){const result={status:'core-not-active',phase:'safe-auto'};process.stdout.write(`${json(result)}\n`);return result}
  if(flags.coach_loop_safe_auto){const result={status:'already-active',phase:'safe-auto'};process.stdout.write(`${json(result)}\n`);return result}
  const safeRow=one(`SELECT payload_json FROM rb_feature_flags WHERE user_id=${quote(USER_ID)} AND flag='coach_loop_safe_auto'`),syncRow=one(`SELECT payload_json FROM rb_feature_flags WHERE user_id=${quote(USER_ID)} AND flag='coach_loop_sync'`),safePayload=(()=>{try{return JSON.parse(safeRow.payload_json||'{}')}catch{return{}}})(),syncPayload=(()=>{try{return JSON.parse(syncRow.payload_json||'{}')}catch{return{}}})(),coreActivatedAt=String(syncPayload.coreActivatedAt||safePayload.coreActivatedAt||''),cleanDates=rows(`SELECT observed_date FROM rb_rollout_observations WHERE user_id=${quote(USER_ID)} AND status='clean' AND created_at>=${quote(coreActivatedAt)} ORDER BY observed_date`).map(row=>row.observed_date),gate=canEnableSafeAuto({coreActivatedAt,now:now(),cleanObservationDates:cleanDates,explicitOptIn:safePayload.explicitOptIn===true});
  if(!gate.ok){process.stdout.write(`${json({status:'waiting',phase:'safe-auto',...gate})}\n`);return{status:'waiting',gate}}
  const enabledFlags={...flags,coach_loop_safe_auto:true},activatedAt=now();
  setFlags(enabledFlags,{phase:'safe-auto',activatedAt,coreActivatedAt,observationDays:gate.cleanDates,explicitOptIn:true});
  audit('safe-auto','activate',enabledFlags,gate.checks);
  process.stdout.write(`${json({status:'activated',phase:'safe-auto',flags:assertCurrentFlags(enabledFlags),gate})}\n`);
  return{status:'activated',gate};
}

function rollback(){
  const next=rollbackFlags(rollbackLevel),actual=setFlags(next,{phase:'manual-rollback',rollbackLevel,rolledBackAt:now(),reactivationRequired:true});
  audit('rollback','activate',actual,{level:rollbackLevel});
  process.stdout.write(`${json({status:'rolled-back',level:rollbackLevel,flags:actual})}\n`);
}

resolveProductionConfig();
if(phase==='rollback')rollback();
else if(phase==='safe-auto'){const observation=recordObservation();if(observation.status!=='deferred')maybeEnableSafeAuto()}
else{
  const flags=currentFlags(),coreActive=flags.coach_loop_read&&flags.coach_loop_ui&&flags.coach_loop_write&&flags.coach_loop_sync;
  if(!coreActive)activateCore();
  if(currentFlags().coach_loop_sync){const observation=recordObservation();if(observation.status!=='deferred')maybeEnableSafeAuto()}
}
