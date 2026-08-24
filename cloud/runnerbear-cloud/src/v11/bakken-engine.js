const DAY_MS=86400000;
export const BAKKEN_ENGINE_VERSION='11.0.0';
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const dateOnly=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||'').slice(0,10))?String(value).slice(0,10):'';
const dayDistance=(a,b)=>Math.abs((Date.parse(`${dateOnly(a)}T12:00:00Z`)-Date.parse(`${dateOnly(b)}T12:00:00Z`))/DAY_MS);
const addDays=(value,days)=>new Date(Date.parse(`${dateOnly(value)}T12:00:00Z`)+days*DAY_MS).toISOString().slice(0,10);
const monday=value=>{const date=new Date(`${dateOnly(value)}T12:00:00Z`),day=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-day);return date.toISOString().slice(0,10)};
const weekOrdinal=value=>Math.round((Date.parse(`${monday(value)}T12:00:00Z`)-Date.parse('2026-01-05T12:00:00Z'))/(7*DAY_MS));
const clone=value=>JSON.parse(JSON.stringify(value));
const terminal=row=>['completed','cancelled','replaced','skipped'].includes(String(row?.status||''));
const isQuality=row=>row?.workoutType==='quality'&&row?.sport==='running'&&!terminal(row);
const eventPayload=row=>row?.payload&&typeof row.payload==='object'?row.payload:{};
const eventId=row=>String(row?.event_id||row?.eventId||row?.source_id||row?.sourceId||'');

