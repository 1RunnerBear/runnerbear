import previous, { MigrationService } from './index-v115.js';
import { buildContextualCoach, CONTEXTUAL_COACH_BUILD, CONTEXTUAL_COACH_VERSION, contextualCoachAudit, retiredCoachLiveResponse } from './v116/contextual-coach.js';

export { MigrationService };

const BUILD=CONTEXTUAL_COACH_BUILD;

function jsonResponse(response,body){
  const headers=new Headers(response.headers);
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('cache-control','no-store');
  return new Response(JSON.stringify(body),{status:response.status,statusText:response.statusText,headers});
}

function withoutRetiredCoachLive(body={}){
  const {
    coachLive:retiredCoachLive,
    coachLiveInference,
    coachLiveModel,
    coachLiveAudit,
    coachLiveReliability,
    coachLiveReliabilityVersion,
    coachLiveReliabilityAudit,
    premiumUx,
    premiumUxVersion,
    premiumUxAudit,
    ...current
  }=body;
  void retiredCoachLive;void coachLiveInference;void coachLiveModel;void coachLiveAudit;
  void coachLiveReliability;void coachLiveReliabilityVersion;void coachLiveReliabilityAudit;
  void premiumUx;void premiumUxVersion;void premiumUxAudit;
  return current;
}

export default{
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/';
    if(path==='/api/v2/coach-live'||path.startsWith('/api/v2/coach-live/'))return retiredCoachLiveResponse();
    const response=await previous.fetch(request,env,ctx);
    if(request.method!=='GET'||!response.ok||!['/api/v2/bootstrap','/health'].includes(path))return response;
    const fallback=response.clone();
    try{
      const retired=await response.json(),body=withoutRetiredCoachLive(retired),audit=contextualCoachAudit();
      if(path==='/api/v2/bootstrap'){
        const contextualCoach=buildContextualCoach(body);
        console.log(JSON.stringify({event:'contextual_coach_built',build:BUILD,planRevisionId:contextualCoach.planRevisionId||'',visible:Object.entries(contextualCoach.surfaces).filter(([,surface])=>surface.visible).map(([name])=>name),status:'ok'}));
        return jsonResponse(response,{...body,build:BUILD,cloudBuild:BUILD,contextualCoach});
      }
      return jsonResponse(response,{...body,build:BUILD,cloudBuild:BUILD,schemaVersion:4,contextualCoach:true,contextualCoachVersion:CONTEXTUAL_COACH_VERSION,contextualCoachAudit:audit,coachLive:false,coachLiveRoutes:false,coachLiveInference:false});
    }catch(error){
      console.error(JSON.stringify({event:'contextual_coach_augmentation',build:BUILD,status:'failed',errorCode:String(error?.message||'AUGMENTATION_FAILED').slice(0,80)}));
      return fallback;
    }
  },
  async scheduled(controller,env,ctx){return previous.scheduled(controller,env,ctx)},
};
