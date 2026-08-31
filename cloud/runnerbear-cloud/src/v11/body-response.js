import { assessLoad } from './load-model.js';

export const BODY_RESPONSE_VERSION='body-response-1';
export const BODY_RESPONSE_POLICY='body-response-policy-1';
const BASELINE_DAYS=28,MIN_BASELINE_DAYS=10;
const finite=value=>{const number=Number(value);return Number.isFinite(number)?number:null};
const parse=(value,fallback)=>{try{return JSON.parse(value)}catch{return fallback}};
const median=values=>{const rows=values.map(finite).filter(value=>value!=null).sort((a,b)=>a-b),middle=Math.floor(rows.length/2);return rows.length?(rows.length%2?rows[middle]:(rows[middle-1]+rows[middle])/2):null};
const mad=(values,center=median(values))=>center==null?null:median(values.map(value=>Math.abs(Number(value)-center)));
const hours=(newer,older)=>(Date.parse(newer)-Date.parse(older))/3600000;
const metricValue=(row,key)=>finite(row?.[key]);
const metricSummary=(rows,key,unit)=>{
  const current=metricValue(rows[0],key),baselineRows=rows.slice(1,BASELINE_DAYS+1).map(row=>metricValue(row,key)).filter(value=>value!=null),baseline=median(baselineRows),recent7=rows.slice(0,7).map(row=>metricValue(row,key)).filter(value=>value!=null),recent28=rows.slice(0,28).map(row=>metricValue(row,key)).filter(value=>value!=null),sampleCount=baselineRows.length;
  return{current,unit,baseline,baselineMad:mad(baselineRows,baseline),trend7:median(recent7),trend28:median(recent28),sampleCount,baselineQuality:sampleCount>=14?'established':sampleCount>=MIN_BASELINE_DAYS?'usable':'building'};
};
const statusRank=Object.freeze({unknown:0,normal:1,watch:2,negative:3});
const worst=(...values)=>values.sort((a,b)=>(statusRank[b]||0)-(statusRank[a]||0))[0]||'unknown';
const stateLabel=Object.freeze({as_planned:'Planen støttes',watch:'Følg med – planen står',adjust:'Dosen bør ned',recover:'Kroppen trenger avklaring',wait_for_data:'Venter på ferske data'});
const reasonText=Object.freeze({LOW_HRV:'HRV ligger lavere enn din personlige normal.',PERSISTENT_LOW_HRV:'HRV har ligget lavt flere netter.',HIGH_RHR:'Hvilepulsen ligger høyere enn din personlige normal.',POOR_SLEEP:'Søvnen ligger lavere enn din personlige normal.',POST_WORKOUT_LOAD:'Forrige økt kostet mer enn ønsket.',SUBJECTIVE_FATIGUE:'Egenfølelsen tilsier ekstra margin.',ILLNESS:'Sykdomsfølelse må avklares før belastning.',PAIN:'Smerte må avklares før belastning.',STALE_HEALTH:'Helsedataene er ikke ferske nok.',MISSING_HEALTH:'RunnerBear bygger fortsatt din personlige normal.'});

