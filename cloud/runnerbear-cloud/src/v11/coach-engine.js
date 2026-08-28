import { HEALTH_TTL,POLICY_VERSION } from './constants.js';
import { clamp,finite } from './validation.js';
const hours=(a,b)=>(Date.parse(a)-Date.parse(b))/3600000;
export function healthFreshness(health={},now=new Date().toISOString()){
  if(['fresh','partial','stale'].includes(health.freshness))return health.freshness;
  const measured=health.measuredAt||health.measured_at||'',synced=health.syncedAt||health.synced_at||'';
  if(!measured||hours(now,measured)>HEALTH_TTL.partialMeasurementHours)return'stale';
  if(hours(now,measured)<=HEALTH_TTL.freshMeasurementHours&&synced&&hours(now,synced)<=HEALTH_TTL.freshSyncHours)return'fresh';
  return'partial';
}
export function decideCoach({planRevisionId='',inputCursor='',todayWorkout=null,health={},subjective={},yesterdayLoad={},now=new Date().toISOString(),policyVersion=POLICY_VERSION}={}){
  const freshness=healthFreshness(health,now),reasonCodes=[],evidence=[],flags=[];
  const hrvRatio=finite(health.hrvRatio,1),sleepRatio=finite(health.sleepRatio,1),rhrDelta=finite(health.rhrDelta,0);
  if(hrvRatio<.85){flags.push('hrv');reasonCodes.push('LOW_HRV')}if(sleepRatio<.85){flags.push('sleep');reasonCodes.push('POOR_SLEEP')}if(rhrDelta>=5){flags.push('rhr');reasonCodes.push('HIGH_RHR')}
  for(const code of health.bodyResponseReasonCodes||[])if(!reasonCodes.includes(code))reasonCodes.push(code);
  evidence.push({metric:'health_freshness',value:freshness,measuredAt:health.measuredAt||null,ingestedAt:health.syncedAt||null,quality:freshness});
  if(Number(yesterdayLoad.volumeRatio)>0)evidence.push({metric:'previous_session_load',value:{volumeRatio:yesterdayLoad.volumeRatio,easyCost:yesterdayLoad.easyCost||0,qualityCost:yesterdayLoad.qualityCost||0},measuredAt:yesterdayLoad.measuredAt||null,quality:yesterdayLoad.sourceConfidence||'summary'});
  if(subjective.rpe!=null||subjective.control||subjective.pain!=null)evidence.push({metric:'athlete_response',value:{rpe:subjective.rpe??null,control:subjective.control||null,pain:subjective.pain??null},measuredAt:subjective.occurredAt||null,quality:'high'});
  if(subjective.illness===true||subjective.reasons?.includes('illness'))reasonCodes.push('ILLNESS');
  if(finite(subjective.pain)>=3||subjective.reasons?.includes('achilles'))reasonCodes.push('PAIN');
  const baselineReady=health.baselineEstablished===true||Number(health.sampleCount)>=HEALTH_TTL.minBaselineDays,baseConfidence=freshness==='fresh'&&baselineReady?'high':freshness==='stale'?'low':'medium',decision={decisionId:`dec-${crypto.randomUUID()}`,planRevisionId,inputCursor:String(inputCursor||now),type:'keep',status:'proposed',confidence:baseConfidence,reasonCodes,evidence,action:{affectedWorkoutIds:todayWorkout?.workoutId?[todayWorkout.workoutId]:[],change:{kind:'none'}},explanation:{title:'Planen står',summary:yesterdayLoad.volumeRatio?'Responsvinduet er vurdert; belastning og kroppssignaler støtter dagens plan.':'Dagens signaler krever ingen endring.',weekImpact:'Resten av uken står uendret.'},policyVersion,validUntil:new Date(Date.parse(now)+6*3600000).toISOString()};
  if(!todayWorkout)return{...decision,type:'wait_for_data',confidence:'low',explanation:{title:'Ingen økt å vurdere',summary:'RunnerBear finner ingen aktiv økt for i dag.',weekImpact:'Planen er ikke endret.'}};
  if(reasonCodes.includes('ILLNESS')||reasonCodes.includes('PAIN'))return{...decision,type:'needs_input',confidence:'high',explanation:{title:'Trenger ett valg fra deg',summary:'Sykdom eller smerte skal ikke håndteres som vanlig formvariasjon.',weekImpact:'Ingen fremtidig økt endres før dette er avklart.'}};
  if(freshness==='stale')return{...decision,type:'wait_for_data',confidence:'low',reasonCodes:[...reasonCodes,'STALE_HEALTH'],explanation:{title:'Avventer ferske data',summary:'Helsedataene er for gamle til å gi et trygt grønt lys.',weekImpact:'Planen står mens RunnerBear venter.'}};
  const highLoad=yesterdayLoad.highCost===true||finite(yesterdayLoad.easyCost)>=.65||finite(yesterdayLoad.qualityCost)>=.75;
  if(health.bodyResponseState==='adjust'||health.bodyResponseState==='recover'||flags.length>=2||highLoad&&flags.length>=1){const quality=['quality','race'].includes(todayWorkout.workoutType),pct=20;return{...decision,type:'reduce',reasonCodes:[...new Set([...reasonCodes,...(highLoad?['POST_WORKOUT_LOAD']:[])])],action:{affectedWorkoutIds:[todayWorkout.workoutId],change:{kind:quality?'reduce_repetitions':'reduce_duration',reductionPercent:pct}},explanation:{title:quality?'Reduser dagens kvalitetsdose':'I dag: kortere rolig økt',summary:'Kroppssignalene og den siste belastningen tilsier en mindre dose i dag.',weekImpact:'Bare dagens dose reduseres. Resten av uken vurderes på nytt i morgen.'}}}
  if(flags.length===1)return{...decision,confidence:freshness==='fresh'&&baselineReady?'medium':'low',explanation:{title:'Planen står – med margin',summary:'Ett avvikende signal er normal variasjon. Unngå bonusarbeid.',weekImpact:'Resten av uken står uendret.'}};
  return decision;
}
const mondayFor=value=>{const date=new Date(`${value}T12:00:00Z`),day=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-day);return date.toISOString().slice(0,10)};
const datePlus=(value,days)=>new Date(Date.parse(`${value}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);
const isKeyWorkout=row=>['quality','race'].includes(row?.workoutType)||/langtur|gate/i.test(String(row?.title||''));
const actionLabels=Object.freeze({keep:'Følg dagens økt',reduce:'Bruk redusert dose',replace:'Bruk coachens alternativ',move:'Flytt økten trygt',rest:'Prioriter hvile',replan:'Se coachens planforslag',wait_for_data:'Oppdater datagrunnlaget',needs_input:'Svar på coachens spørsmål'});
const reasonLabels=Object.freeze({LOW_HRV:'HRV ligger lavere enn normalen din.',PERSISTENT_LOW_HRV:'HRV har ligget lavt flere netter.',POOR_SLEEP:'Søvnen ligger lavere enn normalen din.',HIGH_RHR:'Hvilepulsen ligger høyere enn normalen din.',POST_WORKOUT_LOAD:'Forrige økt kostet mer enn ønsket.',SUBJECTIVE_FATIGUE:'Egenfølelsen tilsier ekstra margin.',ILLNESS:'Sykdomsfølelse må avklares før belastningen økes.',PAIN:'Smerte må avklares før belastningen økes.',STALE_HEALTH:'Helsedataene må fornyes før coachen kan gi grønt lys.',MISSING_HEALTH:'RunnerBear bygger fortsatt din personlige normal.',CONSTRAINT_CONFLICT:'Ukeplanen har en avstandskonflikt som må løses.'});
export function buildCoachBrief({plan={},decision=null,today='',now=new Date().toISOString()}={}){
  const planRevisionId=String(plan?.planRevisionId||''),items=(Array.isArray(plan?.items)?plan.items:[]).slice().sort((a,b)=>String(a.localDate||'').localeCompare(String(b.localDate||''))||Number(a.slotIndex||0)-Number(b.slotIndex||0)),weekStart=mondayFor(today||String(now).slice(0,10)),weekEnd=datePlus(weekStart,6),future=items.filter(row=>row.localDate>=today&&!['completed','cancelled','expired'].includes(row.status)),weekItems=items.filter(row=>row.localDate>=weekStart&&row.localDate<=weekEnd&&!['cancelled','expired'].includes(row.status)),keyItems=future.filter(isKeyWorkout),nextKey=keyItems[0]||null,weekKeys=weekItems.filter(isKeyWorkout),sameRevision=Boolean(decision&&decision.planRevisionId===planRevisionId),validUntil=decision?.validUntil||null,withinTtl=Boolean(validUntil&&Date.parse(validUntil)>Date.parse(now)),current=sameRevision&&withinTtl,rejected=current&&decision.status==='rejected',reasonCodes=Array.isArray(decision?.reasonCodes)?decision.reasonCodes:[],changed=current&&!rejected&&decision.type!=='keep'&&decision.type!=='wait_for_data',attention=!current?'action':decision.type==='needs_input'||changed?'action':rejected||reasonCodes.length?'watch':'normal';
  const todayWorkout=items.find(row=>row.localDate===today)||null,qualityCount=weekItems.filter(row=>['quality','race'].includes(row.workoutType)).length,longRun=weekItems.find(row=>/langtur/i.test(String(row.title||'')))||null;
  let priority='Bevar kontinuiteten',reason='Rolige dager skal bygge kapasitet og gjøre neste nøkkeløkt bedre.',nextChange='Planen vurderes på nytt når nye helse- eller responsdata kommer inn.';
  if(nextKey?.workoutType==='quality'||nextKey?.workoutType==='race'){priority=nextKey.localDate===today?'Gjennomfør ukens nøkkeløkt kontrollert':'Beskytt neste kvalitetsøkt';reason=nextKey.localDate===today?'Kvalitet med kontroll er ukens viktigste stimulus.':'Dagens belastning skal gjøre neste kvalitetsøkt bedre, ikke dyrere.'}
  else if(nextKey&&/langtur/i.test(String(nextKey.title||''))){priority='Bygg utholdenhet uten skjult kvalitet';reason='Varigheten er stimulusen. Farten skal ikke gjøre langturen til en ekstra kvalitetsøkt.'}
  if(current&&decision.explanation?.weekImpact)nextChange=decision.explanation.weekImpact;
  if(!current){priority='Forny coachvurderingen';reason=sameRevision?'Vurderingens gyldighetsvindu er utløpt.':'Coachbeslutningen tilhører ikke gjeldende planrevisjon.';nextChange='Planen står uendret til RunnerBear har en ny, verifisert vurdering.'}
  return{version:'coach-brief-1',planRevisionId,inputCursor:current?String(decision.inputCursor||''):'',generatedAt:now,validUntil:current?validUntil:null,freshness:current?'current':decision?'stale':'unavailable',attention,today:{workoutId:todayWorkout?.workoutId||'',title:rejected?'Planen beholdes':current?(decision.explanation?.title||todayWorkout?.title||'Planen står'):'Vurderingen må fornyes',summary:rejected?'Du valgte å beholde gjeldende dose. Følg økten med ekstra margin.':current?(decision.explanation?.summary||'Dagens plan står.'):'RunnerBear viser ikke en eldre coachbeslutning som om den var gjeldende.',actionKind:rejected?'keep':current?decision.type:'wait_for_data',actionLabel:actionLabels[rejected?'keep':current?decision.type:'wait_for_data'],planChanged:Boolean(changed),affectedWorkoutIds:current&&!rejected?(decision.action?.affectedWorkoutIds||[]):[]},week:{priority,reason,nextChange,nextKeyWorkout:nextKey?{workoutId:nextKey.workoutId,localDate:nextKey.localDate,title:nextKey.title,workoutType:nextKey.workoutType}:null,keyWorkoutIds:weekKeys.map(row=>row.workoutId),qualityCount,longRunWorkoutId:longRun?.workoutId||'',watch:reasonCodes.map(code=>reasonLabels[code]).filter(Boolean).slice(0,3)}};
}
export function safeAutoAllowed(decision={}){
  const change=decision.action?.change||{},count=decision.action?.affectedWorkoutIds?.length||0;
  return decision.confidence==='high'&&count<=2&&!decision.reasonCodes?.some(x=>['ILLNESS','PAIN','CONSTRAINT_CONFLICT'].includes(x))&&((['reduce_duration','reduce_repetitions'].includes(change.kind)&&finite(change.reductionPercent)>0&&clamp(change.reductionPercent,0,100)<=20)||['replace_with_rest','replace_with_existing_alternative','remove_optional_easy','move_within_two_days'].includes(change.kind));
}
const stable=value=>JSON.stringify(value??null);
const dayDistance=(a,b)=>Math.abs((Date.parse(`${a}T12:00:00Z`)-Date.parse(`${b}T12:00:00Z`))/86400000);
const sameWeek=(a,b)=>{const monday=value=>{const date=new Date(`${value}T12:00:00Z`),day=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-day);return date.toISOString().slice(0,10)};return monday(a)===monday(b)};
const unchanged=(before,after,except=[])=>Object.keys(before||{}).every(key=>except.includes(key)||key==='planRevisionId'||stable(before[key])===stable(after?.[key]));
export function safeAutoCandidateAllowed(decision={},beforeItems=[],afterItems=[]){
  if(!safeAutoAllowed(decision))return false;
  const ids=new Set(decision.action?.affectedWorkoutIds||[]),change=decision.action?.change||{},before=new Map(beforeItems.map(row=>[row.workoutId,row])),after=new Map(afterItems.map(row=>[row.workoutId,row]));
  if(!ids.size||ids.size>2||before.size!==after.size||[...before.keys()].some(id=>!after.has(id))||[...ids].some(id=>!before.has(id)))return false;
  for(const [id,oldRow] of before){const next=after.get(id);if(!ids.has(id)){if(!unchanged(oldRow,next))return false;continue}
    if(['reduce_duration','reduce_repetitions'].includes(change.kind)){
      if(!unchanged(oldRow,next,['plannedDistanceM','plannedDurationSeconds','title']))return false;
      const ratios=[['plannedDistanceM'],['plannedDurationSeconds']].map(([key])=>{const old=Number(oldRow[key]||0),value=Number(next[key]||0);return old>0&&value!==old?value/old:null}).filter(Number.isFinite);
      if(!ratios.length||ratios.some(ratio=>ratio<.8||ratio>=1)||String(next.title||'')!==`${oldRow.title} · redusert dose`)return false;
    }else if(change.kind==='move_within_two_days'){
      if(!unchanged(oldRow,next,['localDate'])||!next.localDate||dayDistance(oldRow.localDate,next.localDate)>2||!sameWeek(oldRow.localDate,next.localDate))return false;
    }else if(change.kind==='replace_with_rest'){
      if(!unchanged(oldRow,next,['sport','workoutType','title','intent','prescription','plannedDurationSeconds','plannedDistanceM','plannedLoad'])||next.sport!=='rest'||next.workoutType!=='rest'||Number(next.plannedDistanceM||0)!==0)return false;
    }else if(change.kind==='replace_with_existing_alternative'){
      if(!unchanged(oldRow,next,['sport','workoutType','title','intent','prescription','plannedDurationSeconds','plannedDistanceM','plannedLoad'])||!['cross','cycling','rowing'].includes(next.sport)||next.workoutType!=='cross'||Number(next.plannedDistanceM||0)!==0)return false;
    }else if(change.kind==='remove_optional_easy'){
      if(oldRow.workoutType!=='easy'||oldRow.lockLevel==='user'||!unchanged(oldRow,next,['status'])||next.status!=='cancelled')return false;
    }else return false;
  }
  return true;
}
export function assessGoalConfidence({points=[],vo2Available=false}={}){
  const seen=new Set(),rows=(Array.isArray(points)?points:[]).filter(point=>{const date=String(point?.date||'').slice(0,10),key=String(point?.workoutId||date);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||seen.has(key))return false;seen.add(key);return true}).map(point=>({...point,date:String(point.date).slice(0,10)})).sort((a,b)=>a.date.localeCompare(b.date)),spanDays=rows.length>1?Math.round((Date.parse(`${rows.at(-1).date}T12:00:00Z`)-Date.parse(`${rows[0].date}T12:00:00Z`))/86400000):0,hasNextDayResponse=rows.some(point=>point.nextDayResponse===true),sufficient=rows.length>=3&&spanDays>=21&&hasNextDayResponse,level=sufficient?'sufficient':rows.length?'preliminary':'insufficient',missing=[];if(!vo2Available)missing.push('vo2');if(!hasNextDayResponse)missing.push('next_day_response');if(rows.length<3)missing.push('evidence_points');if(spanDays<21)missing.push('evidence_span');
  const nextEvidence=rows.length<3?`${3-rows.length} relevant${3-rows.length===1?'':'e'} kvalitets-/gateøkt${3-rows.length===1?'':'er'}`:spanDays<21?`${21-spanDays} dager mer evidensspenn`:!hasNextDayResponse?'neste-dags respons etter en relevant økt':'neste planlagte gate';
  return{level,sufficient,showPreciseCorridor:sufficient,sampleCount:rows.length,spanDays,hasNextDayResponse,missingSources:missing,nextEvidence,points:rows.map(point=>({workoutId:point.workoutId||'',date:point.date,kind:point.kind||'quality',nextDayResponse:point.nextDayResponse===true}))};
}