export const QUALITY_LIBRARY=Object.freeze([
  {id:'threshold-6x6',family:'threshold_long',stimulus:'threshold',title:'6 × 6 min terskel',workMinutes:36,cost:2,phases:['BASE','BUILD','SPECIFIC'],main:{kind:'intervals',repetitions:6,workSeconds:360,recoverySeconds:120},desc:'6 × 6 min kontrollert terskel med 2 min rolig jogg.',detail:'Stabil pust og kontrollert puls. Avslutt før økten glir over i X-belastning.',purpose:'Bygge repeterbar terskelkapasitet med moderat muskulær kostnad.'},
  {id:'threshold-5x8',family:'threshold_long',stimulus:'threshold',title:'5 × 8 min terskel',workMinutes:40,cost:2,phases:['BASE','BUILD','SPECIFIC'],main:{kind:'intervals',repetitions:5,workSeconds:480,recoverySeconds:90},desc:'5 × 8 min kontrollert terskel med 90 sek rolig jogg.',detail:'Lang og jevn arbeidsdel. Prioriter repeterbar fart fremfor høyest mulig puls.',purpose:'Akkumulere lang terskeltid uten å gjøre økten til en test.'},
  {id:'threshold-4x10',family:'threshold_long',stimulus:'threshold',title:'4 × 10 min terskel',workMinutes:40,cost:2,phases:['BASE','BUILD','SPECIFIC'],main:{kind:'intervals',repetitions:4,workSeconds:600,recoverySeconds:90},desc:'4 × 10 min kontrollert terskel med 90 sek rolig jogg.',detail:'Finn kontroll tidlig og hold samme tekniske uttrykk gjennom siste drag.',purpose:'Bygge sammenhengende terskelrobusthet med lav nok kostnad til å gjentas.'},
  {id:'threshold-3x12',family:'threshold_long',stimulus:'threshold',title:'3 × 12 min terskel',workMinutes:36,cost:2,phases:['BASE','BUILD','SPECIFIC'],main:{kind:'intervals',repetitions:3,workSeconds:720,recoverySeconds:120},desc:'3 × 12 min kontrollert terskel med 2 min rolig jogg.',detail:'Jevnt og komfortabelt hardt. Ingen progressiv avslutning hvis kontrollen faller.',purpose:'Utvikle varighet nær terskel med tydelig intensitetskontroll.'},
  {id:'threshold-4x2000',family:'threshold_long',stimulus:'threshold',title:'4 × 2000 m terskel',workMinutes:34,cost:2,phases:['BUILD','SPECIFIC'],main:{kind:'intervals',repetitions:4,workMeters:2000,recoverySeconds:90},desc:'4 × 2000 m kontrollert terskel med 90 sek rolig jogg.',detail:'Farten styres av intern belastning. Det siste draget skal være like kontrollert som det første.',purpose:'Koble terskelkontroll til lengre, løpsnære drag.'},
  {id:'threshold-24x45-15',family:'threshold_short',stimulus:'threshold',title:'24 × 45/15 · kontrollert terskel',workMinutes:18,cost:1,phases:['BASE','BUILD','SPECIFIC'],main:{kind:'intervals',repetitions:24,workSeconds:45,recoverySeconds:15},desc:'24 × 45 sek kontrollert / 15 sek flytende rolig.',detail:'Rytme og flyt uten hero-fart. Siste tredel skal være like kontrollert som den første.',purpose:'Gi kort terskelstimulans og god løpsøkonomi med lav restitusjonskostnad.'},
  {id:'threshold-15x1',family:'threshold_short',stimulus:'threshold',title:'15 × 1 min / 30 sek · terskel',workMinutes:15,cost:1,phases:['BASE','BUILD','SPECIFIC'],main:{kind:'intervals',repetitions:15,workSeconds:60,recoverySeconds:30},desc:'15 × 1 min kontrollert terskel med 30 sek rolig flyt.',detail:'Kort steg, god rytme og reserve. Ikke jakt fart på de første dragene.',purpose:'Variere terskelarbeidet uten å øke den totale kostnaden.'},
  {id:'threshold-12x400',family:'threshold_short',stimulus:'threshold',title:'12 × 400 m · kontrollert terskel',workMinutes:16,cost:1,phases:['BASE','BUILD'],main:{kind:'intervals',repetitions:12,workMeters:400,recoverySeconds:30},desc:'12 × 400 m kontrollert med 30 sek rolig flyt.',detail:'Dette er kort terskel, ikke en 400-meterkonkurranse. Hold igjen hele veien.',purpose:'Bygge teknisk flyt og kontroll ved litt høyere fart.'},
  {id:'x-10x60-hills',family:'controlled_x',stimulus:'x',title:'10 × 60 sek korte bakker',workMinutes:10,cost:2,phases:['BASE','BUILD','SPECIFIC'],main:{kind:'intervals',repetitions:10,workSeconds:60,recovery:'rolig retur'},desc:'10 × 60 sek kontrollert hardt i slak motbakke.',detail:'God teknikk og full rolig retur. Stopp før steget blir tungt eller presset.',purpose:'Gi et kontrollert X-element med styrke og fart uten lang VO₂-belastning.'},
  {id:'x-8x2',family:'controlled_x',stimulus:'x',title:'8 × 2 min · kontrollert X',workMinutes:16,cost:2,phases:['BUILD','SPECIFIC'],main:{kind:'intervals',repetitions:8,workSeconds:120,recoverySeconds:60},desc:'8 × 2 min kontrollert over terskel med 60 sek rolig jogg.',detail:'Raskt, men aldri all-in. Avslutt med reserve og bevart teknikk.',purpose:'Vedlikeholde høyere aerob fart uten å dominere terskelarbeidet.'},
  {id:'x-5x1000',family:'vo2',stimulus:'x',title:'5 × 1000 m · kontrollert VO₂',workMinutes:18,cost:3,phases:['SPECIFIC'],goals:['five','ten'],main:{kind:'intervals',repetitions:5,workMeters:1000,recoverySeconds:120},desc:'5 × 1000 m kontrollert VO₂ med 2 min rolig jogg.',detail:'Et sjeldent X-element. Krever grønt responsbilde, riktig løpsfase og minst ett kontrollert terskelanker i uken.',purpose:'Gi målrettet VO₂-stimulans for 5 km/10 km uten å erstatte terskelgrunnlaget.'},
  {id:'specific-half-3x3000',family:'race_specific',stimulus:'race_specific',title:'3 × 3000 m · kontrollert HM-rytme',workMinutes:34,cost:2,phases:['SPECIFIC'],goals:['half'],main:{kind:'intervals',repetitions:3,workMeters:3000,recoverySeconds:120},desc:'3 × 3000 m rundt kontrollert halvmaratonrytme med 2 min rolig jogg.',detail:'Følelsen skal være kontrollert og stabil. Økten er spesifikk trening, ikke en formtest.',purpose:'Koble terskelkapasiteten til aktivt halvmaratonmål.'},
  {id:'specific-ten-4x1600',family:'race_specific',stimulus:'race_specific',title:'4 × 1600 m · kontrollert 10 km-rytme',workMinutes:24,cost:2,phases:['SPECIFIC'],goals:['ten'],main:{kind:'intervals',repetitions:4,workMeters:1600,recoverySeconds:90},desc:'4 × 1600 m kontrollert rundt 10 km-rytme.',detail:'Jevn fart og teknisk kontroll. Ingen sluttspurt.',purpose:'Koble terskelarbeidet til aktivt 10 km-mål.'},
  {id:'specific-five-10x600',family:'race_specific',stimulus:'race_specific',title:'10 × 600 m · kontrollert 5 km-rytme',workMinutes:20,cost:2,phases:['SPECIFIC'],goals:['five'],main:{kind:'intervals',repetitions:10,workMeters:600,recoverySeconds:75},desc:'10 × 600 m kontrollert rundt 5 km-rytme.',detail:'God rytme og reserve. Dette skal ikke bli en maksimal VO₂-test.',purpose:'Gjøre terskelgrunnlaget relevant for aktivt 5 km-mål.'},
  {id:'taper-4x5',family:'taper_threshold',stimulus:'threshold',title:'4 × 5 min terskel · redusert dose',workMinutes:20,cost:1,phases:['TAPER','RACE','TRANSITION'],main:{kind:'intervals',repetitions:4,workSeconds:300,recoverySeconds:90},desc:'4 × 5 min kontrollert terskel med god margin.',detail:'Bevar rytmen og avslutt mens beina fortsatt kjennes lette.',purpose:'Bevare terskelfølelse og friskhet inn mot løp eller ny belastningsperiode.'},
  {id:'taper-3x6',family:'taper_threshold',stimulus:'threshold',title:'3 × 6 min terskel · redusert dose',workMinutes:18,cost:1,phases:['TAPER','RACE','TRANSITION'],main:{kind:'intervals',repetitions:3,workSeconds:360,recoverySeconds:120},desc:'3 × 6 min kontrollert terskel med full reserve.',detail:'Kort totaldose, jevn pust og lett steg. Ingen progressiv avslutning.',purpose:'Bevare terskelkontroll med lav total kostnad inn mot løp.'},
  {id:'taper-5x3',family:'taper_threshold',stimulus:'threshold',title:'5 × 3 min terskel · lett rytme',workMinutes:15,cost:1,phases:['TAPER','RACE','TRANSITION'],main:{kind:'intervals',repetitions:5,workSeconds:180,recoverySeconds:75},desc:'5 × 3 min kontrollert terskel med lett og avslappet rytme.',detail:'Avslutt med mer å gå på. Økten skal gi spenst, ikke tretthet.',purpose:'Vedlikeholde rytme og løpsøkonomi uten å bygge restitusjonsbehov.'},
  {id:'taper-8x2',family:'taper_threshold',stimulus:'threshold',title:'8 × 2 min terskel · lett flyt',workMinutes:16,cost:1,phases:['TAPER','RACE','TRANSITION'],main:{kind:'intervals',repetitions:8,workSeconds:120,recoverySeconds:60},desc:'8 × 2 min kontrollert terskel med rolig jogg.',detail:'Lett frekvens og tydelig kontroll. Ikke la korte drag bli X-belastning.',purpose:'Bevare lett terskelflyt og nevromuskulær rytme med minimal kostnad.'}
]);

