import {localDay,addDays,median,finite,healthEvidence} from './health.js';
const json=(body,status,headers)=>Response.json(body,{status,headers:{'cache-control':'no-store',...headers}});
export function describeFocus(row,health=[],checkins=[],today=localDay(new Date())){
 if(!row)return null;
 const from=row.start_date,through=row.status==='active'?row.end_date:[row.end_date,localDay(row.updated_at)].sort()[0],elapsed=Math.max(0,Math.min(14,(Date.parse([today,through].sort()[0])-Date.parse(from))/86400000+1)),days=health.filter(r=>r.date>=from&&r.date<=through&&r.date<=today),reports=[...new Set(checkins.filter(r=>(r.local_date||r.date)>=from&&(r.local_date||r.date)<=through&&(r.local_date||r.date)<=today).map(r=>r.local_date||r.date))];
 const sleep=days.filter(r=>finite(r.sleep_seconds)!=null).map(r=>r.sleep_seconds),value=median(sleep),minutes=value==null?null:Math.round(value/60);
 const label=row.kind==='sleep_routine'?'En jevnere søvnrutine':'Følg kroppens respons',description=row.kind==='sleep_routine'?'Velg en leggetid som passer deg og prøv å holde en jevn rutine.':'Bruk en kort kroppssjekk etter relevante økter og ta med eventuell symptomrespons.';
 const observation=row.kind==='sleep_routine'?sleep.length?`Registrert søvnlengde har median ${Math.floor(minutes/60)} t ${String(minutes%60).padStart(2,'0')} min fra ${sleep.length} netter. Dagsverdiene bekrefter ikke hvor regelmessig leggetiden var.`:'Vi mangler søvnmålinger i perioden. Egen opplevelse er fortsatt relevant.':`${reports.length} av ${elapsed} dager har kroppssjekk. Manglende svar betyr ikke at kroppen var symptomfri.`;
 return{id:row.focus_id,kind:row.kind,status:row.status,from,through,label,description,elapsed,readyToReview:today>=through,observation,limitation:'Dette er et frivillig vanefokus. Observerte endringer beviser ikke effekt av tiltaket, og endrer ikke planen automatisk.'};
}
export async function readFocus(env,userId,snapshot){
 const row=await env.DB.prepare("SELECT * FROM rb_agent_focus WHERE user_id=?1 ORDER BY CASE WHEN status='active' THEN 0 ELSE 1 END,updated_at DESC,focus_id DESC LIMIT 1").bind(userId).first();
 if(!row)return null;
 const [health,checkins,shadow]=await Promise.all([env.DB.prepare('SELECT date,sleep_seconds FROM rb_health_daily WHERE user_id=?1 AND date>=?2 AND date<=?3 ORDER BY date').bind(userId,row.start_date,row.end_date).all(),env.DB.prepare('SELECT local_date FROM rb_subjective_checkins WHERE user_id=?1 AND local_date>=?2 AND local_date<=?3').bind(userId,row.start_date,row.end_date).all(),env.DB.prepare('SELECT date,metrics,updated_at FROM rb_garmin_shadow WHERE user_id=?1 AND date>=?2 AND date<=?3').bind(userId,row.start_date,row.end_date).all()]);
 return describeFocus(row,healthEvidence(health.results||[],shadow.results||[]),checkins.results||[]);
}
export async function writeFocus(request,env,{userId,bodyJson,corsHeaders={}}){
 if(String(env.RUNNERBEAR_AGENT_INSIGHTS||'true')==='false'||String(env.COACH_LOOP_KILL_SWITCH||'false')==='true')return json({ok:false,code:'AGENT_DISABLED'},409,corsHeaders);
 const b=await bodyJson(request);if(!b||Object.keys(b).some(k=>!['action','kind','focusId'].includes(k))||!['start','complete','dismiss'].includes(b.action))return json({ok:false,code:'INVALID_FOCUS'},400,corsHeaders);
 const now=new Date().toISOString(),today=localDay(now);
 if(b.action==='start'){
  if(!['sleep_routine','body_response'].includes(b.kind))return json({ok:false,code:'INVALID_FOCUS'},400,corsHeaders);
  await env.DB.prepare("INSERT OR IGNORE INTO rb_agent_focus(user_id,focus_id,kind,status,start_date,end_date,created_at,updated_at) VALUES(?1,?2,?3,'active',?4,?5,?6,?6)").bind(userId,crypto.randomUUID(),b.kind,today,addDays(today,13),now).run();
 }else{
  if(typeof b.focusId!=='string'||b.focusId.length>100)return json({ok:false,code:'INVALID_FOCUS'},400,corsHeaders);
  const existing=await env.DB.prepare("SELECT focus_id FROM rb_agent_focus WHERE user_id=?1 AND focus_id=?2 AND status='active'").bind(userId,b.focusId).first();if(!existing)return json({ok:false,code:'FOCUS_CHANGED'},409,corsHeaders);
  await env.DB.prepare("UPDATE rb_agent_focus SET status=?1,updated_at=?2 WHERE user_id=?3 AND focus_id=?4 AND status='active'").bind(b.action==='complete'?'completed':'dismissed',now,userId,b.focusId).run();
 }
 return json({ok:true,focus:await readFocus(env,userId),planChanged:false},200,corsHeaders);
}
