/* Read-only projections. Garmin shadow observations never become plan authority. */
const parse=value=>{try{return JSON.parse(value)}catch{return null}};
const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:null;
export function mergeHealthEvidence(canonical=[],shadow=[]){
 const days=new Map(canonical.map(row=>[row.date,{...row}]));
 for(const row of shadow){const m=parse(row.metrics);if(!m)continue;const old=days.get(row.date)||{date:row.date};
  const direct={hrv_ms:number(m.hrvMs,1,400),sleep_seconds:number(m.sleepSeconds,1,86400),rhr_bpm:number(m.rhr,20,150),spo2_avg_pct:number(m.sleepSpo2Avg,50,100),spo2_min_pct:number(m.sleepSpo2Min,50,100),respiration_avg_bpm:number(m.respiration,4,40),sleep_score:number(m.sleepScore,0,100)};
  const keys=Object.keys(direct).filter(k=>direct[k]!=null);
  if(!keys.length)continue;
  const result={...old};const sources={};for(const k of Object.keys(direct)){if(direct[k]!=null){result[k]=direct[k];sources[k]='garmin_personal_observed'}else if(result[k]!=null)sources[k]=old.health_source||'registered'}
  result.health_source=Object.values(sources).every(v=>v==='garmin_personal_observed')?'garmin_personal_observed':'mixed';result.metric_sources=sources;result.health_quality='observed_with_caveats';result.updated_at=row.updated_at;days.set(row.date,result);
 }
 return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
const kind=s=>/run|treadmill/i.test(s||'')?'run':/cycl|bik|virtual_ride/i.test(s||'')?'bike':/row/i.test(s||'')?'row':/swim/i.test(s||'')?'swim':'unknown';
function matchBasis(a,row){
 const summary=parse(row.summary_json);
 if(!summary||!row.fit_analysis||row.local_date!==a.date)return null;
 const sport=kind(a.sport_type==='misc'?a.sub_sport_type:a.sport_type);
 if(sport==='unknown'||sport!==kind(summary.sport))return null;
 const d=number(a.duration_seconds,1,86400),g=number(summary.durationSeconds,1,86400);
 if(!d||!g)return null;
 const durationClose=value=>Math.abs(d-value)<=Math.max(10,d*.01);
 const hasDistance=a.distance_m>0&&summary.distanceM>0;
 const distanceDelta=Math.abs(a.distance_m-summary.distanceM);
 const distanceClose=hasDistance&&distanceDelta<=Math.max(25,a.distance_m*.01);
 if(durationClose(g)&&(!hasDistance||distanceClose))return 'unique_date_sport_duration_distance';
 // Same UTC second from both providers is mandatory for either exception.
 const utcSecond=value=>typeof value==='string'&&value.endsWith('Z')?Math.floor(Date.parse(value)/1000):NaN;
 if(utcSecond(a.payload?.date)!==utcSecond(summary.startUtc))return null;
 if(sport==='swim'&&distanceClose&&number(summary.movingSeconds,1,g)&&durationClose(summary.movingSeconds))
   return 'unique_utc_sport_moving_duration_distance';
 if(sport==='row'&&durationClose(g)&&hasDistance&&distanceDelta<=a.distance_m*.03)
   return 'unique_utc_sport_duration_row_distance';
 return null;
}
export function attachFitEvidence(activities=[],shadow=[]){
 const candidates=activities.map(a=>shadow.flatMap(row=>{
  const basis=matchBasis(a,row);
  return basis?[{row,basis}]:[];
 }));
 return activities.map((a,i)=>{
  if(candidates[i].length!==1)return a;
  const {row,basis}=candidates[i][0];
  if(candidates.filter(rows=>rows.some(x=>x.row.activity_id===row.activity_id)).length!==1)return a;
  const fit=parse(row.fit_analysis);if(fit?.version!==1||!Array.isArray(fit.laps)||fit.laps.length>1000)return a;
  const cycling=kind(parse(row.summary_json)?.sport)==='bike';
  // A lap average below 40 bpm under sustained power is unreliable for exercise interpretation.
  const suspectHrLaps=cycling?fit.laps.filter(lap=>lap.seconds>=20 && lap.avgPower>=100 &&
    typeof lap.avgHr==='number' && lap.avgHr>=0 && lap.avgHr<40).length:0;
  return{...a,payload:{...a.payload,detail:{...a.payload?.detail,garminFit:{...fit,suspectHrLaps,activityId:row.activity_id,source:'garmin_personal_observed',matchBasis:basis}}}};
 });
}
