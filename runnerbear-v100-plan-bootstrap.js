/* RunnerBear v10.0 · Bakken plan bootstrap
   Runs immediately after plan.js and before the legacy render stack.
   Purpose: keep the plan anchored to real running history and hard safety rails.
*/
(function(){
  'use strict';
  const PROFILE_KEY='runfest26_training_profile_v10';
  const CACHE_KEY='runnerbear_tredict_cache_v1';
  const defaults={
    baseKm:50,
    normalLow:48,
    normalHigh:52,
    maxKm:55,
    minRunDays:5,
    flexibleSessions:2,
    autoVolume:true,
    thresholdPaceSec:242,
    thresholdHr:173,
    maxHr:188
  };
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')??f}catch{return f}};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const roundHalf=v=>Math.round(v*2)/2;
  const profile=Object.assign({},defaults,read(PROFILE_KEY,{}));

  function normalizeActivity(a){
    const s=a?.summary||a?.extendedSummary||a||{};
    return{
      date:a?.date||s?.date||'',
      sportType:String(a?.sportType||s?.sportType||'').toLowerCase(),
      subSportType:String(a?.subSportType||s?.subSportType||'').toLowerCase(),
      distance:Number(s?.distance||a?.distance||0)
    };
  }
  function recentRunBase(){
    const cache=read(CACHE_KEY,{});
    const acts=(cache.activities||[]).map(normalizeActivity).filter(a=>a.sportType==='running'&&a.distance>0&&Date.parse(a.date));
    if(acts.length<6)return Number(profile.baseKm)||50;
    const now=Date.now(),cut=now-42*86400000;
    const rows=acts.filter(a=>Date.parse(a.date)>=cut&&Date.parse(a.date)<=now+86400000).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
    if(rows.length<6)return Number(profile.baseKm)||50;
    const first=Date.parse(rows[0].date);
    const span=Math.max(1,(now-first)/86400000);
    if(span<18)return Number(profile.baseKm)||50;
    const totalKm=rows.reduce((s,a)=>s+a.distance/1000,0);
    const observed=totalKm/(span/7);
    if(!Number.isFinite(observed)||observed<20||observed>90)return Number(profile.baseKm)||50;
    return roundHalf(clamp(observed*.75+Number(profile.baseKm||50)*.25,35,65));
  }
  function phaseTarget(w,anchor){
    const original=Number(w.km)||0;
    if(!profile.autoVolume)return Math.min(original,Number(profile.maxKm)||55);
    const cap=Math.min(Number(profile.maxKm)||55,roundHalf(anchor*1.10));
    const phase=String(w.phase||'').toLowerCase();
    let target=anchor;
    if(/race/.test(phase))target=original;
    else if(/taper/.test(phase))target=anchor*.92;
    else if(/absorber/.test(phase))target=anchor*.96;
    else if(/spesifikk/.test(phase))target=anchor*(w.n===6?1.08:1.06);
    else if(/bygge/.test(phase))target=anchor*(w.n>=3?1.06:1.04);
    target=roundHalf(target);
    return roundHalf(Math.min(original,cap,target));
  }
  function isRunDay(d){return Number(d?.[6]||0)>0&&['easy','quality','race'].includes(d?.[1])}
  function isLong(d){return /langtur/i.test(String(d?.[2]||''))}
  function replaceLeadingKm(text,value){
    const v=Number.isInteger(value)?String(value):String(value).replace('.',',');
    return String(text||'').replace(/^\d+(?:[.,]\d+)?\s*km/i,`${v} km`);
  }
  function rebalanceWeek(w,target,anchor){
    const days=w.days||[];
    const original=roundHalf(days.reduce((s,d)=>s+Number(d?.[6]||0),0));
    const runDays=days.filter(isRunDay).length;
    const minimumRunDays=Math.min(Number(profile.minRunDays)||5,runDays);
    let excess=roundHalf(original-target);
    if(excess<=0){
      w.km=original;
      w.rbPolicy={originalKm:original,targetKm:target,anchorKm:anchor,runDays,minimumRunDays,adjusted:false};
      return;
    }

    const regular=days.filter(d=>d?.[1]==='easy'&&!isLong(d)).sort((a,b)=>Number(b[6])-Number(a[6]));
    const longs=days.filter(d=>d?.[1]==='easy'&&isLong(d)).sort((a,b)=>Number(b[6])-Number(a[6]));
    const candidates=[...regular,...longs];
    let guard=0;
    while(excess>.001&&guard++<300){
      let changed=false;
      for(const d of candidates){
        const cur=Number(d[6]||0);
        const min=isLong(d)?(/taper|race/i.test(String(w.phase))?10:14):5;
        if(cur-min>=.5&&excess>.001){
          d[6]=roundHalf(cur-.5);
          d[2]=replaceLeadingKm(d[2],d[6]);
          excess=roundHalf(excess-.5);
          changed=true;
        }
      }
      if(!changed)break;
    }
    w.km=roundHalf(days.reduce((s,d)=>s+Number(d?.[6]||0),0));
    w.rbPolicy={
      originalKm:original,
      targetKm:target,
      anchorKm:anchor,
      runDays:days.filter(isRunDay).length,
      minimumRunDays,
      adjusted:w.km<original,
      flexibleMax:Number(profile.flexibleSessions)||2
    };
  }

  const weeks=Array.isArray(window.RUNFEST_WEEKS)?window.RUNFEST_WEEKS:[];
  const anchor=recentRunBase();
  weeks.forEach(w=>rebalanceWeek(w,phaseTarget(w,anchor),anchor));
  window.RunnerBearPlanPolicy={
    version:'10.0',
    profile,
    anchorKm:anchor,
    normalRange:[Math.max(0,roundHalf(anchor-2)),roundHalf(Math.min(Number(profile.maxKm)||55,anchor+2))],
    weeks:weeks.map(w=>({n:w.n,km:w.km,meta:w.rbPolicy||{}})),
    isFlexibleDay(day){
      if(!day)return false;
      const type=day[1],text=`${day[2]||''} ${day[3]||''} ${day[4]||''}`;
      return type==='cross'||(type==='rest'&&/(zwift|concept2|roing|sykkel)/i.test(text));
    }
  };
})();
