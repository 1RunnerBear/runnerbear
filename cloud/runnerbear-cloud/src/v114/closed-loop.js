import { buildOneDecision } from '../v113/one-decision.js';

export const CLOSED_LOOP_BUILD='11.4.0';
export const COACH_CONTINUITY_VERSION='coach-continuity-1';
export const ONE_DECISION_V2_VERSION='one-decision-2';

const RESOLVED_STATUSES=new Set(['accepted','rejected','auto_applied','undone']);
const TERMINAL_STATUSES=new Set(['completed','replaced','cancelled','skipped','expired']);
const ALLOWED_ACTIONS=new Set(['open_workout','review_adjustment','complete_checkin','complete_feedback','view_result','view_plan']);
const bounded=(value,max=320)=>String(value??'').trim().slice(0,max);
const localDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||'').slice(0,10))?String(value).slice(0,10):'';
const addDays=(date,days)=>new Date(Date.parse(`${date}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);

function affectedWorkoutId(decision){
  return bounded(Array.isArray(decision?.action?.affectedWorkoutIds)?decision.action.affectedWorkoutIds[0]:'',160);
}

function workoutForDecision(decision,items){
  const id=affectedWorkoutId(decision);
  return(id&&items.find(item=>String(item?.workoutId)===id))||null;
}

function matchesWorkout(row,workout){
  if(!row||!workout)return false;
  const payload=row.payload||{},workoutId=bounded(payload.workoutId||row.workoutId,160);
  return workoutId?workoutId===String(workout.workoutId):localDate(row.local_date||row.localDate||row.date)===localDate(workout.localDate);
}

function feedbackFor(workout,events,phase){
  return events.find(row=>row?.event_type==='feedback:workout'&&matchesWorkout(row,workout)&&(!phase||String(row.payload?.responsePhase||'post_workout')===phase))||null;
}

function checkinFor(workout,checkins,phase){
  return checkins.find(row=>matchesWorkout(row,workout)&&String(row.responsePhase||'')===phase)||null;
}

function activityFor(workout,activities){
  return activities.find(row=>matchesWorkout(row,workout))||null;
}

function resolutionLabel(status){
  return{accepted:'Justeringen ble brukt',rejected:'Planen ble beholdt',auto_applied:'Trygg justering ble brukt',undone:'Endringen ble angret',proposed:'Venter på valg',superseded:'Erstattet av nyere vurdering'}[status]||'Vurderingen er registrert';
}

function decisionLabel(type){
  return{keep:'Behold planen',reduce:'Reduser dose',replace:'Erstatt økten',move:'Flytt økten',rest:'Prioriter hvile',replan:'Juster ukeplanen',wait_for_data:'Vent på data',needs_input:'Trenger ett svar'}[type]||'Coachvurdering';
}

function responseLabel({feedback,nextMorning,activity,workout}){
  const control=String(feedback?.payload?.control||'');
  if(nextMorning)return'Neste-dags respons er tatt med';
  if(control==='controlled')return'Økten ble rapportert kontrollert';
  if(control==='borderline')return'Økten ble rapportert på grensen';
  if(control==='uncontrolled')return'Økten ble rapportert ukontrollert';
  if(feedback)return'Responsen etter økten er tatt med';
  if(activity||TERMINAL_STATUSES.has(workout?.status))return'Økten er observert · kort respons mangler';
  return'Ingen øktrespons ennå';
}

function followUpFor(bootstrap,items,events,checkins,activities,today){
  const todayWorkout=items.filter(item=>localDate(item?.localDate)===today&&(TERMINAL_STATUSES.has(item.status)||activityFor(item,activities))&&!feedbackFor(item,events,'post_workout')).sort((a,b)=>Number(b.slotIndex||0)-Number(a.slotIndex||0))[0]||null;
  if(todayWorkout){
    return{required:true,phase:'post_workout',workoutId:bounded(todayWorkout.workoutId,160),localDate:today,label:'Gi kort respons',prompt:'Hvordan traff dagens økt? Ett kort svar gjør neste vurdering bedre.',actionKind:'complete_feedback'};
  }
  const yesterday=addDays(today,-1),previous=items.filter(item=>localDate(item?.localDate)===yesterday&&(TERMINAL_STATUSES.has(item.status)||activityFor(item,activities))).sort((a,b)=>Number(b.slotIndex||0)-Number(a.slotIndex||0))[0];
  if(previous&&feedbackFor(previous,events,'post_workout')&&!feedbackFor(previous,events,'next_morning')&&!checkinFor(previous,checkins,'next_morning')){
    return{required:true,phase:'next_morning',workoutId:bounded(previous.workoutId,160),localDate:yesterday,label:'Svar på morgenformen',prompt:'Hvordan responderte kroppen etter gårsdagens økt?',actionKind:'complete_checkin'};
  }
  return{required:false,phase:null,workoutId:null,localDate:null,label:null,prompt:null,actionKind:null};
}

function confidenceFor(bootstrap,followUp){
  const decision=bootstrap?.coachDecision,planRevisionId=bounded(bootstrap?.planRevisionId,160),generatedAt=Date.parse(bootstrap?.generatedAt||new Date().toISOString()),decisionCurrent=decision?.planRevisionId===planRevisionId&&['proposed','accepted','auto_applied','rejected'].includes(decision?.status)&&Number.isFinite(Date.parse(decision?.validUntil))&&Date.parse(decision.validUntil)>generatedAt,body=bootstrap?.bodyResponse,bodyCurrent=body&&(!body.planRevisionId||body.planRevisionId===planRevisionId),level=decisionCurrent&&['high','medium','low'].includes(decision.confidence)?decision.confidence:bodyCurrent&&['high','medium','low'].includes(body.confidence)?body.confidence:'low';
  const labels={high:'Godt beslutningsgrunnlag',medium:'Brukbart beslutningsgrunnlag',low:'Begrenset beslutningsgrunnlag'};
  const evidenceCount=decisionCurrent?Math.min(3,Array.isArray(decision.evidence)?decision.evidence.length:0):0;
  const baselineReady=bootstrap?.bodyResponse?.baselineStatus?.status==='established';
  const basis=level==='high'?'Plan, tilgjengelige signaler og respons er kontrollert.':level==='medium'?'Planen er kontrollert, men ett datagrunnlag er mindre sikkert.':'RunnerBear viser tydelig at mer relevant respons eller ferskere data trengs.';
  const nextEvidence=followUp.required?followUp.prompt:baselineReady?'Responsen etter neste relevante økt styrker coachminnet.':'Flere normale dager bygger et tryggere personlig sammenligningsgrunnlag.';
  return{level,label:labels[level],basis,nextEvidence,evidenceCount,baselineReady};
}

function memoryFor(bootstrap,items,events,checkins,activities){
  const decisions=Array.isArray(bootstrap?.decisionHistory)?bootstrap.decisionHistory:[];
  const recent=[];
  for(const decision of decisions){
    if(!RESOLVED_STATUSES.has(decision?.status)||recent.length>=3)continue;
    const workout=workoutForDecision(decision,items),feedback=workout?feedbackFor(workout,events,'post_workout'):null,nextMorning=workout?(feedbackFor(workout,events,'next_morning')||checkinFor(workout,checkins,'next_morning')):null,activity=workout?activityFor(workout,activities):null;
    recent.push({decisionId:bounded(decision.decisionId,160),createdAt:bounded(decision.createdAt,40),type:bounded(decision.type,32),recommendation:decisionLabel(decision.type),resolution:resolutionLabel(decision.status),workoutId:bounded(workout?.workoutId,160)||null,localDate:localDate(workout?.localDate)||null,reason:bounded(decision.explanation?.summary||decision.explanation?.title,240)||'Coachens grunnlag ble kontrollert mot planen.',response:responseLabel({feedback,nextMorning,activity,workout}),responseObserved:Boolean(feedback||nextMorning||activity)});
  }
  const learnedResponses=recent.filter(row=>row.responseObserved).length,observedDecisions=recent.length,status=learnedResponses?'available':'learning';
  const summary=learnedResponses?`RunnerBear har fulgt opp ${observedDecisions} tidligere ${observedDecisions===1?'råd':'råd'} og observert respons etter ${learnedResponses}.`:'Coachminnet er aktivt og bygges når råd, gjennomføring og respons kan kobles sikkert.';
  return{status,summary,observedDecisions,learnedResponses,recent};
}

export function buildCoachContinuity(bootstrap={}){
  const items=Array.isArray(bootstrap?.activePlan?.items)?bootstrap.activePlan.items:[],events=Array.isArray(bootstrap?.responseEvents)?bootstrap.responseEvents:[],checkins=Array.isArray(bootstrap?.responseCheckins)?bootstrap.responseCheckins:[],activities=Array.isArray(bootstrap?.recentActivities)?bootstrap.recentActivities:[],today=localDate(bootstrap?.todayWorkout?.localDate)||new Intl.DateTimeFormat('en-CA',{timeZone:bootstrap?.config?.timezone||'Europe/Oslo'}).format(new Date(bootstrap?.generatedAt||Date.now())),followUp=followUpFor(bootstrap,items,events,checkins,activities,today),confidence=confidenceFor(bootstrap,followUp),memory=memoryFor(bootstrap,items,events,checkins,activities);
  return{version:COACH_CONTINUITY_VERSION,planRevisionId:bounded(bootstrap?.planRevisionId,160),generatedAt:bounded(bootstrap?.generatedAt||new Date().toISOString(),40),confidence,memory,followUp,safety:{planWritesByAi:false,historyLimit:3,rawHealthValuesExposed:false}};
}

export function buildOneDecisionV2(bootstrap={},continuity=buildCoachContinuity(bootstrap)){
  const base=buildOneDecision(bootstrap,{now:bootstrap?.generatedAt||new Date().toISOString()}),common={...base,version:ONE_DECISION_V2_VERSION,confidence:continuity.confidence,memory:{status:continuity.memory.status,summary:continuity.memory.summary,observedDecisions:continuity.memory.observedDecisions,learnedResponses:continuity.memory.learnedResponses,recent:continuity.memory.recent},followUp:continuity.followUp};
  if(!continuity.planRevisionId||continuity.planRevisionId!==base.planRevisionId)return{...common,freshness:'unavailable',state:'refresh',tone:'quiet',headline:'Dagens vurdering fornyes',summary:'Coachminnet tilhører ikke gjeldende planrevisjon. RunnerBear oppdaterer vurderingen automatisk.',primaryAction:base.workout?{kind:'open_workout',label:'Åpne dagens økt'}:{kind:'view_plan',label:'Se planen'},proposal:null};
  if(['refresh','clarify','adjust'].includes(base.state))return common;
  if(continuity.followUp.required&&continuity.followUp.phase==='next_morning')return{...common,state:'clarify',tone:'watch',headline:'Ett svar før dagens råd',summary:continuity.followUp.prompt,primaryAction:{kind:'complete_checkin',label:continuity.followUp.label,workoutId:continuity.followUp.workoutId}};
  if(['completed','follow'].includes(base.state)&&continuity.followUp.required&&continuity.followUp.phase==='post_workout')return{...common,state:'reflect',tone:'calm',headline:'Lukk løkken etter økten',summary:continuity.followUp.prompt,primaryAction:{kind:'complete_feedback',label:continuity.followUp.label,workoutId:continuity.followUp.workoutId}};
  return common;
}

export function closedLoopAudit(){
  const required=['open_workout','review_adjustment','complete_checkin','complete_feedback','view_result','view_plan'];
  return{ok:required.every(kind=>ALLOWED_ACTIONS.has(kind)),continuityVersion:COACH_CONTINUITY_VERSION,oneDecisionVersion:ONE_DECISION_V2_VERSION,states:['follow','adjust','clarify','refresh','reflect','completed','rest'],planWritesByAi:false,maximumReductionPercent:20,historyLimit:3,rawHealthValuesExposed:false};
}
