/* RunnerBear v5.12 · destructive-action PIN guard
   Purpose: prevent accidental local data reset. This is a client-side safety lock,
   not an authentication boundary for a public GitHub Pages application. */
(function(){
  const RESET_PIN_SHA256='d5dfd8b80b80d3690a43961168260e798ef7bf6f9b1d382ee78e3fc8feb4f657';
  const DATA_PREFIX='runfest26_';

  async function sha256Hex(value){
    if(!window.crypto?.subtle||!window.TextEncoder)throw new Error('Secure PIN check unavailable');
    const bytes=new TextEncoder().encode(value);
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  }

  function runnerBearKeys(){
    const keys=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key&&key.startsWith(DATA_PREFIX))keys.push(key);
    }
    return keys;
  }

  function installResetGuard(){
    const btn=document.getElementById('resetData');
    if(!btn)return;
    btn.textContent='🔒 Nullstill RunnerBear-data';
    btn.title='Krever 6-sifret PIN';
    btn.setAttribute('aria-label','Nullstill RunnerBear-data. Krever PIN.');

    btn.onclick=async()=>{
      const entered=window.prompt('RunnerBear sikkerhetslås\n\nSkriv 6-sifret PIN for å nullstille RunnerBear-data.');
      if(entered===null)return;
      const pin=String(entered).trim();
      if(!/^\d{6}$/.test(pin)){
        alert('PIN må bestå av 6 siffer. Ingen data er endret.');
        return;
      }

      let valid=false;
      try{valid=(await sha256Hex(pin))===RESET_PIN_SHA256}
      catch{
        alert('PIN-kontrollen kunne ikke kjøres sikkert i denne nettleseren. Nullstilling er blokkert.');
        return;
      }
      if(!valid){
        alert('Feil PIN. Ingen RunnerBear-data er endret.');
        return;
      }

      const count=runnerBearKeys().length;
      const confirmed=confirm(`PIN godkjent.\n\nSiste bekreftelse: Nullstill ${count} RunnerBear-dataposter på denne enheten?\n\nDette kan ikke angres uten en tidligere eksportert backup.`);
      if(!confirmed)return;

      runnerBearKeys().forEach(key=>localStorage.removeItem(key));
      try{renderAll()}catch{location.reload();return}
      alert('RunnerBear-data er nullstilt.');
    };
  }

  installResetGuard();
})();