const byId=id=>QUALITY_LIBRARY.find(row=>row.id===id)||null;
export function phaseFor(config={},referenceDate=new Date().toISOString().slice(0,10)){
  const goal=config.goal||{};
  if(goal.mode==='transition')return'TRANSITION';
  if(goal.mode==='base'||!dateOnly(goal.date))return'BASE';
  const activeRaces=[...(goal.secondary||[]).filter(row=>row.status!=='cancelled'&&dateOnly(row.date)>=referenceDate).map(row=>({date:dateOnly(row.date),effort:row.effort||'controlled'})),{date:dateOnly(goal.date),effort:'race'}].filter(row=>row.date).sort((a,b)=>a.date.localeCompare(b.date));
  const next=activeRaces[0],days=next?Math.round((Date.parse(`${next.date}T12:00:00Z`)-Date.parse(`${referenceDate}T12:00:00Z`))/DAY_MS):999;
  if(days<=7)return'RACE';
  if(days<=14)return'TAPER';
  if(days<=56)return'SPECIFIC';
  if(days<=112)return'BUILD';
  return'BASE';
}

function desiredFamily({phase,slot,week,goalDistance='half',hasRace=false,expectedQuality=2,responseMode='NORMAL'}={}){
  if(responseMode==='REDUCE'||responseMode==='RECOVERY')return slot===0?'threshold_short':'taper_threshold';
  if(responseMode==='HOLD')return'threshold_short';
  if(hasRace||expectedQuality<=1||phase==='TAPER'||phase==='RACE'||phase==='TRANSITION')return'taper_threshold';
  if(slot===0)return'threshold_long';
  const ordinal=Math.abs(weekOrdinal(week));
  if(phase==='BASE')return ordinal%3===0?'controlled_x':'threshold_short';
  if(phase==='BUILD')return ordinal%2===0?'controlled_x':'threshold_short';
  if(phase==='SPECIFIC')return ordinal%2===0?'race_specific':'controlled_x';
  return goalDistance==='half'?'threshold_short':'controlled_x';
}

