const BASE='https://personal.connectapi.garmin.com';
const TOKEN_PATH='/personalapitoken-service/personal-api/personal-api-key/token';
const safeDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
let isolateToken=null,isolateTokenExpiresAt=0;

async function getAccessToken(env,userId){
  if(!env.GARMIN_API_KEY) throw new Error('GARMIN_KEY_MISSING');
  const now=Date.now();
  if(isolateToken&&isolateTokenExpiresAt>now+10*60_000)return isolateToken;
  const response=await fetch(`${BASE}${TOKEN_PATH}`,{method:'POST',headers:{Authorization:`ApiKey ${env.GARMIN_API_KEY}`,Accept:'application/json'}});
  if(!response.ok)throw new Error(`GARMIN_TOKEN_HTTP_${response.status}`);
  const body=await response.json(),token=body.access_token||body.accessToken;
  if(typeof token!=='string'||token.length<20)throw new Error('GARMIN_TOKEN_INVALID_RESPONSE');
  let exp=Number(body.expires_in||body.expiresIn);if(!Number.isFinite(exp)||exp<=0)exp=23*60*60;
  isolateTokenExpiresAt=now+Math.min(exp,23*60*60)*1000;isolateToken=token;
  return token;
}

async function apiGet(token,path){const response=await fetch(`${BASE}${path}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});if(!response.ok)throw new Error(`GARMIN_API_HTTP_${response.status}`);return response.json()}
const firstNumber=(obj,keys)=>{for(const k of keys){const v=Number(obj?.[k]);if(Number.isFinite(v))return v}return null};
function healthRow(date,sleep,hr,hrv,spo2){
  const sleepObj=Array.isArray(sleep)?sleep[0]||{}:sleep||{},hrObj=Array.isArray(hr)?hr[0]||{}:hr||{},hrvObj=Array.isArray(hrv)?hrv[0]||{}:hrv||{},spoObj=Array.isArray(spo2)?spo2[0]||{}:spo2||{};
  const sleepSeconds=firstNumber(sleepObj,['sleepTimeSeconds','sleepSeconds','totalSleepSeconds']);
  const rhr=firstNumber(hrObj,['restingHeartRate','restingHeartRateInBeatsPerMinute','restingHeartRateBpm']);
  const hrvMs=firstNumber(hrvObj,['lastNightAvg','weeklyAvg','hrvValue','average']);
  const avg=firstNumber(spoObj,['averageSpO2','avgSpO2','average']);
  const min=firstNumber(spoObj,['lowestSpO2','minSpO2','minimum']);
  const respiration=firstNumber(sleepObj,['avgRespiration','averageRespiration','respiration']);
  const score=firstNumber(sleepObj,['sleepScore','overallSleepScore']);
  return {date,sleepSeconds,rhr,hrvMs,spo2Avg:avg>=50&&avg<=100?avg:null,spo2Min:min>=50&&min<=100?min:null,respiration:respiration>=4&&respiration<=40?respiration:null,sleepScore:score>=0&&score<=100?score:null};
}

export async function syncGarminPersonal(env,{userId=String(env.PRIMARY_USER_ID||'primary'),days=2}={}){
  const now=new Date(),today=now.toISOString().slice(0,10),from=new Date(now.getTime()-Math.max(1,Math.min(7,days))*86400000).toISOString().slice(0,10),token=await getAccessToken(env,userId);
  const dates=[];for(let d=new Date(`${from}T12:00:00Z`);d<=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+1))dates.push(d.toISOString().slice(0,10));
  let saved=0;
  for(const date of dates){
    const [sleep,hr,hrv,spo2]=await Promise.all([
      apiGet(token,`/sleep-service/sleep/dailySleep?date=${date}`),
      apiGet(token,`/wellness-service/wellness/dailyHeartRate?date=${date}`),
      apiGet(token,`/hrv-service/hrv/${date}`),
      apiGet(token,`/wellness-service/wellness/daily/spo2acclimation/${date}`),
    ]);
    const row=healthRow(date,sleep,hr,hrv,spo2),at=new Date().toISOString();
    await env.DB.prepare(`INSERT INTO rb_health_daily(user_id,date,hrv_ms,sleep_seconds,rhr_bpm,payload_json,updated_at,spo2_avg_pct,spo2_min_pct,respiration_avg_bpm,sleep_score,health_source,health_quality)
      VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'garmin','partial')
      ON CONFLICT(user_id,date) DO UPDATE SET hrv_ms=COALESCE(excluded.hrv_ms,rb_health_daily.hrv_ms),sleep_seconds=COALESCE(excluded.sleep_seconds,rb_health_daily.sleep_seconds),rhr_bpm=COALESCE(excluded.rhr_bpm,rb_health_daily.rhr_bpm),spo2_avg_pct=COALESCE(excluded.spo2_avg_pct,rb_health_daily.spo2_avg_pct),spo2_min_pct=COALESCE(excluded.spo2_min_pct,rb_health_daily.spo2_min_pct),respiration_avg_bpm=COALESCE(excluded.respiration_avg_bpm,rb_health_daily.respiration_avg_bpm),sleep_score=COALESCE(excluded.sleep_score,rb_health_daily.sleep_score),health_source='garmin',health_quality='partial',payload_json=excluded.payload_json,updated_at=excluded.updated_at`)
      .bind(userId,date,row.hrvMs,row.sleepSeconds,row.rhr,JSON.stringify({garmin:true}),at,row.spo2Avg,row.spo2Min,row.respiration,row.sleepScore).run();saved++;
  }
  const at=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO rb_sync_sources(user_id,source,last_synced_at,status,detail_json,updated_at) VALUES(?1,'garmin',?2,'ok',?3,?2) ON CONFLICT(user_id,source) DO UPDATE SET last_synced_at=excluded.last_synced_at,status='ok',detail_json=excluded.detail_json,updated_at=excluded.updated_at`).bind(userId,at,JSON.stringify({mode:'shadow-read-only',healthRows:saved,dateFrom:from,dateTo:today})).run();
  return{saved,dateFrom:from,dateTo:today};
}

export async function garminTokenProbe(env,userId=String(env.PRIMARY_USER_ID||'primary')){await getAccessToken(env,userId);return{configured:true,tokenObtained:true,tokenStoredServerSide:true}}
export const garminDateIsValid=safeDate;
