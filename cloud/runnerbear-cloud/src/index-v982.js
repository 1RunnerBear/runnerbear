import legacy from './index.js';

const BUILD='10.8';
const USER_ID='primary';
const TREDICT_SOURCE='tredict';
const TREDICT_STATE='tredict';
const LOCAL_STATE='localStorage';
const MIGRATION_STATE='migration';
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
    syncedAt:s?.syncedAt||now(),bridgeParts:Array.isArray(s?.parts)?s.parts:[],source:'runnerbear-cloud-v10.8'
  };
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
