/* RunnerBear v10.12 · sync trust + conservative evidence layer
   Keeps v10.9 coaching and design intact, but makes freshness, publishing and
   trend confidence explicit when the underlying data is not strong enough. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return}
  root.RunnerBearV1011=api;
  api.mount(root);
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const BUILD='10.12';
  const CACHE='runnerbear_tredict_cache_v1';
  const LAST='runnerbear_tredict_last_sync';
  const OUTBOUND='runnerbear_tredict_outbound_v1';
  const SYNC_ERROR='runnerbear_v1011_sync_error';
  const EXCLUSIONS='runnerbear_v108_match_exclusions';
  const MATCH='runnerbear_tredict_match_';
  const SELECTED='runnerbear_v108_selected_day';
  const FRESH_MS=6*3600000;
  const OLD_MS=24*3600000;

  function parseJson(raw,fallback={}){try{return JSON.parse(raw)}catch{return fallback}}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function setText(el,value){const next=String(value??'');if(el&&el.textContent!==next)el.textContent=next}
  function parseClock(value){
    const p=String(value||'').trim().split(':').map(Number);if(p.some(x=>!Number.isFinite(x)||x<0))return 0;
    if(p.length===3)return p[0]*3600+p[1]*60+p[2];if(p.length===2)return p[0]*60+p[1];return 0;
  }
  function fmtClock(sec){
    sec=Math.max(0,Math.round(Number(sec)||0));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;
  }
  function localDate(){
    const d=new Date(),z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
  }
  function ageLabel(age){
    if(!Number.isFinite(age))return'';const min=Math.max(0,Math.round(age/60000));
    if(min<2)return'nå';if(min<60)return`${min} min siden`;const h=Math.round(min/60);if(h<24)return`${h} t siden`;return`${Math.round(h/24)} d siden`;
  }
  function syncHealth({now=Date.now(),syncedAt=0,error='',online=true}={}){
    const at=typeof syncedAt==='number'?syncedAt:Date.parse(syncedAt||0),age=at?Math.max(0,now-at):Infinity;
    if(error)return{code:'error',tone:'error',age,at,label:'Synkfeil',short:'Garmin-synk feilet',copy:'RunnerBear bruker siste kjente data. Hent på nytt før nye coachkonklusjoner får høy sikkerhet.'};
    if(!online)return{code:'offline',tone:'warn',age,at,label:'Frakoblet',short:'Ingen nettforbindelse',copy:'Siste kjente data beholdes. RunnerBear oppdaterer når forbindelsen er tilbake.'};
    if(!at)return{code:'missing',tone:'warn',age,at,label:'Venter på data',short:'Garmin-data ikke bekreftet',copy:'RunnerBear har ikke et sikkert tidspunkt for siste innhenting.'};
    if(age>OLD_MS)return{code:'stale',tone:'warn',age,at,label:'Gamle data',short:`Garmin-data ${ageLabel(age)}`,copy:'Dataene er eldre enn ett døgn. Dagens plan vises, men nye belastnings- og trendkonklusjoner tones ned.'};
    if(age>FRESH_MS)return{code:'aging',tone:'soft',age,at,label:'Bør oppdateres',short:`Garmin-data ${ageLabel(age)}`,copy:'Dataene er brukbare, men en ny synk gir sikrere vurdering av dagens respons.'};
    return{code:'fresh',tone:'ok',age,at,label:'Oppdatert',short:`Garmin oppdatert ${ageLabel(age)}`,copy:'Innkommende data er ferske.'};
  }
  function evidenceConfidence({evidence=0,history=0,distance='half',longKm=0,anchorKm=0}={}){
    const n=Math.max(Number(evidence)||0,Number(history)||0);
    if(distance==='marathon'){
      if(evidence>=4&&longKm>=24&&anchorKm>=55)return{code:'solid',label:'Solid',spread:1,copy:'Flere relevante kvalitetsøkter og maratonspesifikt langturgrunnlag støtter estimatet.'};
      if(evidence>=3&&longKm>=18)return{code:'adequate',label:'Tilstrekkelig',spread:1.6,copy:'Terskelgrunnlaget er brukbart, men maratonspesifikk sikkerhet mangler fortsatt.'};
      return{code:'limited',label:'Begrenset',spread:2.4,copy:'For lite maratonspesifikt grunnlag til en smal prognose.'};
    }
    if(evidence>=4&&history>=2&&(distance!=='half'||longKm>=14))return{code:'solid',label:'Solid',spread:1,copy:'Minst fire relevante kvalitetsøkter gir et stabilt kapasitetsgrunnlag.'};
    if(evidence>=3||history>=4)return{code:'adequate',label:'Tilstrekkelig',spread:1.6,copy:'Minst tre relevante datapunkter støtter estimatet, men området holdes fortsatt bredt.'};
    return{code:'limited',label:'Begrenset',spread:2.4,copy:'RunnerBear trenger minst tre relevante datapunkter før retningen får tydelig vekt.'};
  }
  function thresholdSummary(rows=[]){
    const all=(Array.isArray(rows)?rows:[]).filter(x=>Number(x?.pace)>0&&Number(x?.hr)>0).slice(-12),groups=new Map();all.forEach(x=>{const key=x.family||'legacy';groups.set(key,[...(groups.get(key)||[]),x])});
    const selected=[...groups.values()].sort((a,b)=>b.length-a.length||String(b.at(-1)?.date||'').localeCompare(String(a.at(-1)?.date||'')))[0]||[],clean=selected.slice(-8);
    if(clean.length<3)return{code:'building',label:'Bygger datagrunnlag',copy:`${clean.length||'Ingen'} ${clean.length===1?'relevant økt':'relevante økter'} med arbeidsfart og puls. Minst tre sammenlignbare økter kreves før RunnerBear beskriver en trend.`};
    const first=clean[0],last=clean.at(-1),hrGap=Math.abs(Number(first.hr)-Number(last.hr)),paceDelta=Number(first.pace)-Number(last.pace);
    if(hrGap<=3&&paceDelta>=3)return{code:'positive',label:'Positiv retning',copy:`Ved omtrent samme puls er siste arbeidsfart ${Math.round(paceDelta)} sek/km raskere enn det eldste sammenlignbare datapunktet.`};
    if(hrGap<=3&&Math.abs(paceDelta)<=2)return{code:'stable',label:'Stabil terskel',copy:'Arbeidsfarten er stabil ved sammenlignbar puls. RunnerBear ser kontrollert kapasitet, ikke en sikker endring ennå.'};
    return{code:'unclear',label:'Uavklart retning',copy:'Minst tre økter finnes, men puls og fart er ikke sammenlignbare nok til en tydelig trendpåstand.'};
  }
  function publicationState({outbound={},signature='',queueLength=0}={}){
    const published=['published','calendar-active'].includes(outbound?.status)&&!!outbound?.planId;
    const current=published&&!!signature&&outbound?.clientSignature===signature;
    if(outbound?.status==='calendar-active'&&current)return{code:'active',label:'Garmin-kalender aktiv',copy:`${outbound.calendarCount||queueLength} økter bekreftet via Tredict.`};
    if(current)return{code:'published',label:'Publisert til Tredict',copy:`${outbound.workoutCount||queueLength} kommende økter er publisert. Garmin-integrasjonen håndteres videre i Tredict.`};
    if(published)return{code:'changed',label:'Plan endret',copy:'RunnerBear-planen er endret siden siste publisering. Publiser oppdatert plan før du forventer siste versjon på Garmin.'};
    if(outbound?.status==='review-required')return{code:'review',label:'Kontroller kalender',copy:'Tredict-planen finnes, men kalenderstatus må kontrolleres.'};
    return{code:'ready',label:'Klar for publisering',copy:`${queueLength} kommende løpeøkter kan publiseres via Tredict til Garmin.`};
  }

  function mount(win){
    if(!win?.document||!win?.localStorage)return;
    const doc=win.document,ls=win.localStorage;
    let patching=false,timer=0,lastSyncError=parseJson(ls.getItem(SYNC_ERROR)||'null',null);

    function coach(){return win.RunnerBearCoachOS||null}
    function cache(){return parseJson(ls.getItem(CACHE)||'{}',{})}
    function outbound(){return win.RunnerBearCloud?.cachedOutbound?.()||parseJson(ls.getItem(OUTBOUND)||'{}',{})}
    function syncSnapshot(){
      const c=cache(),at=c.syncedAt||ls.getItem(LAST)||0,err=parseJson(ls.getItem(SYNC_ERROR)||'null',null);
      return syncHealth({syncedAt:at,error:err?.message||'',online:win.navigator?.onLine!==false});
    }
    function setSyncError(error){
      if(!error){ls.removeItem(SYNC_ERROR);lastSyncError=null;return}
      lastSyncError={at:new Date().toISOString(),message:String(error?.message||error||'Synkronisering feilet')};ls.setItem(SYNC_ERROR,JSON.stringify(lastSyncError));
    }
    async function runSync(button){
      if(button){button.disabled=true;button.textContent='Henter Garmin-data…'}
      try{await win.RunnerBearBridge?.sync?.(true);setSyncError(null);coach()?.render?.()}
      catch(error){setSyncError(error);patchSoon(0)}
      finally{if(button){button.disabled=false;button.textContent='Hent Garmin-data'}patchSoon(80)}
    }
    function patchSync(){
      const snap=syncSnapshot(),header=doc.querySelector('#rb107Today .rb107-sync');
      if(header){header.classList.toggle('stale',snap.code!=='fresh');header.classList.toggle('rb1011-error',snap.code==='error');const span=header.querySelector('span');if(span)setText(span,snap.short)}
      const shell=doc.querySelector('#rb107Today .rb107-shell'),head=doc.querySelector('#rb107Today .rb107-today-head');
      let note=doc.getElementById('rb1011SyncTrust');
      const needs=snap.code!=='fresh';
      if(!needs){note?.remove();return}
      if(shell&&head){
        if(!note){note=doc.createElement('section');note.id='rb1011SyncTrust';note.className=`rb1011-trust ${snap.tone}`;head.insertAdjacentElement('afterend',note)}
        note.className=`rb1011-trust ${snap.tone}`;
        const sig=`${snap.code}|${snap.label}|${snap.copy}`;
        if(note.dataset.state!==sig){note.dataset.state=sig;note.innerHTML=`<div><b>${escapeHtml(snap.label)}</b><span>${escapeHtml(snap.copy)}</span></div><button type="button" data-rb1011-sync>Hent Garmin-data</button>`;note.querySelector('[data-rb1011-sync]')?.addEventListener('click',e=>runSync(e.currentTarget),{once:true})}
      }
      const more=doc.querySelector('#rb107More .rb108-settings-list details:first-child summary');
      if(more){const small=more.querySelector('small'),status=more.querySelector('.rb107-status');if(small)setText(small,snap.code==='fresh'?`Innkommende data ${snap.short.toLowerCase()}`:snap.copy);if(status){setText(status,snap.code==='fresh'?'Tilkoblet':'Sjekk');status.classList.toggle('stale',snap.code!=='fresh')}}
    }
    function currentPlan(context){
      const os=coach();if(!os?.planFor)return null;const ds=context==='plan'?(win.sessionStorage?.getItem(SELECTED)||localDate()):localDate();return os.planFor(ds)||null;
    }
    function publishSnapshot(){
      const os=coach(),queue=os?.tredictPlanQueue?.()||[];let signature='';try{signature=win.RunnerBearTredictOutbound?.signature?.(queue)||''}catch{}
      return publicationState({outbound:outbound(),signature,queueLength:queue.length});
    }
    function addPublicationStatus(root,context){
      if(!root||root.querySelector('.rb1011-publish'))return;const p=currentPlan(context);if(!p||!['easy','quality','race'].includes(p.type)||Number(p.km||0)<=0)return;
      const status=publishSnapshot(),host=root.querySelector('.rb107-workout-body,.rb107-day-detail-head')||root;
      const el=doc.createElement('div');el.className=`rb1011-publish ${status.code}`;el.innerHTML=`<span>RunnerBear → Tredict → Garmin</span><b>${escapeHtml(status.label)}</b><small>${escapeHtml(status.copy)}</small>`;host.appendChild(el);
    }
    function patchPublication(){
      addPublicationStatus(doc.querySelector('#rb107Today .rb107-workout'),'today');
      const planDetail=doc.querySelector('#rb107Plan .rb107-day-detail');if(planDetail)addPublicationStatus(planDetail,'plan');
    }
    function unmatch(p){
      const os=coach();if(!p||!os?.matches)return;const m=os.matches()?.map?.get?.(p.baseDs);if(!m?.activity?.id)return;
      const excluded=parseJson(ls.getItem(EXCLUSIONS)||'{}',{});excluded[p.baseDs]=m.activity.id;ls.setItem(EXCLUSIONS,JSON.stringify(excluded));
      ls.removeItem(MATCH+p.ds);if(p.baseDs!==p.ds)ls.removeItem(MATCH+p.baseDs);const mc=os.matches();if(mc)mc.signature='';os.render?.();
    }
    function addMatchControl(root,context){
      if(!root||root.querySelector('[data-rb1011-unmatch]')||root.querySelector('[data-rb108-unmatch]'))return;const p=currentPlan(context),m=p&&coach()?.matches?.()?.map?.get?.(p.baseDs);if(!m?.activity?.id)return;
      const footer=doc.createElement('div');footer.className='rb1011-match-control';footer.innerHTML=`<span>${m.confidence==='high'?'Sikker':'Sannsynlig'} kobling til Garmin-aktivitet</span><button type="button" data-rb1011-unmatch>Endre kobling</button>`;
      root.appendChild(footer);footer.querySelector('button')?.addEventListener('click',()=>unmatch(p),{once:true});
    }
    function patchMatches(){
      addMatchControl(doc.querySelector('#rb107Today .rb109-result-card'),'today');
      addMatchControl(doc.querySelector('#rb107Plan .rb109-result-card'),'plan');
    }
    function evidenceRows(){try{return coach()?.thresholdEvidence?.()||[]}catch{return[]}}
    function patchThreshold(){
      const goals=doc.getElementById('rb107Goals');if(!goals)return;const rows=evidenceRows(),summary=thresholdSummary(rows),card=goals.querySelector('.rb107-threshold-card');
      if(card){const p=card.querySelector('.rb107-threshold-head p');if(p)setText(p,summary.copy);const labels=card.querySelectorAll('.rb107-chart-labels span');if(labels.length>=2)setText(labels[1],summary.label);card.dataset.rb1011Trend=summary.code}
      const os=coach(),rawForecast=os?.forecast?.()||{},goal=os?.goalState?.()?.primary||null,pred=rawForecast||{},history=(win.RunnerBearCoachEngine?.thresholdHistory?.()||[]),distance=goal?.distance||rawForecast.distance||'half';
      const foundation=evidenceConfidence({evidence:rows.length,history:history.length,distance,longKm:Number(pred.long||0),anchorKm:Number(pred.anchor||50)});
      const capacity=goals.querySelector('.rb109-capacity');if(capacity){
        const foundationEl=capacity.querySelector('.rb109-capacity-meta div:nth-child(2) b');if(foundationEl){setText(foundationEl,foundation.label);foundationEl.className=foundation.code}
        const copy=capacity.querySelector('.rb109-capacity-copy');if(copy)setText(copy,`${foundation.copy} Dette er et utjevnet kapasitetsestimat og hopper ikke etter én dårlig natt.`);
        if(foundation.code==='limited'){
          const range=capacity.querySelector('.rb109-capacity-main p strong'),centerEl=capacity.querySelector('.rb109-capacity-main > b');const center=parseClock(centerEl?.textContent);
          if(range&&center){const base={five:22,ten:35,half:50,marathon:150}[distance]||50,spread=Math.round(base*foundation.spread);setText(range,`${fmtClock(center-spread)}–${fmtClock(center+spread)}`);const heroRange=goals.querySelector('.rb109-goal-hero .rb107-goal-now small');if(heroRange)setText(heroRange,`${fmtClock(center-spread)}–${fmtClock(center+spread)}`)}
        }
      }
      goals.querySelectorAll('.rb109-prediction-row').forEach(row=>{const label=row.querySelector('span')?.textContent||'',key=/5 km/i.test(label)?'five':/10 km/i.test(label)?'ten':/halv/i.test(label)?'half':'marathon';const f=evidenceConfidence({evidence:rows.length,history:history.length,distance:key,longKm:Number(pred.long||0),anchorKm:Number(pred.anchor||50)}),el=row.querySelector('.rb109-foundation');if(el){setText(el,f.label);el.className=`rb109-foundation ${f.code}`}});
      const status=goals.querySelector('.rb109-goal-status');if(status&&foundation.code==='limited'&&goal?.targetSeconds){const h=status.querySelector('h2'),p=status.querySelector('p');if(h)setText(h,'For lite grunnlag');if(p)setText(p,'Målet står, men RunnerBear venter på minst tre relevante kvalitetsdatapunkter før retningen vurderes.');status.classList.remove('green','amber');status.classList.add('neutral')}
    }
    function patch(){
      if(patching)return;patching=true;try{if(!coach())return;patchSync();patchPublication();patchMatches();patchThreshold();doc.documentElement.dataset.rbUiBuild=BUILD}finally{patching=false}
    }
    function patchSoon(delay=40){clearTimeout(timer);timer=setTimeout(patch,delay)}
    function wrapCloudSync(){
      const cloud=win.RunnerBearCloud;if(!cloud?.cloudSync||cloud.cloudSync.__rb1011)return false;const original=cloud.cloudSync.bind(cloud);
      const wrapped=async(...args)=>{try{const result=await original(...args);setSyncError(null);return result}catch(error){setSyncError(error);throw error}finally{patchSoon(50)}};wrapped.__rb1011=true;cloud.cloudSync=wrapped;
      if(win.RunnerBearBridge?.cloud)win.RunnerBearBridge.sync=wrapped;return true;
    }
    function start(){
      let attempts=0;const ready=()=>{attempts++;wrapCloudSync();patch();if(attempts<80&&(!coach()||!win.RunnerBearCloud))setTimeout(ready,100)};ready();
      const mo=new win.MutationObserver(()=>patchSoon(25));mo.observe(doc.body,{childList:true,subtree:true});
      win.addEventListener('online',()=>patchSoon(0));win.addEventListener('offline',()=>patchSoon(0));win.addEventListener('storage',()=>patchSoon(0));
      doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)patchSoon(50)});
    }
    if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
  }

  return{BUILD,FRESH_MS,OLD_MS,syncHealth,evidenceConfidence,thresholdSummary,publicationState,mount};
});
