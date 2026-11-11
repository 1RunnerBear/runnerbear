/* Read-only projections. Garmin shadow observations never become plan authority. */
const parse=value=>{try{return JSON.parse(value)}catch{return null}};
const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:null;
export function mergeHealthEvidence(canonical=[],shadow=[]){
 const days=new Map(canonical.map(row=>[row.date,{...row}]));
 for(const row of shadow){const m=parse(row.metrics);if(!m)continue;const old=days.get(row.date)||{date:row.date};
  const direct={hrv_ms:number(m.hrvMs,1,400),sleep_seconds:number(m.sleepSeconds,1,86400),rhr_bpm:number(m.rhr,20,150),spo2_avg_pct:number(m.spo2Avg,50,100),spo2_min_pct:number(m.spo2Min,50,100),respiration_avg_bpm:number(m.respiration,4,40),sleep_score:number(m.sleepScore,0,100)};
  const keys=Object.keys(direct).filter(k=>direct[k]!=null);
  if(!keys.length)continue;
  const result={...old};const sources={};for(const k of Object.keys(direct)){if(direct[k]!=null){result[k]=direct[k];sources[k]='garmin_personal_observed'}else if(result[k]!=null)sources[k]=old.health_source||'registered'}
  result.health_source=Object.values(sources).every(v=>v==='garmin_personal_observed')?'garmin_personal_observed':'mixed';result.metric_sources=sources;result.health_quality='observed_with_caveats';result.updated_at=row.updated_at;days.set(row.date,result);
 }
 return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
const kind=s=>/run|treadmill/i.test(s||'')?'run':/cycl|bik|virtual_ride/i.test(s||'')?'bike':/row/i.test(s||'')?'row':/swim/i.test(s||'')?'swim':'unknown';
export function attachFitEvidence(activities=[],shadow=[]){
 const candidates=activities.map(a=>shadow.filter(row=>{
  const summary=parse(row.summary_json);if(!summary||!row.fit_analysis||row.local_date!==a.date)return false;
  const sport=kind(a.sport_type),garminSport=kind(summary.sport);if(sport==='unknown'||sport!==garminSport)return false;
  const d=number(a.duration_seconds,1,86400),g=number(summary.durationSeconds,1,86400);if(!d||!g||Math.abs(d-g)>Math.max(10,d*.01))return false;
  if(a.distance_m>0&&summary.distanceM>0&&Math.abs(a.distance_m-summary.distanceM)>Math.max(25,a.distance_m*.01))return false;
  return true;
 }));
 return activities.map((a,i)=>{
  if(candidates[i].length!==1)return a;const row=candidates[i][0];if(candidates.filter(rows=>rows.some(x=>x.activity_id===row.activity_id)).length!==1)return a;
  const fit=parse(row.fit_analysis);if(fit?.version!==1||!Array.isArray(fit.laps)||fit.laps.length>1000)return a;
  return{...a,payload:{...a.payload,detail:{...a.payload?.detail,garminFit:{...fit,activityId:row.activity_id,source:'garmin_personal_observed',matchBasis:'unique_date_sport_duration_distance'}}}};
 });
}
