/* RunnerBear v10.22 · tiny cached-data adapter and fatal-init observability. */
(function(){
  'use strict';
  const BUILD='10.22',CACHE='runnerbear_tredict_cache_v1';
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'')??fallback}catch{return fallback}};
  const latestTuple=(obj={})=>{const keys=Object.keys(obj).sort(),today=new Date().toISOString().slice(0,10).replaceAll('-',''),valid=keys.filter(key=>key<=today),key=(valid.length?valid:keys).at(-1);return key?{key,value:obj[key]}:null};
  function latestRhr(rows=[]){
    const values=rows.filter(row=>Number(row?.hrRestDynamic||row?.restingHeartrate)>0).sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp)));
    if(!values.length)return null;
    const last=values.at(-1),baseline=values.slice(-14).map(row=>Number(row.hrRestDynamic||row.restingHeartrate)).filter(Boolean).sort((a,b)=>a-b),middle=Math.floor(baseline.length/2);
    return{value:Number(last.hrRestDynamic||last.restingHeartrate),baseline:baseline.length?(baseline.length%2?baseline[middle]:(baseline[middle-1]+baseline[middle])/2):null,date:last.timestamp};
  }
  function recoverySignal(){
    const cache=read(CACHE,{}),hrv=latestTuple(cache.hrv),sleep=latestTuple(cache.sleep),rhr=latestRhr(cache.body),flags=[];
    const hrvValue=hrv?.value?.[0],hrvBaseline=hrv?.value?.[1],sleepValue=sleep?.value?.[0],sleepBaseline=sleep?.value?.[1];
    if(hrvValue&&hrvBaseline&&hrvValue<hrvBaseline*.85)flags.push('hrv');
    if(sleepValue&&sleepBaseline&&sleepValue<sleepBaseline*.85)flags.push('sleep');
    if(rhr?.value&&rhr?.baseline&&rhr.value>=rhr.baseline+5)flags.push('rhr');
    return{level:flags.length>=2?'red':flags.length===1?'yellow':'green',flags,hrv:hrv?{value:hrvValue,baseline:hrvBaseline,date:hrv.key}:null,sleep:sleep?{value:sleepValue,baseline:sleepBaseline,date:sleep.key}:null,rhr};
  }
  window.RunnerBearTredict={...(window.RunnerBearTredict||{}),recoverySignal};
  window.addEventListener('error',event=>console.error(JSON.stringify({event:'runnerbear_frontend_error',build:BUILD,message:String(event.message||'Unknown frontend error'),source:String(event.filename||'').split('/').pop(),line:Number(event.lineno||0)})));
  window.addEventListener('unhandledrejection',event=>console.error(JSON.stringify({event:'runnerbear_unhandled_rejection',build:BUILD,message:String(event.reason?.message||event.reason||'Unhandled promise rejection')})));
})();
