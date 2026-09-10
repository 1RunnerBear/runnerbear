/* Read-only daily presentation; user responses never grant plan authority. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RunnerBearRunningDay=api})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 function fresh(decision,now=Date.now()) {const generated=Date.parse(decision?.generatedAt),expires=decision?.validUntil?Date.parse(decision.validUntil):generated+15*60000;return decision?.freshness==='current'&&generated<=now+60000&&expires>now}
 function presentation({decision,body,workout,result=false,reported={},now=Date.now()}={}){
  const safety=(reported.reasons||[]).some(r=>['achilles','illness'].includes(r))||(body?.reasonCodes||[]).some(r=>/PAIN|ILLNESS|ACHILLES/.test(r)),attention=safety||['adjust','clarify','refresh'].includes(decision?.state)||body?.checkIn?.required||['adjust','recover','wait_for_data'].includes(body?.state),current=fresh(decision,now);
  if(attention||!current)return{mode:'attention',headline:safety?'Kroppen trenger en avklaring':current?decision?.headline||'Avklar dagens økt':'Dagens grunnlag oppdateres',action:safety?'complete_checkin':current?decision?.primaryAction?.kind||'view_plan':'view_plan',label:safety?'Se helsebildet':current?decision?.primaryAction?.label||'Se planen':'Se gjeldende plan'};
  if(result)return{mode:'result',headline:'Økten er registrert'};
  return{mode:workout?.type==='rest'?'rest':'workout',headline:workout?.title||'Dagens plan',action:'open_workout',label:'Se gjennomføringen'};
 }
 function receipt(events=[],workoutId,activityId,phase='post_workout') {return events.filter(r=>r.event_type==='feedback:workout'&&r.payload?.workoutId===workoutId&&(!r.payload.activityId||r.payload.activityId===activityId)&&(r.payload.responsePhase||'post_workout')===phase).sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at)))[0]||null}
 function questions({type,confidence,pain=false,phase='post_workout'}={}) {if(phase==='next_morning')return pain?[{key:'pain',label:'Hvordan er smerten eller stivheten i dag?',min:0,max:10}]:[];const rows=[];if(type==='quality')rows.push({key:'control',label:'Hvor kontrollert føltes siste drag?',options:[['controlled','Kontrollert'],['borderline','På grensen'],['uncontrolled','Ukontrollert']]});if(pain)rows.push({key:'pain',label:'Smerte eller ubehag etter økten?',min:0,max:10});else if(type==='quality'&&confidence!=='high')rows.push({key:'rpe',label:'Hvor krevende føltes økten?',options:[[4,'Lett · 4/10'],[6,'Moderat · 6/10'],[8,'Svært krevende · 8/10']]});return rows.slice(0,2)}
 return{fresh,presentation,receipt,questions};
});
