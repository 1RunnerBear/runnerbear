export const ONE_DECISION_VERSION='one-decision-1';
export const ONE_DECISION_BUILD='11.3.0';

const TERMINAL_STATUSES=new Set(['completed','replaced','cancelled','skipped','expired']);
const ACTION_KINDS=new Set(['open_workout','review_adjustment','complete_checkin','refresh_data','view_result','view_plan']);
const REASON_LABELS=Object.freeze({
  LOW_HRV:'HRV ligger lavere enn normalen din.',
  PERSISTENT_LOW_HRV:'HRV har ligget lavt flere netter.',
  POOR_SLEEP:'Søvnen ligger lavere enn normalen din.',
  HIGH_RHR:'Hvilepulsen ligger høyere enn normalen din.',
  POST_WORKOUT_LOAD:'Forrige økt kostet mer enn ønsket.',
  SUBJECTIVE_FATIGUE:'Egenfølelsen tilsier ekstra margin.',
  ILLNESS:'Sykdomsfølelse må avklares før belastningen økes.',
  PAIN:'Smerte må avklares før belastningen økes.',
  STALE_HEALTH:'Helsedataene må oppdateres før coachen kan gi grønt lys.',
  MISSING_HEALTH:'RunnerBear bygger fortsatt din personlige normal.',
  CONSTRAINT_CONFLICT:'Ukeplanen må kontrolleres før en endring kan lagres.',
});

const bounded=(value,max=320)=>String(value??'').trim().slice(0,max);
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const roundDistance=value=>Math.max(0,Math.round(Number(value||0)));

function compactWorkout(workout){
  if(!workout)return null;
  return{
    workoutId:bounded(workout.workoutId,160),
    localDate:bounded(workout.localDate,10),
    status:bounded(workout.status,32)||'scheduled',
    sport:bounded(workout.sport,40),
    workoutType:bounded(workout.workoutType,40),
    title:bounded(workout.title,180)||'Planlagt økt',
    intent:bounded(workout.intent,180),
    plannedDistanceM:roundDistance(workout.plannedDistanceM),
    plannedDurationSeconds:finite(workout.plannedDurationSeconds),
  };
}

function currentDecision(bootstrap,now){
  const decision=bootstrap?.coachDecision,planRevisionId=bounded(bootstrap?.planRevisionId,160);
  if(!decision||!planRevisionId||decision.planRevisionId!==planRevisionId)return null;
  if(!['proposed','accepted','auto_applied','rejected'].includes(decision.status))return null;
  if(!decision.validUntil||!Number.isFinite(Date.parse(decision.validUntil))||Date.parse(decision.validUntil)<=Date.parse(now))return null;
  return decision;
}

function evidenceFor(bootstrap,decision){
  const rows=[],seen=new Set(),push=(id,label,source,tone='neutral')=>{
    id=bounded(id,80);label=bounded(label,180);if(!id||!label||seen.has(id)||rows.length>=3)return;
    seen.add(id);rows.push({id,label,source:bounded(source,80),tone});
  };
  for(const code of decision?.reasonCodes||[])push(`reason:${code}`,REASON_LABELS[code]||String(code).toLocaleLowerCase('nb-NO').replaceAll('_',' '),'Coach',/ILLNESS|PAIN|CONSTRAINT/.test(code)?'attention':'watch');
  const body=bootstrap?.bodyResponse;
  if(rows.length<3&&body?.stateLabel)push(`body:${body.state||'unknown'}`,body.stateLabel,'Kroppens respons',body.state==='as_planned'?'support':body.state==='watch'?'watch':'attention');
  if(rows.length<3&&bootstrap?.coachBrief?.week?.priority)push('plan:weekly-priority',bootstrap.coachBrief.week.priority,'Aktiv plan','neutral');
  if(!rows.length)push('plan:current','Plan og tilgjengelige signaler er kontrollert.','RunnerBear','support');
  return rows;
}

function proposalFor(decision,workout){
  const change=decision?.action?.change||{},reductionPercent=finite(change.reductionPercent),affected=Array.isArray(decision?.action?.affectedWorkoutIds)?decision.action.affectedWorkoutIds.map(String):[];
  if(!workout||decision?.type!=='reduce'||decision?.status!=='proposed'||!['reduce_duration','reduce_repetitions'].includes(change.kind)||!reductionPercent||reductionPercent<=0||reductionPercent>20||!affected.includes(workout.workoutId))return null;
  const factor=1-reductionPercent/100,before={title:workout.title,plannedDistanceM:workout.plannedDistanceM,plannedDurationSeconds:workout.plannedDurationSeconds},after={title:`${workout.title} · redusert dose`,plannedDistanceM:roundDistance(workout.plannedDistanceM*factor),plannedDurationSeconds:workout.plannedDurationSeconds==null?null:Math.max(0,Math.round(workout.plannedDurationSeconds*factor))};
  return{
    decisionId:bounded(decision.decisionId,160),
    kind:change.kind,
    reductionPercent,
    affectedWorkoutIds:affected.slice(0,2),
    before,
    after,
    confirmationRequired:true,
    undoAvailable:true,
  };
}

