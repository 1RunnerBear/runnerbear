export const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
export const dateOnly=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||'').slice(0,10))?String(value).slice(0,10):'';
export const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
export const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
export function object(value,name='payload'){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`INVALID_${name.toUpperCase()}`);return value}
export function oneOf(value,values,name){if(!values.includes(value))throw new Error(`INVALID_${name.toUpperCase()}`);return value}
export function requireDate(value,name='date'){const date=dateOnly(value);if(!date)throw new Error(`INVALID_${name.toUpperCase()}`);return date}
export function config(input={}){
  object(input,'config');const constraints=object(input.constraints||{},'constraints'),goal=object(input.goal||{},'goal');
  const runDays=[...new Set((constraints.runDays||[1,2,3,4,6]).map(Number).filter(x=>Number.isInteger(x)&&x>=0&&x<=6))].sort();
  const qualityDays=[...new Set((constraints.qualityDays||[1,4]).map(Number).filter(x=>Number.isInteger(x)&&x>=0&&x<=6))].slice(0,2).sort();
  const alternativeDays=[...new Set((constraints.alternativeDays||[0,5]).map(Number).filter(x=>Number.isInteger(x)&&x>=0&&x<=6))].sort();
  const longRunDay=clamp(constraints.longRunDay??6,0,6);if(qualityDays.some(day=>!runDays.includes(day)))throw new Error('INVALID_QUALITY_DAYS');if(!runDays.includes(longRunDay))throw new Error('INVALID_LONG_RUN_DAY');if(alternativeDays.some(day=>runDays.includes(day)))throw new Error('INVALID_ALTERNATIVE_DAYS');if(goal.distance&&!['five','ten','half'].includes(goal.distance))throw new Error('INVALID_GOAL_DISTANCE');
  const baseKm=clamp(input.profile?.baseKm||50,10,250),normalLow=clamp(input.profile?.normalLow??baseKm,10,250),normalHigh=clamp(input.profile?.normalHigh??Math.max(baseKm,normalLow),normalLow,250),upperLimit=clamp(input.profile?.upperLimit??input.profile?.maxKm??constraints.weeklyKmCap??normalHigh,normalHigh,300),targetWeeklyVolume=clamp(input.profile?.targetWeeklyVolume??baseKm,normalLow,Math.min(normalHigh,upperLimit));
  const safetyOverrides=Array.isArray(constraints.safetyOverrides)?constraints.safetyOverrides.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)).map(row=>({week:dateOnly(row.week),reason:clean(row.reason),expectedQualitySessions:clamp(row.expectedQualitySessions??2,0,2),targetWeeklyVolume:row.targetWeeklyVolume==null?null:clamp(row.targetWeeklyVolume,0,upperLimit)})).filter(row=>row.week&&row.reason):[];
  return{
    profile:{...(input.profile||{}),baseKm,normalLow,normalHigh,upperLimit,targetWeeklyVolume},
    constraints:{runDays,qualityDays,alternativeDays,longRunDay,maxRunDays:Math.min(runDays.length,clamp(constraints.maxRunDays??runDays.length,1,7)),weeklyKmCap:Math.min(upperLimit,clamp(constraints.weeklyKmCap??upperLimit,10,300)),safetyOverrides},
    goal:{mode:['race','base','transition'].includes(goal.mode)?goal.mode:'race',distance:['five','ten','half'].includes(goal.distance)?goal.distance:'half',date:dateOnly(goal.date),name:clean(goal.name),targetSeconds:Math.max(0,finite(goal.targetSeconds))}
  };
}
