import previous, { MigrationService } from './index-v112.js';
import { buildOneDecision, ONE_DECISION_BUILD, ONE_DECISION_VERSION, oneDecisionAudit } from './v113/one-decision.js';

export { MigrationService };

const BUILD=ONE_DECISION_BUILD;

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
        const oneDecision=buildOneDecision(body);
        console.log(JSON.stringify({event:'one_decision_built',build:BUILD,planRevisionId:oneDecision.planRevisionId||'',state:oneDecision.state,freshness:oneDecision.freshness,status:'ok'}));
        return jsonResponse(response,{...body,build:BUILD,cloudBuild:BUILD,oneDecision});
      }
      return jsonResponse(response,{...body,build:BUILD,cloudBuild:BUILD,schemaVersion:4,oneDecision:true,oneDecisionVersion:ONE_DECISION_VERSION,oneDecisionAudit:oneDecisionAudit()});
    }catch(error){
      console.error(JSON.stringify({event:'one_decision_augmentation',build:BUILD,status:'failed',errorCode:String(error?.message||'AUGMENTATION_FAILED').slice(0,80)}));
      return fallback;
    }
  },
  async scheduled(controller,env,ctx){return previous.scheduled(controller,env,ctx)},
};