function candidateScore(candidate,{family,phase,goalDistance,responseMode,date,history=[],slot=0}={}){
  let score=candidate.family===family?100:candidate.stimulus==='threshold'&&family!=='controlled_x'&&family!=='race_specific'?42:0;
  if(!candidate.phases.includes(phase))score-=120;
  if(candidate.goals&&!candidate.goals.includes(goalDistance))score-=120;
  if(candidate.id==='x-5x1000'&&(phase!=='SPECIFIC'||responseMode!=='BUILD'&&responseMode!=='NORMAL'))score-=160;
  if(responseMode==='HOLD'&&candidate.stimulus!=='threshold')score-=160;
  if(['REDUCE','RECOVERY'].includes(responseMode)&&candidate.stimulus!=='threshold')score-=160;
  if(responseMode==='REDUCE')score-=candidate.cost*18;
  if(responseMode==='BUILD')score+=candidate.workMinutes>=24?8:0;
  const repeats=history.filter(row=>row.sessionId===candidate.id&&row.localDate<date).map(row=>dayDistance(row.localDate,date));
  if(repeats.some(days=>days<14))score-=90;
  else if(repeats.some(days=>days<28))score-=18;
  const rotation=Math.abs(weekOrdinal(date)+slot)%Math.max(1,QUALITY_LIBRARY.filter(row=>row.family===family).length);
  const familyIndex=QUALITY_LIBRARY.filter(row=>row.family===family).findIndex(row=>row.id===candidate.id);
  if(familyIndex===rotation)score+=12;
  return score;
}

export function sessionHistory(items=[]){
  return items.map(row=>({localDate:dateOnly(row.localDate||row.ds),sessionId:String(row.plannedLoad?.bakken?.sessionId||row.prescription?.bakken?.sessionId||''),stimulus:String(row.plannedLoad?.bakken?.stimulus||row.intent||'')})).filter(row=>row.localDate&&row.sessionId);
}

