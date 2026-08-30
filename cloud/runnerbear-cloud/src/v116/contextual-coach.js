export const CONTEXTUAL_COACH_BUILD='11.6.0';
export const CONTEXTUAL_COACH_VERSION='contextual-coach-1';

const bounded=(value,max=180)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const action=value=>value&&typeof value==='object'?{
  kind:bounded(value.kind,40),
  label:bounded(value.label,64),
  workoutId:bounded(value.workoutId,160)||null,
}:null;

function todaySurface(bootstrap){
  const decision=bootstrap?.oneDecision;
  if(!decision||decision.planRevisionId!==bootstrap?.planRevisionId)return{visible:false,reason:'no-current-decision'};
  return{
    visible:true,
    tone:bounded(decision.tone,24)||'calm',
    headline:bounded(decision.headline,90)||'Følg dagens plan',
    summary:bounded(decision.summary,240)||'Dagens plan står.',
    why:(decision.evidence||[]).slice(0,1).map(row=>bounded(row.label,140)).filter(Boolean)[0]||null,
    primaryAction:action(decision.primaryAction),
  };
}

function healthSurface(bootstrap){
  const body=bootstrap?.bodyResponse;
  if(!body||body.planRevisionId&&body.planRevisionId!==bootstrap?.planRevisionId)return{visible:false,reason:'no-current-body-response'};
  const needsAttention=!['as_planned'].includes(body.state)||body.freshness?.status!=='fresh'||body.baselineStatus?.status!=='established';
  return{
    visible:needsAttention,
    state:bounded(body.state,32),
    headline:bounded(body.stateLabel,80)||'Kroppens respons',
    summary:bounded(body.summary,220),
    consequence:bounded(body.recommendedAction?.label,90)||'Planen står',
    trendFirst:true,
  };
}

function postWorkoutSurface(bootstrap){
  const decision=bootstrap?.oneDecision,followUp=bootstrap?.coachContinuity?.followUp;
  const visible=['reflect','completed'].includes(decision?.state)||followUp?.phase==='post_workout';
  if(!visible)return{visible:false,reason:'no-verified-result'};
  return{
    visible:true,
    headline:bounded(decision?.headline,90)||'Økten er registrert',
    summary:bounded(decision?.summary,220)||'Gjennomføringen brukes i neste vurdering.',
    consequence:'Resten av uken vurderes fra den registrerte responsen.',
    primaryAction:action(decision?.primaryAction||{kind:'view_result',label:'Se resultatet'}),
  };
}

function planSurface(bootstrap){
  const brief=bootstrap?.coachBrief,proposal=bootstrap?.realignmentProposal,changed=brief?.today?.planChanged===true||['proposed','ready'].includes(proposal?.status);
  if(!changed)return{visible:false,reason:'plan-unchanged'};
  return{
    visible:true,
    headline:bounded(brief?.today?.title||proposal?.headline,90)||'Planen er justert',
    summary:bounded(brief?.today?.summary||proposal?.summary,220),
    why:bounded(brief?.week?.reason||proposal?.reason,180),
    affectedWorkoutIds:(brief?.today?.affectedWorkoutIds||proposal?.affectedWorkoutIds||[]).slice(0,8).map(value=>bounded(value,160)).filter(Boolean),
  };
}

function weeklySurface(bootstrap){
  const review=bootstrap?.weeklyReview;
  if(!review||review.planRevisionId!==bootstrap?.planRevisionId)return{visible:false,reason:'review-not-ready'};
  const body=bootstrap?.bodyResponse,healthPriority=body&&!['as_planned'].includes(body.state)?body.recommendedAction?.label:null,priorities=[review.nextDirection,healthPriority].map(value=>bounded(value,180)).filter((value,index,rows)=>value&&rows.indexOf(value)===index).slice(0,2);
  return{
    visible:true,
    headline:bounded(review.headline,90),
    summary:bounded(review.coachComment||review.nextDirection,220),
    whatWentWell:bounded(review.learning||review.coachComment,220),
    healthTrend:bounded(body?.stateLabel,80)||'Helsebildet bygges videre',
    priorities,
    dataQuality:bounded(review.dataQuality,24),
  };
}

function goalSurface(bootstrap){
  const confidence=bootstrap?.goalConfidence;
  if(!confidence||!confidence.level||confidence.level==='insufficient')return{visible:false,reason:'no-meaningful-new-evidence'};
  return{
    visible:true,
    headline:confidence.sufficient?'Målretningen har støtte':'Målretningen er foreløpig',
    summary:bounded(confidence.summary||confidence.nextEvidence,220),
    confidence:bounded(confidence.level,24),
    nextEvidence:bounded(confidence.nextEvidence,140)||null,
  };
}

export function buildContextualCoach(bootstrap={}){
  return{
    version:CONTEXTUAL_COACH_VERSION,
    planRevisionId:bounded(bootstrap?.planRevisionId,160),
    generatedAt:bounded(bootstrap?.generatedAt||new Date().toISOString(),40),
    mode:'background',
    surfaces:{
      today:todaySurface(bootstrap),
      health:healthSurface(bootstrap),
      postWorkout:postWorkoutSurface(bootstrap),
      plan:planSurface(bootstrap),
      weekly:weeklySurface(bootstrap),
      goal:goalSurface(bootstrap),
    },
    safety:{planWritesByAi:false,maximumReductionPercent:20,rawHealthValuesExposed:false,oneRecommendationPerSurface:true},
  };
}

export function contextualCoachAudit(){
  return{
    ok:true,
    version:CONTEXTUAL_COACH_VERSION,
    mode:'background',
    surfaces:['today','health','postWorkout','plan','weekly','goal'],
    silentWhenNormal:true,
    oneRecommendationPerSurface:true,
    planWritesByAi:false,
    maximumReductionPercent:20,
    rawHealthValuesExposed:false,
    coachLive:false,
    coachLiveRoutes:false,
    navigationTabs:4,
  };
}

export function retiredCoachLiveResponse(){
  return Response.json({ok:false,code:'COACH_LIVE_REMOVED',error:'Coach Live er fjernet. RunnerBear gir nå korte coachråd der de er relevante.',replacement:CONTEXTUAL_COACH_VERSION},{status:410,headers:{'cache-control':'no-store'}});
}
