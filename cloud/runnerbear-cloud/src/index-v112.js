import legacy, { MigrationService } from './index-v11.js';

export { MigrationService };

const BUILD='11.2.0';

function retiredRoute(){
  return Response.json({ok:false,code:'COACH_LIVE_REMOVED',error:'Coach Live er fjernet.',replacement:'contextual-coach-1'},{status:410,headers:{'cache-control':'no-store'}});
}

export default{
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/';
    if(path==='/api/v2/coach-live'||path.startsWith('/api/v2/coach-live/'))return retiredRoute();
    const response=await legacy.fetch(request,env,ctx);
    if(request.method!=='GET'||path!=='/health'||!response.ok)return response;
    try{
      const body=await response.json();
      return Response.json({...body,build:BUILD,cloudBuild:BUILD,schemaVersion:4,coachLive:false,coachLiveRoutes:false,coachLiveInference:false},{status:response.status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }catch{return response}
  },
  async scheduled(controller,env,ctx){return legacy.scheduled(controller,env,ctx)},
};
