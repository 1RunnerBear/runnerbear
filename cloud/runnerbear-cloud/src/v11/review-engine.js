import { adaptNextQuality } from './bakken-engine.js';

const DAY_MS=86400000;
const addDays=(value,days)=>new Date(Date.parse(`${value}T12:00:00Z`)+days*DAY_MS).toISOString().slice(0,10);
const monday=value=>{const date=new Date(`${value}T12:00:00Z`),day=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-day);return date.toISOString().slice(0,10)};
const parseDate=value=>String(value||'').slice(0,10);
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const running=value=>/run|running|jogg|løp/i.test(String(value||''));
const alternative=value=>/row|rowing|cycle|cycling|bike|concept2|zwift|cross/i.test(String(value||''));
const quality=row=>['quality','race'].includes(String(row?.workoutType||row?.workout_type||''));
const long=row=>String(row?.intent||'')==='long'||/langtur|long run/i.test(String(row?.title||''));
const terminal=row=>['completed','cancelled','replaced','skipped'].includes(String(row?.status||''));
const sourceId=row=>String(row?.source_id||row?.sourceId||row?.event_id||row?.eventId||'');
const activityDate=row=>parseDate(row?.date||row?.localDate||row?.startDate);
const activitySport=row=>String(row?.sport_type||row?.sportType||row?.sport||row?.sub_sport_type||'');
const activityDistance=row=>finite(row?.distance_m??row?.distanceM??row?.distance);
const activityDuration=row=>finite(row?.duration_seconds??row?.durationSeconds??row?.duration);
const eventPayload=row=>row?.payload&&typeof row.payload==='object'?row.payload:{};

function activitiesOn(rows=[],date=''){return rows.filter(row=>activityDate(row)===date)}
function matchedActivity(item,rows=[]){
  const same=activitiesOn(rows,item.localDate),run=same.find(row=>running(activitySport(row))),other=same.find(row=>alternative(activitySport(row)));
  if(item.sport==='running')return run||other||null;
  return other||run||null;
}

