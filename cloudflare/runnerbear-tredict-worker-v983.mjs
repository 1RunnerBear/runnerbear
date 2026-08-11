import base from './runnerbear-tredict-worker.mjs';
export { TredictService } from './runnerbear-tredict-worker.mjs';

const LEGACY_ORIGIN='https://1runnerbear.github.io';
const MAX_BODY_BYTES=1_600_000;

function cors(origin,allowed){
  return {
    'Access-Control-Allow-Origin':allowed?origin:'null',
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Accept,Content-Type,X-RunnerBear-Key',
    'Access-Control-Max-Age':'86400',
    'Vary':'Origin',
    'Cache-Control':'no-store',
    'Content-Type':'application/json;charset=UTF-8'
  };
}
function json(body,status,origin,allowed=true){return new Response(JSON.stringify(body),{status,headers:cors(origin,allowed)})}
async function bodyJson(request){
  const declared=Number(request.headers.get('content-length')||0);
  if(declared>MAX_BODY_BYTES)throw new Error('Payload too large');
  const text=await request.text();
  if(text.length>MAX_BODY_BYTES)throw new Error('Payload too large');
  return text?JSON.parse(text):{};
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    const relayPath=url.pathname==='/api/migrate-local'||url.pathname==='/api/migrate-check';
    if(!relayPath)return base.fetch(request,env,ctx);

    const origin=request.headers.get('Origin')||'';
    const allowed=origin===(env.RUNNERBEAR_ORIGIN||LEGACY_ORIGIN);
    if(request.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers:cors(origin,allowed)});
    if(!allowed)return json({ok:false,error:'ORIGIN_DENIED'},403,origin,false);
    if(!env.RUNNERBEAR_BRIDGE_KEY)return json({ok:false,error:'BRIDGE_NOT_CONFIGURED'},503,origin,true);
    if(request.headers.get('X-RunnerBear-Key')!==env.RUNNERBEAR_BRIDGE_KEY)return json({ok:false,error:'BRIDGE_AUTH_FAILED'},401,origin,true);
    if(!env.RUNNERBEAR_CLOUD)return json({ok:false,error:'CLOUD_MIGRATION_NOT_CONFIGURED'},503,origin,true);

    if(url.pathname==='/api/migrate-check'){
      if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405,origin,true);
      try{
        const check=await env.RUNNERBEAR_CLOUD.health();
        return json({ok:check?.ok===true,relay:'runnerbear-bridge-v9.8.3',cloudVersion:String(check?.version||'')},check?.ok===true?200:503,origin,true);
      }catch(error){
        return json({ok:false,error:'MIGRATION_RELAY_UNAVAILABLE',detail:error instanceof Error?error.message:String(error)},503,origin,true);
      }
    }

    if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405,origin,true);
    try{
      const input=await bodyJson(request);
      const result=await env.RUNNERBEAR_CLOUD.migrateLocal({
        fromOrigin:origin,
        localStorage:input?.localStorage||{}
      });
      return json({ok:true,relay:'runnerbear-bridge-v9.8.3',...result},200,origin,true);
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      return json({ok:false,error:'MIGRATION_RELAY_FAILED',detail:message},/too large/i.test(message)?413:500,origin,true);
    }
  }
};
