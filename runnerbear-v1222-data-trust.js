/* Read-only activity availability. Independent of coach rollout and write authority. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RunnerBearDataTrust=api})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function history(snapshot,now=Date.now()){
    const rows=snapshot?.ok===true&&Array.isArray(snapshot.recentActivities)?snapshot.recentActivities:null,meta=snapshot?.activityHistory,age=now-Date.parse(meta?.syncedAt),current=!!rows&&meta?.version==='activity-history-1'&&meta.state==='current'&&age>=-60000&&age<=6*3600000;
    return{rows:rows||[],loaded:!!rows,current,truncated:meta?.truncated!==false,oldestDate:meta?.oldestDate||'',latestDate:meta?.latestDate||'',syncedAt:meta?.syncedAt||null,label:current?'Aktiviteter oppdatert':rows?.length?'Aktiviteter oppdateres':'Aktivitetshistorikken avklares'};
  }
  function covers(history,date){return /^\d{4}-\d{2}-\d{2}$/.test(date||'')&&history.current&&(!history.truncated||date>history.oldestDate)}
  return {history,covers};
});
