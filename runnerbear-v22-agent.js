/* Proactive read model. No raw health data persisted in browser storage. */
(function(){
 'use strict';let data=null,pending=null,checkedAt=0,retry=null,generation=0,warmingAttempts=0;
 async function refresh(force=false){
  if(pending)return pending;if(!force&&Date.now()-checkedAt<60000)return data;
  const request=++generation,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  pending=(async()=>{try{
   const response=await fetch('/api/v2/agent',{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Agentgrunnlaget kunne ikke hentes.');
   const body=await response.json();if(body.ok!==true)throw Error('Ugyldig agentgrunnlag.');if(request!==generation)return;
   const previousRevision=data?.snapshot?.inputRevision;
   checkedAt=Date.now();data=body.enabled&&body.snapshot?.version==='proactive-agent-1'?body:null;
   if(previousRevision!==data?.snapshot?.inputRevision)window.dispatchEvent(new CustomEvent('runnerbear:agent',{detail:{available:!!data?.snapshot}}));
   if(body.warming&&warmingAttempts++<3){clearTimeout(retry);retry=setTimeout(()=>refresh(true),3000);}
   if(body.snapshot)warmingAttempts=0;
   return data;
  }catch{checkedAt=Date.now();return data;}finally{clearTimeout(timer);pending=null;}})();return pending;
 }
 async function receipt(action){
  const primary=data?.snapshot?.primary;if(!primary)return;
  const response=await fetch('/api/v2/agent/receipt',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({itemId:primary.id,inputRevision:primary.inputRevision,action})});
  if(!response.ok)throw Error('Kunne ikke lagre at innsikten er lest.');
  data={...data,receipt:action};window.dispatchEvent(new CustomEvent('runnerbear:agent',{detail:{available:true}}));
 }
 window.RunnerBearV22Agent=Object.freeze({snapshot:()=>data?.snapshot?.localDate===new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo'}).format(new Date())&&!data?.stale?data.snapshot:null,receipt:()=>data?.receipt||null,refresh,markSeen:()=>receipt('seen')});
 window.addEventListener('runnerbear:view',()=>refresh());
 window.addEventListener('runnerbear:canonical-changed',()=>refresh(true));
 window.addEventListener('focus',()=>refresh());
 setInterval(()=>{if(document.visibilityState==='visible')refresh()},60000);
 if(document.readyState==='complete')refresh();else window.addEventListener('load',()=>refresh(),{once:true});
})();