export function selectQualitySession({date,slot=0,week=monday(date),config={},history=[],expectedQuality=2,hasRace=false,responseMode='NORMAL',excludeIds=[]}={}){
  const phase=phaseFor(config,date),goalDistance=config.goal?.distance||'half',family=desiredFamily({phase,slot,week,goalDistance,hasRace,expectedQuality,responseMode}),excluded=new Set(excludeIds),ranked=QUALITY_LIBRARY.filter(row=>!excluded.has(row.id)).map(candidate=>({candidate,score:candidateScore(candidate,{family,phase,goalDistance,responseMode,date,history,slot})})).sort((a,b)=>b.score-a.score||a.candidate.cost-b.candidate.cost||a.candidate.id.localeCompare(b.candidate.id));
  const selected=ranked[0]?.candidate||byId('threshold-6x6');
  return{session:clone(selected),phase,family,responseMode,confidence:ranked[0]?.score>=80?'high':'medium',reasonCodes:[`PHASE_${phase}`,`ROLE_${family.toUpperCase()}`,`RESPONSE_${responseMode}`],rationale:`${phase==='SPECIFIC'?'Løpsspesifikk fase':'Bakken-grunnmotor'}: ${selected.purpose}`};
}

function scaledMain(main={},factor=1){
  const next=clone(main);
  if(Number.isFinite(Number(next.repetitions)))next.repetitions=Math.max(2,Math.floor(Number(next.repetitions)*factor));
  return next;
}

export function applyBakkenSession(row,selection,{evidenceId='',reasonCodes=[]}={}){
  const source=clone(row),session=selection.session,responseMode=selection.responseMode||'NORMAL',factor=responseMode==='REDUCE'?.8:1,main=scaledMain(session.main,factor),reduced=factor<1,title=reduced&&!/redusert dose/i.test(session.title)?`${session.title} · redusert dose`:session.title,bakken={engineVersion:BAKKEN_ENGINE_VERSION,sessionId:session.id,family:session.family,stimulus:session.stimulus,phase:selection.phase,role:selection.family,responseMode,rationale:selection.rationale,confidence:selection.confidence,reasonCodes:[...new Set([...(selection.reasonCodes||[]),...reasonCodes])],evidenceId:evidenceId||undefined,workMinutes:Math.round(session.workMinutes*factor),cost:session.cost,repeatWindowDays:14};
  return{...source,workoutType:'quality',sport:'running',title,intent:session.stimulus,source:'runnerbear-v11.0',prescription:{version:2,main,bakken:{...bakken,purpose:session.purpose,guardrail:session.detail},legacy:{...(source.prescription?.legacy||{}),desc:session.desc,detail:session.detail}},plannedLoad:{...(source.plannedLoad||{}),bakken}};
}

export function programQualityWeek({rows=[],allItems=[],config={},week='',expectedQuality=2,responseMode='NORMAL'}={}){
  const dateWeek=week||monday(rows[0]?.localDate),qualityRows=rows.filter(isQuality).sort((a,b)=>a.localDate.localeCompare(b.localDate)),hasRace=rows.some(row=>row.workoutType==='race'),history=sessionHistory([...allItems,...rows]),selectedIds=[];
  const replacements=new Map();
  qualityRows.forEach((row,slot)=>{
    if(row.lockLevel==='user'||row.lockLevel==='system'||row.explicitChoice===true||row.plannedLoad?.manualMove===true&&row.plannedLoad?.bakken?.engineVersion===BAKKEN_ENGINE_VERSION)return;
    const selection=selectQualitySession({date:row.localDate,slot,week:dateWeek,config,history:[...history,...selectedIds.map((sessionId,index)=>({sessionId,localDate:qualityRows[index]?.localDate||row.localDate}))],expectedQuality,hasRace,responseMode,excludeIds:selectedIds});
    selectedIds.push(selection.session.id);replacements.set(row.workoutId,applyBakkenSession(row,selection));
  });
  return rows.map(row=>replacements.get(row.workoutId)||row);
}

