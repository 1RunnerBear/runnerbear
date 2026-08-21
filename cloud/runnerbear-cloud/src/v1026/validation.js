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
  return{
    profile:{...(input.profile||{}),baseKm:clamp(input.profile?.baseKm||50,10,250)},
    constraints:{runDays,qualityDays,alternativeDays,longRunDay,maxRunDays:Math.min(runDays.length,clamp(constraints.maxRunDays??runDays.length,1,7)),weeklyKmCap:clamp(constraints.weeklyKmCap??55,10,300)},
    goal:{mode:['race','base','transition'].includes(goal.mode)?goal.mode:'race',distance:['five','ten','half'].includes(goal.distance)?goal.distance:'half',date:dateOnly(goal.date),name:clean(goal.name),targetSeconds:Math.max(0,finite(goal.targetSeconds))}
  };
}
