import {mergeHealthEvidence} from '../v20/evidence.js';
export const HEALTH_POLICY='observed-response-1';
export const addDays=(date,n)=>new Date(Date.parse(`${date}T12:00:00Z`)+n*86400000).toISOString().slice(0,10);
export const localDay=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo'}).format(new Date(now));
export const finite=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
export const median=values=>{const a=values.filter(v=>finite(v)!=null).sort((a,b)=>a-b),n=a.length;return n?(n%2?a[n>>1]:(a[n/2-1]+a[n/2])/2):null};
export const parse=(text,fallback={})=>{try{return JSON.parse(text)||fallback}catch{return fallback}};
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
export function healthEvidence(canonical=[],shadow=[]){
 const rows=mergeHealthEvidence(canonical,shadow),original=new Map(canonical.map(r=>[r.date,r])),direct=new Map(shadow.map(r=>[r.date,r]));
 for(const row of rows)for(const [key,min,max] of [['hrv_ms',1,400],['sleep_seconds',1,86400],['rhr_bpm',20,150],['spo2_avg_pct',50,100],['spo2_min_pct',50,100]])if(finite(row[key])==null||row[key]<min||row[key]>max)row[key]=null;
 return rows.filter(r=>validDate(r.date)).map(r=>({...r,metricEvidence:Object.fromEntries(['hrv_ms','sleep_seconds','rhr_bpm','spo2_avg_pct','spo2_min_pct'].filter(k=>finite(r[k])!=null).map(k=>{const source=r.metric_sources?.[k]||r.health_source||'registered',row=source==='garmin_personal_observed'?direct.get(r.date):original.get(r.date);return[k,{source,measurementDate:r.date,measuredAt:null,precision:'day',receivedAt:row?.updated_at||null,quality:r.health_quality||'observed'}]}))}));
}
const definitions=[['hrv','hrv_ms','HRV','ms',1,400,0.1],['sleep','sleep_seconds','Søvn','seconds',1,86400,1800],['rhr','rhr_bpm','Hvilepuls','bpm',20,150,3]];
export function analyzeHealth(rows=[],{today=localDay(new Date()),now=new Date().toISOString()}={}){
 const map=new Map();for(const row of rows.filter(r=>validDate(r.date)&&r.date<=today).sort((a,b)=>String(a.updated_at||'').localeCompare(String(b.updated_at||''))))map.set(row.date,row);
 const days=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
 const domains=definitions.map(([id,key,label,unit,min,max,floor])=>{
  const valid=days.filter(r=>finite(r[key])!=null&&r[key]>=min&&r[key]<=max),recent=valid.filter(r=>r.date>=addDays(today,-6)),reference=valid.filter(r=>r.date>=addDays(today,-34)&&r.date<=addDays(today,-7)),latest=valid.at(-1),value=median(recent.map(r=>r[key])),baseline=median(reference.map(r=>r[key])),mad=baseline==null?null:median(reference.map(r=>Math.abs(r[key]-baseline))),fresh=!!latest&&latest.date>=addDays(today,-1),sufficient=recent.length>=4&&reference.length>=14;
  // Descriptive change detection only, not a clinical or readiness threshold.
  const threshold=baseline==null?null:Math.max((mad||0)*2.5,id==='hrv'?baseline*floor:floor),delta=value!=null&&baseline!=null?value-baseline:null;
  const direction=delta==null?null:Math.abs(delta)>threshold?delta>0?'higher':'lower':'within';
  const state=!latest?'missing':!fresh?'stale':!sufficient?'building':direction==='within'?'steady':direction;
  const fmt=v=>unit==='seconds'?`${Math.round(v/60)} min`:`${Math.round(v*10)/10} ${unit}`;
  const summary=state==='missing'?`${label}: ingen tilgjengelige målinger.`:state==='stale'?`${label}: siste måledato er ${latest.date}.`:state==='building'?`${label}: ${recent.length} av 7 dager; sammenligningsgrunnlaget bygges (${reference.length} av 28 dager).`:`${label}: ${fmt(value)} de siste 7 dagene, mot ${fmt(baseline)} i referanseperioden. ${state==='steady'?'Ingen tydelig endring i denne sammenligningen.':state==='higher'?'Høyere enn referansen.':'Lavere enn referansen.'}`;
  return{id,key,label,unit,state,current:latest?.[key]??null,value,baseline,delta,referenceMad:mad,referenceFrom:addDays(today,-34),referenceTo:addDays(today,-7),recentFrom:addDays(today,-6),recentThrough:today,coverage:recent.length,referenceCoverage:reference.length,measurementDate:latest?.date||null,measuredAt:null,precision:'day',source:latest?.metricEvidence?.[key]?.source||latest?.metric_sources?.[key]||latest?.health_source||null,receivedAt:latest?.metricEvidence?.[key]?.receivedAt||latest?.updated_at||null,confidence:!fresh||!sufficient?'limited':'descriptive',summary,factId:`health:${id}:${today}`};
 });
 const changed=domains.filter(d=>['higher','lower'].includes(d.state)),usable=domains.filter(d=>!['missing','stale'].includes(d.state));
 return{version:HEALTH_POLICY,date:today,generatedAt:now,domains,changedDomains:changed.map(d=>d.id),title:changed.length?'Kroppens mønster har endret seg.':usable.length?'Dette viser kroppens respons.':'Vi viser siste tilgjengelige grunnlag.',summary:changed.length?changed.slice(0,2).map(d=>d.summary).join(' '):domains.filter(d=>d.state==='steady').length?domains.filter(d=>d.state==='steady').map(d=>d.summary).join(' '):usable.length?usable.map(d=>d.summary).join(' '):'Nye nattdata følges automatisk. Manglende målinger tolkes ikke som normal respons.',limitation:'Dette er observerte mønstre, ikke en diagnose eller en automatisk beslutning om trening. Dagsmålinger har ikke et kjent sensorklokkeslett.',mode:'observed-only',planAuthority:false};
}
export function responseAfter(activity,rows,today){
 const dates=[addDays(activity.date,1),addDays(activity.date,2)],available=rows.filter(r=>dates.includes(r.date)&&r.date<=today&&['hrv_ms','sleep_seconds','rhr_bpm'].some(k=>finite(r[k])!=null)),elapsed=(Date.parse(today)-Date.parse(activity.date))/86400000;
 const status=elapsed<1?'awaiting_night':available.length===2?'observed':elapsed>3?'closed_insufficient':available.length?'partial':'awaiting_data';
 const values=available.map(r=>({date:r.date,hrv:finite(r.hrv_ms),sleepSeconds:finite(r.sleep_seconds),rhr:finite(r.rhr_bpm)}));
 return{status,dates,values,nextReviewDate:elapsed<1?dates[0]:elapsed<2?dates[1]:addDays(activity.date,3),summary:status==='awaiting_night'?'Vi følger de neste nettenes målinger etter økten.':available.length?`${available.length} av 2 påfølgende netter har målinger. Flere økter og andre forhold kan påvirke responsen.`:status==='closed_insufficient'?'Oppfølgingen er avsluttet uten nok nattdata til å evaluere responsen.':'Nattdata mangler foreløpig. Oppfølgingen oppdateres automatisk.',limitation:'Målinger etter en økt viser tidsmessig sammenheng, ikke at økten forårsaket endringen.'};
}