function freshnessFor(rows,syncedAt,now){
  const latest=rows[0],measuredAt=latest?.date?`${latest.date}T06:00:00.000Z`:null;
  if(!measuredAt)return{status:'stale',measuredAt:null,syncedAt:syncedAt||null,measurementAgeHours:null,syncAgeHours:syncedAt?Math.max(0,hours(now,syncedAt)):null};
  const measurementAgeHours=Math.max(0,hours(now,measuredAt)),syncAgeHours=syncedAt?Math.max(0,hours(now,syncedAt)):null,status=measurementAgeHours<=18&&syncAgeHours!=null&&syncAgeHours<=6?'fresh':measurementAgeHours<=36&&syncAgeHours!=null?'partial':'stale';
  return{status,measuredAt,syncedAt:syncedAt||null,measurementAgeHours:Math.round(measurementAgeHours*10)/10,syncAgeHours:syncAgeHours==null?null:Math.round(syncAgeHours*10)/10};
}
function persistentLow(rows,key,baseline,ratio){
  if(!baseline)return false;const recent=rows.slice(0,3).map(row=>metricValue(row,key)).filter(value=>value!=null);return recent.length>=2&&recent.slice(0,2).every(value=>value/baseline<ratio);
}
function domain(id,label,status,summary,evidence=[],reasonCodes=[]){return{id,label,status,summary,evidence,reasonCodes,vote:status==='negative'?1:0}}
function inferredSubjective(raw={}){
  const reasons=Array.isArray(raw.reasons)?raw.reasons.filter(Boolean):[],pain=finite(raw.pain),illness=raw.illness===true||reasons.includes('illness'),hasPain=pain!=null&&pain>=3||raw.pain_increased===true||reasons.includes('achilles'),state=['fresh','tired','heavy'].includes(raw.state)?raw.state:illness||hasPain?'heavy':raw.stress===true||raw.poor_sleep===true||reasons.includes('stress')||reasons.includes('poor_sleep')?'tired':'unknown';
  return{state,reasons,illness,pain:hasPain?Math.max(3,pain||0):pain,stress:raw.stress===true||reasons.includes('stress'),poorSleep:raw.poor_sleep===true||reasons.includes('poor_sleep'),occurredAt:raw.occurredAt||raw.occurred_at||raw.updatedAt||raw.updated_at||null,sourceId:raw.sourceId||raw.source_id||''};
}
function actionFor(state,todayWorkout){
  if(state==='wait_for_data')return{kind:'wait_for_data',label:'Oppdateres automatisk',maximumDose:'planned',reductionPercent:0};
  if(state==='recover')return{kind:'needs_input',label:'Avklar kroppen før økten',maximumDose:'planned',reductionPercent:0};
  if(state==='adjust'){const quality=['quality','race'].includes(todayWorkout?.workoutType);return{kind:quality?'reduce_repetitions':'reduce_duration',label:quality?'Reduser dagens kvalitetsdose':'Kort ned dagens rolige økt',maximumDose:'planned',reductionPercent:20}}
  if(state==='watch')return{kind:'keep_with_margin',label:'Følg planen med ekstra margin',maximumDose:'planned',reductionPercent:0};
  return{kind:'keep',label:'Følg dagens plan',maximumDose:'planned',reductionPercent:0};
}

