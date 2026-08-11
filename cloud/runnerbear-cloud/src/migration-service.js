import { WorkerEntrypoint } from 'cloudflare:workers';

const USER_ID='primary';
const LOCAL_STATE='localStorage';
const MIGRATION_STATE='migration';
const MAX_LOCAL_KEYS=400;
const MAX_LOCAL_BYTES=1_500_000;

function owner(env){return String(env.PRIMARY_USER_ID||USER_ID)}
function now(){return new Date().toISOString()}
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
async function upsertState(env,namespace,data){
  const t=now();
  await env.DB.prepare(`INSERT INTO rb_state (user_id, namespace, payload_json, updated_at) VALUES (?1,?2,?3,?4)
    ON CONFLICT(user_id, namespace) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at`)
    .bind(owner(env),namespace,JSON.stringify(data??{}),t).run();
  return t;
}

export class MigrationService extends WorkerEntrypoint {
  async health(){return{ok:!!this.env.DB,version:'9.8.3'}}
  async migrateLocal(input={}){
    if(!this.env.DB)throw new Error('D1 binding missing');
    const filtered=filterLocalStorage(input.localStorage);
    const migratedAt=now();
    await upsertState(this.env,LOCAL_STATE,filtered.data);
    await upsertState(this.env,MIGRATION_STATE,{version:2,migratedAt,fromOrigin:String(input.fromOrigin||''),keys:filtered.count,bytes:filtered.bytes,via:'bridge-rpc'});
    return{ok:true,build:'9.8.3',migratedAt,storedKeys:filtered.count,bytes:filtered.bytes};
  }
}