export function buildWeeklyReview({plan={},activities=[],events=[],today=new Date().toISOString().slice(0,10),generatedAt=new Date().toISOString()}={}){
  const weekEnd=addDays(monday(today),-1),weekStart=addDays(weekEnd,-6),items=(plan.items||[]).filter(row=>row.localDate>=weekStart&&row.localDate<=weekEnd),plannedRuns=items.filter(row=>row.sport==='running'&&!['cancelled','replaced'].includes(row.status)),results=[];
  for(const item of items){
    const activity=matchedActivity(item,activities),sport=activitySport(activity),isRun=running(sport),isAlternative=Boolean(activity)&&!isRun&&alternative(sport),completed=item.status==='completed'||Boolean(activity),state=item.status==='replaced'||isAlternative?'replaced':completed?'completed':item.status==='cancelled'?'cancelled':'missed';
    results.push({workoutId:item.workoutId,localDate:item.localDate,title:item.title,workoutType:item.workoutType,state,plannedDistanceM:finite(item.plannedDistanceM),actualDistanceM:isRun?activityDistance(activity):0,actualDurationSeconds:isRun?activityDuration(activity):0,activityId:sourceId(activity),activitySport:sport||'',qualityWorkout:quality(item),longRun:long(item),keyWorkout:quality(item)||long(item)});
  }
  const plannedDistanceM=plannedRuns.reduce((sum,row)=>sum+finite(row.plannedDistanceM),0),completedDistanceM=results.reduce((sum,row)=>sum+finite(row.actualDistanceM),0),completedDurationSeconds=results.reduce((sum,row)=>sum+finite(row.actualDurationSeconds),0),completed=results.filter(row=>row.state==='completed').length,replaced=results.filter(row=>row.state==='replaced').length,missed=results.filter(row=>row.state==='missed').length,keyCompleted=results.filter(row=>row.keyWorkout&&row.state==='completed').length,keyPlanned=results.filter(row=>row.keyWorkout).length,qualityPlanned=results.filter(row=>row.qualityWorkout).length,qualityCompleted=results.filter(row=>row.qualityWorkout&&row.state==='completed').length,alternatives=results.filter(row=>row.state==='replaced').length,longResult=results.filter(row=>row.longRun).sort((a,b)=>finite(b.plannedDistanceM)-finite(a.plannedDistanceM))[0]||null,longRun=longResult?{planned:true,completed:longResult.state==='completed',workoutId:longResult.workoutId,localDate:longResult.localDate,title:longResult.title,plannedDistanceM:longResult.plannedDistanceM,actualDistanceM:longResult.actualDistanceM,actualDurationSeconds:longResult.actualDurationSeconds}:{planned:false,completed:false,workoutId:'',localDate:'',title:'Ingen planlagt langtur',plannedDistanceM:0,actualDistanceM:0,actualDurationSeconds:0},completionRatio=plannedDistanceM>0?completedDistanceM/plannedDistanceM:0;
  let attention='normal',headline='Kontinuiteten er bevart',learning='Uken støtter videre kontrollert progresjon.',nextDirection='Neste uke følger planlagt rytme uten å jage ekstra kilometer.',coachComment='En jevn uke med nok kontroll til at planen kan fortsette som planlagt.';
  if(!items.length){attention='watch';headline='Ukereviewen bygges';learning='RunnerBear mangler en komplett planreferanse for forrige uke.';nextDirection='Planen står mens datagrunnlaget kompletteres.';coachComment='Datagrunnlaget er ikke komplett nok til å vurdere uken sikkert. Planen beholdes til Garmin- og plandata er verifisert.'}
  else if(missed>0){attention='watch';headline=keyPlanned>keyCompleted?'En nøkkeløkt falt bort':'Uken ble tilpasset';learning='Tapte økter blir ikke treningsgjeld. Coachen beskytter neste relevante stimulus.';nextDirection='Fremtidige økter vurderes fra i dag; forrige uke endres ikke.';coachComment=qualityCompleted<qualityPlanned?'Uken ga mindre kvalitetsarbeid enn planlagt. Den tapte økten tas ikke igjen; neste relevante kvalitetsøkt beskyttes.':'Mengden ble lavere enn planlagt, men de viktigste stimuliene er bevart. Planen går videre uten treningsgjeld.'}
  else if(replaced>0){headline='Uken ble løst fleksibelt';learning='Alternativ trening teller som aerob støtte, men ikke som løpskilometer.';nextDirection='Neste nøkkeløkt beskyttes ut fra faktisk belastning.';coachComment='Alternativ trening ga aerob støtte uten falske løpskilometer. Neste løpeuke styres fortsatt av faktisk løpsbelastning.'}
  else if(qualityPlanned>0&&qualityCompleted===qualityPlanned&&(!longRun.planned||longRun.completed)&&completionRatio>=.9&&completionRatio<=1.12){headline='Sterk og balansert uke';coachComment='Alle planlagte kvalitetsøkter og langturen ble gjennomført, med totalmengde nær planen. Belastningen støtter videre kontrollert progresjon.'}
  else if(qualityCompleted===qualityPlanned&&qualityPlanned>0){coachComment='Kvalitetsarbeidet ble gjennomført som planlagt. Coachen holder videre progresjon kontrollert ut fra totalmengden og langturen.'}
  const dataQuality=items.length&&results.every(row=>row.state!=='completed'||row.activityId||items.find(item=>item.workoutId===row.workoutId)?.status==='completed')?'verified':items.length?'partial':'unavailable';
  return{version:'weekly-review-1',planRevisionId:String(plan.planRevisionId||''),weekStart,weekEnd,generatedAt,attention,dataQuality,headline,coachComment,learning,nextDirection,longRun,totals:{plannedDistanceM,completedDistanceM,completedDurationSeconds,plannedSessions:items.filter(row=>row.workoutType!=='rest').length,completedSessions:completed,replacedSessions:replaced,missedSessions:missed,plannedKeySessions:keyPlanned,completedKeySessions:keyCompleted,plannedQualitySessions:qualityPlanned,completedQualitySessions:qualityCompleted,completedLongRuns:longRun.completed?1:0,alternativeSessions:alternatives},sessions:results,evidence:{activityIds:results.map(row=>row.activityId).filter(Boolean),feedbackEventIds:events.filter(row=>parseDate(row.local_date||row.localDate)>=weekStart&&parseDate(row.local_date||row.localDate)<=weekEnd).map(sourceId).filter(Boolean)}};
}