export function buildBodyResponse({snapshotId='',planRevisionId='',inputCursor='',healthRows=[],syncedAt=null,subjective={},yesterdayLoad={},todayWorkout=null,now=new Date().toISOString()}={}){
  const rows=(Array.isArray(healthRows)?healthRows:[]).map(row=>({...row,payload:row?.payload||parse(row?.payload_json,{})})).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))),hrv=metricSummary(rows,'hrv_ms','ms'),sleep=metricSummary(rows,'sleep_seconds','seconds'),rhr=metricSummary(rows,'rhr_bpm','bpm'),freshness=freshnessFor(rows,syncedAt||rows[0]?.updated_at,now),reported=inferredSubjective(subjective),reasonCodes=[];
  const hrvRatio=hrv.current!=null&&hrv.baseline?hrv.current/hrv.baseline:null,rhrDelta=rhr.current!=null&&rhr.baseline!=null?rhr.current-rhr.baseline:null,sleepRatio=sleep.current!=null&&sleep.baseline?sleep.current/sleep.baseline:null,persistentHrv=persistentLow(rows,'hrv_ms',hrv.baseline,.9),persistentRhr=rhr.baseline!=null&&rows.slice(0,2).filter(row=>metricValue(row,'rhr_bpm')!=null).length>=2&&rows.slice(0,2).every(row=>metricValue(row,'rhr_bpm')-rhr.baseline>=4);
  let autonomicStatus=hrvRatio==null&&rhrDelta==null?'unknown':hrvRatio!=null&&hrvRatio<.85||rhrDelta!=null&&rhrDelta>=5?'negative':hrvRatio!=null&&hrvRatio<.93||rhrDelta!=null&&rhrDelta>=3?'watch':'normal';
  const autonomicReasons=[];if(hrvRatio!=null&&hrvRatio<.85)autonomicReasons.push('LOW_HRV');if(persistentHrv)autonomicReasons.push('PERSISTENT_LOW_HRV');if(rhrDelta!=null&&rhrDelta>=5)autonomicReasons.push('HIGH_RHR');reasonCodes.push(...autonomicReasons);
  const sleepStatus=sleepRatio==null?'unknown':sleepRatio<.8||sleep.current<21600?'negative':sleepRatio<.9?'watch':'normal',sleepReasons=sleepStatus==='negative'?['POOR_SLEEP']:[];reasonCodes.push(...sleepReasons);
  const highLoad=yesterdayLoad.highCost===true||finite(yesterdayLoad.easyCost)>=.65||finite(yesterdayLoad.qualityCost)>=.75,loadStatus=Object.keys(yesterdayLoad||{}).length===0?'unknown':highLoad?'negative':'normal',loadReasons=highLoad?['POST_WORKOUT_LOAD']:[];reasonCodes.push(...loadReasons);
  const safetyReasons=[];if(reported.illness)safetyReasons.push('ILLNESS');if(reported.pain!=null&&reported.pain>=3)safetyReasons.push('PAIN');reasonCodes.push(...safetyReasons);
  const subjectiveStatus=reported.state==='heavy'?'negative':reported.state==='tired'?'watch':reported.state==='fresh'?'normal':'unknown',subjectiveReasons=subjectiveStatus==='negative'?['SUBJECTIVE_FATIGUE']:[];reasonCodes.push(...subjectiveReasons);
  const domains=[
    domain('autonomic','HRV og hvilepuls',autonomicStatus,autonomicStatus==='unknown'?'Venter på sammenlignbare målinger':autonomicStatus==='normal'?'Innenfor din personlige normal':persistentHrv||persistentRhr?'Vedvarende avvik fra din normal':'Ett autonomt signal følges',[{metric:'hrv',current:hrv.current,baseline:hrv.baseline,ratio:hrvRatio},{metric:'resting_hr',current:rhr.current,baseline:rhr.baseline,delta:rhrDelta}],autonomicReasons),
    domain('sleep','Søvn',sleepStatus,sleepStatus==='unknown'?'Venter på søvndata':sleepStatus==='normal'?'Søvnen støtter planlagt belastning':sleepStatus==='watch'?'Litt under din normal':'Tydelig under din normal',[{metric:'sleep',current:sleep.current,baseline:sleep.baseline,ratio:sleepRatio}],sleepReasons),
    domain('load','Faktisk belastning',loadStatus,loadStatus==='unknown'?'Bygges fra siste gjennomførte økt':loadStatus==='normal'?'Siste belastning ser kontrollert ut':'Siste økt kostet mer enn ønsket',[{metric:'previous_session_load',value:yesterdayLoad}],loadReasons),
    domain('subjective','Egenfølelse',subjectiveStatus,reported.state==='fresh'?'Meldt som normalt':reported.state==='tired'?'Meldt som litt redusert':reported.state==='heavy'?'Meldt som klart redusert':'Ikke meldt i dag',[{metric:'body_checkin',value:reported.state,measuredAt:reported.occurredAt}],subjectiveReasons),
    domain('safety','Sikkerhet',safetyReasons.length?'negative':'normal',safetyReasons.length?'Sykdom eller smerte må avklares':'Ingen eksplisitte sikkerhetssignaler',[{metric:'illness',value:reported.illness},{metric:'pain',value:reported.pain}],safetyReasons),
  ];
  const negativeDomains=domains.filter(row=>row.vote===1&&row.id!=='safety').length,baselineCounts=[hrv.sampleCount,sleep.sampleCount,rhr.sampleCount].filter(Boolean),baselineEstablished=baselineCounts.length>0&&Math.max(...baselineCounts)>=MIN_BASELINE_DAYS,persistent=Boolean(persistentHrv||persistentRhr),conflict=subjectiveStatus==='normal'&&negativeDomains>0||subjectiveStatus==='negative'&&domains.slice(0,3).every(row=>['normal','unknown'].includes(row.status));
  let state='as_planned';if(safetyReasons.length)state='recover';else if(!rows.length||freshness.status==='stale')state='wait_for_data';else if(negativeDomains>=2||persistent)state='adjust';else if(domains.some(row=>['watch','negative'].includes(row.status))||freshness.status==='partial'||!baselineEstablished)state='watch';
  const missing=domains.slice(0,4).filter(row=>row.status==='unknown').map(row=>row.id),missingCritical=!rows.length||freshness.status==='stale'||autonomicStatus==='unknown'&&sleepStatus==='unknown',checkInRequired=safetyReasons.length>0||conflict||missingCritical,confidence=freshness.status==='fresh'&&baselineEstablished?'high':rows.length?'medium':'low',uniqueReasons=[...new Set(reasonCodes)];if(freshness.status==='stale')uniqueReasons.push(rows.length?'STALE_HEALTH':'MISSING_HEALTH');
  const summary=state==='as_planned'?'Kroppssignalene støtter planlagt dose. RunnerBear øker aldri økten på grunn av et godt helsebilde.':state==='watch'?'Planen står, men gjennomfør uten bonusarbeid og med ekstra margin.':state==='adjust'?'Responsen tilsier en mindre dose i dag. Resten av uken vurderes på nytt i morgen.':state==='recover'?'Belastningen bør ikke avgjøres før sykdom, smerte eller samlet respons er avklart.':'RunnerBear viser ikke grønt lys før helsedataene er ferske nok.';
  const coachFlags=[...(uniqueReasons.includes('LOW_HRV')?['hrv']:[]),...(uniqueReasons.includes('POOR_SLEEP')?['sleep']:[]),...(uniqueReasons.includes('HIGH_RHR')?['rhr']:[])];
  return{version:BODY_RESPONSE_VERSION,policyVersion:BODY_RESPONSE_POLICY,snapshotId,planRevisionId,inputCursor,state,stateLabel:stateLabel[state],confidence,summary,recommendedAction:actionFor(state,todayWorkout),freshness,baselineStatus:{status:baselineEstablished?'established':'building',windowDays:BASELINE_DAYS,minDays:MIN_BASELINE_DAYS,sampleCount:baselineCounts.length?Math.max(...baselineCounts):0,method:'personal_median_mad'},metrics:{hrv,sleep,rhr},domains,reasonCodes:uniqueReasons,reasonText:uniqueReasons.map(code=>reasonText[code]).filter(Boolean),checkIn:{required:checkInRequired,prompt:safetyReasons.length?'Hvordan kjennes kroppen akkurat nå?':conflict?'Data og egenfølelse peker i ulik retning. Hvordan kjennes kroppen?':'Hjelp coachen med én kort kroppssjekk.',options:[{value:'fresh',label:'Som normalt'},{value:'tired',label:'Litt redusert'},{value:'heavy',label:'Klart redusert'}]},generatedAt:now,subjectiveInput:{...reported,reasons:[...reported.reasons,...safetyReasons.map(code=>code==='ILLNESS'?'illness':'achilles')]},coachInput:{measuredAt:freshness.measuredAt,syncedAt:freshness.syncedAt,freshness:freshness.status,hrvRatio:hrvRatio??1,sleepRatio:sleepRatio??1,rhrDelta:rhrDelta??0,sampleCount:Math.max(0,...baselineCounts),baselineEstablished,flags:coachFlags,bodyResponseState:state,bodyResponseReasonCodes:uniqueReasons,domainVotes:negativeDomains,inputVersion:inputCursor},yesterdayLoad};
}

