import {analyzeFit, readBounded} from './garmin-fit.js';
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

async function apiGet(token,path){const response=await fetch(`${BASE}${path}`,{redirect:'manual',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});if(response.status===404)return null;if(!response.ok)throw new Error(`GARMIN_API_HTTP_${response.status}`);return response.json()}
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
  const now=new Date(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo'}).format(now),from=new Date(Date.parse(today+'T12:00:00Z')-Math.max(1,Math.min(7,days))*86400000).toISOString().slice(0,10),token=await getAccessToken(env,userId);
  const dates=[];for(let d=new Date(`${from}T12:00:00Z`);d<=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+1))dates.push(d.toISOString().slice(0,10));
  let saved=0;
  for(const date of dates){if(await importHealthDate(env,userId,date,token)) saved++;}
  const at=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO rb_sync_sources(user_id,source,last_synced_at,status,detail_json,updated_at) VALUES(?1,'garmin_shadow',?2,'ok',?3,?2) ON CONFLICT(user_id,source) DO UPDATE SET last_synced_at=excluded.last_synced_at,status='ok',detail_json=excluded.detail_json,updated_at=excluded.updated_at`).bind(userId,at,JSON.stringify({mode:'shadow-read-only',healthRows:saved,dateFrom:from,dateTo:today})).run();
  await env.DB.prepare(`INSERT INTO rb_garmin_observation_days(user_id,observed_date,first_checked_at,last_checked_at,checks,checks_with_data,plan_failures)
    SELECT ?1,?2,?3,?3,1,?4,CASE WHEN COUNT(*)=1 THEN 0 ELSE 1 END
    FROM rb_plan_revisions WHERE user_id=?1 AND status='active'
    ON CONFLICT(user_id,observed_date) DO UPDATE SET
      last_checked_at=max(last_checked_at,excluded.last_checked_at),checks=checks+1,
      checks_with_data=checks_with_data+excluded.checks_with_data,
      plan_failures=plan_failures+excluded.plan_failures`)
    .bind(userId,today,at,saved>0?1:0).run();
  return{saved,dateFrom:from,dateTo:today};
}

export async function garminTokenProbe(env,userId=String(env.PRIMARY_USER_ID||'primary')){await getAccessToken(env,userId);return{configured:true,tokenObtained:true,tokenStoredServerSide:true}}
export const garminDateIsValid=safeDate;

async function importHealthDate(env,userId,date,token){
    const [sleep,hr,hrv,spo2]=await Promise.all([
      apiGet(token,`/sleep-service/sleep/dailySleep?date=${date}`),
      apiGet(token,`/wellness-service/wellness/dailyHeartRate?date=${date}`),
      apiGet(token,`/hrv-service/hrv/${date}`),
      apiGet(token,`/wellness-service/wellness/daily/spo2acclimation/${date}`),
    ]);
    const row=healthRow(date,sleep?.dailySleepDTO??sleep,hr,hrv?.hrvSummary??hrv,spo2),at=new Date().toISOString();
    if(Object.entries(row).every(([key,value])=>key==='date'||value==null)) return false;
    await env.DB.prepare(`INSERT INTO rb_garmin_shadow(user_id,date,metrics,updated_at)
      VALUES(?1,?2,?3,?4) ON CONFLICT(user_id,date) DO UPDATE
      SET metrics=CASE WHEN excluded.updated_at>=rb_garmin_shadow.updated_at THEN json_patch(rb_garmin_shadow.metrics,(SELECT json_group_object(key,value) FROM json_each(excluded.metrics) WHERE type!='null')) ELSE rb_garmin_shadow.metrics END,updated_at=max(rb_garmin_shadow.updated_at,excluded.updated_at)`)
      .bind(userId,date,JSON.stringify(row),at).run();
    return true;
}

// One historical day per scheduled run. Missing dates are revisited after a week.
export async function backfillGarminDay(env){
  const userId=String(env.PRIMARY_USER_ID||'primary');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo'}).format(new Date());
  const candidate=await env.DB.prepare(`WITH RECURSIVE dates(d) AS (
    SELECT date(?1,'-3 days') UNION ALL SELECT date(d,'-1 day') FROM dates WHERE d>date(?1,'-89 days')
  ) SELECT d FROM dates LEFT JOIN rb_garmin_backfill_checks c ON c.user_id=?2 AND c.date=d
  WHERE c.checked_at IS NULL OR (c.has_data=0 AND date(c.checked_at)<=date(?1,'-7 days'))
  ORDER BY c.checked_at IS NOT NULL,d DESC LIMIT 1`).bind(today,userId).first();
  if(!candidate)return;
  const saved=await importHealthDate(env,userId,candidate.d,await getAccessToken(env,userId));
  await env.DB.prepare(`INSERT INTO rb_garmin_backfill_checks(user_id,date,checked_at,has_data)
    VALUES (?1,?2,?3,?4) ON CONFLICT(user_id,date) DO UPDATE SET checked_at=excluded.checked_at,has_data=excluded.has_data`)
    .bind(userId,candidate.d,new Date().toISOString(),saved?1:0).run();
}

export async function importGarminActivities(env){
  const user=String(env.PRIMARY_USER_ID||'primary');
  const token=await getAccessToken(env,user);
  const end=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo'}).format(new Date());
  const start=new Date(Date.parse(end+'T12:00:00Z')-2*86400000).toISOString().slice(0,10);
  const rows=await apiGet(token,'/activitylist-service/activities/search/activities?start=0&limit=100&startDate='+start+'&endDate='+end);
  if(!Array.isArray(rows)||rows.length===100)throw new Error('GARMIN_ACTIVITY_WINDOW_INCOMPLETE');
  const statements=[];
  for(const row of rows){
    const id=String(row.activityId||''),day=String(row.startTimeLocal||'').slice(0,10);
    if(!/^\d+$/.test(id)||!safeDate(day)||day<start||day>end)continue;
    const summary={sport:row.activityType?.typeKey||null,durationSeconds:firstNumber(row,['duration']),distanceM:firstNumber(row,['distance']),avgHr:firstNumber(row,['averageHR']),avgWatts:firstNumber(row,['avgPower','averagePower'])};
    statements.push(env.DB.prepare(`INSERT INTO rb_garmin_activity_shadow(user_id,activity_id,local_date,summary_json)
      VALUES(?1,?2,?3,?4) ON CONFLICT(user_id,activity_id) DO UPDATE SET
      local_date=excluded.local_date,summary_json=excluded.summary_json`).bind(user,id,day,JSON.stringify(summary)));
  }
  if(statements.length)await env.DB.batch(statements);
  await analyzeNextActivity(env,user,token);
  return statements.length;
}

async function analyzeNextActivity(env,user,token){
  const row=await env.DB.prepare(`SELECT activity_id FROM rb_garmin_activity_shadow
    WHERE user_id=?1 AND fit_analysis IS NULL AND (fit_attempt IS NULL OR fit_attempt<datetime('now','-1 day'))
    ORDER BY local_date DESC,activity_id DESC LIMIT 1`).bind(user).first();
  if(!row)return;
  const claim=await env.DB.prepare(`UPDATE rb_garmin_activity_shadow SET fit_attempt=datetime('now')
    WHERE user_id=?1 AND activity_id=?2 AND fit_analysis IS NULL AND (fit_attempt IS NULL OR fit_attempt<datetime('now','-1 day'))`).bind(user,row.activity_id).run();
  if(!claim.meta.changes)return;
  const response=await fetch(BASE+'/download-service/files/activity/'+row.activity_id,{redirect:'manual',headers:{Authorization:'Bearer '+token,Accept:'*/*'}});
  if(!response.ok)throw new Error('GARMIN_FIT_HTTP_'+response.status);
  const analysis=analyzeFit(await readBounded(response));
  await env.DB.prepare('UPDATE rb_garmin_activity_shadow SET fit_analysis=?3 WHERE user_id=?1 AND activity_id=?2')
    .bind(user,row.activity_id,JSON.stringify(analysis)).run();
}