function latestIllness(events=[],today=''){
  const start=addDays(today,-3);
  return events.filter(row=>{const payload=eventPayload(row),date=parseDate(payload.responseDate||row.local_date||row.localDate||row.occurred_at);return payload.illness===true&&date>=start&&date<=today}).sort((a,b)=>String(a.occurred_at||'').localeCompare(String(b.occurred_at||''))).at(-1)||null;
}
function clone(value){return JSON.parse(JSON.stringify(value))}
function toRecovery(row,reason){return{...clone(row),status:'scheduled',sport:'rest',workoutType:'rest',title:reason==='illness_reported'?'Hvile · sykdomsrealignment':'Hvile · coachrealignment',intent:'recovery',prescription:{version:1,main:{kind:'recovery'},legacy:{desc:'Hvile.',detail:'Belastningen er tatt ut uten treningsgjeld.'}},plannedDurationSeconds:null,plannedDistanceM:0,plannedLoad:{...(row.plannedLoad||{}),realignment:{reason,originalSport:row.sport,originalWorkoutType:row.workoutType,originalTitle:row.title,originalDistanceM:finite(row.plannedDistanceM)}}}}
function toAlternative(row,activity){const sport=activitySport(activity),title=String(activity?.title||activity?.name||(/row/i.test(sport)?'Concept2 · alternativ trening':'Sykkel · alternativ trening'));return{...clone(row),status:'replaced',sport:'cross',workoutType:'cross',title,intent:'aerobic_support',prescription:{version:1,main:{kind:'alternative'},legacy:{desc:'Alternativ aerob aktivitet er registrert.',detail:'Aerob støtte uten mekaniske løpskilometer.'}},plannedDurationSeconds:finite(activity?.duration_seconds??activity?.durationSeconds)||null,plannedDistanceM:0,plannedLoad:{...(row.plannedLoad||{}),realignment:{reason:'alternative_training',originalSport:row.sport,originalWorkoutType:row.workoutType,originalTitle:row.title,originalDistanceM:finite(row.plannedDistanceM),activityId:sourceId(activity)}}}}
function markSafety(rows,dates,reason,fromDate){const weeks=new Set(dates.map(monday)),markers=new Set();for(const week of weeks){const candidate=rows.filter(row=>row.localDate>=fromDate&&monday(row.localDate)===week).sort((a,b)=>a.localDate.localeCompare(b.localDate)).at(-1);if(candidate)markers.add(candidate.workoutId)}return rows.map(row=>markers.has(row.workoutId)?{...row,plannedLoad:{...(row.plannedLoad||{}),integrity:{...(row.plannedLoad?.integrity||{}),safetyOverrideReason:reason,volumeReason:'Ukevolumet reduseres uten treningsgjeld.',volumeDebtSuppressed:true}}}:row)}

