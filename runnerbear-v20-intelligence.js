/* RunnerBear 2.0: read-only, source-bound workout and capacity evidence. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RunnerBearIntelligence=api})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0?v:null;
 const nonnegative=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
 const mean=rows=>{const valid=rows.filter(r=>nonnegative(r.value)!=null&&positive(r.seconds));const n=valid.reduce((s,r)=>s+r.seconds,0);return n?valid.reduce((s,r)=>s+r.value*r.seconds,0)/n:null};
 function workout(activity={}){
  const detail=activity.detail||{},analysis=detail.analysis||{},fit=detail.garminFit,raw=Array.isArray(fit?.laps)?fit.laps:null;
  const source=raw?'Garmin FIT':analysis.workBlocks?.length?'Registrerte arbeidsdeler':null;
  const blocks=(raw||analysis.workBlocks||[]).slice(0,1000).map((b,i)=>({index:i+1,seconds:positive(b.seconds??b.duration),distance:positive(b.distanceM??b.distance),hr:positive(b.avgHr??b.hr),power:nonnegative(b.avgPower??b.power),pace:positive(b.pace)||(positive(b.distanceM??b.distance)&&positive(b.seconds??b.duration)?(b.seconds??b.duration)/((b.distanceM??b.distance)/1000):null),role:raw?String(b.intensity||'unknown').toLowerCase():'active'})).filter(b=>b.seconds);
  const genericLaps=raw && blocks.length>1 && blocks.every(b=>b.role==='active');
  const work=genericLaps?[]:blocks.filter(b=>['active','interval','work'].includes(b.role));
  const correction=activity.paceCorrection;if(correction)for(const b of work)b.pace=correction.mode==='set'?positive(correction.paceSeconds):null;
  const kind=activity.sportType==='running'?'run':activity.sportType==='cycling'?'bike':activity.sportType==='rowing'||/concept2|rowerg|roing/i.test(activity.title||'')?'row':activity.sportType==='swimming'?'swim':'other';
  const metric=kind==='bike'||kind==='row'?'power':'pace',values=work.map(b=>b[metric]).filter(v=>nonnegative(v)!=null),avg=mean(work.map(b=>({seconds:b.seconds,value:b[metric]}))),spread=work.length>=3&&Math.max(...work.map(b=>b.seconds))/Math.min(...work.map(b=>b.seconds))<=1.1&&values.length===work.length&&avg?(Math.max(...values)-Math.min(...values))/avg:null;
  const seconds=work.reduce((s,b)=>s+b.seconds,0),hr=fit?.suspectHrLaps?null:mean(work.map(b=>({seconds:b.seconds,value:b.hr}))),power=mean(work.map(b=>({seconds:b.seconds,value:b.power}))),distance=work.reduce((s,b)=>s+(b.distance||0),0),pace=correction?(correction.mode==='set'?positive(correction.paceSeconds):null):work.length&&work.every(b=>b.distance)&&distance?seconds/(distance/1000):metric==='pace'?avg:null;
  const ramp=/ramp|ftp.?test/i.test(activity.title||'');
  const hasRecovery=blocks.some(b=>['rest','recovery','recover'].includes(b.role));
  const structure=ramp?'ramp':work.length>1&&hasRecovery?'intervals':work.length===1?'continuous':'unknown';
  const findings=[];
  if(fit?.suspectHrLaps)findings.push('Mulig sensorutfall i puls ved registrert sykkelbelastning. Arbeidspuls er utelatt.');
  if(work.length) findings.push(`${work.length} ${structure==='intervals'?'arbeidsdrag':work.length===1?'registrert arbeidsdel':'registrerte arbeidsdeler'} · ${Math.round(seconds/60)} min registrert varighet.`);
  if(spread!=null&&structure==='intervals') findings.push(spread<=.08?'Arbeidsdragene hadde liten variasjon.':'Arbeidsdragene varierte; se hvert drag før du vurderer intensiteten.');
  if(ramp)findings.push('Snittwatt på en ramptest er ikke FTP. Sonene endres ikke automatisk.');
  if(structure==='unknown'&&work.length)findings.push('Registrerte segmenter bekrefter ikke alene at dette var en intervalløkt.');
  if(!work.length)findings.push(blocks.length?'Rundedata finnes, men arbeid og pauser er ikke sikkert merket.':'Arbeidsdrag kan ikke skilles sikkert fra oppvarming og pauser ennå.');
  return{version:'workout-intelligence-1',kind,structure,source:correction?`${source||'Arbeidsdeler'} · arbeidsfart oppgitt av deg`:source,blocks,work,seconds,hr,power,pace,spread,findings:findings.slice(0,3),confidence:work.length?'observed_segments':'limited',title:ramp?'Ramptesten er registrert.':work.length?structure==='intervals'&&spread!=null&&spread<=.08?'Jevne arbeidsdrag.':'Dette fikk du gjort.':'Økten er registrert.',unknown:raw?'Grafen viser rundegjennomsnitt, ikke sekund-for-sekund-målinger. Ukjente runder brukes ikke som arbeidsdrag.':'Analysen bruker tilgjengelige arbeidsdeler. Sensorfeil, terreng og egenfølelse kan endre tolkningen.',next:kind==='run'?'Vurder opplevd innsats og eventuell symptomrespons før neste løpsbelastning. Farten alene bekrefter ikke intensiteten.':'Følg egenfølelse og målingene etter økten. Alternativ trening og løpsbelastning vurderes separat.'};
 }
 function load(activities=[],today,days=28){
  const from=new Date(Date.parse(today+'T12:00:00Z')-(days-1)*86400000).toISOString().slice(0,10),rows=activities.filter(a=>a.ds>=from&&a.ds<=today),running=rows.filter(a=>a.sportType==='running');
  return{from,through:today,days,minutes:Math.round(rows.reduce((s,a)=>s+(positive(a.duration)||0),0)/60),runKm:running.reduce((s,a)=>s+(positive(a.distance)||0),0)/1000,runSessions:running.length,alternateMinutes:Math.round(rows.filter(a=>a.sportType!=='running').reduce((s,a)=>s+(positive(a.duration)||0),0)/60)};
 }
 function capacity(activities=[],today,days=28){
  const dose=load(activities,today,days),runs=activities.filter(a=>a.sportType==='running'&&a.ds>=dose.from&&a.ds<=today&&positive(a.duration)&&positive(a.distance));
  const activeWeeks=new Set(runs.map(a=>{const d=new Date(a.ds+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10)})).size,longest=runs.length?Math.max(...runs.map(a=>a.duration)):0,intervals=runs.map(a=>workout(a)).filter(a=>a.structure==='intervals'&&a.pace!=null),workMinutes=Math.round(intervals.reduce((n,a)=>n+a.seconds,0)/60);
  const dimensions=[{label:'Løpskontinuitet',title:`${runs.length} løpeøkter i ${activeWeeks} kalenderuker`,copy:`${new Intl.NumberFormat('nb-NO',{maximumFractionDigits:1}).format(dose.runKm)} km registrert i valgt periode. Treningsdose beskriver hva du har gjort, ikke alene hvordan formen har endret seg.`},{label:'Arbeidsgrunnlag',title:intervals.length?`${workMinutes} minutter i registrerte arbeidsdrag`:'Arbeidsgrunnlaget er begrenset',copy:intervals.length?`${intervals.length} løpsøkter har intervallstruktur og registrert arbeidsfart. Sammenligning krever kvalifiserte økter og kontrollert aktivering.`:'Vi viser faktiske aktiviteter mens arbeid, pauser og hensikt blir tydeligere.'},{label:'Langvarig utholdenhet',title:longest?`Lengste registrerte løp: ${Math.round(longest/60)} minutter`:'Ingen egnet løpsøkt i perioden',copy:'Lengste økt beskriver eksponering for varighet. Konkurransekapasitet krever mer løpsspesifikt og sammenlignbart grunnlag.'}];
  return{version:'capacity-evidence-1',date:today,days,dose,dimensions,runObservations:runs.length,latestRun:runs.map(a=>a.ds).sort().at(-1)||null,estimates:[['5 km',5000],['10 km',10000],['Halvmaraton',21097.5]].map(([label,distance])=>({label,distance,seconds:null,range:null,reason:'Ikke sikkert nok ennå',explanation:'Et validert løpsspesifikt grunnlag trengs før RunnerBear viser et tidsestimat. Sykkelwatt omregnes ikke til løpstid.'})),modelStatus:'awaiting_validation'};
 }
 function todayContext({today,activities=[],workout=null,attention=false}={}){
  const latest=activities.filter(a=>a.ds<=today).sort((a,b)=>b.ds.localeCompare(a.ds))[0]||null;
  const age=latest?(Date.parse(today+'T12:00:00Z')-Date.parse(latest.ds+'T12:00:00Z'))/86400000:Infinity;
  if(attention)return{mode:'attention',latest};
  if(latest&&age<=2)return{mode:'activity',latest};
  if(workout?.ds===today)return{mode:workout.type==='rest'?'rest':'planned',latest};
  return{mode:'missing',latest};
 }
 return Object.freeze({workout,load,capacity,todayContext});
});
