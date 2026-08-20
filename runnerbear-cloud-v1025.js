/* RunnerBear v10.25 · non-blocking Cloud state and Tredict transport client */
(function(){
  'use strict';
  const BUILD='10.25';
  const LEGACY_ORIGIN='https://1runnerbear.github.io';
  const IS_LEGACY=location.origin===LEGACY_ORIGIN;
  const CLOUD_ORIGIN=IS_LEGACY?'https://app.runnerbear.workers.dev':location.origin;
  const IS_CLOUD=!IS_LEGACY&&location.hostname==='app.runnerbear.workers.dev';
  const CACHE='runnerbear_tredict_cache_v1';
  const LAST='runnerbear_tredict_last_sync';
  const MIGRATED='runnerbear_cloud_migrated_v1';
  const MIGRATE_QUERY='rb_migrate';
  const OUTBOUND='runnerbear_tredict_outbound_v1';
  const VO2_HISTORY='runfest26_vo2_history';
  let hydrating=false,baseline='',uploadTimer=0,lastBootstrap=null,lastHomeAt=0,dirtyVersion=0,uploadedVersion=0,fullPromise=null,fullLoaded=false;

  const qs=(s,r=document)=>r.querySelector(s);
  const readJson=(raw,fallback={})=>{try{return JSON.parse(raw)}catch{return fallback}};

  function safeKey(key){
    const k=String(key||'');
    if(!/^(runnerbear_|runfest26_|rb)/i.test(k))return false;
    if(/(?:token|secret|bridge_key|api_key|access_aud|access_team|cloudflare)/i.test(k))return false;
    if(k==='runnerbear_bridge_url'||k===CACHE||k===LAST)return false;
    if(/^runnerbear_cloud_/i.test(k))return false;
    return k.length<=160;
  }
  function localSnapshot(){
    const out={};
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(!safeKey(k))continue;
      const v=localStorage.getItem(k);
      if(typeof v==='string')out[k]=v;
    }
    return Object.fromEntries(Object.entries(out).sort(([a],[b])=>a.localeCompare(b)));
  }
  function signature(obj){try{return JSON.stringify(obj)}catch{return''}}

  function applyLocalState(map){
    if(!map||typeof map!=='object'||Array.isArray(map))return;
    hydrating=true;
    try{
      for(const [k,v] of Object.entries(map)){
        if(safeKey(k)&&typeof v==='string'&&localStorage.getItem(k)!==v)localStorage.setItem(k,v);
      }
    }finally{hydrating=false}
  }

  function applyTredict(cache,{merge=false}={}){
    if(!cache||typeof cache!=='object')return;
    const previous=merge?readJson(localStorage.getItem(CACHE)||'{}',{}):{};
    const byId=new Map();
    for(const row of [...(Array.isArray(previous.activities)?previous.activities:[]),...(Array.isArray(cache.activities)?cache.activities:[])]){
      const id=String(row?.id||row?._id||'');if(id)byId.set(id,row);
    }
    const mergeRows=(previousRows,nextRows,keyOf)=>{
      const rows=new Map();
      for(const row of [...(Array.isArray(previousRows)?previousRows:[]),...(Array.isArray(nextRows)?nextRows:[])]){
        const key=String(keyOf(row)||'');if(key)rows.set(key,row);
      }
      return [...rows.values()].sort((a,b)=>String(keyOf(a)).localeCompare(String(keyOf(b))));
    };
    const previousCapacity=previous.capacity&&typeof previous.capacity==='object'?previous.capacity:{};
    const nextCapacity=cache.capacity&&typeof cache.capacity==='object'?cache.capacity:{};
    const normalized={
      activities:[...byId.values()].sort((a,b)=>String(b?.date||'').localeCompare(String(a?.date||''))),
      hrv:{...(previous.hrv||{}),...(cache.hrv||{})},sleep:{...(previous.sleep||{}),...(cache.sleep||{})},
      body:mergeRows(previous.body,cache.body,row=>row?.timestamp),
      capacity:merge?{...previousCapacity,...nextCapacity,running:mergeRows(previousCapacity.running,nextCapacity.running,row=>row?.timestamp)}:nextCapacity,
      zones:{...(previous.zones||{}),...(cache.zones||{})},
      syncedAt:cache.syncedAt||new Date().toISOString(),
      bridgeParts:Array.isArray(cache.bridgeParts)?cache.bridgeParts:[],
      source:'runnerbear-cloud-v10.25'
    };
    localStorage.setItem(CACHE,JSON.stringify(normalized));
    localStorage.setItem(LAST,normalized.syncedAt);
    const model=window.RunnerBearV1025,existing=readJson(localStorage.getItem(VO2_HISTORY)||'[]',[]);
    const vo2=model?.mergeVo2History?.(existing,normalized.activities,normalized.syncedAt);
    if(Array.isArray(vo2)&&signature(vo2)!==signature(existing))localStorage.setItem(VO2_HISTORY,JSON.stringify(vo2));
  }

  function applyOutbound(state){
    if(state&&typeof state==='object'&&!Array.isArray(state)){
      const previous=readJson(localStorage.getItem(OUTBOUND)||'{}',{});
      localStorage.setItem(OUTBOUND,JSON.stringify({...state,clientSignature:state.clientSignature||previous.clientSignature||''}));
    }
  }

  async function api(path,options={}){
    const r=await fetch(path,{
      credentials:'same-origin',
      cache:'no-store',
      ...options,
      headers:{'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}
    });
    let body=null;try{body=await r.json()}catch{}
    if(!r.ok)throw new Error(body?.detail||body?.error||`RunnerBear Cloud HTTP ${r.status}`);
    return body;
  }

  function refreshUi(view=''){
    try{window.RunnerBearBridge?.reconcile?.()}catch{}
    try{window.RunnerBearTredict?.matchToday?.(true)}catch{}
    try{
      const ui=window.RunnerBearCoachOS;
      if(ui?.renderView)ui.renderView(view||document.querySelector('.view.active')?.id||'today');
      else if(ui?.render)ui.render();
    }catch{}
  }

  function applyBootstrap(data,{merge=false,view=''}={}){
    lastBootstrap=data;
    applyLocalState(data?.state?.localStorage||{});
    applyTredict(data?.state?.tredict||null,{merge});
    applyOutbound(data?.state?.tredictOutbound||null);
    baseline=signature(localSnapshot());uploadedVersion=dirtyVersion;
    installBridgeAdapter();installTredictTransport();
    try{window.RunnerBearCoachOS?.tredictSync?.init?.()}catch{}
    refreshUi(view);schedulePlanReconcile();
    document.documentElement.classList.add('rb1021-cloud');
    return data;
  }

  async function bootstrapHome(){
    if(!IS_CLOUD)return null;
    const started=performance.now(),data=await api('/api/bootstrap/home');lastHomeAt=Date.now();
    applyBootstrap(data,{merge:true,view:'today'});
    console.info(JSON.stringify({event:'runnerbear_client_bootstrap',build:BUILD,kind:'home',durationMs:Math.round(performance.now()-started)}));
    return data;
  }

  async function bootstrapFull(view='',force=false){
    if(!IS_CLOUD)return null;
    if(fullLoaded&&!force){refreshUi(view);return lastBootstrap}
    if(fullPromise&&!force)return fullPromise;
    fullPromise=(async()=>{const started=performance.now(),data=await api('/api/bootstrap?days=365');fullLoaded=true;applyBootstrap(data,{merge:false,view});console.info(JSON.stringify({event:'runnerbear_client_bootstrap',build:BUILD,kind:'full',view,durationMs:Math.round(performance.now()-started)}));return data})().finally(()=>{fullPromise=null});
    return fullPromise;
  }

  async function cloudSync(show=false){
    if(!IS_CLOUD)return null;
    try{
      const result=await api('/api/sync/tredict?days=365',{method:'POST'});
      if(fullLoaded)await bootstrapFull(document.querySelector('.view.active')?.id||'',true);else await bootstrapHome();
      if(show)toast('Garmin / Tredict er synkronisert.');
      return result;
    }catch(error){
      if(show)toast(error?.message||'Kunne ikke synkronisere data.','error');
      throw error;
    }
  }

  function outboundBundle(queue){
    const compiler=window.RunnerBearTredictOutbound;if(!compiler?.plan)throw new Error('Tredict planbygger er ikke lastet');
    const built=compiler.plan(queue);return{source:{...built.source,clientSignature:compiler.signature(queue)},payload:built.payload};
  }
  async function reconcileOutbound(queue,mutation={operation:'reconcile'}){
    if(!IS_CLOUD)throw new Error('Utgående Tredict-synk krever RunnerBear Cloud');
    const bundle=outboundBundle(queue),result=await api('/api/outbound/tredict/reconcile',{method:'POST',body:JSON.stringify({...bundle,mutation})});
    applyOutbound(result);return result;
  }
  async function previewOutbound(queue){
    if(!IS_CLOUD)throw new Error('Utgående Tredict-synk krever RunnerBear Cloud');
    const bundle=outboundBundle(queue);return api('/api/outbound/tredict/preview',{method:'POST',body:JSON.stringify(bundle)});
  }
  async function publishOutbound(queue){
    if(!IS_CLOUD)throw new Error('Utgående Tredict-synk krever RunnerBear Cloud');
    const bundle=outboundBundle(queue),result=await api('/api/outbound/tredict/publish',{method:'POST',body:JSON.stringify(bundle)});
    const saved={...result,clientSignature:bundle.source.clientSignature};applyOutbound(saved);return saved;
  }
  async function outboundStatus(){
    if(!IS_CLOUD)return null;const result=await api('/api/outbound/tredict/status');applyOutbound(result);return result;
  }
  async function verifyOutbound(){
    if(!IS_CLOUD)throw new Error('Utgående Tredict-synk krever RunnerBear Cloud');const result=await api('/api/outbound/tredict/verify',{method:'POST'});applyOutbound(result);return result;
  }
  function cachedOutbound(){return readJson(localStorage.getItem(OUTBOUND)||'{}',{})}

  function currentPlanQueue(){
    try{return window.RunnerBearCoachOS?.tredictPlanQueue?.()||[]}catch{return[]}
  }
  function installTredictTransport(){
    if(!IS_CLOUD)return;
    window.RunnerBearTredictTransport={
      available:true,
      name:'tredict-garmin',
      async syncWorkout(payload={}){
        const queue=currentPlanQueue();if(!queue.length)throw new Error('Ingen kommende løpeøkter å publisere via Tredict');
        return reconcileOutbound(queue,{operation:payload.operation||'upsert',event:payload.event||{},workout:payload.workout||{},hash:payload.hash||'',externalId:payload?.event?.externalId||payload?.workout?.externalId||''});
      }
    };
  }
  let reconcileTimer=0;
  function schedulePlanReconcile(){
    if(!IS_CLOUD)return;clearTimeout(reconcileTimer);
    reconcileTimer=setTimeout(()=>{const queue=currentPlanQueue();if(!queue.length)return;reconcileOutbound(queue,{operation:'reconcile'}).then(result=>{window.RunnerBearCoachOS?.tredictSync?.acceptRemote?.(result,queue.map(x=>x.externalId));refreshUi(document.querySelector('.view.active')?.id||'today')}).catch(error=>console.warn(JSON.stringify({event:'runnerbear_tredict_reconcile_failed',build:BUILD,message:error?.message||String(error)})))},1200);
  }

  function installBridgeAdapter(){
    if(!IS_CLOUD)return;
    const B=window.RunnerBearBridge=window.RunnerBearBridge||{};
    if(!B.__rb982Legacy)B.__rb982Legacy={sync:B.sync,test:B.test,configured:B.configured};
    B.configured=()=>true;
    B.test=async()=>{const x=await api('/api/session');return x?.ok===true};
    B.sync=cloudSync;
    B.cloud=true;
  }

  async function uploadLocal(force=false){
    if(!IS_CLOUD||hydrating)return;
    if(!force&&dirtyVersion===uploadedVersion)return;
    const snap=localSnapshot(),sig=signature(snap);
    if(!force&&sig===baseline){uploadedVersion=dirtyVersion;return}
    await api('/api/state/localStorage',{method:'PUT',body:JSON.stringify({payload:snap})});
    baseline=sig;uploadedVersion=dirtyVersion;
  }

  function scheduleUpload(){
    if(!IS_CLOUD||hydrating)return;
    dirtyVersion++;
    clearTimeout(uploadTimer);
    uploadTimer=setTimeout(()=>uploadLocal(false).catch(()=>{}),900);
  }

  function patchMore(){
    if(!IS_CLOUD)return;
    const card=qs('#rb97More .rb97-data-card');if(!card)return;
    const head=qs('.rb97-more-head strong',card);
    if(head){head.textContent='RUNNERBEAR CLOUD';head.classList.remove('off');head.classList.add('ok')}
    const row=qs('.rb97-data-row',card);
    if(row){
      const b=qs('b',row),span=qs('span',row),i=qs('i',row);
      if(b)b.textContent='Garmin / Tredict';
      const synced=localStorage.getItem(LAST);
      if(span)span.textContent=synced?`Sentralt · synk ${new Date(synced).toLocaleString('nb-NO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`:'Sentralt · venter på første synk';
      i?.classList.remove('off');i?.classList.add('ok');
    }
    const version=qs('.rb97-data-actions span',card);if(version)version.textContent=`RunnerBear ${BUILD}`;
    const p=qs('.rb97-advanced p',card);
    if(p)p.textContent='RunnerBear Cloud er autoritativ datakilde. App-state og Garmin/Tredict-data følger kontoen din på tvers av enheter.';
  }

  function toast(text,tone='ok'){
    let el=document.getElementById('rb982Toast');
    if(!el){el=document.createElement('div');el.id='rb982Toast';el.className='rb982-toast';document.body.appendChild(el)}
    el.textContent=text;el.dataset.tone=tone;el.classList.add('show');
    clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),4200);
  }

  function migrationCard(){
    if(!IS_LEGACY)return;
    const more=document.getElementById('more');if(!more)return;
    let card=document.getElementById('rb982MigrationCard');
    if(!card){
      card=document.createElement('article');card.id='rb982MigrationCard';card.className='card rb982-migration-card';
      const anchor=qs('.section-head',more);anchor?.insertAdjacentElement('afterend',card);
    }
    const done=localStorage.getItem(MIGRATED)==='1';
    card.innerHTML=done?
      `<div><span>RUNNERBEAR CLOUD</span><h3>Data er flyttet</h3><p>Denne gamle adressen kan fases ut. Bruk den private Cloud-versjonen videre.</p></div><button type="button" data-rb982-open>Åpne RunnerBear Cloud →</button>`:
      `<div><span>FLYTT TIL RUNNERBEAR CLOUD</span><h3>Ta med lokale RunnerBear-data</h3><p>Gjennomførte økter, tilpasninger, terskelhistorikk og annen lokal app-state flyttes sikkert til kontoen din. API-nøkler flyttes ikke.</p></div><button type="button" data-rb982-migrate>Flytt data →</button>`;
    qs('[data-rb982-open]',card)?.addEventListener('click',()=>location.href=CLOUD_ORIGIN);
    qs('[data-rb982-migrate]',card)?.addEventListener('click',beginMigration);
  }

  function beginMigration(){
    const payload={type:'runnerbear-migration-payload',version:1,fromOrigin:location.origin,sentAt:new Date().toISOString(),localStorage:localSnapshot()};
    const popup=window.open(`${CLOUD_ORIGIN}/?${MIGRATE_QUERY}=1`,'runnerbear-cloud-migration','popup=yes,width=520,height=760');
    if(!popup){toast('Nettleseren blokkerte vinduet. Tillat popup og prøv igjen.','error');return}
    const listener=(event)=>{
      if(event.origin!==CLOUD_ORIGIN||event.source!==popup)return;
      if(event.data?.type==='runnerbear-cloud-ready')popup.postMessage(payload,CLOUD_ORIGIN);
      if(event.data?.type==='runnerbear-migration-complete'){
        localStorage.setItem(MIGRATED,'1');
        window.removeEventListener('message',listener);
        migrationCard();
        toast(`${event.data?.storedKeys||0} lokale datapunkter er flyttet.`);
        try{popup.focus()}catch{}
      }
      if(event.data?.type==='runnerbear-migration-error')toast(event.data?.message||'Migreringen feilet.','error');
    };
    window.addEventListener('message',listener);
  }

  function migrationReceiver(){
    if(!IS_CLOUD||new URLSearchParams(location.search).get(MIGRATE_QUERY)!=='1'||!window.opener)return;
    let received=false,timer=0;
    const ping=()=>{if(!received)try{window.opener.postMessage({type:'runnerbear-cloud-ready'},LEGACY_ORIGIN)}catch{}};
    timer=setInterval(ping,900);ping();
    window.addEventListener('message',async(event)=>{
      if(received||event.origin!==LEGACY_ORIGIN||event.source!==window.opener||event.data?.type!=='runnerbear-migration-payload')return;
      received=true;clearInterval(timer);
      try{
        const result=await api('/api/migrate/local',{method:'POST',body:JSON.stringify({fromOrigin:event.data.fromOrigin||LEGACY_ORIGIN,localStorage:event.data.localStorage||{}})});
        await bootstrapHome();
        try{window.opener.postMessage({type:'runnerbear-migration-complete',storedKeys:result?.storedKeys||0,migratedAt:result?.migratedAt},LEGACY_ORIGIN)}catch{}
        const u=new URL(location.href);u.searchParams.delete(MIGRATE_QUERY);history.replaceState({},'',u.pathname+u.search+u.hash);
        toast('Lokale data er flyttet til RunnerBear Cloud.');
      }catch(error){
        try{window.opener.postMessage({type:'runnerbear-migration-error',message:error?.message||'Migreringen feilet.'},LEGACY_ORIGIN)}catch{}
        received=false;timer=setInterval(ping,1000);
      }
    });
  }

  function startCloud(){
    document.documentElement.classList.add('rb1021-cloud');
    installBridgeAdapter();
    migrationReceiver();
    bootstrapHome().then((home)=>{
      installBridgeAdapter();
      window.addEventListener('runnerbear:state-dirty',scheduleUpload);
      window.addEventListener('runnerbear:view',event=>{const view=String(event.detail?.view||'');if(view&&view!=='today')bootstrapFull(view).catch(error=>console.error(JSON.stringify({event:'runnerbear_lazy_bootstrap_error',build:BUILD,view,message:error?.message||String(error)})))});
      document.addEventListener('visibilitychange',()=>{if(document.hidden)uploadLocal(false).catch(()=>{});else if(Date.now()-lastHomeAt>5*60*1000)bootstrapHome().catch(()=>{})});
      window.addEventListener('pagehide',()=>{
        if(dirtyVersion===uploadedVersion)return;
        const snap=localSnapshot(),sig=signature(snap);
        if(sig!==baseline)fetch('/api/state/localStorage',{method:'PUT',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({payload:snap})}).catch(()=>{});
      });
      const last=(home?.sync||[]).map(x=>Date.parse(x.last_synced_at||0)).filter(Number.isFinite).sort((a,b)=>b-a)[0]||0;
      const active=document.querySelector('.view.active')?.id||'today';
      if(active!=='today')bootstrapFull(active).catch(error=>console.error(JSON.stringify({event:'runnerbear_lazy_bootstrap_error',build:BUILD,view:active,message:error?.message||String(error)})));
      if(!last||Date.now()-last>5*60*1000)cloudSync(false).catch(error=>console.warn(JSON.stringify({event:'runnerbear_background_sync_error',build:BUILD,message:error?.message||String(error)})));
    }).catch(error=>{
      console.error(JSON.stringify({event:'runnerbear_bootstrap_error',build:BUILD,message:error?.message||String(error)}));
      toast('Viser sist kjente data. Oppdatering fra RunnerBear Cloud feilet.','error');
    });
  }

  function startLegacy(){
    document.documentElement.classList.add('rb982','rb982-legacy');
    migrationCard();
    const mo=new MutationObserver(()=>migrationCard());mo.observe(document.body,{childList:true,subtree:true});
  }

  window.RunnerBearCloud={build:BUILD,origin:CLOUD_ORIGIN,bootstrap:bootstrapHome,bootstrapHome,bootstrapFull,loadView:bootstrapFull,cloudSync,uploadLocal,previewOutbound,publishOutbound,reconcileOutbound,outboundStatus,verifyOutbound,cachedOutbound,schedulePlanReconcile};
  window.addEventListener('load',()=>{
    if(IS_CLOUD)startCloud();
    else if(IS_LEGACY)startLegacy();
  },{once:true});
})();