export function buildRealignmentProposal({plan={},activities=[],events=[],config={},today=new Date().toISOString().slice(0,10),generatedAt=new Date().toISOString()}={}){
  const items=(plan.items||[]).map(clone),illness=latestIllness(events,today),todayWorkout=items.find(row=>row.localDate===today&&row.sport==='running'&&!terminal(row)),todayAlternative=todayWorkout?activitiesOn(activities,today).find(row=>alternative(activitySport(row))):null,yesterday=addDays(today,-1),missed=items.find(row=>row.localDate===yesterday&&row.sport==='running'&&!terminal(row)&&!matchedActivity(row,activities));
  let trigger='',evidenceId='',summary='',consequence='',rows=items,requiresInput=false,reasonCodes=[];
  if(illness){
    trigger='illness_reported';evidenceId=sourceId(illness);const until=addDays(today,2),protectedRows=[];
    rows=items.map(row=>{if(row.localDate<today||row.localDate>until||row.sport!=='running'||terminal(row))return row;if(row.workoutType==='race'||row.lockLevel==='system'||row.lockLevel==='user'){protectedRows.push(row.workoutId);return row}return toRecovery(row,trigger)});rows=markSafety(rows,rows.filter(row=>row.plannedLoad?.realignment?.reason===trigger).map(row=>row.localDate),'Eksplisitt sykdomsrealignment.',today);
    requiresInput=protectedRows.length>0;summary=requiresInput?'Sykdom er meldt, men en låst nøkkeløkt må avklares.':'Løpsbelastningen de neste 72 timene tas ut.';consequence='Ingen kilometer tas igjen senere. Planen vurderes på nytt ved friskmelding eller nye data.';
  }else if(todayAlternative){
    trigger='alternative_training';evidenceId=sourceId(todayAlternative);rows=items.map(row=>row.workoutId===todayWorkout.workoutId?toAlternative(row,todayAlternative):row);rows=markSafety(rows,[today],'Alternativ aktivitet erstatter løpsøkten uten kvalitetskreditt.',today);summary='Dagens alternative aktivitet erstatter den aerobe støtteøkten.';consequence='Aktiviteten teller aerobt, men gir ingen løpskilometer eller kvalitetskreditt.';
  }else if(missed){
    trigger='missed_workout';evidenceId=missed.workoutId;summary=quality(missed)?'Den tapte kvalitetsøkten flyttes ikke blindt.':'Den tapte støtteøkten tas ikke igjen.';consequence=quality(missed)?'Neste planlagte kvalitetsstimulus beskyttes; resten av planen står når avstanden er trygg.':'Planen går videre uten treningsgjeld.';
  }else{
    const adaptation=adaptNextQuality({items,events,config,today});
    if(adaptation){trigger='quality_response';evidenceId=adaptation.signal.eventId;rows=adaptation.rows;summary=adaptation.summary;consequence=adaptation.consequence;reasonCodes=adaptation.signal.reasonCodes||[]}
  }
  if(!trigger)return null;
  const before=new Map(items.map(row=>[row.workoutId,row])),changes=rows.filter(row=>JSON.stringify(before.get(row.workoutId))!==JSON.stringify(row)).map(row=>({workoutId:row.workoutId,localDate:row.localDate,before:before.get(row.workoutId),after:row})),protectedWorkoutIds=items.filter(row=>row.localDate>=today&&(row.workoutType==='race'||row.lockLevel==='system'||row.lockLevel==='user')).map(row=>row.workoutId),autoEligible=!requiresInput&&changes.length>0&&changes.length<=4&&changes.every(change=>change.localDate>=today&&!protectedWorkoutIds.includes(change.workoutId)&&finite(change.after.plannedDistanceM)<=finite(change.before.plannedDistanceM));
  return{version:'realignment-proposal-2',proposalId:`realign:${String(plan.planRevisionId||'none')}:${trigger}:${String(evidenceId||today).replace(/[^a-z0-9._:-]+/gi,'-')}`,planRevisionId:String(plan.planRevisionId||''),inputCursor:`${String(plan.planRevisionId||'')}:${trigger}:${evidenceId||today}`,generatedAt,validUntil:new Date(Date.parse(generatedAt)+6*3600000).toISOString(),trigger,reasonCodes,status:requiresInput?'needs_input':changes.length?'proposed':'unchanged',summary,consequence,trainingDebt:false,autoEligible,protectedWorkoutIds,affectedWorkoutIds:changes.map(row=>row.workoutId),changes,rows};
}
