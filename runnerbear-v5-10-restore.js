/* RunnerBear v5.11 · guarded restore / undo */
(function(){
  const api=window.RunnerBearBackup;if(!api)return;
  const PREFIX=api.PREFIX;
  const UNDO_KEY='runnerbear_pre_restore_snapshot_v1';
  const NOTICE_KEY='runnerbear_restore_notice_v1';
  const LAST_IMPORT=PREFIX+'backup_last_import';

  function collect(){return api.collect()}
  function removeRunnerBearKeys(){
    const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(PREFIX))keys.push(k)}
    keys.forEach(k=>localStorage.removeItem(k));
  }
  function writeItems(items){Object.entries(items).forEach(([k,v])=>{if(k.startsWith(PREFIX)&&typeof v==='string')localStorage.setItem(k,v)})}
  function saveUndo(){
    try{sessionStorage.setItem(UNDO_KEY,JSON.stringify({createdAt:new Date().toISOString(),items:collect()}));return true}catch{return false}
  }
  function readUndo(){try{const x=JSON.parse(sessionStorage.getItem(UNDO_KEY)||'null');return x&&x.items&&typeof x.items==='object'?x:null}catch{return null}}
  function refreshUndoButton(){const b=document.getElementById('undoRestore');if(!b)return;b.classList.toggle('hidden',!readUndo());b.onclick=undo}
  function showNotice(){const msg=sessionStorage.getItem(NOTICE_KEY),el=document.getElementById('backupActionStatus');if(msg&&el){el.textContent=msg;sessionStorage.removeItem(NOTICE_KEY)}}
  function restore(pending){
    if(!pending?.obj)return;
    let checked;try{checked=api.validate(pending.obj)}catch(e){alert(e?.message||'Backupen kan ikke gjenopprettes.');return}
    const when=pending.obj.exportedAt?new Date(pending.obj.exportedAt).toLocaleString('nb-NO'):'ukjent dato';
    if(!confirm(`Gjenopprette RunnerBear-backup fra ${when}?\n\nDette erstatter dagens RunnerBear-data. Du kan angre så lenge denne nettleserøkten er åpen.`))return;
    saveUndo();
    try{
      removeRunnerBearKeys();writeItems(pending.obj.items);localStorage.setItem(LAST_IMPORT,new Date().toISOString());
      sessionStorage.setItem(NOTICE_KEY,`Gjenopprettet ${checked.entries.length} dataposter. Dagens gamle tilstand kan angres i denne økten.`);location.reload();
    }catch(e){
      const snap=readUndo();if(snap){removeRunnerBearKeys();writeItems(snap.items)}
      alert('Gjenoppretting feilet. RunnerBear forsøkte å legge tilbake dataene som lå på enheten før restore.');
    }
  }
  function undo(){
    const snap=readUndo();if(!snap)return;
    if(!confirm('Angre siste gjenoppretting og legge tilbake RunnerBear-dataene som lå på enheten før restore?'))return;
    removeRunnerBearKeys();writeItems(snap.items);sessionStorage.removeItem(UNDO_KEY);sessionStorage.setItem(NOTICE_KEY,'Siste gjenoppretting er angret. Tidligere RunnerBear-data er tilbake.');location.reload();
  }

  api.restore=restore;api.undo=undo;api.refreshUndoButton=refreshUndoButton;
  refreshUndoButton();showNotice();
})();