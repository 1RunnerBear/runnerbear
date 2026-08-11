import legacy from './index.js';

const BUILD='10.8.1';
const USER_ID='primary';
const TREDICT_SOURCE='tredict';
const TREDICT_STATE='tredict';
const LOCAL_STATE='localStorage';
const MIGRATION_STATE='migration';
const OUTBOUND_STATE='tredictOutbound';
const FRESH_MS=5*60*1000;
const MAX_LOCAL_KEYS=400;
const MAX_LOCAL_BYTES=1_500_000;
const MAX_BODY_BYTES=2_000_000;

function json(data,status=200){return Response.json(data,{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
function now(){return new Date().toISOString()}
function owner(env){return String(env.PRIMARY_USER_ID||USER_ID)}
function isoDate(value){const s=String(value||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:''}
function finite(value){const n=Number(value);return Number.isFinite(n)?n:null}
async function bodyJson(request){
  const declared=Number(request.headers.get('content-length')||0);if(declared>MAX_BODY_BYTES)throw new Error('Payload too large');
  if(!request.body)return{};const reader=request.body.getReader(),chunks=[];let total=0;
  while(true){const{done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BODY_BYTES){await reader.cancel('Payload too large');throw new Error('Payload too large')}chunks.push(value)}
  if(!total)return{};const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function session(request,env,ctx){
  const u=new URL(request.url);u.pathname='/api/session';u.search='';
  const r=await legacy.fetch(new Request(u,{method:'GET',headers:request.headers}),env,ctx);
  if(!r.ok)return null;
  try{return await r.json()}catch{return null}
}

async function upsertState(env,namespace,data){
  const t=now();
  await env.DB.prepare(`INSERT INTO rb_state (user_id, namespace, payload_json, updated_at) VALUES (?1,?2,?3,?4)
    ON CONFLICT(user_id, namespace) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at`)
    .bind(owner(env),namespace,JSON.stringify(data??{}),t).run();
  return t;
}

async function readState(env,namespace,fallback={}){
  const row=await env.DB.prepare('SELECT payload_json FROM rb_state WHERE user_id=?1 AND namespace=?2').bind(owner(env),namespace).first();
  if(!row?.payload_json)return fallback;
  try{return JSON.parse(row.payload_json)}catch{return fallback}
}

async function upsertSync(env,status,detail,lastSyncedAt=now()){
  const t=now();
  await env.DB.prepare(`INSERT INTO rb_sync_sources (user_id, source, last_synced_at, status, detail_json, updated_at)
    VALUES (?1,?2,?3,?4,?5,?6)
    ON CONFLICT(user_id, source) DO UPDATE SET last_synced_at=excluded.last_synced_at,status=excluded.status,
      detail_json=excluded.detail_json,updated_at=excluded.updated_at`)
    .bind(owner(env),TREDICT_SOURCE,lastSyncedAt,String(status||'ok').slice(0,32),JSON.stringify(detail||{}),t).run();
}

async function batch(db,statements,size=50){
  for(let i=0;i<statements.length;i+=size)await db.batch(statements.slice(i,i+size));
}

async function storeActivities(env,rows){
  if(!Array.isArray(rows)||!rows.length)return 0;
  const t=now(),id=owner(env);
  const stmt=env.DB.prepare(`INSERT INTO rb_activities (user_id, source, source_id, date, sport_type, sub_sport_type, title,
    duration_seconds, distance_m, pace_seconds_per_km, avg_hr, max_hr, power, cadence, payload_json, updated_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)
    ON CONFLICT(user_id, source, source_id) DO UPDATE SET date=excluded.date,sport_type=excluded.sport_type,
      sub_sport_type=excluded.sub_sport_type,title=excluded.title,duration_seconds=excluded.duration_seconds,
      distance_m=excluded.distance_m,pace_seconds_per_km=excluded.pace_seconds_per_km,avg_hr=excluded.avg_hr,
      max_hr=excluded.max_hr,power=excluded.power,cadence=excluded.cadence,payload_json=excluded.payload_json,
      updated_at=excluded.updated_at`);
  const statements=[];
  for(const a of rows){
    const sourceId=String(a?.id||'');const date=isoDate(a?.date);if(!sourceId||!date)continue;
    const s=a?.summary||{};
    statements.push(stmt.bind(id,TREDICT_SOURCE,sourceId,date,String(a?.sportType||''),String(a?.subSportType||''),String(a?.title||''),
      finite(s.duration),finite(s.distance),finite(s.pace),finite(s.heartrate),finite(s.heartrateMax),finite(s.power),finite(s.cadence),JSON.stringify(a),t));
  }
  if(statements.length)await batch(env.DB,statements);
  return statements.length;
}

async function storeCapacity(env,capacity){
  const rows=Array.isArray(capacity?.running)?capacity.running:[];
  if(!rows.length)return 0;
  const t=now(),id=owner(env);
  const stmt=env.DB.prepare(`INSERT INTO rb_capacity (user_id, timestamp, source, payload_json, updated_at)
    VALUES (?1,?2,?3,?4,?5)
    ON CONFLICT(user_id, timestamp, source) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at`);
  const statements=rows.map((r,i)=>stmt.bind(id,String(r?.timestamp||r?.date||`${t.slice(0,19)}.${String(i).padStart(3,'0')}Z`),TREDICT_SOURCE,JSON.stringify(r||{}),t));
  await batch(env.DB,statements);
  return statements.length;
}

function healthValue(source,key,index){
  const value=source?.[key];
  const selected=Array.isArray(value)?value[index]:value;
  return selected===null||selected===undefined?null:finite(selected);
}

async function storeHealth(env,cache){
  const hrv=cache?.hrv&&typeof cache.hrv==='object'?cache.hrv:{},sleep=cache?.sleep&&typeof cache.sleep==='object'?cache.sleep:{},body=Array.isArray(cache?.body)?cache.body:[];
  const rows=new Map(),put=(date,patch)=>{const ds=isoDate(String(date||'').replace(/^(\d{4})(\d{2})(\d{2}).*$/,'$1-$2-$3'));if(!ds)return;rows.set(ds,{...(rows.get(ds)||{}),...patch})};
  Object.keys(hrv).forEach(key=>put(key,{hrv:healthValue(hrv,key,0),hrvBaseline:healthValue(hrv,key,1)}));
  Object.keys(sleep).forEach(key=>put(key,{sleep:healthValue(sleep,key,0),sleepBaseline:healthValue(sleep,key,1)}));
  body.forEach(x=>put(x?.timestamp,{rhr:finite(x?.hrRestDynamic??x?.restingHeartrate)}));
  if(!rows.size)return 0;
  const t=now(),id=owner(env),stmt=env.DB.prepare(`INSERT INTO rb_health_daily (user_id,date,hrv_ms,sleep_seconds,rhr_bpm,payload_json,updated_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7)
    ON CONFLICT(user_id,date) DO UPDATE SET hrv_ms=excluded.hrv_ms,sleep_seconds=excluded.sleep_seconds,
      rhr_bpm=excluded.rhr_bpm,payload_json=excluded.payload_json,updated_at=excluded.updated_at`);
  await batch(env.DB,[...rows].map(([date,x])=>stmt.bind(id,date,x.hrv??null,x.sleep??null,x.rhr??null,JSON.stringify(x),t)));
  return rows.size;
}

function cacheFromSnapshot(s){
  return{
    activities:Array.isArray(s?.activities)?s.activities:[],
    hrv:s?.hrv||{},sleep:s?.sleep||{},body:Array.isArray(s?.body)?s.body:[],capacity:s?.capacity||{},zones:s?.zones||{},
    syncedAt:s?.syncedAt||now(),bridgeParts:Array.isArray(s?.parts)?s.parts:[],source:'runnerbear-cloud-v10.8.1'
  };
}

const STEP_INTENSITY=new Set(['warmup','active','recover','rest','cooldown','misc']);
const STEP_DURATION=new Set(['time','distance','open']);
const TARGET_ZONE=new Set(['cadence','heartrate','pace','power']);
const TARGET_MODE=new Set(['padding','range']);
function bounded(value,min,max,label){const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw new Error(`Invalid ${label}`);return n}
function text(value,max,label,required=false){const s=String(value||'').replace(/\s+/g,' ').trim();if(required&&!s)throw new Error(`${label} is required`);return s.slice(0,max)}
function sanitizeTargets(raw={}){
  const out={};
  for(const key of ['cadence','heartrate','pace','power'])if(raw?.[key])out[key]={value:bounded(raw[key].value,1,5000,`${key} target`),padding:bounded(raw[key].padding??0,0,1000,`${key} padding`)};
  for(const key of ['ftp','ftpa','hrMax'])if(raw?.[key])out[key]={from:bounded(raw[key].from,0,3,`${key} from`),to:bounded(raw[key].to,0,3,`${key} to`)};
  return out;
}
function sanitizeBaseStep(raw={}){
  const durationType=String(raw.durationType||'');if(!STEP_DURATION.has(durationType))throw new Error('Invalid durationType');
  const intensityType=String(raw.intensityType||'active');if(!STEP_INTENSITY.has(intensityType))throw new Error('Invalid intensityType');
  const out={note:text(raw.note,255,'step note'),intensityType,durationType};
  if(durationType==='time')out.duration=Math.round(bounded(raw.duration,1,86400,'step duration'));
  if(durationType==='distance')out.distance=Math.round(bounded(raw.distance,1,100000,'step distance'));
  if(raw.progressionType)out.progressionType=raw.progressionType==='ramp'?'ramp':'steady';
  if(raw.targetMode){if(!TARGET_MODE.has(raw.targetMode))throw new Error('Invalid targetMode');out.targetMode=raw.targetMode}
  if(raw.targetZoneType){if(!TARGET_ZONE.has(raw.targetZoneType))throw new Error('Invalid targetZoneType');out.targetZoneType=raw.targetZoneType}
  if(raw.targets)out.targets=sanitizeTargets(raw.targets);
  return out;
}
function sanitizeStep(raw={}){
  if(raw.repetitions!==undefined){
    const steps=Array.isArray(raw.steps)?raw.steps:[];if(!steps.length||steps.length>12)throw new Error('Invalid repetition steps');
    return{repetitions:Math.round(bounded(raw.repetitions,1,100,'repetitions')),steps:steps.map(sanitizeBaseStep)};
  }
  return sanitizeBaseStep(raw);
}
function sanitizeOutbound(input={}){
  const payload=input?.payload&&typeof input.payload==='object'?input.payload:{};
  const plan=payload?.plan&&typeof payload.plan==='object'?payload.plan:{};
  const rows=Array.isArray(payload.planTrainings)?payload.planTrainings:[];if(!rows.length||rows.length>80)throw new Error('Plan requires 1–80 workouts');
  const cleanRows=rows.map(row=>{
    const w=row?.structuredWorkout||{},steps=Array.isArray(w.steps)?w.steps:[];if(!steps.length||steps.length>80)throw new Error('Workout requires valid steps');
    return{day:Math.round(bounded(row.day,1,1024,'plan day')),time:Math.round(bounded(row.time??1020,0,1439,'workout time')),structuredWorkout:{title:text(w.title,255,'workout title',true),notes:text(w.notes,1024,'workout notes'),trainingType:'planned',sportType:'running',subSportType:'generic',steps:steps.map(sanitizeStep)}};
  });
  const source=input?.source&&typeof input.source==='object'?input.source:{};
  const startDate=isoDate(source.startDate),endDate=isoDate(source.endDate),externalIds=Array.isArray(source.externalIds)?source.externalIds.map(x=>text(x,160,'external id')).slice(0,80):[];
  if(!startDate||!endDate||endDate<startDate)throw new Error('Plan requires a valid date range');
  if(externalIds.length!==cleanRows.length||externalIds.some(x=>!x))throw new Error('Plan requires one stable external ID per workout');
  return{
    source:{version:'10.8.1',startDate,endDate,workoutCount:cleanRows.length,externalIds,clientSignature:text(source.clientSignature,64,'client signature')},
    payload:{plan:{title:text(plan.title,255,'plan title',true),description:text(plan.description,10240,'plan description',true),categories:['building','intensity','race_specific'],targetgroups:['intermediate'],zonetypes:['heartrate','pace'],language:'en'},planTrainings:cleanRows}
  };
}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value}
async function sha256(value){const bytes=new TextEncoder().encode(JSON.stringify(canonical(value))),hash=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function addIsoDays(ds,days){const d=new Date(`${ds}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+Number(days||0));return d.toISOString().slice(0,10)}
function publicOutbound(state={}){return{status:String(state.status||'not-published'),hash:String(state.hash||''),clientSignature:String(state.clientSignature||''),planId:String(state.planId||''),planTitle:String(state.planTitle||''),startDate:String(state.startDate||''),endDate:String(state.endDate||''),workoutCount:Number(state.workoutCount)||0,calendarCount:Number(state.calendarCount)||0,updatedAt:String(state.updatedAt||''),message:String(state.message||'')}}
async function outboundStatus(env){return publicOutbound(await readState(env,OUTBOUND_STATE,{}))}
async function verifyOutbound(env){
  if(!env.TREDICT)throw new Error('Tredict service binding missing');const state=await readState(env,OUTBOUND_STATE,{});
  if(!state.planId||!state.startDate||!state.endDate)throw new Error('No published Tredict plan to verify');
  const raw=await env.TREDICT.plannedWorkouts(`${state.startDate}T00:00:00.000Z`,`${state.endDate}T23:59:59.999Z`),rows=raw?._embedded?.plannedWorkoutList||raw?.plannedWorkoutList||[];
  const expected=Array.isArray(state.expected)?state.expected:[],matched=expected.filter(x=>rows.some(r=>isoDate(r?.date)===x.date&&(String(r?.notes||'').includes(`[RB:${x.externalId}]`)||String(r?.title||'')===x.title)));
  const active=expected.length>0&&matched.length===expected.length,next={...state,status:active?'calendar-active':'published',calendarCount:matched.length,updatedAt:now(),message:active?'Tredict-kalenderen inneholder alle RunnerBear-øktene. Garmin-synk styres videre av Tredict.':`${matched.length} av ${expected.length} RunnerBear-økter finnes i Tredict-kalenderen.`};
  await upsertState(env,OUTBOUND_STATE,next);return{ok:true,build:BUILD,active,...publicOutbound(next)};
}
async function outboundPlan(request,env,publish=false){
  if(!env.TREDICT)throw new Error('Tredict service binding missing');
  const bundle=sanitizeOutbound(await bodyJson(request)),hash=await sha256(bundle.payload),previous=await readState(env,OUTBOUND_STATE,{});
  const expected=bundle.payload.planTrainings.map((x,i)=>({date:addIsoDays(bundle.source.startDate,x.day-1),title:x.structuredWorkout.title,externalId:bundle.source.externalIds[i]||''}));
  const base={hash,clientSignature:bundle.source.clientSignature,planTitle:bundle.payload.plan.title,startDate:bundle.source.startDate,endDate:bundle.source.endDate,workoutCount:bundle.source.workoutCount,expected,updatedAt:now()};
  if(!publish)return{ok:true,build:BUILD,preview:true,...base,workouts:bundle.payload.planTrainings.map((x,i)=>({externalId:bundle.source.externalIds[i]||'',day:x.day,title:x.structuredWorkout.title,steps:x.structuredWorkout.steps.length}))};
  if(previous.hash===hash&&['published','calendar-active'].includes(previous.status)&&previous.planId)return{ok:true,build:BUILD,idempotent:true,...publicOutbound(previous)};
  if(previous.hash===hash&&previous.status==='publishing')return{ok:false,build:BUILD,error:'Publication already in progress',...publicOutbound(previous)};
  await upsertState(env,OUTBOUND_STATE,{...base,status:'publishing',message:'Publiserer strukturert plan til Tredict'});
  try{
    const result=await env.TREDICT.createPlan(bundle.payload),published={...base,status:'published',planId:String(result?.planId||''),message:'Planen er opprettet i Tredict. Aktiver den én gang i kalenderen for Garmin-synk.',publishedAt:now()};
    if(!published.planId)throw new Error('Tredict did not return planId');
    await upsertState(env,OUTBOUND_STATE,published);return{ok:true,build:BUILD,idempotent:false,...publicOutbound(published)};
  }catch(error){
    const failed={...base,status:'review-required',message:'Tredict-svaret var ikke sikkert. Kontroller før ny publisering.',error:error instanceof Error?error.message:String(error)};
    await upsertState(env,OUTBOUND_STATE,failed);throw error;
  }
}

async function syncTredict(env,{force=false,days=365}={}){
  if(!env.DB)throw new Error('D1 binding missing');
  if(!env.TREDICT)throw new Error('Tredict service binding missing');
  const existing=await env.DB.prepare('SELECT last_synced_at,status FROM rb_sync_sources WHERE user_id=?1 AND source=?2')
    .bind(owner(env),TREDICT_SOURCE).first();
  const age=Date.now()-Date.parse(existing?.last_synced_at||0);
  if(!force&&existing?.status==='ok'&&Number.isFinite(age)&&age>=0&&age<FRESH_MS)return{ok:true,skipped:true,lastSyncedAt:existing.last_synced_at};
  try{
    const snapshot=await env.TREDICT.snapshot(Math.max(30,Math.min(365,Number(days)||365)));
    const cache=cacheFromSnapshot(snapshot);
    const [activities,capacity,health]=await Promise.all([storeActivities(env,cache.activities),storeCapacity(env,cache.capacity),storeHealth(env,cache)]);
    await upsertState(env,TREDICT_STATE,cache);
    await upsertSync(env,'ok',{version:snapshot?.version||'',parts:cache.bridgeParts,activities,capacity,health},cache.syncedAt);
    return{ok:true,skipped:false,syncedAt:cache.syncedAt,activities,capacity,health,parts:cache.bridgeParts};
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    await upsertSync(env,'error',{message},existing?.last_synced_at||now());
    throw error;
  }
}

function safeLocalKey(key){
  const k=String(key||'');
  if(!/^(runnerbear_|runfest26_|rb)/i.test(k))return false;
  if(/(?:token|secret|bridge_key|api_key|access_aud|access_team|cloudflare)/i.test(k))return false;
  if(k==='runnerbear_bridge_url'||k==='runnerbear_tredict_cache_v1'||k==='runnerbear_tredict_last_sync')return false;
  if(/^runnerbear_cloud_/i.test(k))return false;
  return k.length<=160;
}

function filterLocalStorage(input){
  const source=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const out={};let bytes=0,count=0;
  for(const [key,value] of Object.entries(source)){
    if(!safeLocalKey(key)||typeof value!=='string')continue;
    const size=key.length+value.length;if(bytes+size>MAX_LOCAL_BYTES)break;
    out[key]=value;bytes+=size;count++;if(count>=MAX_LOCAL_KEYS)break;
  }
  return{data:out,count,bytes};
}

async function migrateLocal(request,env){
  const input=await bodyJson(request);
  const filtered=filterLocalStorage(input?.localStorage);
  const migratedAt=now();
  await upsertState(env,LOCAL_STATE,filtered.data);
  await upsertState(env,MIGRATION_STATE,{version:1,migratedAt,fromOrigin:String(input?.fromOrigin||''),keys:filtered.count,bytes:filtered.bytes});
  return{ok:true,build:BUILD,migratedAt,storedKeys:filtered.count,bytes:filtered.bytes};
}

async function decorateBootstrap(response,sync){
  if(!response.ok)return response;
  try{
    const body=await response.json();
    body.cloud={build:BUILD,sync:sync||null,authoritative:true};
    return json(body,200);
  }catch{return response}
}

async function health(request,env,ctx){
  const response=await legacy.fetch(request,env,ctx);
  if(!response.ok)return response;
  try{
    const body=await response.json();
    let rpc={ok:false,version:'',error:''};
    if(env.TREDICT){
      try{
        const check=await env.TREDICT.health();
        rpc={ok:check?.ok===true,version:String(check?.version||''),error:''};
      }catch(error){rpc={ok:false,version:'',error:error instanceof Error?error.message:String(error)}}
    }
    body.cloudBuild=BUILD;
    body.tredictService=!!env.TREDICT;
    body.tredictRpc=rpc.ok;
    body.tredictRpcVersion=rpc.version;
    if(rpc.error)body.tredictRpcError=rpc.error;
    return json(body);
  }catch{return response}
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'')||'/';

    if(request.method==='POST'&&path==='/api/sync/tredict'){
      const auth=await session(request,env,ctx);if(!auth)return json({ok:false,error:'Unauthorized'},401);
      try{return json({build:BUILD,...await syncTredict(env,{force:true,days:Number(url.searchParams.get('days')||365)})})}
      catch(error){return json({ok:false,build:BUILD,error:'Tredict sync failed',detail:error instanceof Error?error.message:String(error)},502)}
    }

    if(request.method==='GET'&&path==='/api/outbound/tredict/status'){
      const auth=await session(request,env,ctx);if(!auth)return json({ok:false,error:'Unauthorized'},401);
      return json({ok:true,build:BUILD,...await outboundStatus(env)});
    }

    if(request.method==='POST'&&path==='/api/outbound/tredict/verify'){
      const auth=await session(request,env,ctx);if(!auth)return json({ok:false,error:'Unauthorized'},401);
      try{return json(await verifyOutbound(env))}catch(error){return json({ok:false,build:BUILD,error:'Tredict calendar verification failed',detail:error instanceof Error?error.message:String(error)},502)}
    }

    if(request.method==='POST'&&(path==='/api/outbound/tredict/preview'||path==='/api/outbound/tredict/publish')){
      const auth=await session(request,env,ctx);if(!auth)return json({ok:false,error:'Unauthorized'},401);
      try{return json(await outboundPlan(request,env,path.endsWith('/publish')))}
      catch(error){return json({ok:false,build:BUILD,error:'Tredict plan publication failed',detail:error instanceof Error?error.message:String(error)},/invalid|required|requires/i.test(String(error))?400:502)}
    }

    if(request.method==='POST'&&path==='/api/migrate/local'){
      const auth=await session(request,env,ctx);if(!auth)return json({ok:false,error:'Unauthorized'},401);
      try{return json(await migrateLocal(request,env))}
      catch(error){return json({ok:false,error:'Migration failed',detail:error instanceof Error?error.message:String(error)},400)}
    }

    if(request.method==='GET'&&path==='/api/bootstrap'){
      const auth=await session(request,env,ctx);if(!auth)return json({ok:false,error:'Unauthorized'},401);
      let sync=null;
      try{sync=await syncTredict(env,{force:false,days:365})}catch(error){sync={ok:false,error:error instanceof Error?error.message:String(error)}}
      const response=await legacy.fetch(request,env,ctx);
      return decorateBootstrap(response,sync);
    }

    if(request.method==='GET'&&path==='/health')return health(request,env,ctx);

    return legacy.fetch(request,env,ctx);
  }
};
