import previous, { MigrationService } from './index-v113.js';
import { buildCoachContinuity, buildOneDecisionV2, CLOSED_LOOP_BUILD, COACH_CONTINUITY_VERSION, ONE_DECISION_V2_VERSION, closedLoopAudit } from './v114/closed-loop.js';

export { MigrationService };

const BUILD=CLOSED_LOOP_BUILD;

function jsonResponse(response,body){
  const headers=new Headers(response.headers);
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('cache-control','no-store');
  return new Response(JSON.stringify(body),{status:response.status,statusText:response.statusText,headers});
}

export default{
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/',response=await previous.fetch(request,env,ctx);
    if(request.method!=='GET'||!response.ok||!['/api/v2/bootstrap','/health'].includes(path))return response;
    const fallback=response.clone();
    try{
      const body=await response.json();
      if(path==='/api/v2/bootstrap'){
        const coachContinuity=buildCoachContinuity(body),oneDecision=buildOneDecisionV2(body,coachContinuity),{decisionHistory,responseCheckins,...publicBody}=body;
        console.log(JSON.stringify({event:'closed_loop_built',build:BUILD,planRevisionId:oneDecision.planRevisionId||'',state:oneDecision.state,confidence:coachContinuity.confidence.level,memory:coachContinuity.memory.status,followUp:coachContinuity.followUp.phase||'none',status:'ok'}));
        return jsonResponse(response,{...publicBody,build:BUILD,cloudBuild:BUILD,oneDecision,coachContinuity});
      }
      const audit=closedLoopAudit();
      return jsonResponse(response,{...body,build:BUILD,cloudBuild:BUILD,schemaVersion:4,oneDecision:true,oneDecisionVersion:ONE_DECISION_V2_VERSION,oneDecisionAudit:audit,coachContinuity:true,coachContinuityVersion:COACH_CONTINUITY_VERSION,coachContinuityAudit:audit});
    }catch(error){
      console.error(JSON.stringify({event:'closed_loop_augmentation',build:BUILD,status:'failed',errorCode:String(error?.message||'AUGMENTATION_FAILED').slice(0,80)}));
      return fallback;
    }
  },
  async scheduled(controller,env,ctx){return previous.scheduled(controller,env,ctx)},
};
