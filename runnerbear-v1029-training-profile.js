/* RunnerBear v10.29.0 · automatic training-profile model */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RunnerBearTrainingProfileV1029=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||min));
  const roundHalf=value=>Math.round(Number(value||0)*2)/2;
  const days=value=>[...new Set((Array.isArray(value)?value:[]).map(Number).filter(day=>Number.isInteger(day)&&day>=0&&day<=6))].sort((a,b)=>a-b);

  function automaticVolume({anchorKm,baseKm=50}={}){
    const workingKm=roundHalf(clamp(Number(anchorKm)||Number(baseKm)||50,35,65));
    const normalLow=roundHalf(Math.max(30,workingKm-2));
    const normalHigh=roundHalf(Math.min(85,workingKm+2));
    const maxKm=roundHalf(Math.max(normalHigh,Math.min(90,workingKm*1.10)));
    return{baseKm:workingKm,normalLow,normalHigh,maxKm,targetWeeklyVolume:workingKm,autoVolume:true,source:'history-continuity-goal'};
  }

  function rhythm({runDays,qualityDays,longRunDay}={}){
    const running=days(runDays),quality=days(qualityDays),long=Number(longRunDay),alternativeDays=[0,1,2,3,4,5,6].filter(day=>!running.includes(day));
    return{runDays:running,qualityDays:quality,longRunDay:long,alternativeDays,minRunDays:running.length,maxRunDays:running.length,flexibleSessions:Math.min(2,alternativeDays.length)};
  }

  return{version:'10.29.0',automaticVolume,rhythm};
});
