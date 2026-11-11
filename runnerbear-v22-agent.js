/* Proactive read model. Personal evidence stays in memory for this session. */
(function(){
 'use strict';let data=null,pending=null,checkedAt=0,retry=null,generation=0,warmingAttempts=0;
 const details=new Map(),detailPending=new Map(),detailChecked=new Map();
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo'}).format(new Date());
 const snapshot=()=>data?.snapshot?.localDate===today()&&!data?.stale&&!data?.warming?data.snapshot:null;
 const emit=()=>window.dispatchEvent(new CustomEvent('runnerbear:agent',{detail:{available:!!snapshot()}}));
 async function refresh(force=false){
  if(pending)return pending;if(!force&&Date.now()-checkedAt<60000)return data;
  const request=++generation,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  pending=(async()=>{try{
   const response=await fetch('/api/v2/agent',{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Agentgrunnlaget kunne ikke hentes.');
   const body=await response.json();if(body.ok!==true)throw Error('Ugyldig agentgrunnlag.');if(request!==generation)return;
   const previousRevision=data?.snapshot?.inputRevision,previousWarming=data?.warming,previousStale=data?.stale;
   checkedAt=Date.now();data=body.enabled&&body.snapshot?.version==='proactive-agent-1'?body:null;
   if(previousRevision!==data?.snapshot?.inputRevision||previousWarming!==data?.warming||previousStale!==data?.stale)emit();
   clearTimeout(retry);
   if(body.warming&&warmingAttempts<3){warmingAttempts++;retry=setTimeout(()=>refresh(true),3000);}
   if(body.snapshot&&!body.warming&&!body.stale)warmingAttempts=0;
   return data;
  }catch{checkedAt=Date.now();return data;}finally{clearTimeout(timer);pending=null;}})();return pending;
 }
 function workout(source,sourceId){
  const key=JSON.stringify([source,String(sourceId)]),current=snapshot()?.activities?.find(a=>a.source===source&&String(a.sourceId)===String(sourceId));if(current)return current;
  const cached=details.get(key);if(!detailPending.has(key)&&Date.now()-(detailChecked.get(key)||0)>=60000){
   detailChecked.set(key,Date.now());const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
   const task=(async()=>{try{const response=await fetch('/api/v2/agent/workout?'+new URLSearchParams({source,sourceId:String(sourceId)}),{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!response.ok)return;const value=await response.json();if(value.ok&&value.workout?.version==='workout-response-2'&&value.workout.source===source&&String(value.workout.sourceId)===String(sourceId)){details.set(key,value.workout);if(details.size>150)details.delete(details.keys().next().value);emit();}}catch{}finally{clearTimeout(timer);detailPending.delete(key);}})();detailPending.set(key,task);
  }return cached;
 }
 async function receipt(action){
  const primary=snapshot()?.primary;if(!primary)return;
  const response=await fetch('/api/v2/agent/receipt',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({itemId:primary.id,inputRevision:primary.inputRevision,action})});
  if(!response.ok)throw Error('Kunne ikke lagre at innsikten er lest.');data={...data,receipt:action};emit();
 }
 async function focusAction(action,kind,focusId){const response=await fetch('/api/v2/agent/focus',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({action,...(kind?{kind}:{}),...(focusId?{focusId}:{})})});if(!response.ok)throw Error('Fokuset kunne ikke lagres. Prøv igjen.');const result=await response.json();if(!result.ok)throw Error('Fokuset ble ikke bekreftet lagret.');data={...data,focus:result.focus};emit();return result.focus;}
 window.RunnerBearV22Agent=Object.freeze({snapshot,workout,focus:()=>data?.focus||null,focusAction,historySnapshot:()=>data?.snapshot||null,receipt:()=>data?.receipt||null,refresh,markSeen:()=>receipt('seen')});
 window.addEventListener('runnerbear:view',()=>refresh());
 window.addEventListener('runnerbear:canonical-changed',()=>{details.clear();detailChecked.clear();refresh(true)});
 window.addEventListener('focus',()=>refresh());
 setInterval(()=>{if(document.visibilityState==='visible')refresh()},60000);
 if(document.readyState==='complete')refresh();else window.addEventListener('load',()=>refresh(),{once:true});
})();
