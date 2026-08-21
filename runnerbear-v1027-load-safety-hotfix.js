/* RunnerBear v10.27 load-safety hotfix · repairs unsafe generated plans after the v10.27 allocator bug. */
(function(){
  'use strict';
  const BUILD='10.27.1-load-safety',REPAIR_KEY='runnerbear_v1027_load_safety_repair';
  const iso=()=>new Date().toISOString().slice(0,10);
  const km=row=>Number(row?.plannedDistanceM||0)/1000;
  const isLong=row=>/langtur|long/i.test(`${row?.title||''} ${row?.intent||''}`)||row?.workoutType==='long';
  const isQuality=row=>['quality','race'].includes(row?.workoutType||row?.type);
  const hard=row=>isLong(row)||isQuality(row);
  const gap=(a,b)=>Math.abs((Date.parse(`${a}T12:00:00Z`)-Date.parse(`${b}T12:00:00Z`))/86400000);
  const userLocked=row=>row?.lockLevel==='user'||row?.explicitChoice===true;
  function recovery(row){return ['rest','cross'].includes(row?.workoutType)||['rest','cross'].includes(row?.sport)||row?.intent==='recovery'}
  function recoveryCopy(row){
    if(!recovery(row))return row;
    const cross=row?.workoutType==='cross'||row?.sport==='cross';
    return{...row,plannedDurationSeconds:null,plannedDistanceM:0,intent:'recovery',prescription:{...(row.prescription||{}),version:1,main:{kind:'recovery'},legacy:cross?{desc:'Rolig alternativ trening eller full hvile.',detail:'Restitusjonsdag. Ingen intervaller, terskel, progresjon eller skjult kvalitetsarbeid.',shoe:'',fuel:''}:{desc:'Hvile eller svært lett bevegelse.',detail:'Restitusjonsdag. Ikke ta igjen kilometer eller kvalitet som mangler fra ukeplanen.',shoe:'',fuel:''}}};
  }
  function sanitize(snapshot){
    if(!snapshot?.activePlan?.items)return snapshot;
    const items=snapshot.activePlan.items.map(recoveryCopy),today=snapshot.todayWorkout?recoveryCopy(snapshot.todayWorkout):snapshot.todayWorkout;
    return{...snapshot,activePlan:{...snapshot.activePlan,items},todayWorkout:today};
  }
  function wrapReadModel(){
    const model=window.RunnerBearPlanReadModel;if(!model?.install||model.__rb1027LoadSafety)return;
    const original=model.install.bind(model);model.install=snapshot=>original(sanitize(snapshot));model.__rb1027LoadSafety=true;
  }
  function unsafe(snapshot){
    const items=(snapshot?.activePlan?.items||[]).filter(row=>row?.localDate&&row.status!=='cancelled'&&row.status!=='replaced'&&row.status!=='skipped'),today=iso(),target=Number(snapshot?.config?.profile?.targetWeeklyVolume||snapshot?.config?.profile?.baseKm||50),longCap=Math.round(Math.min(20,Math.max(14,target*.36))*2)/2;
    if(items.some(row=>row.localDate>=today&&row.status==='scheduled'&&isLong(row)&&!userLocked(row)&&km(row)>longCap+.01))return true;
    const hardRows=items.filter(hard).sort((a,b)=>a.localDate.localeCompare(b.localDate));
    for(let i=1;i<hardRows.length;i++){const a=hardRows[i-1],b=hardRows[i];if(b.localDate>=today&&gap(a.localDate,b.localDate)<2&&(!userLocked(a)||!userLocked(b)))return true}
    return false;
  }
  async function repair(){
    const cloud=window.RunnerBearCloudV1027,snapshot=cloud?.snapshot?.();if(!cloud?.reconfigure||!snapshot?.flags?.coach_loop_write||!snapshot?.planRevisionId||!unsafe(snapshot))return;
    if(sessionStorage.getItem(REPAIR_KEY)===snapshot.planRevisionId)return;
    sessionStorage.setItem(REPAIR_KEY,snapshot.planRevisionId);
    try{
      await cloud.refresh?.('full');
      await cloud.reconfigure({reason:'load-safety-repair',trigger:'plan_adjustment',confirm:false,force:true});
      console.info(JSON.stringify({event:'runnerbear_load_safety_repaired',build:BUILD,planRevisionId:snapshot.planRevisionId}));
    }catch(error){sessionStorage.removeItem(REPAIR_KEY);console.warn(JSON.stringify({event:'runnerbear_load_safety_repair_failed',build:BUILD,code:error?.code||'',message:error?.message||String(error)}))}
  }
  wrapReadModel();
  window.addEventListener('load',()=>setTimeout(()=>{wrapReadModel();repair()},700),{once:true});
})();
