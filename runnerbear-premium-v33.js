/* RunnerBear v9.4.1 · Tredict Bridge client
   Uses a private Cloudflare Worker. The Tredict Personal API token never belongs in browser storage.
*/
(function(){
  'use strict';
  const $=id=>document.getElementById(id),qs=(s,r=document)=>r.querySelector(s),qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const CACHE='runnerbear_tredict_cache_v1',LAST='runnerbear_tredict_last_sync',URLKEY='runnerbear_bridge_url',KEYKEY='runnerbear_bridge_key',MATCH='runnerbear_tredict_match_';
  const DIRECT='runnerbear_tredict_token',DIRECT_REMOVED='runnerbear_bridge_direct_token_removed_at';
  const LEG='runfest-2026',SYNC_MAX_AGE=5*60*1000;
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')??f}catch{return f}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const iso=d=>{const x=d instanceof Date?d:new Date(d),z=n=>String(n).padStart(2,'0');return`${x.getFullYear()}-${z(x.getMonth()+1)}-${z(x.getDate())}`};
  const date=s=>new Date(String(s).slice(0,10)+'T12:00:00');
  const slug=s=>String(s||'').toLowerCase().replace(/[.]/g,'').replace(/\s+/g,'_').replace(/[^a-z0-9æøå_]/g,'');
  const bridgeUrl=()=>String(window.RUNNERBEAR_BRIDGE_URL||localStorage.getItem(URLKEY)||'').trim().replace(/\/+$/,'');
  const bridgeKey=()=>localStorage.getItem(KEYKEY)||'';
  const configured=()=>/^https:\/\//.test(bridgeUrl())&&bridgeKey().length>=16;

  function retireDirectToken(){
    if(localStorage.getItem(DIRECT)){
      localStorage.removeItem(DIRECT);localStorage.removeItem('runnerbear_tredict_diag_v1');
      localStorage.setItem(DIRECT_REMOVED,new Date().toISOString());
    }
  }
  function headers(){return{'Accept':'application/json','X-RunnerBear-Key':bridgeKey()}}
  async function request(path){
    if(!configured())throw new Error('Bridge er ikke konfigurert ennå.');
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),18000);let r;
    try{r=await fetch(bridgeUrl()+path,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:headers(),signal:ctl.signal})}
    catch(e){clearTimeout(timer);throw new Error(e?.name==='AbortError'?'Bridge svarte ikke innen 18 sekunder.':'Fikk ikke kontakt med RunnerBear Bridge.');}
    clearTimeout(timer);let body=null;try{body=await r.json()}catch{}
    if(!r.ok)throw new Error(body?.error?`${body.error}${body.detail?` · ${body.detail}`:''}`:`Bridge HTTP ${r.status}`);
    return body;
  }
  async function test(){const x=await request('/health');return x?.ok===true}

  function flatActivity(a){const s=a?.summary||{};return{id:a.id,date:a.date,sportType:a.sportType,subSportType:a.subSportType,title:a.title||'',duration:Number(s.duration||0),distance:Number(s.distance||0),pace:Number(s.pace||0),heartrate:Number(s.heartrate||0),heartrateMax:Number(s.heartrateMax||0),power:Number(s.power||0),cadence:Number(s.cadence||0)}}
  function goal(){return window.RunnerBearV7?.activeGoal?.()||null}
  function legacyDoneKey(f){return`runfest26_date_${String(f.label).toLowerCase().replace(/\s+/g,'_')}`}
  function v7DoneKey(g,d){return`runnerbear_v7_done_${g.id}_${iso(d.date)}`}
  function choiceLegacy(f){try{return localStorage.getItem(`runfest26_easychoice_${slug(f.label)}`)||''}catch{return''}}
  function plannedRows(){
    const g=goal();
    if(g&&g.id!==LEG){
      try{
        const p=window.RunnerBearV8?.rollingPlan?.(g),weeks=p?.weeks||[];
        return weeks.flatMap(w=>(w.days||[]).map(d=>({goalId:g.id,date:iso(d.date),dateObj:d.date,type:d.type||'',title:d.title||'',km:Number(d.km||0),label:d.label||iso(d.date),source:'v8',doneKey:v7DoneKey(g,d),choice:''})));
      }catch{}
    }
    try{return flat.map(f=>({goalId:LEG,date:iso(f.date),dateObj:f.date,type:f.type||'',title:f.title||'',km:Number(f.km||0),label:f.label,source:'legacy',doneKey:legacyDoneKey(f),choice:choiceLegacy(f)}))}catch{return[]}
  }
  function sportScore(p,a){
    const run=['quality','easy','race'].includes(p.type)||/langtur|terskel|intervall|45\/15|løp/i.test(p.title);
    if(run)return a.sportType==='running'?6:-12;
    if(p.type==='rest'||/hvile/i.test(p.title))return-20;
    const want=p.choice==='row'||/concept2|roing|rowerg/i.test(p.title)?'row':p.choice==='bike'||/zwift|sykkel/i.test(p.title)?'bike':'cross';
    if(want==='row')return(a.subSportType==='indoor_rowing'||a.subSportType==='rowing')?6:-8;
    if(want==='bike')return a.sportType==='cycling'?6:-8;
    return(a.sportType==='cycling'||a.subSportType==='indoor_rowing'||a.subSportType==='rowing'||a.sportType==='misc')?5:-8;
  }
  function crossBonus(p,a){
    if(p.type!=='cross'&&!/zwift|sykkel|concept2|roing|rowerg/i.test(p.title))return 0;
    const row=a.subSportType==='indoor_rowing'||a.subSportType==='rowing',bike=a.sportType==='cycling';
    if(row){if(p.choice==='bike')return-10;return 4}
    if(bike){if(p.choice==='row')return-10;return 4}
    return 0;
  }
  function matchScore(p,a){
    if(a.date!==p.date)return-99;let s=10+sportScore(p,a)+crossBonus(p,a);if(s<5)return s;
    const akm=Number(a.distance||0)/1000;if(p.km>0&&akm>0){const d=Math.abs(akm-p.km);s+=d<=1?5:d<=2.5?3:d<=4?1:-2}
    const pt=p.title.toLowerCase(),at=(a.title||'').toLowerCase();
    if(/langtur/.test(pt)&&/lang|long/.test(at))s+=2;if(/terskel|intervall|45\/15/.test(pt)&&/terskel|threshold|interval/.test(at))s+=2;
    return s;
  }
  function saveMatch(p,a){
    const key=MATCH+p.date;if(localStorage.getItem(key))return false;
    write(key,{activityId:a.id,activity:a,planned:{goalId:p.goalId,date:p.date,type:p.type,title:p.title,km:p.km,label:p.label,source:p.source},automatic:true,matchedAt:new Date().toISOString(),matcher:'runnerbear-v9.4.1'});
    localStorage.setItem(p.doneKey,'1');return true;
  }
  function reconcile(){
    const c=read(CACHE,{activities:[]}),acts=(c.activities||[]).map(flatActivity).filter(a=>a.id&&a.date).map(a=>Object.assign(a,{date:iso(new Date(a.date))}));
    const cutoff=new Date();cutoff.setDate(cutoff.getDate()-35);cutoff.setHours(0,0,0,0);const end=new Date();end.setHours(23,59,59,999);
    const plans=plannedRows().filter(p=>date(p.date)>=cutoff&&date(p.date)<=end&&p.type!=='rest');let matched=0,ambiguous=0;
    plans.forEach(p=>{
      if(localStorage.getItem(MATCH+p.date))return;
      const candidates=acts.filter(a=>a.date===p.date).map(a=>({a,score:matchScore(p,a)})).filter(x=>x.score>=16).sort((a,b)=>b.score-a.score);
      if(!candidates.length)return;if(candidates.length>1&&candidates[0].score-candidates[1].score<3){ambiguous++;return}
      if(saveMatch(p,candidates[0].a))matched++;
    });
    return{matched,ambiguous};
  }
  function mergedRunningCapacity(){
    const c=read(CACHE,{}),rows=c.capacity?.running;if(!Array.isArray(rows)||!rows.length)return null;const out={};rows.slice().sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp))).forEach(x=>Object.assign(out,x));return out;
  }
  function paceFmt(sec){sec=Number(sec);if(!sec)return'–';return`${Math.floor(sec/60)}:${String(Math.round(sec%60)).padStart(2,'0')}`}
  function patchCapacity(){
    const c=mergedRunningCapacity();if(!c)return;
    const th=$('rb9Threshold'),src=$('rb9ThresholdSource'),max=$('rb9MaxHr');
    if(th&&(c.ftpa||c.hrLth))th.textContent=`${c.ftpa?paceFmt(c.ftpa)+'/km':'–'}${c.hrLth?` · ${Math.round(c.hrLth)} bpm`:''}`;
    if(src)src.textContent='Tredict · capacity';if(max&&c.hrMax)max.textContent=`${Math.round(c.hrMax)} bpm`;
  }

  function statusText(){const last=localStorage.getItem(LAST);return last?`Sist synk ${new Date(last).toLocaleString('nb-NO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`:'Ingen vellykket bridge-sync ennå'}
  function ensureSetupCard(){
    const more=$('more');if(!more)return;let card=$('rbTredictCard');
    if(!card){card=document.createElement('article');card.id='rbTredictCard';card.className='card rb-tredict-card';(qs('.section-head',more)||more.firstElementChild)?.insertAdjacentElement('afterend',card)}
    const ready=configured();card.innerHTML=`<div class="kicker"><span>TREDICT · SECURE BRIDGE</span><span id="rb94BridgePill" class="status-pill ${ready?'green':'neutral'}">${ready?'KLAR':'VENTER'}</span></div>
      <div class="rb94-bridge-main"><div><h3>${ready?'Personal API via sikker proxy':'Bridge-klienten er klar'}</h3><p>${ready?'Tredict-tokenet ligger ikke i RunnerBear. Aktivitet, HRV, søvn, hvilepuls og kapasitet hentes via Worker.':'Cloudflare Worker-koden er klargjort. Når Workeren er publisert fyller vi inn endpoint og en separat bridge-nøkkel her.'}</p><small id="rb94BridgeLast">${esc(statusText())}</small></div></div>
      <div class="rb94-actions">${ready?'<button class="secondary" id="rb94Sync">Synk nå</button><button class="secondary" id="rb94Test">Test bridge</button>':''}<button class="textbtn" id="rb94SetupToggle">${ready?'Endre bridge-oppsett':'Bridge-oppsett'}</button></div>
      <div id="rb94Setup" class="rb94-setup hidden"><label>Worker-endpoint<input id="rb94Url" type="url" autocomplete="off" placeholder="https://runnerbear-…workers.dev" value="${esc(bridgeUrl())}"></label><label>Bridge-nøkkel<input id="rb94Key" type="password" autocomplete="off" placeholder="Separat nøkkel · ikke Tredict-token" value=""></label><button class="secondary" id="rb94Save">Lagre lokalt</button><small>Bridge-nøkkelen lagres bare på denne enheten og er ikke del av RunnerBear-backup.</small><div id="rb94SetupMsg"></div></div>`;
    $('rb94SetupToggle')?.addEventListener('click',()=>{$('rb94Setup')?.classList.toggle('hidden')});
    $('rb94Save')?.addEventListener('click',()=>{const u=$('rb94Url')?.value.trim().replace(/\/+$/,''),k=$('rb94Key')?.value.trim();const msg=$('rb94SetupMsg');if(!/^https:\/\//.test(u||'')){if(msg)msg.textContent='Endpoint må være https.';return}if(k&&k.length<16){if(msg)msg.textContent='Bridge-nøkkelen må være minst 16 tegn.';return}localStorage.setItem(URLKEY,u);if(k)localStorage.setItem(KEYKEY,k);ensureSetupCard();patchSyncReadiness()});
    $('rb94Test')?.addEventListener('click',async()=>{setPill('TESTER','neutral');try{await test();setPill('BRIDGE OK','green')}catch(e){setPill('FEIL','red');alert(e.message)}});
    $('rb94Sync')?.addEventListener('click',()=>sync(true));
  }
  function setPill(t,tone='neutral'){const p=$('rb94BridgePill');if(p){p.textContent=t;p.className=`status-pill ${tone}`}}
  function patchSyncReadiness(){const c=$('rb9SyncReadiness');if(!c)return;const h=qs('h3',c),p=qs('p',c),pill=qs('.kicker span:last-child',c);if(h)h.textContent='Personal API Bridge';if(p)p.textContent=configured()?'Sikker read-only bro er konfigurert. Garmin-data matches automatisk mot planen når synk lykkes.':'RunnerBear er klargjort for sikker Personal API-bridge. Tredict-tokenet skal ligge som Worker-secret, aldri i GitHub eller nettleseren.';if(pill)pill.textContent=configured()?'BRIDGE READY':'WORKER READY'}

  async function sync(show=false){
    if(!configured()){if(show)alert('Bridge er ikke konfigurert ennå.');ensureSetupCard();return null}
    setPill('SYNKER…','neutral');
    try{
      const s=await request('/api/snapshot?days=28');
      const cache={activities:s.activities||[],hrv:s.hrv||{},sleep:s.sleep||{},body:s.body||[],capacity:s.capacity||{},zones:s.zones||{},syncedAt:s.syncedAt||new Date().toISOString(),bridgeParts:s.parts||[],source:'runnerbear-bridge-v9.4.1'};
      write(CACHE,cache);localStorage.setItem(LAST,cache.syncedAt);const rec=reconcile();
      try{window.RunnerBearTredict?.matchToday?.(true)}catch{}
      if(typeof window.renderAll==='function')window.renderAll();else window.RunnerBearTredict?.render?.();
      patchCapacity();ensureSetupCard();patchSyncReadiness();setPill('SYNKRONISERT','green');
      if(show&&rec.matched)console.info(`RunnerBear: ${rec.matched} økt(er) automatisk matchet.`);return{snapshot:s,reconcile:rec};
    }catch(e){setPill('SYNC FEILET','red');const msg=$('rb94SetupMsg');if(msg)msg.textContent=e.message;if(show)alert(e.message);return null}
  }
  function render(){ensureSetupCard();patchSyncReadiness();patchCapacity()}

  retireDirectToken();
  const B=window.RunnerBearBridge=window.RunnerBearBridge||{};B.sync=sync;B.test=test;B.reconcile=reconcile;B.configured=configured;B.render=render;
  const prev=window.renderAll;if(typeof prev==='function')window.renderAll=function(){const r=prev.apply(this,arguments);requestAnimationFrame(render);return r};
  const prevSwitch=window.switchTab;if(typeof prevSwitch==='function')window.switchTab=function(id,scroll){const r=prevSwitch.apply(this,arguments);if(id==='more'||id==='today'||id==='plan')requestAnimationFrame(render);return r};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&configured()){const t=Date.parse(localStorage.getItem(LAST)||0);if(!t||Date.now()-t>SYNC_MAX_AGE)sync(false)}});
  render();
  if(configured()){const t=Date.parse(localStorage.getItem(LAST)||0);if(!t||Date.now()-t>SYNC_MAX_AGE)setTimeout(()=>sync(false),500)}
})();