function baseEnvelope(bootstrap,now){
  const planRevisionId=bounded(bootstrap?.planRevisionId,160),workout=compactWorkout(bootstrap?.todayWorkout);
  return{
    version:ONE_DECISION_VERSION,
    planRevisionId,
    inputCursor:'',
    generatedAt:bounded(bootstrap?.generatedAt||now,40),
    validUntil:null,
    freshness:'unavailable',
    state:'refresh',
    tone:'quiet',
    headline:'Forny dagens vurdering',
    summary:'RunnerBear viser ikke en eldre coachbeslutning som om den var gjeldende.',
    workout,
    evidence:[{id:'data:refresh',label:'Datagrunnlaget må kontrolleres på nytt.',source:'RunnerBear',tone:'watch'}],
    primaryAction:{kind:'refresh_data',label:'Oppdater data'},
    secondaryActions:[{kind:'ask_coach',label:'Spør coach'}],
    proposal:null,
    safety:{planWritesByAi:false,confirmationRequired:true,undoAvailable:true,maximumReductionPercent:20},
  };
}

export function buildOneDecision(bootstrap={},options={}){
  const now=options.now||new Date().toISOString(),envelope=baseEnvelope(bootstrap,now),workout=envelope.workout;
  if(!bootstrap||bootstrap.needsMigration||!envelope.planRevisionId||bootstrap?.activePlan?.planRevisionId&&bootstrap.activePlan.planRevisionId!==envelope.planRevisionId)return envelope;
  if(workout&&TERMINAL_STATUSES.has(workout.status))return{...envelope,freshness:'current',state:'completed',tone:'calm',headline:'Dagens økt er registrert',summary:'Resultatet er klart for gjennomgang. Planen videre vurderes fra den registrerte responsen.',evidence:[{id:`result:${workout.status}`,label:workout.status==='completed'?'Økten er markert gjennomført.':'Dagens planstatus er oppdatert.',source:'Aktivitetslogg',tone:'support'}],primaryAction:{kind:'view_result',label:'Se dagens resultat'}};
  if(workout?.workoutType==='rest'||workout?.sport==='rest')return{...envelope,freshness:'current',state:'rest',tone:'calm',headline:'Prioriter hvile i dag',summary:'Hviledagen er en del av den aktive planen og beskytter neste treningsstimulus.',evidence:[{id:'plan:rest',label:'Planlagt restitusjonsdag.','source':'Aktiv plan',tone:'support'}],primaryAction:{kind:'view_plan',label:'Se planen'}};
  const decision=currentDecision(bootstrap,now);
  if(!decision)return envelope;
  const common={...envelope,inputCursor:bounded(decision.inputCursor,240),validUntil:decision.validUntil,freshness:'current',evidence:evidenceFor(bootstrap,decision)};
  if(decision.status==='rejected')return{...common,state:'follow',tone:'watch',headline:'Planen beholdes',summary:'Du valgte å beholde gjeldende dose. Følg økten med ekstra margin og uten bonusarbeid.',primaryAction:{kind:'open_workout',label:'Åpne dagens økt'}};
  if(decision.type==='wait_for_data')return{...common,state:'refresh',tone:'quiet',headline:bounded(decision.explanation?.title,180)||'Oppdater datagrunnlaget',summary:bounded(decision.explanation?.summary,420)||'RunnerBear trenger ferskere data før dagens dose kan vurderes.',primaryAction:{kind:'refresh_data',label:'Oppdater Garmin-data'}};
  if(decision.type==='needs_input')return{...common,state:'clarify',tone:'attention',headline:bounded(decision.explanation?.title,180)||'Svar på én kroppssjekk',summary:bounded(decision.explanation?.summary,420)||'RunnerBear trenger ett svar før dagens belastning kan avklares.',primaryAction:{kind:'complete_checkin',label:'Svar på kroppssjekken'}};
  const proposal=proposalFor(decision,workout);
  if(proposal)return{...common,state:'adjust',tone:'attention',headline:bounded(decision.explanation?.title,180)||'Juster dagens dose',summary:bounded(decision.explanation?.summary,420)||'Coachens verifiserte forslag reduserer bare dagens dose.',primaryAction:{kind:'review_adjustment',label:'Se redusert dose'},proposal};
  if(decision.type==='reduce')return{...common,freshness:'unavailable',state:'refresh',tone:'quiet',headline:'Kontroller coachforslaget på nytt',summary:'Forslaget oppfyller ikke den låste sikkerhetskontrakten og kan ikke brukes.',primaryAction:{kind:'refresh_data',label:'Forny vurderingen'},proposal:null};
  return{...common,state:'follow',tone:decision.reasonCodes?.length?'watch':'calm',headline:bounded(decision.explanation?.title,180)||'Følg dagens økt',summary:bounded(decision.explanation?.summary,420)||'Dagens signaler støtter den planlagte dosen.',primaryAction:{kind:'open_workout',label:'Åpne dagens økt'}};
}

export function oneDecisionAudit(){
  const required=['open_workout','review_adjustment','complete_checkin','refresh_data','view_result','view_plan'];
  return{ok:required.every(kind=>ACTION_KINDS.has(kind)),version:ONE_DECISION_VERSION,states:['follow','adjust','clarify','refresh','completed','rest'],planWritesByAi:false,maximumReductionPercent:20};
}
