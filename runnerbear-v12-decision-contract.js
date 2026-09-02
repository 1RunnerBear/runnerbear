/* RunnerBear v12.0 · one coherent presentation contract. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return}
  root.RunnerBearV12Decision=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function requiresAction(decision={}){
    const kind=decision.primaryAction?.kind;
    return(decision.state==='adjust'&&kind==='review_adjustment'&&!!decision.proposal)||(decision.state==='clarify'&&kind==='complete_checkin');
  }
  function presentation({decision=null,body=null,brief=null}={}){
    const action=requiresAction(decision||{}),watch=!action&&brief?.attention==='watch',weekTone=action?'action':watch?'watch':'normal';
    let healthHeadline=body?.stateLabel||'Helsebildet bygges',healthSummary=body?.summary||'RunnerBear venter på nok ferske data til å tolke en personlig trend.';
    if(body?.state==='as_planned'&&decision?.state==='adjust'){
      healthHeadline='Kroppssignalene er normale';
      healthSummary='Den foreslåtte dosen bygger på samlet belastning og treningsrespons – ikke et enkelt avvik i søvn, HRV eller hvilepuls.';
    }else if(body?.state==='as_planned'&&decision?.state==='clarify'){
      healthHeadline='Kroppssignalene er normale';
      healthSummary='Coachen trenger ett kort svar om egenfølelsen før dagens dose avklares.';
    }
    return{actionRequired:action,weekTone,weekStatus:action?'Handling kreves':watch?'Følg med':'Planen står',healthHeadline,healthSummary};
  }
  return{requiresAction,presentation};
});
