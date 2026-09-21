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
 // Presentation and explicit user previews only. No writes or plan authority here.
 function duration(workout={},model={}){
  const explicit=Number(workout.plannedDurationSeconds||0);
  if(explicit>0)return{seconds:explicit,label:`ca. ${Math.round(explicit/60)} min`};
  const i=model.interval||{};
  if(i.mode==='time'&&i.count>0&&i.workSeconds>0){
   const work=i.count*i.workSeconds+Math.max(0,i.count-1)*Number(i.recoverySeconds||0);
   return{seconds:work+25*60,label:`ca. ${Math.round((work+20*60)/60)}–${Math.round((work+30*60)/60)} min`};
  }
  return{seconds:0,label:workout.type==='rest'?'Hviledag':'Se øktstrukturen'};
 }
 function timeProposal({workout={},model={},minutes}={}){
  const budget=Number(minutes)*60,original=duration(workout,model),i=model.interval||{};
  if(![30,45,60].includes(Number(minutes)))return{error:'Velg 30, 45 eller 60 minutter.'};
  if(workout.type==='quality'){
   if(original.seconds&&original.seconds<=budget)return{error:'Den planlagte økten passer allerede innenfor tiden.'};
   if(i.mode!=='time'||!Number(i.count)||!Number(i.workSeconds)||!/terskel/i.test(workout.title||''))return{error:'Denne øktstrukturen må tilpasses via øktbanken. Velg en kortere kvalitetsøkt der.'};
   const recovery=Number(i.recoverySeconds||0),count=Math.min(i.count-1,Math.floor((budget-25*60+recovery)/(i.workSeconds+recovery)));
   if(count<2)return{error:'Tiden gir ikke plass til to drag med oppvarming og nedjogg. Velg mer tid eller en annen økt.'};
   const seconds=25*60+count*i.workSeconds+Math.max(0,count-1)*recovery,title=String(workout.title).replace(/\d+\s*[×x]\s*\d+\s*min/i,`${count} × ${i.workSeconds/60} min`),ratio=seconds/original.seconds;
   return{before:workout.title,after:title,beforeDuration:original.label,afterDuration:`ca. ${Math.round(seconds/60)} min`,workReductionSeconds:(i.count-count)*i.workSeconds,patch:{prescription:{version:1,warmup:{kind:'time',seconds:900},main:{kind:'intervals',repetitions:count,workSeconds:i.workSeconds,recoverySeconds:recovery},cooldown:{kind:'time',seconds:600}},type:workout.type,workoutType:workout.type,title,desc:`15 min oppvarming · ${count} × ${i.workSeconds/60} min · ${recovery} s pause · 10 min nedjogg`,detail:`${count} × ${i.workSeconds/60} min kontrollert terskel. ${recovery} s rolig pause mellom dragene. 15 min rolig oppvarming og 10 min nedjogg. Behold intensitetskontrollen; ikke øk farten. ${model.hrLabel||''} ${model.paceLabel||''}`,km:Number(workout.km||0)*ratio,plannedDistanceM:Math.round(Number(workout.km||0)*1000*ratio),plannedDurationSeconds:seconds}};
  }
  if(workout.type!=='easy'||original.seconds<=budget)return{error:original.seconds?'Den planlagte økten passer allerede innenfor tiden.':'Vi mangler en beregnet varighet. Velg en annen aktivitet eller se øktdetaljene.'};
  const ratio=budget/original.seconds,title=`${minutes} min rolig løp`;
  return{before:workout.title,after:title,beforeDuration:original.label,afterDuration:`${minutes} min`,patch:{prescription:{version:1,main:{kind:'continuous',seconds:budget}},type:'easy',workoutType:'easy',title,desc:`${minutes} min i behagelig snakketempo.`,detail:'Kortere varighet, samme rolige intensitet. Ingen kilometer skal tas igjen.',km:Number(workout.km||0)*ratio,plannedDistanceM:Math.round(Number(workout.km||0)*1000*ratio),plannedDurationSeconds:budget}};
 }
 return{fresh,presentation,receipt,questions,duration,timeProposal};
});
