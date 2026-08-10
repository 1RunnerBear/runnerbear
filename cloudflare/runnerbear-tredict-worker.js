/* RunnerBear v9.4 · Tredict Bridge · Cloudflare Worker
   Secrets (Cloudflare): TREDICT_TOKEN, RUNNERBEAR_BRIDGE_KEY
   Optional var: RUNNERBEAR_ORIGIN (defaults to GitHub Pages origin)
   Read-only bridge for activities + recovery/capacity data.
   Deploy probe: same-repo PR verifies Cloudflare CI and secret wiring · retry 4.
*/
const TREDICT='https://www.tredict.com/api/oauth/v2/';
const DEFAULT_ORIGIN='https://1runnerbear.github.io';

function cors(origin,allowed){
  return {
    'Access-Control-Allow-Origin':allowed?origin:'null',
    'Access-Control-Allow-Methods':'GET,OPTIONS',
    'Access-Control-Allow-Headers':'Accept,Content-Type,X-RunnerBear-Key',
    'Access-Control-Max-Age':'86400',
    'Vary':'Origin',
    'Cache-Control':'no-store',
    'Content-Type':'application/json;charset=UTF-8'
  };
}
function json(body,status,origin,allowed=true){return new Response(JSON.stringify(body),{status,headers:cors(origin,allowed)})}
function daysAgo(n){const d=new Date();d.setUTCDate(d.getUTCDate()-n);return d}
function pickSummary(a){
  const s=a?.summary||a?.extendedSummary||{};
  return {
    id:a?.id||a?._id||'',date:a?.date||'',sportType:a?.sportType||'',subSportType:a?.subSportType||'',title:a?.title||s?.title||'',timezone:a?.timezone||'',
    summary:{
      duration:Number(s.duration||s.durationTotal||0),distance:Number(s.distance||0),pace:Number(s.pace||0),speed:Number(s.speed||0),
      heartrate:Number(s.heartrate||0),heartrateMax:Number(s.heartrateMax||0),power:Number(s.power||0),powerMax:Number(s.powerMax||0),
      cadence:Number(s.cadence||0),cadenceMax:Number(s.cadenceMax||0),calories:Number(s.calories||0)
    }
  };
}
function trimBody(rows,cutoff){
  return (rows||[]).filter(x=>x?.timestamp&&new Date(x.timestamp)>=cutoff).map(x=>({
    timestamp:x.timestamp,timezoneOffsetInSeconds:x.timezoneOffsetInSeconds,
    restingHeartrate:Number(x.restingHeartrate||0)||undefined,hrRestDynamic:Number(x.hrRestDynamic||0)||undefined
  }));
}
async function td(env,path,params={}){
  const u=new URL(TREDICT+path);Object.entries(params).forEach(([k,v])=>v!==undefined&&v!==null&&u.searchParams.set(k,String(v)));
  const r=await fetch(u,{headers:{Authorization:`Bearer ${env.TREDICT_TOKEN}`,Accept:'application/json;charset=UTF-8'}});
  if(!r.ok){let msg='';try{msg=(await r.text()).slice(0,300)}catch{};const e=new Error(`Tredict ${path}: HTTP ${r.status}${msg?` · ${msg}`:''}`);e.status=r.status;throw e}
  return r.json();
}
async function safe(name,fn){try{return{name,ok:true,data:await fn()}}catch(e){return{name,ok:false,status:e.status||0,error:e.message||String(e)}}

export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin')||'';
    const allowedOrigin=env.RUNNERBEAR_ORIGIN||DEFAULT_ORIGIN;
    const allowed=origin===allowedOrigin;
    if(request.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers:cors(origin,allowed)});
    if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405,origin,allowed);
    if(!allowed)return json({ok:false,error:'ORIGIN_DENIED'},403,origin,false);
    if(!env.TREDICT_TOKEN||!env.RUNNERBEAR_BRIDGE_KEY)return json({ok:false,error:'BRIDGE_NOT_CONFIGURED'},503,origin,true);
    if(request.headers.get('X-RunnerBear-Key')!==env.RUNNERBEAR_BRIDGE_KEY)return json({ok:false,error:'BRIDGE_AUTH_FAILED'},401,origin,true);

    const url=new URL(request.url);
    if(url.pathname==='/health')return json({ok:true,service:'RunnerBear Tredict Bridge',version:'9.4'},200,origin,true);
    if(url.pathname!=='/api/snapshot')return json({ok:false,error:'NOT_FOUND'},404,origin,true);

    const days=Math.max(7,Math.min(60,Number(url.searchParams.get('days')||28)));
    const now=new Date(),old=daysAgo(days),nowIso=now.toISOString(),oldIso=old.toISOString();
    const calls=await Promise.all([
      safe('activities',()=>td(env,'activityList',{startDate:nowIso,endDate:oldIso,pageSize:100,extendedSummary:1})),
      safe('hrv',()=>td(env,'hrv',{startDate:nowIso,endDate:oldIso})),
      safe('sleep',()=>td(env,'sleep',{startDate:nowIso,endDate:oldIso})),
      safe('body',()=>td(env,'bodyvalues')),
      safe('capacity',()=>td(env,'capacity',{sportType:'running'})),
      safe('zones',()=>td(env,'zones',{sportType:'running'}))
    ]);
    const by=Object.fromEntries(calls.map(x=>[x.name,x]));
    if(!by.activities.ok)return json({ok:false,error:'TREDICT_ACTIVITY_READ_FAILED',detail:by.activities.error,status:by.activities.status,parts:calls.map(({name,ok,status})=>({name,ok,status}))},502,origin,true);
    const activityRows=by.activities.data?._embedded?.activityList||by.activities.data?.activityList||[];
    const bodyRows=by.body.ok?(by.body.data?.bodyvalues||by.body.data?._embedded?.bodyvalues||[]):[];
    const payload={
      ok:true,version:'9.4',syncedAt:new Date().toISOString(),windowDays:days,
      activities:activityRows.map(pickSummary),
      hrv:by.hrv.ok?(by.hrv.data?.hrv||{}):{},
      sleep:by.sleep.ok?(by.sleep.data?.sleep||{}):{},
      body:trimBody(bodyRows,old),
      capacity:by.capacity.ok?(by.capacity.data?.capacity||{}):{},
      zones:by.zones.ok?(by.zones.data?.zones||{}):{},
      parts:calls.map(({name,ok,status,error})=>({name,ok,status,error:error||undefined}))
    };
    return json(payload,200,origin,true);
  }
};
