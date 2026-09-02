import previous, { MigrationService } from './index-v116.js';

export { MigrationService };
const BUILD='12.0.0';

const jsonResponse=(response,body)=>{const headers=new Headers(response.headers);headers.set('content-type','application/json; charset=utf-8');headers.set('cache-control','no-store');return new Response(JSON.stringify(body),{status:response.status,statusText:response.statusText,headers})};

async function liveMirrorAudit(env,userId){
  const defaults={ok:false,canonicalPlanCount:0,canonicalPlanId:null,activePlanRevisionId:null,activeGoalDate:null,planEndDate:null,executionWindowDays:14,lastReconcileAt:null,lastReconcileResult:null,tredictConfigured:!!env.TREDICT,calendarRead:false,calendarWrite:false,moveSupported:false,createSupported:false,updateSupported:false,deleteSupported:false,replaceSupported:false};
  try{
    const [plan,horizon,state,provider]=await Promise.all([
      env.DB.prepare("SELECT p.canonical_plan_id,p.active_goal_date,r.plan_revision_id FROM rb_canonical_plans p LEFT JOIN rb_plan_revisions r ON r.user_id=p.user_id AND r.canonical_plan_id=p.canonical_plan_id AND r.status='active' WHERE p.user_id=?1 AND p.status='active'").bind(userId).all(),
      env.DB.prepare("SELECT MAX(i.local_date) AS plan_end_date FROM rb_plan_revision_items i JOIN rb_plan_revisions r ON r.plan_revision_id=i.plan_revision_id WHERE r.user_id=?1 AND r.status='active' AND i.status='scheduled'").bind(userId).first(),
      env.DB.prepare("SELECT * FROM rb_reconciliation_state WHERE user_id=?1 AND provider='tredict'").bind(userId).first(),
      env.TREDICT?.health?.().catch?.(()=>null)||Promise.resolve(null),
    ]),rows=plan.results||[],remote=provider||{};
    return{...defaults,ok:rows.length===1&&!!rows[0]?.plan_revision_id,canonicalPlanCount:rows.length,canonicalPlanId:rows[0]?.canonical_plan_id||null,activePlanRevisionId:rows[0]?.plan_revision_id||null,activeGoalDate:rows[0]?.active_goal_date||null,planEndDate:horizon?.plan_end_date||null,lastReconcileAt:state?.last_completed_at||state?.last_started_at||null,lastReconcileResult:state?.last_result||null,tredictConfigured:remote.ok===true,calendarRead:remote.calendarRead===true,calendarWrite:remote.calendarWrite===true,moveSupported:remote.supportsMove===true,createSupported:remote.supportsCreate===true,updateSupported:remote.supportsUpdate===true,deleteSupported:remote.supportsDelete===true,replaceSupported:remote.supportsReplace===true};
  }catch(error){return{...defaults,error:String(error?.message||error).slice(0,160)}}
}

export default{
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/',response=await previous.fetch(request,env,ctx);
    if(request.method!=='GET'||!response.ok||!['/api/v2/bootstrap','/health'].includes(path))return response;
    const fallback=response.clone();try{const body=await response.json();if(path==='/api/v2/bootstrap')return jsonResponse(response,{...body,build:BUILD,cloudBuild:BUILD,tredictLiveCalendarMirror:true});const audit=await liveMirrorAudit(env,String(env.PRIMARY_USER_ID||'primary'));return jsonResponse(response,{...body,build:BUILD,cloudBuild:BUILD,schemaVersion:5,tredictLiveCalendarMirror:true,tredictLiveCalendarMirrorVersion:'live-calendar-mirror-1',tredictMirrorAudit:audit,tredictConfigured:audit.tredictConfigured,calendarRead:audit.calendarRead,calendarWrite:audit.calendarWrite,moveSupported:audit.moveSupported,createSupported:audit.createSupported,updateSupported:audit.updateSupported,deleteSupported:audit.deleteSupported,replaceSupported:audit.replaceSupported,lastReconcileAt:audit.lastReconcileAt,lastReconcileResult:audit.lastReconcileResult})}catch(error){console.error(JSON.stringify({event:'tredict_live_mirror_health',build:BUILD,status:'failed',errorCode:String(error?.message||error).slice(0,80)}));return fallback}
  },
  async scheduled(controller,env,ctx){return previous.scheduled(controller,env,ctx)},
};
