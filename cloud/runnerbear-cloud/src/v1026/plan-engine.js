import { clean,config as normalizeConfig,dateOnly,finite } from './validation.js';
const RUN_TYPES=new Set(['easy','quality','race']);
const QUALITY_TYPES=new Set(['quality','race']);
const ms=date=>Date.parse(`${dateOnly(date)}T12:00:00Z`);
const addDays=(date,days)=>new Date(ms(date)+days*86400000).toISOString().slice(0,10);
const dayIndex=date=>(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7;
const monday=date=>addDays(date,-dayIndex(date));
const weekKey=date=>monday(date);
const isLong=row=>/langtur|long/i.test(`${row.title||''} ${row.intent||''}`)||row.workoutType==='long';
const isQuality=row=>QUALITY_TYPES.has(row.workoutType||row.type);
const isRun=row=>RUN_TYPES.has(row.workoutType||row.type)||String(row.sport||'').toLowerCase()==='running';
const distance=row=>finite(row.plannedDistanceM??row.planned_distance_m??finite(row.km)*1000);
const clone=row=>({...row,localDate:dateOnly(row.localDate||row.local_date||row.ds),status:row.status||'scheduled',sport:row.sport||'running',workoutType:row.workoutType||row.workout_type||row.type||'easy',plannedDistanceM:distance(row)});
function hash(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0).toString(36)}
function template(type,date,km,index=0){
  const quality=type==='quality',long=type==='long';
  return{workoutId:`wo-${hash(`${date}|${type}|${index}`)}`,lineageId:`lin-${hash(`${date}|${type}`)}`,localDate:date,slotIndex:0,status:'scheduled',sport:'running',workoutType:quality?'quality':'easy',title:quality?(index%2?'5 × 1000 m · VO₂':'6 × 6 min terskel'):long?`${km} km rolig langtur`:`${km} km rolig`,intent:quality?(index%2?'vo2':'threshold'):long?'long':'easy',plannedDistanceM:km*1000,lockLevel:'none',prescription:{version:1,main:quality?(index%2?{kind:'intervals',repetitions:5,workMeters:1000,recoverySeconds:120}:{kind:'intervals',repetitions:6,workSeconds:360,recoverySeconds:120}):{kind:'continuous',intensity:'easy'}}};
}
export function validatePlan(rows=[],rawConfig={}){
  const cfg=normalizeConfig(rawConfig),issues=[],weeks=new Map(),slots=new Set(),scheduledQuality=[];
  for(const source of rows){const row=clone(source),key=weekKey(row.localDate);weeks.set(key,[...(weeks.get(key)||[]),row])}
  for(const source of rows){const row=clone(source),slot=`${row.localDate}:${Number(row.slotIndex||0)}`;if(slots.has(slot))issues.push({code:'SLOT_COLLISION',localDate:row.localDate,slotIndex:Number(row.slotIndex||0)});slots.add(slot);if(row.status==='scheduled'&&isRun(row)&&!cfg.constraints.runDays.includes(dayIndex(row.localDate))&&row.workoutType!=='race'&&!row.explicitChoice)issues.push({code:'RUN_DAY_CONFLICT',workoutId:row.workoutId,localDate:row.localDate});if(row.status==='scheduled'&&isQuality(row))scheduledQuality.push(row)}
  for(const [week,items] of weeks){
    const runs=items.filter(isRun),km=runs.reduce((sum,row)=>sum+distance(row)/1000,0),quality=items.filter(isQuality).sort((a,b)=>a.localDate.localeCompare(b.localDate)),longs=items.filter(isLong);
    if(runs.length>cfg.constraints.maxRunDays)issues.push({code:'MAX_RUN_DAYS',week,actual:runs.length,limit:cfg.constraints.maxRunDays});
    if(km>cfg.constraints.weeklyKmCap+.01)issues.push({code:'WEEKLY_KM_CAP',week,actual:Math.round(km*10)/10,limit:cfg.constraints.weeklyKmCap});
    for(let i=1;i<quality.length;i++)if((ms(quality[i].localDate)-ms(quality[i-1].localDate))/86400000<2)issues.push({code:'ADJACENT_QUALITY',week,workoutIds:[quality[i-1].workoutId,quality[i].workoutId]});
    for(const q of quality)for(const l of longs)if(Math.abs((ms(q.localDate)-ms(l.localDate))/86400000)<=1)issues.push({code:'QUALITY_LONG_CONFLICT',week,workoutIds:[q.workoutId,l.workoutId]});
  }
  scheduledQuality.sort((a,b)=>a.localDate.localeCompare(b.localDate));for(let i=1;i<scheduledQuality.length;i++)if((ms(scheduledQuality[i].localDate)-ms(scheduledQuality[i-1].localDate))/86400000<2)issues.push({code:'ADJACENT_QUALITY',workoutIds:[scheduledQuality[i-1].workoutId,scheduledQuality[i].workoutId]});for(let i=0;i<scheduledQuality.length;i++)if(scheduledQuality[i+2]&&(ms(scheduledQuality[i+2].localDate)-ms(scheduledQuality[i].localDate))/86400000<=6)issues.push({code:'ROLLING_QUALITY_CAP',workoutIds:scheduledQuality.slice(i,i+3).map(row=>row.workoutId)});
  return{valid:issues.length===0,issues};
}
export function constrainExisting(rows=[],rawConfig={},fromDate=new Date().toISOString().slice(0,10)){
  const cfg=normalizeConfig(rawConfig),source=rows.map(clone),weeks=new Map();
  for(const row of source){if(row.localDate>=fromDate&&row.status==='scheduled'&&!row.explicitChoice&&(row.flexible===true||row.workoutType==='cross'||isRun(row)&&!cfg.constraints.runDays.includes(dayIndex(row.localDate))))Object.assign(row,{sport:cfg.constraints.alternativeDays.includes(dayIndex(row.localDate))?'cross':'rest',workoutType:cfg.constraints.alternativeDays.includes(dayIndex(row.localDate))?'cross':'rest',plannedDistanceM:0,title:cfg.constraints.alternativeDays.includes(dayIndex(row.localDate))?'Alternativ eller hvile':'Hvile · treningsramme',intent:'recovery'});const key=weekKey(row.localDate);weeks.set(key,[...(weeks.get(key)||[]),row])}
  for(const items of weeks.values()){
    const future=items.filter(row=>row.localDate>=fromDate&&!['completed','cancelled','replaced','skipped'].includes(row.status)&&row.lockLevel!=='user');
    const week=monday(items[0]?.localDate),swapTo=(row,targetDay)=>{
      const targetDate=addDays(week,targetDay);if(!row||targetDate<fromDate||row.localDate===targetDate)return;
      const partner=items.find(candidate=>candidate!==row&&candidate.localDate===targetDate);
      if(partner&&(!future.includes(partner)||partner.lockLevel==='user'))return;
      const previous=row.localDate;row.localDate=targetDate;if(partner)partner.localDate=previous;
    };
    const qualities=items.filter(row=>future.includes(row)&&isQuality(row)&&row.workoutType!=='race').sort((a,b)=>a.localDate.localeCompare(b.localDate));
    qualities.slice(0,2).forEach((row,index)=>{const target=cfg.constraints.qualityDays[index];if(Number.isInteger(target)&&target!==cfg.constraints.longRunDay)swapTo(row,target)});
    const long=items.find(row=>future.includes(row)&&isLong(row));if(long)swapTo(long,cfg.constraints.longRunDay);
    let runs=items.filter(isRun).sort((a,b)=>(isQuality(a)||isLong(a)?1:0)-(isQuality(b)||isLong(b)?1:0)||b.localDate.localeCompare(a.localDate));
    while(runs.length>cfg.constraints.maxRunDays){const row=runs.find(x=>future.includes(x)&&!isQuality(x)&&!isLong(x));if(!row)break;Object.assign(row,{sport:'rest',workoutType:'rest',title:'Hvile · volumramme',plannedDistanceM:0,intent:'recovery'});runs=items.filter(isRun)}
    let total=items.filter(isRun).reduce((s,x)=>s+distance(x),0),cap=cfg.constraints.weeklyKmCap*1000;
    for(const row of future.filter(x=>isRun(x)&&!isQuality(x)&&!isLong(x)).sort((a,b)=>distance(b)-distance(a))){if(total<=cap)break;const cut=Math.min(distance(row)-3000,total-cap);if(cut>0){row.plannedDistanceM=distance(row)-cut;row.title=`${Math.round(row.plannedDistanceM/1000)} km rolig · volumramme`;total-=cut}}
    for(const row of future.filter(x=>isRun(x)&&!isQuality(x)&&isLong(x))){if(total<=cap)break;const cut=Math.min(distance(row)-10000,total-cap);if(cut>0){row.plannedDistanceM=distance(row)-cut;row.title=`${Math.round(row.plannedDistanceM/1000)} km rolig langtur`;total-=cut}}
  }
  const validation=validatePlan(source,cfg);return{rows:source,validation,config:cfg};
}
export function generateGoalPlan(rawConfig={},fromDate=new Date().toISOString().slice(0,10)){
  const cfg=normalizeConfig(rawConfig),goalDate=cfg.goal.date&&cfg.goal.date>=fromDate?cfg.goal.date:addDays(fromDate,55),rows=[];let cursor=monday(fromDate),week=0;
  while(cursor<=goalDate&&week<24){
    const days=cfg.constraints.runDays.slice(0,cfg.constraints.maxRunDays),targetKm=Math.min(cfg.profile.baseKm,cfg.constraints.weeklyKmCap),longKm=Math.max(12,Math.min(22,Math.round(targetKm*.34))),qualityDays=cfg.constraints.qualityDays.filter(day=>days.includes(day)&&day!==cfg.constraints.longRunDay),types=new Map([[cfg.constraints.longRunDay,'long']]);qualityDays.slice(0,2).forEach(day=>types.set(day,'quality'));
    const reserved=longKm+qualityDays.slice(0,2).reduce((sum,_d,i)=>sum+(i%2?10:12),0),easyDays=days.filter(day=>!types.has(day)),easyKm=Math.max(3,Math.floor((targetKm-reserved)/Math.max(1,easyDays.length)));
    days.forEach(day=>{const date=addDays(cursor,day),type=types.get(day)||'easy';if(date<fromDate||date>goalDate)return;rows.push(template(type,date,type==='long'?longKm:type==='quality'?(week%2?10:12):easyKm,week))});
    cursor=addDays(cursor,7);week++;
  }
  if(cfg.goal.mode==='race'&&cfg.goal.date){
    for(let index=rows.length-1;index>=0;index--)if(rows[index].localDate===cfg.goal.date)rows.splice(index,1);
    for(const row of rows)if(row.workoutType==='quality'&&Math.abs((ms(row.localDate)-ms(cfg.goal.date))/86400000)<=2)Object.assign(row,{workoutType:'easy',title:'5 km svært rolig · løpstilpasning',intent:'easy',plannedDistanceM:5000,prescription:{version:1,main:{kind:'continuous',intensity:'easy'}}});
    rows.push({...template('quality',cfg.goal.date,{five:5,ten:10,half:21.1}[cfg.goal.distance]||21.1,99),workoutType:'race',title:cfg.goal.name||'Hovedmål',intent:'race',plannedDistanceM:({five:5,ten:10,half:21.1}[cfg.goal.distance]||21.1)*1000,lockLevel:'system'})
  }
  const constrained=constrainExisting(rows,cfg,fromDate);return{...constrained,goalDate};
}
export function previewPlan({currentItems=[],config={},fromDate='',goalChanged=false}={}){
  if(!goalChanged)return constrainExisting(currentItems,config,fromDate);
  const preserved=currentItems.map(clone).filter(row=>row.localDate<fromDate||['completed','cancelled','replaced','skipped'].includes(row.status)||row.lockLevel==='user'||row.lockLevel==='system'&&row.workoutType!=='race'),generated=generateGoalPlan(config,fromDate),occupied=new Set(preserved.map(row=>`${row.localDate}:${Number(row.slotIndex||0)}`)),future=generated.rows.filter(row=>!occupied.has(`${row.localDate}:${Number(row.slotIndex||0)}`)),result=constrainExisting([...preserved,...future],config,fromDate);return{...result,goalDate:generated.goalDate};
}
