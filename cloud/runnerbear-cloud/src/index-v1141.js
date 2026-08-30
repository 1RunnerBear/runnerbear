import previous, { MigrationService } from './index-v114.js';

export { MigrationService };

const BUILD='11.4.1';

function jsonResponse(response,body){
  const headers=new Headers(response.headers);
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('cache-control','no-store');
  return new Response(JSON.stringify(body),{status:response.status,statusText:response.statusText,headers});
}

export function reliabilityAudit(){
  return{ok:true,version:'reliability-1',healthReadOnly:true,retiredChatRuntime:false,emptyResponsesAccepted:false,planWritesByAi:false,maximumReductionPercent:20};
}

export default{
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/',response=await previous.fetch(request,env,ctx);
    if(request.method!=='GET'||!response.ok||!['/api/v2/bootstrap','/health'].includes(path))return response;
    const fallback=response.clone();
    try{
      const body=await response.json(),audit=reliabilityAudit();
      if(path==='/api/v2/bootstrap')return jsonResponse(response,{...body,build:BUILD,cloudBuild:BUILD});
      return jsonResponse(response,{...body,build:BUILD,cloudBuild:BUILD,schemaVersion:4,healthReadOnly:true,reliabilityVersion:audit.version,reliabilityAudit:audit});
    }catch(error){
      console.error(JSON.stringify({event:'reliability_augmentation',build:BUILD,status:'failed',errorCode:String(error?.message||'AUGMENTATION_FAILED').slice(0,80)}));
      return fallback;
    }
  },
  async scheduled(controller,env,ctx){return previous.scheduled(controller,env,ctx)},
};
