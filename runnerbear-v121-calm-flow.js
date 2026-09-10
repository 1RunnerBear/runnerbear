/* Presentation-only state. Never writes a workout, plan revision or sync operation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RunnerBearCalmFlow=api})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const key='runnerbear_v121_seen_content';
  const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
  // Explicit user-visible fields: transport timestamps/revision IDs cannot resurrect a message.
  function reviewContent(review){if(!review)return null;return {weekStart:review.weekStart||review.period?.start||review.week?.start,weekEnd:review.weekEnd||review.period?.end||review.week?.end,headline:review.headline,coachComment:review.coachComment,nextDirection:review.nextDirection,learning:review.learning,totals:review.totals,longRun:review.longRun,sessions:(review.sessions||[]).map(r=>({date:r.localDate||r.date,title:r.title,status:r.status,actualDistanceM:r.actualDistanceM,actualDurationSeconds:r.actualDurationSeconds}))}}
  function fingerprint(value){return JSON.stringify(stable(value))}
  function records(storage){try{const value=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(value)?value.filter(r=>r&&typeof r==='object'):[]}catch{return[]}}
  function hasSeen(storage,kind,content){return records(storage).some(r=>r.kind===kind&&r.content===fingerprint(content))}
  function markSeen(storage,kind,content,revision=''){const value=fingerprint(content),rows=records(storage).filter(r=>!(r.kind===kind&&r.content===value));rows.push({kind,content:value,revision,seenAt:new Date().toISOString()});try{storage.setItem(key,JSON.stringify(rows.slice(-50)))}catch{}}
  function chooseSupport({transport,change,response,race,review,priority}){return transport||change||response||race||review||priority||''}
  function exceptionalSync(status){return ['failed_retryable','failed_terminal','review_required','error','retry','action'].includes(status)}
  function syncDelayed(timestamp,now=Date.now()){const at=Date.parse(timestamp);return Number.isFinite(at)&&now-at>10*60*1000}
  return {reviewContent,fingerprint,hasSeen,markSeen,chooseSupport,exceptionalSync,syncDelayed};
});
