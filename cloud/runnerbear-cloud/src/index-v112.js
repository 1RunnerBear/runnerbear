import legacy, { MigrationService } from './index-v11.js';
import { coachLiveAudit, DEFAULT_COACH_LIVE_MODEL, handleCoachLive } from './v112/coach-live.js';

export { MigrationService };

const BUILD='11.2.0';

async function authenticatedSession(request,env,ctx){
  const url=new URL(request.url);url.pathname='/api/session';url.search='';
  const response=await legacy.fetch(new Request(url,{method:'GET',headers:request.headers}),env,ctx);
  if(!response.ok)return null;
  try{return await response.json()}catch{return null}
}

export default{
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/';
    if(path==='/api/v2/coach-live'||path.startsWith('/api/v2/coach-live/')){
      const session=await authenticatedSession(request,env,ctx);
      if(!session)return Response.json({ok:false,error:'Unauthorized'},{status:401,headers:{'cache-control':'no-store'}});
      return handleCoachLive(request,env,ctx,{userId:String(session.owner||env.PRIMARY_USER_ID||'primary')});
    }
    const response=await legacy.fetch(request,env,ctx);
    if(request.method!=='GET'||path!=='/health'||!response.ok)return response;
    try{
      const [body,audit]=await Promise.all([response.json(),coachLiveAudit(env.DB)]),model=String(env.COACH_LIVE_MODEL||DEFAULT_COACH_LIVE_MODEL);
      return Response.json({...body,build:BUILD,cloudBuild:BUILD,schemaVersion:4,coachLive:true,coachLiveModel:model,coachLiveInference:!!env.AI,coachLiveAudit:audit},{status:response.status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }catch{return response}
  },
  async scheduled(controller,env,ctx){return legacy.scheduled(controller,env,ctx)},
};

