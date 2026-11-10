const BASE='https://personal.connectapi.garmin.com';
const TOKEN_PATH='/personalapitoken-service/personal-api/personal-api-key/token';
const safeDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
let isolateToken=null,isolateTokenExpiresAt=0;

async function getAccessToken(env,userId){
  if(!env.GARMIN_API_KEY) throw new Error('GARMIN_KEY_MISSING');
  const now=Date.now();
  if(isolateToken&&isolateTokenExpiresAt>now+10*60_000)return isolateToken;
  const response=await fetch(`${BASE}${TOKEN_PATH}`,{method:'POST',redirect:'manual',headers:{Authorization:`ApiKey ${env.GARMIN_API_KEY}`,Accept:'*/*'}});
  if(!response.ok)throw new Error(`GARMIN_TOKEN_HTTP_${response.status}`);
  const token=(await response.text()).trim();
  let expiration;
  try {
    const parts=token.split('.');
    if(parts.length!==3) throw new Error();
    expiration=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/'))).exp*1000;
  } catch { throw new Error('GARMIN_TOKEN_INVALID_RESPONSE'); }
  if(!Number.isFinite(expiration)||expiration<=now) throw new Error('GARMIN_TOKEN_EXPIRED');
  isolateTokenExpiresAt=Math.min(expiration,now+86400000);
  isolateToken=token;
  return token;
}

async function apiGet(token,path){const response=await fetch(`${BASE}${path}`,{redirect:'manual',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});if(!response.ok)throw new Error(`GARMIN_API_HTTP_${response.status}`);return response.json()}
const firstNumber=(obj,keys)=>{for(const k of keys){const v=obj?.[k];if(typeof v==='number'&&Number.isFinite(v))return v}return null};
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
    const row=healthRow(date,sleep?.dailySleepDTO??sleep,hr,hrv?.hrvSummary??hrv,spo2),at=new Date().toISOString();
    if(Object.entries(row).every(([key,value])=>key==='date'||value==null)) continue;
    await env.DB.prepare(`INSERT INTO rb_garmin_shadow(user_id,date,metrics,updated_at)
      VALUES(?1,?2,?3,?4) ON CONFLICT(user_id,date) DO UPDATE
      SET metrics=excluded.metrics,updated_at=excluded.updated_at`)
      .bind(userId,date,JSON.stringify(row),at).run();saved++;
  }
  const at=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO rb_sync_sources(user_id,source,last_synced_at,status,detail_json,updated_at) VALUES(?1,'garmin_shadow',?2,'ok',?3,?2) ON CONFLICT(user_id,source) DO UPDATE SET last_synced_at=excluded.last_synced_at,status='ok',detail_json=excluded.detail_json,updated_at=excluded.updated_at`).bind(userId,at,JSON.stringify({mode:'shadow-read-only',healthRows:saved,dateFrom:from,dateTo:today})).run();
  return{saved,dateFrom:from,dateTo:today};
}

export async function garminTokenProbe(env,userId=String(env.PRIMARY_USER_ID||'primary')){await getAccessToken(env,userId);return{configured:true,tokenObtained:true,tokenStoredServerSide:true}}
export const garminDateIsValid=safeDate;
