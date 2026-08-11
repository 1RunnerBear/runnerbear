/* RunnerBear v9.8.2 · migration rescue for legacy pages with broken tab navigation */
(function(){
  'use strict';
  const CLOUD='https://runnerbear-cloud.torbjorn-forre.workers.dev';
  const LEGACY='https://1runnerbear.github.io';
  const MIGRATED='runnerbear_cloud_migrated_v1';
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
      const k=localStorage.key(i);
      if(!safeKey(k))continue;
      const v=localStorage.getItem(k);
      if(typeof v==='string')out[k]=v;
    }
    return Object.fromEntries(Object.entries(out).sort(([a],[b])=>a.localeCompare(b)));
  }

  function notify(text,error=false){
    try{window.RunnerBearCloud?.toast?.(text,error?'error':'ok');return}catch{}
    let el=document.getElementById('rb982RescueToast');
    if(!el){el=document.createElement('div');el.id='rb982RescueToast';el.className='rb982-toast';document.body.appendChild(el)}
    el.textContent=text;el.dataset.tone=error?'error':'ok';el.classList.add('show');
    clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),4500);
  }

  function migrate(){
    const payload={type:'runnerbear-migration-payload',version:1,fromOrigin:location.origin,sentAt:new Date().toISOString(),localStorage:snapshot()};
    const popup=window.open(`${CLOUD}/?rb_migrate=1`,'runnerbear-cloud-migration','popup=yes,width=520,height=760');
    if(!popup){notify('Tillat popup-vindu for RunnerBear og prøv igjen.',true);return}
    const listener=(event)=>{
      if(event.origin!==CLOUD||event.source!==popup)return;
      if(event.data?.type==='runnerbear-cloud-ready')popup.postMessage(payload,CLOUD);
      if(event.data?.type==='runnerbear-migration-complete'){
        localStorage.setItem(MIGRATED,'1');
        window.removeEventListener('message',listener);
        render();
        notify(`${event.data?.storedKeys||0} lokale datapunkter er flyttet til RunnerBear Cloud.`);
        try{popup.focus()}catch{}
      }
      if(event.data?.type==='runnerbear-migration-error')notify(event.data?.message||'Migreringen feilet.',true);
    };
    window.addEventListener('message',listener);
  }

  function render(){
    document.documentElement.classList.add('rb982','rb982-legacy');
    const today=document.getElementById('today');if(!today)return;
    let card=document.getElementById('rb982TodayMigration');
    if(!card){
      card=document.createElement('article');
      card.id='rb982TodayMigration';
      card.className='card rb982-today-migration';
      today.insertBefore(card,today.firstChild);
    }
    const done=localStorage.getItem(MIGRATED)==='1';
    card.innerHTML=done?
      '<div><span>RUNNERBEAR CLOUD</span><h3>Data er flyttet</h3><p>Bruk den private Cloud-versjonen videre på alle enheter.</p></div><button type="button" data-rb982-rescue-open>Åpne Cloud →</button>':
      '<div><span>ENGANGSFLYTTING</span><h3>Flytt RunnerBear-data nå</h3><p>Du trenger ikke åpne Mer. Ett klikk flytter lokal app-state sikkert til kontoen din.</p></div><button type="button" data-rb982-rescue-migrate>Flytt data →</button>';
    card.querySelector('[data-rb982-rescue-migrate]')?.addEventListener('click',migrate);
    card.querySelector('[data-rb982-rescue-open]')?.addEventListener('click',()=>{location.href=CLOUD});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});
  else render();
  window.addEventListener('load',render,{once:true});
  const mo=new MutationObserver(()=>{if(!document.getElementById('rb982TodayMigration'))render()});
  if(document.body)mo.observe(document.body,{childList:true,subtree:true});
})();
