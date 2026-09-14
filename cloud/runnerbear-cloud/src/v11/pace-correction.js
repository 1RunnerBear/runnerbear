// Append-only user corrections. Original activities, plans and transport are never written.
import { event } from './events.js';
const type='activity:pace-corrected';
const fail=(code,message,status=400)=>Object.assign(new Error(message),{code,status});
const stable=x=>JSON.stringify(Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))));
const latestSQL="SELECT event_id,payload_json,occurred_at FROM rb_training_events WHERE user_id=?1 AND event_type='activity:pace-corrected' AND json_extract(payload_json,'$.activitySource')=?2 AND json_extract(payload_json,'$.activityId')=?3 ORDER BY rowid DESC LIMIT 1";
export async function paceCorrections(db,userId,limit=400){
 const rows=await db.prepare(`WITH recent AS (SELECT source,source_id FROM rb_activities WHERE user_id=?1 ORDER BY date DESC,updated_at DESC LIMIT ?2), ranked AS (SELECT e.event_id,e.occurred_at,e.payload_json,ROW_NUMBER() OVER(PARTITION BY a.source,a.source_id ORDER BY e.rowid DESC) AS rank FROM rb_training_events e JOIN recent a ON a.source=json_extract(e.payload_json,'$.activitySource') AND a.source_id=json_extract(e.payload_json,'$.activityId') WHERE e.user_id=?1 AND e.event_type='activity:pace-corrected') SELECT * FROM ranked WHERE rank<=5 ORDER BY rank`).bind(userId,limit).all();
 return(rows.results||[]).map(r=>({eventId:r.event_id,savedAt:r.occurred_at,rank:r.rank,...JSON.parse(r.payload_json)}));
}
export async function savePaceCorrection(db,userId,input,key,now=new Date().toISOString()){
 const allowed=new Set(['activityId','activitySource','activityVersion','expectedEventId','scope','mode','paceSeconds']);
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.has(k)))throw fail('INVALID_CORRECTION','Ugyldig korrigering.');
 for(const k of ['activityId','activitySource','activityVersion'])if(typeof input[k]!=='string'||!input[k]||input[k].length>200)throw fail('INVALID_CORRECTION','Aktiviteten må være bekreftet.');
 if(typeof key!=='string'||!key||key.length>200||typeof input.expectedEventId!=='string'||input.expectedEventId.length>200||input.scope!=='work'||!['set','unreliable','clear'].includes(input.mode))throw fail('INVALID_CORRECTION','Ugyldig korrigeringsvalg.');
 if(input.mode==='set'?(!Number.isInteger(input.paceSeconds)||input.paceSeconds<60||input.paceSeconds>1200):Object.hasOwn(input,'paceSeconds'))throw fail('INVALID_CORRECTION','Oppgi arbeidsfart mellom 1:00 og 20:00 min/km.');
 const replay=await db.prepare("SELECT event_id,occurred_at,payload_json FROM rb_training_events WHERE user_id=?1 AND source='runnerbear' AND source_id=?2 AND event_type=?3").bind(userId,key,type).first();
 const receipt=row=>({ok:true,planChanged:false,correction:{eventId:row.event_id,savedAt:row.occurred_at,rank:1,...JSON.parse(row.payload_json)}});
 if(replay){if(stable(JSON.parse(replay.payload_json))!==stable(input))throw fail('CORRECTION_CONFLICT','Lagringsnøkkelen er allerede brukt.',409);return receipt(replay)}
 const activity=await db.prepare('SELECT date,sport_type,updated_at,payload_json FROM rb_activities WHERE user_id=?1 AND source=?2 AND source_id=?3').bind(userId,input.activitySource,input.activityId).first();
 if(!activity||activity.sport_type!=='running'||activity.updated_at!==input.activityVersion)throw fail('ACTIVITY_CHANGED','Aktivitetsgrunnlaget er oppdatert. Åpne økten på nytt.',409);
 const work=JSON.parse(activity.payload_json)?.detail?.analysis;
 if(input.mode!=='clear'&&!(work?.workBlocks?.length&&Number(work.workDuration)>0))throw fail('WORK_UNCONFIRMED','Arbeidsdelen er ikke sikkert skilt fra resten av økten.',409);
 const latest=await db.prepare(latestSQL).bind(userId,input.activitySource,input.activityId).first();
 if((latest?.event_id||'')!==input.expectedEventId||input.mode==='clear'&&(!latest||JSON.parse(latest.payload_json).mode==='clear'))throw fail('CORRECTION_CONFLICT','Korrigeringen er endret. Åpne økten på nytt.',409);
 const row=event({userId,type,sourceId:key,localDate:activity.date,payload:input,now});
 // Compare-and-append in the same SQLite statement prevents concurrent edits overwriting each other.
 await db.prepare(`INSERT INTO rb_training_events(event_id,user_id,event_type,occurred_at,local_date,source,source_id,payload_json,quality,ingested_at) SELECT ?1,?2,?3,?4,?5,'runnerbear',?6,?7,'medium',?4 WHERE COALESCE((SELECT event_id FROM rb_training_events WHERE user_id=?2 AND event_type=?3 AND json_extract(payload_json,'$.activitySource')=?8 AND json_extract(payload_json,'$.activityId')=?9 ORDER BY rowid DESC LIMIT 1),'')=?10 ON CONFLICT(user_id,source,source_id,event_type) DO NOTHING`).bind(row.eventId,userId,type,now,activity.date,key,JSON.stringify(input),input.activitySource,input.activityId,input.expectedEventId).run();
 const saved=await db.prepare("SELECT event_id,occurred_at,payload_json FROM rb_training_events WHERE user_id=?1 AND source='runnerbear' AND source_id=?2 AND event_type=?3").bind(userId,key,type).first();
 if(!saved||stable(JSON.parse(saved.payload_json))!==stable(input))throw fail('CORRECTION_CONFLICT','Korrigeringen er endret. Åpne økten på nytt.',409);
 return receipt(saved);
}
