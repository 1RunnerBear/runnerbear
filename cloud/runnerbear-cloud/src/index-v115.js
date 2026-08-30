import previous, { MigrationService } from './index-v1141.js';

export { MigrationService };

const BUILD='11.5.0';

function jsonResponse(response,body){
  const headers=new Headers(response.headers);
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('cache-control','no-store');
  return new Response(JSON.stringify(body),{status:response.status,statusText:response.statusText,headers});
}

export function premiumUxAudit(){
  return{ok:true,version:'premium-ux-1',designDirection:'1.0',coachLiveStructured:true,unifiedDialogContract:true,keyboardFocusTrap:true,planWritesByAi:false,maximumReductionPercent:20,navigationTabs:4,styleSources:26};
}

export default{
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/',response=await previous.fetch(request,env,ctx);
    if(request.method!=='GET'||!response.ok||!['/api/v2/bootstrap','/health'].includes(path))return response;
    const fallback=response.clone();
    try{
      const body=await response.json(),audit=premiumUxAudit();
      if(path==='/api/v2/bootstrap')return jsonResponse(response,{...body,build:BUILD,cloudBuild:BUILD,premiumUx:true,premiumUxVersion:audit.version});
      return jsonResponse(response,{...body,build:BUILD,cloudBuild:BUILD,schemaVersion:4,premiumUx:true,premiumUxVersion:audit.version,premiumUxAudit:audit});
    }catch(error){
      console.error(JSON.stringify({event:'premium_ux_augmentation',build:BUILD,status:'failed',errorCode:String(error?.message||'AUGMENTATION_FAILED').slice(0,80)}));
      return fallback;
    }
  },
  async scheduled(controller,env,ctx){return previous.scheduled(controller,env,ctx)},
};