export function responseSignal({items=[],events=[],today=new Date().toISOString().slice(0,10)}={}){
  const qualityItems=new Map(items.filter(row=>row.workoutType==='quality').map(row=>[String(row.workoutId),row])),cutoff=addDays(today,-10),relevant=events.filter(row=>String(row.event_type||row.eventType)==='feedback:workout').map(row=>({row,payload:eventPayload(row),date:dateOnly(eventPayload(row).responseDate||row.local_date||row.localDate||row.occurred_at)})).filter(entry=>entry.date>=cutoff&&entry.date<=today&&(qualityItems.has(String(entry.payload.workoutId||''))||[...qualityItems.values()].some(item=>item.localDate===dateOnly(entry.row.local_date||entry.row.localDate)))).sort((a,b)=>String(a.row.occurred_at||a.row.occurredAt||'').localeCompare(String(b.row.occurred_at||b.row.occurredAt||'')));
  const latest=relevant.at(-1);if(!latest)return null;
  const payload=latest.payload,rpe=Number(payload.rpe||0),pain=Number(payload.pain||0),control=clean(payload.control).toLowerCase();
  let mode='NORMAL',reasonCodes=['QUALITY_RESPONSE'];
  if(payload.illness===true||pain>=3){mode='RECOVERY';reasonCodes.push(payload.illness===true?'ILLNESS':'PAIN')}
  else if(control==='uncontrolled'||rpe>=9||payload.pain_increased===true){mode='REDUCE';reasonCodes.push('HIGH_SESSION_COST')}
  else if(control==='borderline'||rpe>=8||pain>0||payload.poor_sleep===true||payload.stress===true){mode='HOLD';reasonCodes.push('HOLD_RESPONSE')}
  else{
    const controlledWorkouts=new Set(relevant.filter(entry=>entry.payload.control==='controlled'&&Number(entry.payload.rpe||6)<=7&&Number(entry.payload.pain||0)===0).map(entry=>String(entry.payload.workoutId||entry.date)));
    if(controlledWorkouts.size>=2){mode='BUILD';reasonCodes.push('REPEATABLE_RESPONSE')}
  }
  const workout=qualityItems.get(String(payload.workoutId||''))||[...qualityItems.values()].find(item=>item.localDate===dateOnly(latest.row.local_date||latest.row.localDate));
  return{mode,eventId:eventId(latest.row),workoutId:workout?.workoutId||String(payload.workoutId||''),localDate:workout?.localDate||dateOnly(latest.row.local_date||latest.row.localDate),reasonCodes,confidence:payload.responsePhase==='next_morning'?'high':'medium'};
}

export function adaptNextQuality({items=[],events=[],config={},today=new Date().toISOString().slice(0,10)}={}){
  const signal=responseSignal({items,events,today});if(!signal||signal.mode==='RECOVERY')return null;
  const target=items.filter(row=>isQuality(row)&&row.localDate>=today&&row.localDate>signal.localDate&&row.lockLevel!=='user'&&row.lockLevel!=='system'&&!row.explicitChoice).sort((a,b)=>a.localDate.localeCompare(b.localDate))[0];
  if(!target||target.plannedLoad?.bakken?.evidenceId===signal.eventId)return null;
  const week=monday(target.localDate),weekRows=items.filter(row=>monday(row.localDate)===week),qualityRows=weekRows.filter(isQuality).sort((a,b)=>a.localDate.localeCompare(b.localDate)),slot=Math.max(0,qualityRows.findIndex(row=>row.workoutId===target.workoutId)),currentId=String(target.plannedLoad?.bakken?.sessionId||''),selection=selectQualitySession({date:target.localDate,slot,week,config,history:sessionHistory(items),expectedQuality:qualityRows.length,hasRace:weekRows.some(row=>row.workoutType==='race'),responseMode:signal.mode,excludeIds:signal.mode==='REDUCE'?[]:[currentId].filter(Boolean)}),after=applyBakkenSession(target,selection,{evidenceId:signal.eventId,reasonCodes:signal.reasonCodes}),changed=JSON.stringify([target.title,target.intent,target.prescription,target.plannedLoad?.bakken])!==JSON.stringify([after.title,after.intent,after.prescription,after.plannedLoad?.bakken]);
  if(!changed)return null;
  return{signal,target,before:target,after,rows:items.map(row=>row.workoutId===target.workoutId?after:row),summary:signal.mode==='REDUCE'?'Neste kvalitetsøkt er redusert og ført tilbake til kontrollert Bakken-belastning.':signal.mode==='HOLD'?'Neste kvalitetsøkt er valgt med lavere kostnad og samme fysiologiske retning.':'Neste kvalitetsøkt er rotert ut fra kontrollert respons og aktiv fase.',consequence:'Bare neste ulåste kvalitetsøkt endres. Historikk, løpsmål og resten av ukeplanen står.'};
}