async function digest(value){const data=new TextEncoder().encode(String(value)),hash=await crypto.subtle.digest('SHA-256',data);return[...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
async function persistSnapshot(db,userId,response){
  const now=response.generatedAt,statements=[db.prepare(`INSERT INTO rb_body_response_snapshots(snapshot_id,user_id,plan_revision_id,input_cursor,state,confidence,reason_codes_json,domains_json,recommendation_json,freshness_json,baseline_status_json,policy_version,generated_at,valid_until)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)
    ON CONFLICT(snapshot_id) DO UPDATE SET state=excluded.state,confidence=excluded.confidence,reason_codes_json=excluded.reason_codes_json,domains_json=excluded.domains_json,recommendation_json=excluded.recommendation_json,freshness_json=excluded.freshness_json,baseline_status_json=excluded.baseline_status_json,generated_at=excluded.generated_at,valid_until=excluded.valid_until`).bind(response.snapshotId,userId,response.planRevisionId,response.inputCursor,response.state,response.confidence,JSON.stringify(response.reasonCodes),JSON.stringify(response.domains),JSON.stringify(response.recommendedAction),JSON.stringify(response.freshness),JSON.stringify(response.baselineStatus),response.policyVersion,now,new Date(Date.parse(now)+6*3600000).toISOString())];
  for(const [metric,row] of Object.entries(response.metrics))if(row.baseline!=null)statements.push(db.prepare(`INSERT INTO rb_health_baseline_snapshots(snapshot_id,user_id,metric,window_days,value,mad,sample_count,quality,input_cursor,as_of,created_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11) ON CONFLICT(user_id,metric,window_days,input_cursor) DO NOTHING`).bind(`${response.snapshotId}:${metric}`,userId,metric,BASELINE_DAYS,row.baseline,row.baselineMad,row.sampleCount,row.baselineQuality,response.inputCursor,response.freshness.measuredAt||now,now));
  await db.batch(statements);
}

export async function bodyResponseFor(db,userId,{plan={},today='',now=new Date().toISOString(),persist=true}={}){
  const localDate=today||now.slice(0,10),yesterday=new Date(Date.parse(`${localDate}T12:00:00Z`)-86400000).toISOString().slice(0,10),previous=plan?.items?.find(item=>item.localDate===yesterday)||null,todayWorkout=plan?.items?.find(item=>item.localDate===localDate)||null;
  const [health,sync,checkIn,feedback,activity]=await Promise.all([
    db.prepare('SELECT date,hrv_ms,sleep_seconds,rhr_bpm,payload_json,updated_at FROM rb_health_daily WHERE user_id=?1 ORDER BY date DESC LIMIT 29').bind(userId).all(),
    db.prepare("SELECT last_synced_at,status,updated_at FROM rb_sync_sources WHERE user_id=?1 AND source IN ('tredict','garmin') ORDER BY updated_at DESC LIMIT 1").bind(userId).first(),
    db.prepare('SELECT source_id,local_date,state,reasons_json,occurred_at,updated_at FROM rb_subjective_checkins WHERE user_id=?1 ORDER BY occurred_at DESC LIMIT 1').bind(userId).first(),
    db.prepare("SELECT source_id,occurred_at,payload_json FROM rb_training_events WHERE user_id=?1 AND event_type='feedback:workout' ORDER BY occurred_at DESC LIMIT 1").bind(userId).first(),
    db.prepare('SELECT * FROM rb_activities WHERE user_id=?1 AND date=?2 ORDER BY updated_at DESC LIMIT 1').bind(userId,yesterday).first(),
  ]);
  const rows=health.results||[],feedbackValue=parse(feedback?.payload_json,{}),checkInValue=checkIn?{state:checkIn.state,reasons:parse(checkIn.reasons_json,[]),occurredAt:checkIn.occurred_at,sourceId:checkIn.source_id}:{},selectedSubjective=Date.parse(checkIn?.occurred_at||0)>=Date.parse(feedback?.occurred_at||0)?checkInValue:{...feedbackValue,occurredAt:feedback?.occurred_at,sourceId:feedback?.source_id},subjective=selectedSubjective.occurredAt&&hours(now,selectedSubjective.occurredAt)<=36?selectedSubjective:{},yesterdayLoad=previous&&activity?{...assessLoad({workout:previous,activity:{sportType:activity.sport_type,distanceM:activity.distance_m,durationSeconds:activity.duration_seconds,avgHr:activity.avg_hr,detail:parse(activity.payload_json,{})?.detail}}),measuredAt:activity.date,sourceId:activity.source_id}:{};
  const healthCursor=await digest(JSON.stringify(rows.map(row=>[row.date,row.hrv_ms,row.sleep_seconds,row.rhr_bpm,row.updated_at]))),inputCursor=[plan?.planRevisionId||'no-plan',localDate,healthCursor,sync?.status||'no-sync',sync?.last_synced_at||'',sync?.updated_at||'',checkIn?.source_id||feedback?.source_id||'no-checkin',activity?.source_id||'no-activity',activity?.updated_at||''].join(':'),snapshotId=`br-${(await digest(`${userId}:${inputCursor}`)).slice(0,24)}`,healthySyncAt=sync?sync.status==='ok'?sync.last_synced_at:null:rows[0]?.updated_at||null,response=buildBodyResponse({snapshotId,planRevisionId:plan?.planRevisionId||'',inputCursor,healthRows:rows,syncedAt:healthySyncAt,subjective,yesterdayLoad,todayWorkout,now});
  if(persist&&response.planRevisionId)await persistSnapshot(db,userId,response);return response;
}

export function publicBodyResponse(response,{includeHistory=false,healthRows=[]}={}){
  if(!response)return null;const{coachInput,subjectiveInput,yesterdayLoad,...visible}=response;return includeHistory?{...visible,history:(healthRows||[]).map(row=>({date:row.date,hrv:finite(row.hrv_ms),sleep:finite(row.sleep_seconds),rhr:finite(row.rhr_bpm)}))}:visible;
}
