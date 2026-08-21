import { config as normalizeConfig,dateOnly,finite } from './validation.js';

const RUN_TYPES=new Set(['easy','quality','race','long']);
const TERMINAL=new Set(['completed','cancelled','replaced','skipped']);
const ms=date=>Date.parse(`${dateOnly(date)}T12:00:00Z`);
const addDays=(date,days)=>new Date(ms(date)+days*86400000).toISOString().slice(0,10);
const dayIndex=date=>(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7;
const monday=date=>addDays(date,-dayIndex(date));
const weekKey=date=>monday(date);
const roundHalf=value=>Math.round(Number(value||0)*2)/2;
const isLong=row=>/langtur|long/i.test(`${row.title||''} ${row.intent||''}`)||row.workoutType==='long';
const isQuality=row=>['quality','race'].includes(row.workoutType||row.type);
const isRun=row=>RUN_TYPES.has(row.workoutType||row.type)||String(row.sport||'').toLowerCase()==='running';
const distance=row=>finite(row.plannedDistanceM??row.planned_distance_m??finite(row.km)*1000);
const clone=row=>({...row,localDate:dateOnly(row.localDate||row.local_date||row.ds),slotIndex:Number(row.slotIndex||row.slot_index||0),status:row.status||'scheduled',sport:row.sport||'running',workoutType:row.workoutType||row.workout_type||row.type||'easy',plannedDistanceM:distance(row),prescription:{...(row.prescription||{})},plannedLoad:{...(row.plannedLoad||{})}});
function hash(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0).toString(36)}
function template(type,date,km,index=0,week=''){
  const quality=type==='quality',long=type==='long';
  return{workoutId:`wo-${hash(`${week||weekKey(date)}|${type}|${index}`)}`,lineageId:`lin-${hash(`${week||weekKey(date)}|${type}|${index}`)}`,localDate:date,slotIndex:0,status:'scheduled',sport:'running',workoutType:quality?'quality':'easy',title:quality?(index%2?'5 × 1000 m · VO₂':'6 × 6 min terskel'):long?`${km} km rolig langtur`:`${km} km rolig`,intent:quality?(index%2?'vo2':'threshold'):long?'long':'easy',plannedDistanceM:km*1000,lockLevel:'none',source:'runnerbear-v10.27',prescription:{version:1,main:quality?(index%2?{kind:'intervals',repetitions:5,workMeters:1000,recoverySeconds:120}:{kind:'intervals',repetitions:6,workSeconds:360,recoverySeconds:120}):{kind:'continuous',intensity:'easy'}}};
}
function overrideFor(cfg,week){return cfg.constraints.safetyOverrides.find(row=>row.week===week)||null}
export function targetWeeklyVolume(rawConfig={}){return normalizeConfig(rawConfig).profile.targetWeeklyVolume}
function targetForWeek(cfg,week,fromDate){
  const explicit=overrideFor(cfg,week);if(explicit)return{targetKm:explicit.targetWeeklyVolume??cfg.profile.targetWeeklyVolume,volumeReason:explicit.reason,expectedQualitySessions:explicit.expectedQualitySessions,safetyOverrideReason:explicit.reason};
  const raceWeek=cfg.goal.mode==='race'&&cfg.goal.date&&weekKey(cfg.goal.date)===week;if(raceWeek)return{targetKm:roundHalf(Math.max(cfg.profile.targetWeeklyVolume*.76,({five:5,ten:10,half:21.1}[cfg.goal.distance]||21.1)+16)),volumeReason:'Konkurranseuke · volumet er kontrollert redusert.',expectedQualitySessions:2,safetyOverrideReason:'Konkurranseuke'};
  const index=Math.max(0,Math.round((ms(week)-ms(monday(fromDate)))/(7*86400000)));if(index%4===2)return{targetKm:roundHalf(Math.max(cfg.profile.targetWeeklyVolume*.88,cfg.profile.normalLow*.84)),volumeReason:'Planlagt absorberingsuke · lavere volum med to kontrollerte kvalitetsdoser.',expectedQualitySessions:Math.min(2,cfg.constraints.qualityDays.length),safetyOverrideReason:'Planlagt absorberingsuke'};
  const progression=index%4===1?Math.min(cfg.profile.normalHigh,cfg.profile.targetWeeklyVolume+2):cfg.profile.targetWeeklyVolume;return{targetKm:roundHalf(progression),volumeReason:'',expectedQualitySessions:Math.min(2,cfg.constraints.qualityDays.length),safetyOverrideReason:''};
}
function integrityOf(items=[]){return [...items].reverse().map(row=>row.plannedLoad?.integrity).find(Boolean)||{}}
function weekGroups(rows=[]){const weeks=new Map();for(const source of rows){const row=clone(source);if(!row.localDate)continue;const key=weekKey(row.localDate);weeks.set(key,[...(weeks.get(key)||[]),row])}return weeks}
function immutableFingerprint(row){const x=clone(row);return JSON.stringify([x.workoutId,x.lineageId,x.localDate,x.slotIndex,x.status,x.sport,x.workoutType,x.title,x.intent,x.prescription,x.plannedDurationSeconds??null,x.plannedDistanceM,x.plannedLoad,x.source,x.lockLevel,x.flexible===true,x.explicitChoice===true])}
export function historicalRowsUnchanged(before=[],after=[],fromDate){
  const next=new Map(after.filter(row=>dateOnly(row.localDate||row.ds)<fromDate).map(row=>[String(row.workoutId||row.lineageId||`${row.localDate}:${row.slotIndex||0}`),row]));
  return before.filter(row=>dateOnly(row.localDate||row.ds)<fromDate).every(row=>{const key=String(row.workoutId||row.lineageId||`${row.localDate}:${row.slotIndex||0}`),candidate=next.get(key);return candidate&&immutableFingerprint(row)===immutableFingerprint(candidate)});
}
export function validatePlan(rows=[],rawConfig={},options={}){
  const cfg=normalizeConfig(rawConfig),fromDate=dateOnly(options.fromDate||''),issues=[],weeks=weekGroups(rows),slots=new Set(),scheduledQuality=[];
  for(const source of rows){const row=clone(source),mutable=!fromDate||row.localDate>=fromDate,slot=`${row.localDate}:${row.slotIndex}`;if(slots.has(slot))issues.push({code:'SLOT_COLLISION',localDate:row.localDate,slotIndex:row.slotIndex});slots.add(slot);if(mutable&&row.status==='scheduled'&&isRun(row)&&!cfg.constraints.runDays.includes(dayIndex(row.localDate))&&row.workoutType!=='race'&&!row.explicitChoice)issues.push({code:'RUN_DAY_CONFLICT',workoutId:row.workoutId,localDate:row.localDate});if(mutable&&row.status==='scheduled'&&isQuality(row))scheduledQuality.push(row)}
  for(const [week,items] of weeks){
    const mutableWeek=!fromDate||items.some(row=>row.localDate>=fromDate),runs=items.filter(row=>isRun(row)&&row.status!=='cancelled'),km=roundHalf(runs.reduce((sum,row)=>sum+distance(row)/1000,0)),quality=items.filter(row=>isQuality(row)&&!['cancelled','replaced','skipped'].includes(row.status)).sort((a,b)=>a.localDate.localeCompare(b.localDate)),meta=integrityOf(items),longs=items.filter(isLong);
    if(mutableWeek&&runs.length>cfg.constraints.maxRunDays)issues.push({code:'MAX_RUN_DAYS',week,actual:runs.length,limit:cfg.constraints.maxRunDays});
    if(mutableWeek&&km>cfg.constraints.weeklyKmCap+.01)issues.push({code:'WEEKLY_KM_CAP',week,actual:km,limit:cfg.constraints.weeklyKmCap});
    if(mutableWeek)for(let i=1;i<quality.length;i++)if((ms(quality[i].localDate)-ms(quality[i-1].localDate))/86400000<2)issues.push({code:'ADJACENT_QUALITY',week,workoutIds:[quality[i-1].workoutId,quality[i].workoutId]});
    if(mutableWeek)for(const q of quality)for(const l of longs)if(l.intent==='progressive-long'&&Math.abs((ms(q.localDate)-ms(l.localDate))/86400000)<=1)issues.push({code:'QUALITY_HARD_LONG_CONFLICT',week,workoutIds:[q.workoutId,l.workoutId]});
    if(mutableWeek){
      const expected=Number.isFinite(Number(meta.expectedQualitySessions))?Number(meta.expectedQualitySessions):Math.min(2,cfg.constraints.qualityDays.length),reason=String(meta.safetyOverrideReason||'');
      if(quality.length!==expected&&!reason)issues.push({code:'QUALITY_SESSION_INVARIANT',week,expected,actual:quality.length});
      const target=Number(meta.targetWeeklyVolume||0);if(target>0&&Math.abs(km-target)>.51&&!String(meta.volumeReason||reason))issues.push({code:'WEEKLY_VOLUME_INVARIANT',week,target,actual:km});
    }
  }
  scheduledQuality.sort((a,b)=>a.localDate.localeCompare(b.localDate));for(let i=1;i<scheduledQuality.length;i++)if((ms(scheduledQuality[i].localDate)-ms(scheduledQuality[i-1].localDate))/86400000<2)issues.push({code:'ADJACENT_QUALITY',workoutIds:[scheduledQuality[i-1].workoutId,scheduledQuality[i].workoutId]});for(let i=0;i<scheduledQuality.length;i++)if(scheduledQuality[i+2]&&(ms(scheduledQuality[i+2].localDate)-ms(scheduledQuality[i].localDate))/86400000<=6)issues.push({code:'ROLLING_QUALITY_CAP',workoutIds:scheduledQuality.slice(i,i+3).map(row=>row.workoutId)});
  return{valid:issues.length===0,issues,weeks:[...weeks].map(([week,items])=>{const meta=integrityOf(items);return{week,targetWeeklyVolume:Number(meta.targetWeeklyVolume||0),plannedKm:roundHalf(items.filter(row=>isRun(row)&&row.status!=='cancelled').reduce((sum,row)=>sum+distance(row)/1000,0)),expectedQualitySessions:Number(meta.expectedQualitySessions??Math.min(2,cfg.constraints.qualityDays.length)),actualQualitySessions:items.filter(row=>isQuality(row)&&!['cancelled','replaced','skipped'].includes(row.status)).length,safetyOverrideReason:String(meta.safetyOverrideReason||'')}})};
}
function chooseQualityDates({week,cfg,available,fixedQuality,expected,longDate}){
  const selected=[],canUse=date=>available.includes(date)&&date!==longDate&&![...fixedQuality,...selected].some(other=>Math.abs((ms(other)-ms(date))/86400000)<2),preferred=cfg.constraints.qualityDays.map(day=>addDays(week,day));
  for(const date of preferred)if(selected.length+fixedQuality.length<expected&&canUse(date))selected.push(date);
  for(const date of available)if(selected.length+fixedQuality.length<expected&&canUse(date))selected.push(date);
  return selected;
}
function allocateDistances(rows,targetRemaining){
  if(!rows.length)return{targetRemaining:roundHalf(targetRemaining),actualRemaining:0,shortfall:roundHalf(targetRemaining)};
  const min=row=>isLong(row)?12:isQuality(row)?8:3,weight=row=>isLong(row)?0.34:isQuality(row)?0.22:0.11,minTotal=rows.reduce((sum,row)=>sum+min(row),0),target=Math.max(0,roundHalf(targetRemaining));let remaining=Math.max(0,target-minTotal),weightTotal=rows.reduce((sum,row)=>sum+weight(row),0),assigned=0;
  rows.forEach((row,index)=>{let km=index===rows.length-1?roundHalf(target-assigned):roundHalf(min(row)+(remaining*weight(row)/Math.max(.01,weightTotal)));km=Math.max(min(row),km);if(index===rows.length-1)km=Math.max(min(row),roundHalf(target-assigned));assigned+=km;row.plannedDistanceM=km*1000;if(isLong(row))row.title=`${String(km).replace('.',',')} km rolig langtur`;else if(!isQuality(row))row.title=`${String(km).replace('.',',')} km rolig`});
  return{targetRemaining:target,actualRemaining:roundHalf(rows.reduce((sum,row)=>sum+distance(row)/1000,0)),shortfall:roundHalf(Math.max(0,minTotal-target))};
}
function rowFor(pool,used,type,date,index,week){
  const match=pool.find(row=>!used.has(row.workoutId)&&(type==='long'?isLong(row):type==='quality'?isQuality(row)&&row.workoutType!=='race':row.workoutType==='easy'&&!isLong(row))),fallback=pool.find(row=>!used.has(row.workoutId));let row=clone(match||fallback||template(type,date,0,index,week));used.add(row.workoutId);row.localDate=date;row.slotIndex=0;row.status='scheduled';row.sport='running';row.lockLevel='none';if(type==='long'){row.workoutType='easy';row.intent='long'}else if(type==='quality'){const generated=template('quality',date,0,index,week);row.workoutType='quality';row.intent=row.intent&&!['easy','long','recovery'].includes(row.intent)?row.intent:generated.intent;if(!isQuality(match||{})){row.title=generated.title;row.prescription=generated.prescription}}else{row.workoutType='easy';row.intent='easy';row.prescription=row.prescription?.main?.kind==='continuous'?row.prescription:{version:1,main:{kind:'continuous',intensity:'easy'}}}return row;
}
function restRow(pool,used,date,cfg,index,week){const same=pool.find(row=>!used.has(row.workoutId)&&row.localDate===date),fallback=pool.find(row=>!used.has(row.workoutId));let row=clone(same||fallback||template('easy',date,0,index,week));used.add(row.workoutId);const cross=cfg.constraints.alternativeDays.includes(dayIndex(date));return{...row,localDate:date,slotIndex:0,status:'scheduled',sport:cross?'cross':'rest',workoutType:cross?'cross':'rest',title:cross?'Alternativ eller hvile':'Hvile · treningsramme',intent:'recovery',plannedDistanceM:0,lockLevel:'none',prescription:{version:1,main:{kind:'recovery'}}}}
function reflowWeek(items,cfg,week,fromDate,trigger){
  const source=items.map(clone),fixed=source.filter(row=>row.localDate<fromDate||TERMINAL.has(row.status)||row.lockLevel==='user'||row.lockLevel==='system'||row.explicitChoice===true||row.plannedLoad?.manualMove===true&&trigger!=='training_preferences_changed'||row.workoutType==='race'),mutable=source.filter(row=>!fixed.includes(row)),occupied=new Set(fixed.map(row=>row.localDate)),available=cfg.constraints.runDays.map(day=>addDays(week,day)).filter(date=>date>=fromDate&&!occupied.has(date)),targetMeta=targetForWeek(cfg,week,fromDate),fixedRuns=fixed.filter(row=>isRun(row)&&row.status!=='cancelled'),fixedQuality=fixedRuns.filter(isQuality).map(row=>row.localDate),fixedLong=fixedRuns.find(isLong),preferredLong=addDays(week,cfg.constraints.longRunDay),longDate=fixedLong?'':available.includes(preferredLong)?preferredLong:available.find(date=>!fixedQuality.some(q=>Math.abs((ms(q)-ms(date))/86400000)<2))||'',qualityDates=chooseQualityDates({week,cfg,available:available.filter(date=>date!==longDate),fixedQuality,expected:targetMeta.expectedQualitySessions,longDate}),runDates=new Set([...available]),types=new Map([...runDates].map(date=>[date,'easy']));if(longDate)types.set(longDate,'long');qualityDates.forEach(date=>types.set(date,'quality'));
  const used=new Set(),future=[],allDates=Array.from({length:7},(_,index)=>addDays(week,index)).filter(date=>date>=fromDate&&!occupied.has(date));let qualityIndex=0;for(const date of allDates){const type=types.get(date);future.push(type?rowFor(mutable,used,type,date,qualityIndex++,week):restRow(mutable,used,date,cfg,qualityIndex++,week))}
  const targetKm=Math.min(cfg.constraints.weeklyKmCap,targetMeta.targetKm),fixedKm=roundHalf(fixedRuns.reduce((sum,row)=>sum+distance(row)/1000,0)),futureRuns=future.filter(isRun),allocation=allocateDistances(futureRuns,Math.max(0,targetKm-fixedKm)),actualQuality=fixed.filter(row=>isQuality(row)&&!['cancelled','replaced','skipped'].includes(row.status)).length+future.filter(isQuality).length;let safetyOverrideReason=targetMeta.safetyOverrideReason,volumeReason=targetMeta.volumeReason;
  if(actualQuality!==targetMeta.expectedQualitySessions&&!safetyOverrideReason)safetyOverrideReason='Begrenset gjenstående tilgjengelighet i inneværende uke.';
  if(allocation.shortfall>0&&!volumeReason)volumeReason='Gjenstående økter kan ikke reduseres mer uten å bryte minimumsdosen.';
  const longRunOverrideReason=!fixedLong&&longDate&&longDate!==preferredLong?'Langturen ble flyttet fra ønsket dag for å bevare avstand til en hardøkt eller en låst økt.':!fixedLong&&!longDate?'Ingen ledig langturdag gjenstår i uken.':'';
  const integrity={targetWeeklyVolume:targetKm,plannedWeeklyVolume:roundHalf(fixedKm+allocation.actualRemaining),expectedQualitySessions:targetMeta.expectedQualitySessions,actualQualitySessions:actualQuality,safetyOverrideReason,volumeReason,longRunOverrideReason,generatedFromDate:fromDate,trigger,preferredQualityDays:cfg.constraints.qualityDays,preferredLongRunDay:cfg.constraints.longRunDay};
  for(const row of [...fixed.filter(row=>row.localDate>=fromDate),...future]){row.plannedLoad={...(row.plannedLoad||{}),integrity};if(trigger==='training_preferences_changed')delete row.plannedLoad.manualMove}return[...fixed,...future].sort((a,b)=>a.localDate.localeCompare(b.localDate)||a.slotIndex-b.slotIndex);
}
export function reflowFuturePlan(rows=[],rawConfig={},fromDate=new Date().toISOString().slice(0,10),trigger='plan_adjustment'){
  const cfg=normalizeConfig(rawConfig),groups=weekGroups(rows),out=[];for(const [week,items] of groups)out.push(...(items.some(row=>row.localDate>=fromDate)?reflowWeek(items,cfg,week,fromDate,trigger):items));const result=out.sort((a,b)=>a.localDate.localeCompare(b.localDate)||a.slotIndex-b.slotIndex),validation=validatePlan(result,cfg,{fromDate});return{rows:result,validation,config:cfg,targetWeeklyVolume:cfg.profile.targetWeeklyVolume,generatedAt:new Date().toISOString(),generatedFromDate:fromDate,trigger};
}
export function constrainExisting(rows=[],rawConfig={},fromDate=new Date().toISOString().slice(0,10)){return reflowFuturePlan(rows,rawConfig,fromDate,'plan_adjustment')}
export function generateGoalPlan(rawConfig={},fromDate=new Date().toISOString().slice(0,10)){
  const cfg=normalizeConfig(rawConfig),goalDate=cfg.goal.date&&cfg.goal.date>=fromDate?cfg.goal.date:addDays(fromDate,55),rows=[];let cursor=monday(fromDate),week=0;while(cursor<=goalDate&&week<24){for(const day of cfg.constraints.runDays){const date=addDays(cursor,day);if(date<fromDate||date>goalDate)continue;rows.push(template('easy',date,0,day,cursor))}cursor=addDays(cursor,7);week++}
  if(cfg.goal.mode==='race'&&cfg.goal.date){for(let index=rows.length-1;index>=0;index--)if(rows[index].localDate===cfg.goal.date)rows.splice(index,1);rows.push({...template('quality',cfg.goal.date,({five:5,ten:10,half:21.1}[cfg.goal.distance]||21.1),99,weekKey(cfg.goal.date)),workoutType:'race',title:cfg.goal.name||'Hovedmål',intent:'race',plannedDistanceM:({five:5,ten:10,half:21.1}[cfg.goal.distance]||21.1)*1000,lockLevel:'system'})}
  const reflowed=reflowFuturePlan(rows,cfg,fromDate,'goal_changed');return{...reflowed,goalDate};
}
export function previewPlan({currentItems=[],historicalItems=null,config={},fromDate='',goalChanged=false,trigger='plan_adjustment'}={}){
  const start=dateOnly(fromDate)||new Date().toISOString().slice(0,10),authoritativeHistory=(historicalItems||currentItems).map(clone).filter(row=>row.localDate<start),future=currentItems.map(clone).filter(row=>row.localDate>=start),generated=goalChanged?generateGoalPlan(config,start):reflowFuturePlan(future,config,start,trigger),occupied=new Set(authoritativeHistory.map(row=>`${row.localDate}:${row.slotIndex}`)),combined=[...authoritativeHistory,...generated.rows.filter(row=>!occupied.has(`${row.localDate}:${row.slotIndex}`))],result=reflowFuturePlan(combined,config,start,trigger);if(!historicalRowsUnchanged(authoritativeHistory,result.rows,start))result.validation={valid:false,issues:[...(result.validation?.issues||[]),{code:'HISTORY_MUTATION_REJECTED'}]};return{...result,goalDate:generated.goalDate||''};
}
