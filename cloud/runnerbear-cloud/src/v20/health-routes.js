import { BUILD } from '../v11/constants.js';
import {mergeHealthEvidence} from './evidence.js';
import {normalizeHealthWindow,summarizeHealthWindow,summarizeSleepBreathing} from '../v1027/health-intelligence.js';
const json=(body,status,headers)=>Response.json(body,{status,headers:{'cache-control':'no-store',...headers}});
const fail=(code,status,message,headers)=>json({ok:false,code,message},status,headers);
const addDays=(date,days)=>new Date(Date.parse(`${date}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);
export async function healthObservationResponse(request,env,{userId,corsHeaders={},kill=false}){
  const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
    if(kill)return fail('HEALTH_READ_DISABLED',503,'Helseinnsikt er midlertidig utilgjengelig.',corsHeaders);
    const breathing=path.endsWith('/sleep-breathing'),allowed=breathing?[7,28,30,90]:[7,28,90],days=normalizeHealthWindow(url.searchParams.get('window'),allowed,breathing?28:28);
    const timezone='Europe/Oslo',today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone}).format(new Date()),from=addDays(today,-(days-1));
    const result=await env.DB.prepare(`SELECT date,hrv_ms,sleep_seconds,rhr_bpm,spo2_avg_pct,spo2_min_pct,respiration_avg_bpm,sleep_score,health_source,health_quality,updated_at
      FROM rb_health_daily WHERE user_id=?1 AND date>=?2 AND date<=?3 ORDER BY date DESC LIMIT ?4`).bind(userId,from,today,days).all(),rows=result.results||[];
    const shadow=String(env.RUNNERBEAR_V20_EVIDENCE_DISABLED||'false')==='true'?{results:[]}:await env.DB.prepare('SELECT date,metrics,updated_at FROM rb_garmin_shadow WHERE user_id=?1 AND date>=?2 AND date<=?3 ORDER BY date DESC LIMIT ?4').bind(userId,from,today,days).all();
    const observed=mergeHealthEvidence(rows,shadow.results||[]);
    const summary=breathing?summarizeSleepBreathing(observed,days):summarizeHealthWindow(observed,days);
    return json({ok:true,build:BUILD,generatedAt:new Date().toISOString(),source:'runnerbear-health-observations',timezone,windowDays:days,...summary},200,corsHeaders);
}
