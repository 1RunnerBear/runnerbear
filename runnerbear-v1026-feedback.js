/* RunnerBear v10.26 · decision-relevant post-workout feedback. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return}
  root.RunnerBearFeedbackV1026=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const allowed=new Set(['rpe','control','pain','pain_increased','illness','stress','poor_sleep','sourceId','localDate','responseDate','responsePhase','workoutId','planRevisionId']);
  function normalize(input={}){
    const out={};
    for(const [key,value] of Object.entries(input||{}))if(allowed.has(key))out[key]=value;
    if(out.rpe!=null){out.rpe=Math.round(Number(out.rpe));if(out.rpe<1||out.rpe>10)throw new Error('RPE must be 1–10')}
    if(out.pain!=null){out.pain=Math.round(Number(out.pain));if(out.pain<0||out.pain>10)throw new Error('Pain must be 0–10')}
    if(out.control!=null&&!['controlled','borderline','uncontrolled'].includes(out.control))throw new Error('Invalid control value');
    if(out.responsePhase!=null&&!['post_workout','next_morning'].includes(out.responsePhase))throw new Error('Invalid response phase');
    return out;
  }
  function questions({workout={},assessment={}}={}){
    const rows=[];
    if(workout.workoutType==='quality'||workout.type==='quality')rows.push({key:'control',label:'Hvor kontrollert føltes siste drag?',options:['controlled','borderline','uncontrolled']});
    if(assessment.requiresPainCheck===true)rows.push({key:'pain',label:'Akilles eller smerte etter økten?',min:0,max:10});
    else if(assessment.confidence!=='high'||assessment.volumeRatio>1.25)rows.push({key:'rpe',label:'Hvor krevende føltes økten?',min:1,max:10});
    return rows.slice(0,2);
  }
  return{normalize,questions};
});
