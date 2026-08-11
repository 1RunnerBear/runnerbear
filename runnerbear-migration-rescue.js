/* RunnerBear v9.8.4 · resilient direct legacy migration */
(function(){
  'use strict';
  const CLOUD='https://runnerbear-cloud.torbjorn-forre.workers.dev';
  const LEGACY='https://1runnerbear.github.io';
  const BRIDGE_FALLBACK='https://runnerbear-tredict-bridge.torbjorn-forre.workers.dev';
  const MIGRATED='runnerbear_cloud_migrated_v1';
  const KEY='runnerbear_bridge_key';
  const URLKEY='runnerbear_bridge_url';
  let running=false;
  if(location.origin!==LEGACY)return;

  function safeKey(key){
    const k=String(key||'');
    if(!/^(runnerbear_|runfest26_|rb)/i.test(k))return false;
    if(/(?:token|secret|bridge_key|api_key|access_aud|access_team|cloudflare)/i.test(k))return false;
    if(k==='runnerbear_bridge_url'||k==='runnerbear_tredict_cache_v1'||k==='runnerbear_tredict_last_sync')return false;
    if(/^runnerbear_cloud_/i.test(k))return false;
    return k.length<=160;
  }
  function snapshot(){
    const out={};
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);if(!safeKey(k))continue;
      const v=localStorage.getItem(k);if(typeof v==='string')out[k]=v;
    }
    return Object.fromEntries(Object.entries(out).sort(([a],[b])=>a.localeCompare(b)));
  }
  function bridgeUrl(){return String(window.RUNNERBEAR_BRIDGE_URL||localStorage.getItem(URLKEY)||BRIDGE_FALLBACK).trim().replace(/\/+$/,'')}
  function notify(text,error=false){
    let el=document.getElementById('rb982RescueToast');
    if(!el){el=document.createElement('div');el.id='rb982RescueToast';el.className='rb982-toast';document.body.appendChild(el)}
    el.textContent=text;el.dataset.tone=error?'error':'ok';el.classList.add('show');
    clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),6000);
  }
  function statusText(text,error=false){
    const card=document.getElementById('rb982TodayMigration');
    const p=card?.querySelector('p');
    if(p){p.textContent=text;p.dataset.tone=error?'error':'ok'}
  }
  function setBusy(busy){
    const card=document.getElementById('rb982TodayMigration');if(!card)return;
    card.dataset.busy=busy?'1':'0';
    const btn=card.querySelector('[data-rb982-rescue-migrate]');
    if(btn){btn.disabled=busy;btn.textContent=busy?'Flytter data…':'Flytt data →'}
    if(busy)statusText('Sender lokale RunnerBear-data sikkert til RunnerBear Cloud…');
  }
  async function migrate(){
    if(running||localStorage.getItem(MIGRATED)==='1')return;
    const bridgeKey=localStorage.getItem(KEY)||'';
    if(bridgeKey.length<16){
      statusText('Denne nettleseren mangler den gamle bridge-nøkkelen. Jeg kan ikke lese lokale data uten den.',true);
      notify('Bridge-nøkkel mangler på denne nettleseren.',true);
      return;
    }
    running=true;setBusy(true);
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),20000);
    try{
      const r=await fetch(`${bridgeUrl()}/api/migrate-local`,{
        method:'POST',mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:ctl.signal,
        headers:{'Accept':'application/json','Content-Type':'application/json','X-RunnerBear-Key':bridgeKey},
        body:JSON.stringify({localStorage:snapshot()})
      });
      let body=null;try{body=await r.json()}catch{}
      if(!r.ok||body?.ok!==true)throw new Error(body?.detail||body?.error||`Migrering HTTP ${r.status}`);
      localStorage.setItem(MIGRATED,'1');
      render();
      notify(`${body.storedKeys||0} lokale datapunkter er flyttet til RunnerBear Cloud.`);
      setTimeout(()=>{location.href=CLOUD},1200);
    }catch(error){
      const msg=error?.name==='AbortError'?'Migreringen svarte ikke innen 20 sekunder.':(error?.message||'Migreringen feilet.');
      statusText(msg,true);notify(msg,true);setBusy(false);
    }finally{clearTimeout(timer);running=false}
  }
  function render(){
    document.documentElement.classList.add('rb982','rb982-legacy');
    const today=document.getElementById('today');if(!today)return;
    let card=document.getElementById('rb982TodayMigration');
    if(!card){card=document.createElement('article');card.id='rb982TodayMigration';card.className='card rb982-today-migration';today.insertBefore(card,today.firstChild)}
    const done=localStorage.getItem(MIGRATED)==='1';
    card.innerHTML=done?
      '<div><span>RUNNERBEAR CLOUD</span><h3>Data er flyttet</h3><p>Bruk den private Cloud-versjonen videre på alle enheter.</p></div><button type="button" data-rb982-rescue-open>Åpne Cloud →</button>':
      '<div><span>ENGANGSFLYTTING</span><h3>Flytt RunnerBear-data nå</h3><p>Klikk én gang. Overføringen går direkte via den sikre RunnerBear-bridgen.</p></div><button type="button" data-rb982-rescue-migrate>Flytt data →</button>';
  }
  function onClick(event){
    const migrateBtn=event.target?.closest?.('[data-rb982-rescue-migrate]');
    if(migrateBtn){event.preventDefault();event.stopPropagation();migrate();return}
    const openBtn=event.target?.closest?.('[data-rb982-rescue-open]');
    if(openBtn){event.preventDefault();event.stopPropagation();location.href=CLOUD}
  }
  function start(){
    render();
    document.addEventListener('click',onClick,true);
    const mo=new MutationObserver(()=>{if(!document.getElementById('rb982TodayMigration'))render()});
    if(document.body)mo.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
