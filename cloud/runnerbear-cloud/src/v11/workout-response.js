// Authenticated user input only. No plan, decision, feature flag or calendar writes.
import { activePlan,athleteConfig } from './repository.js';
import { event,eventStatement } from './events.js';
const fields=new Set(['activityId','activitySource','workoutId','planRevisionId','localDate','responseDate','responsePhase','control','rpe','pain','pain_increased']);
const fail=(code,message,status=400)=>Object.assign(new Error(message),{code,status});
const day=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value};
const stable=value=>JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))));
export async function saveWorkoutResponse(db,userId,input,key,now=new Date().toISOString()){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!fields.has(k)))throw fail('INVALID_RESPONSE','Ugyldig øktsvar.');
  if(typeof key!=='string'||!key||key.length>200)throw fail('INVALID_RESPONSE','Svaret mangler en gyldig lagringsnøkkel.');
  for(const k of ['activityId','activitySource','workoutId','planRevisionId'])if(typeof input[k]!=='string'||!input[k]||input[k].length>200)throw fail('INVALID_RESPONSE','Økten må være bekreftet før svaret lagres.');
  if(!day(input.localDate)||!day(input.responseDate)||!['post_workout','next_morning'].includes(input.responsePhase))throw fail('INVALID_RESPONSE','Datoen for øktsvaret kunne ikke bekreftes.');
  if('control' in input&&!['controlled','borderline','uncontrolled'].includes(input.control))throw fail('INVALID_RESPONSE','Velg opplevd kontroll.');
  for(const [k,min] of [['rpe',1],['pain',0]])if(k in input&&(!Number.isInteger(input[k])||input[k]<min||input[k]>10))throw fail('INVALID_RESPONSE','Svaret er utenfor gyldig skala.');
  if('pain_increased' in input&&typeof input.pain_increased!=='boolean')throw fail('INVALID_RESPONSE','Ugyldig smerterespons.');
  if(!['control','rpe','pain','pain_increased'].some(k=>input[k]!=null))throw fail('INVALID_RESPONSE','Velg et svar før du lagrer.');
  const existing=await db.prepare("SELECT event_id,payload_json,occurred_at FROM rb_training_events WHERE user_id=?1 AND source='runnerbear' AND source_id=?2 AND event_type='feedback:workout'").bind(userId,key).first();
  if(existing){const stored=JSON.parse(existing.payload_json);delete stored.sourceId;if(stable(stored)!==stable(input))throw fail('RESPONSE_CONFLICT','Dette svaret er allerede lagret med annet innhold.',409);return{ok:true,eventId:existing.event_id,savedAt:existing.occurred_at,idempotent:true,planChanged:false}}
  const [plan,config,activity]=await Promise.all([activePlan(db,userId),athleteConfig(db,userId),db.prepare('SELECT date FROM rb_activities WHERE user_id=?1 AND source=?2 AND source_id=?3').bind(userId,input.activitySource,input.activityId).first()]);
  if(!plan||plan.planRevisionId!==input.planRevisionId)throw fail('PLAN_REVISION_CONFLICT','Planen er oppdatert. Åpne økten på nytt før du lagrer.',409);
  const workout=plan.items.find(p=>p.workoutId===input.workoutId&&p.localDate===input.localDate),today=new Intl.DateTimeFormat('en-CA',{timeZone:config?.timezone||'Europe/Oslo'}).format(new Date(now)),age=(Date.parse(today+'T12:00:00Z')-Date.parse(input.localDate+'T12:00:00Z'))/86400000;
  if(!workout||!activity||activity.date!==input.localDate||input.responseDate!==today||age<0||age>7||input.responsePhase==='next_morning'&&age!==1)throw fail('RESPONSE_ACTIVITY_MISMATCH','Svaret må gjelde en bekreftet, nylig gjennomført økt.',409);
  const row=event({userId,type:'feedback:workout',sourceId:key,localDate:input.localDate,payload:{...input,sourceId:key},now});await eventStatement(db,row).run();
  const saved=await db.prepare("SELECT event_id,occurred_at,payload_json FROM rb_training_events WHERE user_id=?1 AND source='runnerbear' AND source_id=?2 AND event_type='feedback:workout'").bind(userId,key).first(),payload=JSON.parse(saved.payload_json);delete payload.sourceId;
  if(stable(payload)!==stable(input))throw fail('RESPONSE_CONFLICT','Dette svaret er allerede lagret med annet innhold.',409);
  return{ok:true,eventId:saved.event_id,savedAt:saved.occurred_at,idempotent:false,planChanged:false};
}
