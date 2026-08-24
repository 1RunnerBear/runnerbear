/* RunnerBear v11 · Bakken Adaptive Coach browser model.
   Extends the locked v10.25.1 plan helpers without mutating rollback sources. */
(function(root,factory){
  if(typeof module==='object'&&module.exports){module.exports=factory(require('./runnerbear-v10251-adaptive-plan.js'));return}
  root.RunnerBearV10251=factory(root.RunnerBearV10251||{});
})(typeof window!=='undefined'?window:globalThis,function(legacy){
  'use strict';
  const BUILD='11.0.0',clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const QUALITY_BANK=Object.freeze([
    {id:'threshold-6x6',family:'threshold_long',stimulus:'threshold',title:'6 × 6 min terskel',type:'quality',km:12,workMinutes:36,cost:2,desc:'6 × 6 min kontrollert terskel med 2 min rolig jogg.',detail:'Stabil pust og kontrollert puls. Avslutt før økten glir over i X-belastning.'},
    {id:'threshold-5x8',family:'threshold_long',stimulus:'threshold',title:'5 × 8 min terskel',type:'quality',km:13,workMinutes:40,cost:2,desc:'5 × 8 min kontrollert terskel med 90 sek rolig jogg.',detail:'Lang og jevn arbeidsdel. Prioriter repeterbar fart fremfor høyest mulig puls.'},
    {id:'threshold-4x10',family:'threshold_long',stimulus:'threshold',title:'4 × 10 min terskel',type:'quality',km:13,workMinutes:40,cost:2,desc:'4 × 10 min kontrollert terskel med 90 sek rolig jogg.',detail:'Finn kontroll tidlig og hold samme tekniske uttrykk gjennom siste drag.'},
    {id:'threshold-3x12',family:'threshold_long',stimulus:'threshold',title:'3 × 12 min terskel',type:'quality',km:12,workMinutes:36,cost:2,desc:'3 × 12 min kontrollert terskel med 2 min rolig jogg.',detail:'Jevnt og komfortabelt hardt. Ingen progressiv avslutning hvis kontrollen faller.'},
    {id:'threshold-4x2000',family:'threshold_long',stimulus:'threshold',title:'4 × 2000 m terskel',type:'quality',km:12,workMinutes:34,cost:2,desc:'4 × 2000 m kontrollert terskel med 90 sek rolig jogg.',detail:'Farten styres av intern belastning. Siste drag skal være like kontrollert som det første.'},
    {id:'threshold-24x45-15',family:'threshold_short',stimulus:'threshold',title:'24 × 45/15 · kontrollert terskel',type:'quality',km:9,workMinutes:18,cost:1,desc:'24 × 45 sek kontrollert / 15 sek flytende rolig.',detail:'Rytme og flyt uten hero-fart. Siste tredel skal være like kontrollert som den første.'},
    {id:'threshold-15x1',family:'threshold_short',stimulus:'threshold',title:'15 × 1 min / 30 sek · terskel',type:'quality',km:9,workMinutes:15,cost:1,desc:'15 × 1 min kontrollert terskel med 30 sek rolig flyt.',detail:'Kort steg, god rytme og reserve. Ikke jakt fart på de første dragene.'},
    {id:'threshold-12x400',family:'threshold_short',stimulus:'threshold',title:'12 × 400 m · kontrollert terskel',type:'quality',km:9,workMinutes:16,cost:1,desc:'12 × 400 m kontrollert med 30 sek rolig flyt.',detail:'Dette er kort terskel, ikke en 400-meterkonkurranse. Hold igjen hele veien.'},
    {id:'x-10x60-hills',family:'controlled_x',stimulus:'x',title:'10 × 60 sek korte bakker',type:'quality',km:9,workMinutes:10,cost:2,desc:'10 × 60 sek kontrollert hardt i slak motbakke.',detail:'God teknikk og full rolig retur. Stopp før steget blir tungt eller presset.'},
    {id:'x-8x2',family:'controlled_x',stimulus:'x',title:'8 × 2 min · kontrollert X',type:'quality',km:10,workMinutes:16,cost:2,desc:'8 × 2 min kontrollert over terskel med 60 sek rolig jogg.',detail:'Raskt, men aldri all-in. Avslutt med reserve og bevart teknikk.'},
    {id:'x-5x1000',family:'vo2',stimulus:'x',goals:['five','ten'],title:'5 × 1000 m · kontrollert VO₂',type:'quality',km:10,workMinutes:18,cost:3,desc:'5 × 1000 m kontrollert VO₂ med 2 min rolig jogg.',detail:'Sjeldent X-element. Krever grønt responsbilde, riktig fase og et kontrollert terskelanker i uken.'},
    {id:'specific-half-3x3000',family:'race_specific',stimulus:'race_specific',goals:['half'],title:'3 × 3000 m · kontrollert HM-rytme',type:'quality',km:13,workMinutes:34,cost:2,desc:'3 × 3000 m rundt kontrollert halvmaratonrytme med 2 min rolig jogg.',detail:'Spesifikk trening, ikke en formtest. Avslutt med kontroll.'},
    {id:'specific-ten-4x1600',family:'race_specific',stimulus:'race_specific',goals:['ten'],title:'4 × 1600 m · kontrollert 10 km-rytme',type:'quality',km:11,workMinutes:24,cost:2,desc:'4 × 1600 m kontrollert rundt 10 km-rytme.',detail:'Jevn fart og teknisk kontroll. Ingen sluttspurt.'},
    {id:'specific-five-10x600',family:'race_specific',stimulus:'race_specific',goals:['five'],title:'10 × 600 m · kontrollert 5 km-rytme',type:'quality',km:10,workMinutes:20,cost:2,desc:'10 × 600 m kontrollert rundt 5 km-rytme.',detail:'God rytme og reserve. Dette skal ikke bli en maksimal VO₂-test.'},
    {id:'taper-4x5',family:'taper_threshold',stimulus:'threshold',title:'4 × 5 min terskel · redusert dose',type:'quality',km:8,workMinutes:20,cost:1,desc:'4 × 5 min kontrollert terskel med god margin.',detail:'Bevar rytmen og avslutt mens beina fortsatt kjennes lette.'},
    {id:'taper-3x6',family:'taper_threshold',stimulus:'threshold',title:'3 × 6 min terskel · redusert dose',type:'quality',km:8,workMinutes:18,cost:1,desc:'3 × 6 min kontrollert terskel med full reserve.',detail:'Kort totaldose, jevn pust og lett steg. Ingen progressiv avslutning.'},
    {id:'taper-5x3',family:'taper_threshold',stimulus:'threshold',title:'5 × 3 min terskel · lett rytme',type:'quality',km:8,workMinutes:15,cost:1,desc:'5 × 3 min kontrollert terskel med lett og avslappet rytme.',detail:'Avslutt med mer å gå på. Økten skal gi spenst, ikke tretthet.'},
    {id:'taper-8x2',family:'taper_threshold',stimulus:'threshold',title:'8 × 2 min terskel · lett flyt',type:'quality',km:8,workMinutes:16,cost:1,desc:'8 × 2 min kontrollert terskel med rolig jogg.',detail:'Lett frekvens og tydelig kontroll. Ikke la korte drag bli X-belastning.'}
  ]);
  function stimulusForWorkout(workout={}){
    const explicit=clean(workout?.plannedLoad?.bakken?.stimulus||workout?.prescription?.bakken?.stimulus||workout?.stimulus||workout?.intent).toLowerCase();
    if(['threshold','x','race_specific','race','long','easy','cross','recovery'].includes(explicit))return explicit;
    return legacy.stimulusForWorkout?.(workout)||'recovery';
  }
  function workoutSuitabilityScore(candidate={},context={}){
    const intended=context.intendedStimulus||stimulusForWorkout(context.plan||{}),phase=String(context.phase||'build').toLowerCase(),weekMode=String(context.weekMode||'NORMAL').toUpperCase(),goalDistance=String(context.goalDistance||'half');let score=candidate.stimulus===intended?76:candidate.stimulus==='threshold'&&intended!=='x'?58:18;
    if(candidate.stimulus==='threshold')score+=12;
    if(candidate.family==='race_specific'&&['specific','race'].includes(phase))score+=24;
    if(candidate.goals&&!candidate.goals.includes(goalDistance))score-=90;
    if(candidate.family==='vo2'&&phase!=='specific')score-=46;
    if(candidate.family==='vo2'&&weekMode!=='BUILD'&&weekMode!=='NORMAL')score-=60;
    if(['DELOAD','RECOVERY'].includes(weekMode)&&candidate.stimulus!=='threshold')score-=80;
    if(context.healthTrend==='negative'&&candidate.stimulus!=='threshold')score-=70;
    if(Number(context.daysToNextQuality)<=2&&candidate.cost>=3)score-=35;
    if(Number(context.daysToLongRun)<=1&&candidate.stimulus!=='threshold')score-=30;
    if(clean(context.lastQualityId)===candidate.id)score-=45;
    return Math.max(0,Math.min(100,Math.round(score)));
  }
  function rankWorkoutBank(context={}){const goalDistance=String(context.goalDistance||'half');return QUALITY_BANK.filter(workout=>!workout.goals||workout.goals.includes(goalDistance)).map(workout=>({...workout,suitabilityScore:workoutSuitabilityScore(workout,context)})).sort((a,b)=>b.suitabilityScore-a.suitabilityScore||a.cost-b.cost||a.title.localeCompare(b.title,'nb'))}
  return{...legacy,BUILD,QUALITY_BANK,stimulusForWorkout,workoutSuitabilityScore,rankWorkoutBank};
});
