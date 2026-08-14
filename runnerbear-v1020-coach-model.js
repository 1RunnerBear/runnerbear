/* RunnerBear UX v10.20 · pure coaching and intensity presentation model.
   UI layers consume these decisions and ranges; they do not duplicate the
   readiness thresholds or calculate overlapping training areas themselves. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return}
  root.RunnerBearV1020=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const BUILD='10.20';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

  const STATUS={
    plan_stands:{
      key:'plan_stands',headline:'Planen står',readiness:{score:8,label:'Klar',copy:'Det er trygt å følge dagens plan.'}
    },
    plan_margin:{
      key:'plan_margin',headline:'Planen står – med margin',readiness:{score:6,label:'Med margin',copy:'Følg planen, men behold tydelig kontroll.'}
    },
    adjust_day:{
      key:'adjust_day',headline:'Juster dagen',readiness:{score:4,label:'Juster',copy:'Reduser eller erstatt den planlagte belastningen.'}
    },
    prioritize_recovery:{
      key:'prioritize_recovery',headline:'Prioriter restitusjon',readiness:{score:2,label:'Restitusjon',copy:'Kvalitetsbelastning bør ikke gjennomføres i dag.'}
    }
  };

  function coachDecision({rawLevel='green',healthTone='neutral',hasRecoverySignals=false,severeSignal=false,message=''}={}){
    let status=STATUS.plan_stands;
    if(severeSignal||(rawLevel==='red'&&healthTone==='red'))status=STATUS.prioritize_recovery;
    else if(rawLevel==='red')status=STATUS.adjust_day;
    else if(rawLevel==='yellow'||healthTone==='yellow'||healthTone==='red'||!hasRecoverySignals)status=STATUS.plan_margin;
    const fallback={
      plan_stands:'RunnerBear ser ingen tydelige signaler som tilsier at dagens plan bør endres.',
      plan_margin:'Ett signal tilsier ekstra kontroll. Behold økten, men ikke jag fart eller bonusarbeid.',
      adjust_day:'Dagens belastning bør reduseres eller erstattes. Det som tas ut skal ikke tas igjen.',
      prioritize_recovery:'Kroppssignalene tilsier restitusjon fremfor kvalitet. Ingen treningsgjeld.'
    }[status.key];
    const rawMatches=status.key==='plan_stands'&&rawLevel==='green'||status.key==='plan_margin'&&rawLevel==='yellow'||['adjust_day','prioritize_recovery'].includes(status.key)&&rawLevel==='red';
    return{...status,message:String(rawMatches&&message?message:fallback),readiness:{...status.readiness}};
  }

  function deriveIntensityRanges({thresholdHr=0,maxHr=0}={}){
    const maximum=clamp(Math.round(maxHr)||188,150,230);
    const threshold=clamp(Math.round(thresholdHr)||Math.round(maximum*.91),Math.round(maximum*.82),maximum-1);
    const recoveryHigh=clamp(Math.round(maximum*.70),95,threshold-25);
    const thresholdLow=clamp(threshold-13,recoveryHigh+12,threshold-5);
    const greyHigh=thresholdLow-1;
    const greyLow=clamp(greyHigh-9,recoveryHigh+2,greyHigh);
    const easyLow=recoveryHigh+1;
    const easyHigh=greyLow-1;
    const rows=[
      {key:'recovery',label:'Restitusjon',min:null,max:recoveryHigh,description:'Svært lett arbeid',guidance:'Brukes når målet er å hente seg inn.',width:32},
      {key:'easy',label:'Rolig',min:easyLow,max:easyHigh,description:'Mesteparten av mengdetreningen',guidance:'Snakketempo og lav kostnad.',width:64},
      {key:'grey',label:'Gråsone',min:greyLow,max:greyHigh,description:'Begrenset bruk',guidance:'Unngå unødvendig mellomintensitet.',width:42},
      {key:'threshold',label:'Terskel',min:thresholdLow,max:threshold,description:'Kontrollert kvalitetsarbeid',guidance:'Repeterbar kvalitet rundt individuell terskel.',width:72},
      {key:'above_threshold',label:'Over terskel',min:threshold+1,max:null,description:'Kun når planen krever det',guidance:'Kortere og hardere arbeid med tydelig formål.',width:28}
    ];
    return{build:BUILD,thresholdHr:threshold,maxHr:maximum,ranges:rows};
  }

  function validateIntensityRanges(value){
    const rows=Array.isArray(value)?value:value?.ranges;
    if(!Array.isArray(rows)||rows.length!==5)return false;
    for(let i=0;i<rows.length;i+=1){
      const current=rows[i];
      if(current.min!=null&&current.max!=null&&current.min>current.max)return false;
      if(i>0){
        const previous=rows[i-1];
        if(previous.max==null||current.min==null||previous.max+1!==current.min)return false;
      }
    }
    return rows[0].min==null&&rows.at(-1).max==null;
  }

  function dayState({date='',today='',planType='easy',hasActivity=false,deviates=false}={}){
    if(hasActivity&&deviates)return{code:'completed_deviation',label:'Gjennomført · avviker fra planen'};
    if(hasActivity)return{code:'completed',label:'Gjennomført'};
    if(planType==='rest')return{code:'rest',label:'Hviledag'};
    if(date&&today&&date<today)return{code:'missed',label:'Ikke gjennomført'};
    if(planType==='cross')return{code:'alternative',label:'Alternativ trening'};
    return{code:'planned',label:'Planlagt'};
  }

  return{BUILD,STATUS,coachDecision,deriveIntensityRanges,validateIntensityRanges,dayState};
});
