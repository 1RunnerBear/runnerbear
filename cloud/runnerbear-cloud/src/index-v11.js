import legacy from './index-v11-legacy.js';
import { processPendingSync,reconcileActiveSyncProjection,repairAccidentalGoalState,repairBakkenV11Plan } from './v11/routes.js';

export { MigrationService } from './migration-service.js';

const BUILD = '11.1.0';

async function historyAudit(db) {
  if (!db) return { ok: false, activities: 0, duplicateExternalIds: 0, planItems: 0, events: 0 };
  try {
    const [activities, duplicates, plans, events] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS total,MIN(date) AS earliest,MAX(date) AS latest FROM rb_activities WHERE user_id='primary'").first(),
      db.prepare("SELECT COUNT(*) AS total FROM (SELECT source,source_id FROM rb_activities WHERE user_id='primary' GROUP BY source,source_id HAVING COUNT(*)>1)").first(),
      db.prepare("SELECT COUNT(*) AS total FROM rb_plan_revision_items i JOIN rb_plan_revisions r ON r.plan_revision_id=i.plan_revision_id WHERE r.user_id='primary'").first(),
      db.prepare("SELECT COUNT(*) AS total FROM rb_training_events WHERE user_id='primary'").first(),
    ]);
    const result={activities:Number(activities?.total||0),earliestActivity:activities?.earliest||null,latestActivity:activities?.latest||null,duplicateExternalIds:Number(duplicates?.total||0),planItems:Number(plans?.total||0),events:Number(events?.total||0)};
    return{ok:result.activities>0&&result.duplicateExternalIds===0,...result};
  } catch (error) {
    return{ok:false,activities:0,duplicateExternalIds:0,planItems:0,events:0,error:String(error?.message||error).slice(0,160)};
  }
}

async function syncAudit(db) {
  if (!db) return { queued: 0, retryable: 0, processing: 0, reviewRequired: 0 };
  try {
    const rows = await db.prepare("SELECT status,COUNT(*) AS total FROM rb_sync_operations WHERE user_id='primary' AND status IN ('queued','failed_retryable','processing','review_required') GROUP BY status").all();
    const counts = Object.fromEntries((rows.results || []).map((row) => [row.status, Number(row.total || 0)]));
    return { queued: counts.queued || 0, retryable: counts.failed_retryable || 0, processing: counts.processing || 0, reviewRequired: counts.review_required || 0 };
  } catch {
    return { queued: 0, retryable: 0, processing: 0, reviewRequired: 0 };
  }
}

async function goalGuardAudit(db) {
  if(!db)return{restored:false,activePrimary:false};
  try{
    const row=await db.prepare("SELECT payload_json FROM rb_state WHERE user_id='primary' AND namespace='localStorage'").first(),local=JSON.parse(row?.payload_json||'{}'),decode=value=>typeof value==='string'?JSON.parse(value||'{}'):value||{},goal=decode(local.runnerbear_v109_goals),guard=decode(local.runnerbear_v10312_goal_guard);
    return{restored:guard.restored===true,activePrimary:goal.mode==='race'&&!!goal.primary};
  }catch{return{restored:false,activePrimary:false}}
}

async function bodyResponseAudit(db) {
  if(!db)return{ok:false,tablesFound:0,latestState:null};
  try{
    const [tables,latest]=await Promise.all([
      db.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type='table' AND name IN ('rb_health_observations','rb_health_baseline_snapshots','rb_body_response_snapshots','rb_subjective_checkins','rb_workout_response_links','rb_recovery_insights')").first(),
      db.prepare("SELECT state,confidence,generated_at FROM rb_body_response_snapshots WHERE user_id='primary' ORDER BY generated_at DESC LIMIT 1").first(),
    ]),tablesFound=Number(tables?.total||0);
    return{ok:tablesFound===6,tablesFound,latestState:latest?.state||null,latestConfidence:latest?.confidence||null,latestGeneratedAt:latest?.generated_at||null};
  }catch(error){return{ok:false,tablesFound:0,latestState:null,error:String(error?.message||error).slice(0,160)}}
}

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    let goalRepair={ok:true,restored:false},bakkenRepair={ok:true,repaired:false,afterAudit:{ok:false}},syncDrain={ok:true,projected:0,processed:0};
    if(request.method==='GET'&&path==='/health'){
      if(env.GOAL_REPAIR_RELEASE)try{goalRepair=await repairAccidentalGoalState(env,String(env.PRIMARY_USER_ID||'primary'))}catch{goalRepair={ok:false,restored:false,issues:['REPAIR_EXECUTION_FAILED']}}
      if(env.BAKKEN_ENGINE_RELEASE)try{bakkenRepair=await repairBakkenV11Plan(env,String(env.PRIMARY_USER_ID||'primary'))}catch(error){bakkenRepair={ok:false,repaired:false,reason:String(error?.message||error),afterAudit:{ok:false}}}
      try{const userId=String(env.PRIMARY_USER_ID||'primary'),projection=await reconcileActiveSyncProjection(env,userId),drain=await processPendingSync(env,userId);syncDrain={ok:true,projected:Number(projection.queued||0),processed:Number(drain.processed||0)}}catch{syncDrain={ok:false,projected:0,processed:0}}
    }
    const response = await legacy.fetch(request, env, ctx);
    if (request.method !== 'GET' || path !== '/health' || !response.ok) return response;
    try {
      const [body,audit,sync,goalGuard,bodyResponse] = await Promise.all([response.json(),historyAudit(env.DB),syncAudit(env.DB),goalGuardAudit(env.DB),bodyResponseAudit(env.DB)]);
      return Response.json({ ...body, build: BUILD, cloudBuild: BUILD, bodyResponseEngine:true, bodyResponseEngineVersion:'body-response-1', bodyResponseAudit:bodyResponse, bakkenEngine:true, bakkenEngineVersion:'11.0.0', bakkenPlanAudit:bakkenRepair.afterAudit||bakkenRepair.beforeAudit||{ok:false}, bakkenRepair:{ok:bakkenRepair.ok===true,repaired:bakkenRepair.repaired===true,idempotent:bakkenRepair.idempotent===true,reason:bakkenRepair.reason||null,planRevisionId:bakkenRepair.planRevisionId||null}, historyIntegrity:audit.ok, historyAudit:{activitiesPresent:audit.activities>0,duplicateExternalIds:audit.duplicateExternalIds}, durableSync:true, syncOutbox:sync, syncDrain, goalGuard, goalRepair:{ok:goalRepair.ok!==false,restored:goalRepair.restored===true,issues:Array.isArray(goalRepair.issues)?goalRepair.issues:[]} }, {
        status: response.status,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      });
    } catch {
      return response;
    }
  },
  async scheduled(controller, env) {
    const userId=String(env.PRIMARY_USER_ID||'primary'),repair=await repairAccidentalGoalState(env,userId),bakken=await repairBakkenV11Plan(env,userId),projection=await reconcileActiveSyncProjection(env,userId),result=await processPendingSync(env,userId);
    console.log(JSON.stringify({ event: 'coach_loop_sync_cron', build: BUILD, cron: controller.cron, goalRestored:repair.restored===true, bakkenRepaired:bakken.repaired===true, projected:projection.queued, processed: result.processed }));
  },
};
