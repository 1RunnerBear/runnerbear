const weeks=window.RUNFEST_WEEKS;
const classLabel={easy:'Rolig',quality:'Kvalitet',race:'Race',rest:'Hvile',cross:'Cross'};
const START=new Date(2026,7,10,12),RACE=new Date(2026,9,3,12),today=new Date();
const baselineThreshold={date:'2026-08-09',pace:'4:02',hr:173,source:'Garmin'};
const shoeMeta={
'Adidas Adios Pro 4':'Race / HM-spesifikk',
'Nike Zoom Fly 6':'Primær terskel',
'Xtep 360X 3.0':'Tempo / terskel',
'Nike Vomero 18':'Easy + strides',
'Nike Vomero 18 Plus':'Langtur',
'Nike Vomero Premium':'Restitusjon',
'VJ Ultra 3':'Grus / lett terreng'
};
const flat=[];let gi=0;
weeks.forEach(w=>w.days.forEach((d,i)=>flat.push({week:w.n,idx:i,date:addDays(START,gi++),raw:d,label:d[0],type:d[1],title:d[2],desc:d[3],detail:d[4],shoe:d[5],km:Number(d[6]||0),fuel:d[7]||''})));
const $=id=>document.getElementById(id);
function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r}
function sameDay(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function slug(s){return s.toLowerCase().replace(/[.]/g,'').replace(/\s+/g,'_').replace(/[^a-z0-9æøå_]/g,'')}
function dayKey(label){return`runfest26_date_${label.toLowerCase().replace(/\s+/g,'_')}`}
function fbKey(label){return`runfest26_fb_${slug(label)}`}
function adaptKey(label){return`runfest26_adapt_${slug(label)}`}
function isDone(label){return localStorage.getItem(dayKey(label))==='1'}
function setDone(label,v){localStorage.setItem(dayKey(label),v?'1':'0')}
function getFeedback(label){try{return JSON.parse(localStorage.getItem(fbKey(label))||'{}')}catch{return{}}}
function setFeedback(label,obj){localStorage.setItem(fbKey(label),JSON.stringify(obj))}
function gateVal(n){return localStorage.getItem(`runfest26_gate${n}`)||''}
function paceSec(p){if(!p)return null;const m=String(p).match(/(\d):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null}
function paceFmt(s){if(s==null)return'–';return`${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,'0')}`}
function fmtTime(sec){const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=Math.round(sec%60);return`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function currentWeek(){return weeks.find(w=>{const a=flat.filter(f=>f.week===w.n);return today>=addDays(a[0].date,-.5)&&today<addDays(a[a.length-1].date,1)})||(today<START?weeks[0]:weeks[weeks.length-1])}
function nextSession(){const exact=flat.find(f=>sameDay(f.date,today)&&!isDone(f.label));if(exact)return exact;const future=flat.find(f=>f.date>today&&!isDone(f.label));return future||flat.find(f=>!isDone(f.label)||f.type==='race')||flat[flat.length-1]}
function extractPaceRange(text){const m=text.match(/(\d:\d{2})\s*[–-]\s*(\d:\d{2})\/km/);return m?[paceSec(m[1]),paceSec(m[2])]:null}
function extractHrRange(text){const m=text.match(/(?:HR|puls)[^0-9]{0,20}(\d{3})\s*[–-]\s*(\d{3})/i);return m?[Number(m[1]),Number(m[2])]:null}
function workoutPurpose(f){
 const t=f.title.toLowerCase();
 if(f.type==='race')return'Utføre raceplanen med kontrollert åpning og sterk avslutning.';
 if(/gate/.test(t))return'Måle om ønsket halvmaratonfart er kontrollert nok til å kvalifisere racemålet.';
 if(/x-element/.test(t))return'Beholde aerob toppfart og løpsøkonomi uten å gjøre uka VO₂max-tung.';
 if(/45\/15|400/.test(t))return'Få mer fart og flyt med korte pauser, men fortsatt kontrollert metabolsk kostnad.';
 if(/subterskel|× 2 km|× 10|min subterskel/.test(t))return'Akkumulere terskeltid litt under reell terskel med lav nok kostnad til å kunne gjentas.';
 if(/langtur/.test(t))return'Bygge aerob robusthet og varighet uten å gjøre langturen til en moderat kvalitetsøkt.';
 if(/strides/.test(t))return'Holde steget kvikt og økonomisk uten å legge til reell treningsbelastning.';
 if(f.type==='easy')return'Restitusjon og aerob grunnmur. Denne økten skal gjøre neste kvalitetsøkt bedre.';
 if(f.type==='cross')return'Legge til aerob belastning uten ekstra løpsstøt og bevare friske løpebein.';
 return'Restitusjon og kontinuitet er selve treningen i dag.';
}
function targetSummary(f){
 const p=extractPaceRange(f.detail),h=extractHrRange(f.detail);
 let pace=p?`${paceFmt(p[0])}–${paceFmt(p[1])}/km`:(/HR|puls/i.test(f.detail)?'styr på puls':'kontrollert');
 if(/45\/15/.test(f.title))pace='dragfart · se detalj';
 if(f.type==='rest'||f.type==='cross')pace='lett / fri';
 return{pace,hr:h?`${h[0]}–${h[1]} bpm`:(f.type==='quality'?'under terskel':'–')};
}
function isLongThreshold(f){return f.type==='quality'&&/subterskel/i.test(f.title)&&!/45\/15|400|gate|hm-spesifikk/i.test(f.title)}
function thresholdOffset(){return Number(localStorage.getItem('runfest26_threshold_offset')||0)}
function adjustedPace(f){
 const r=extractPaceRange(f.detail),off=thresholdOffset();if(!r||!off||!isLongThreshold(f))return null;
 return`${paceFmt(r[0]+off)}–${paceFmt(r[1]+off)}/km`;
}
function coachBefore(f){
 const wc=localStorage.getItem(`runfest26_weekcheck_${currentWeek().n}`);
 const a=localStorage.getItem(adaptKey(f.label));
 if(a)return adaptationAdvice(f,a).short;
 if(wc==='heavy'&&f.type==='quality')return'Kroppen er meldt tung. Ikke jag planfart: start konservativt og bruk «Tilpass dagen» hvis oppvarmingen ikke løsner.';
 if(/gate/i.test(f.title))return'Ikke vinn testen. Samme kontroll fra første til siste drag er selve resultatet.';
 if(isLongThreshold(f))return'Første drag er kalibrering. Når puls, pust og følelse spriker, velg den roligere tolkningen.';
 if(/45\/15|400/.test(f.title))return'Flyt før fart. Ingen sluttspurt – siste drag skal ligne de andre.';
 if(/x-element/i.test(f.title))return'Raskt, men kontrollert. RPE rundt 7 er nok; dette er et supplement til terskelmotoren.';
 if(/langtur/i.test(f.title))return'Langturens verdi ligger i varighet og lave kostnader, ikke i å vise form.';
 if(f.type==='easy')return'Rolig betyr produktivt. La kvaliteten få eie de raske minuttene.';
 if(f.type==='cross')return'Hold den aerob. Sykkelen skal støtte løpingen, ikke bli en ekstra terskeløkt.';
 return'Bra. Restitusjon er en planlagt del av progresjonen.';
}
function reduceWorkoutTitle(title){
 const m=title.match(/^(\d+)\s*×\s*(.+)$/);if(!m)return title;
 const n=Number(m[1]);return`${Math.max(2,Math.round(n*.72))} × ${m[2]}`;
}
function adaptationAdvice(f,reason){
 const gate=/gate/i.test(f.title),quality=f.type==='quality',long=/langtur/i.test(f.title);
 if(reason==='achilles'){
   return{short:'Akilles trumfer kalenderen i dag.',html:`<strong>Bytt løpingen til lett, smertefri aerob trening.</strong> ${quality?'45–60 min lett Zwift er førstevalg; ikke flytt kvalitetsøkten automatisk til i morgen.':long?'60–75 min lett Zwift er nok.':'45–60 min lett Zwift eller hvile.'} Ved tydelig hevelse, halting eller skarp smerte: avbryt og få det vurdert.`};
 }
 if(reason==='tired'){
   if(gate)return{short:'Tung kropp gjør Gate-testen mindre verdifull.',html:'<strong>Ikke press gjennom en Gate-test for å få et tall.</strong> Hvis oppvarmingen ikke løsner, utsett testen fremfor å endre farten eller korte den tilfeldig.'};
   if(quality)return{short:'Behold intensiteten konservativ – kutt heller volum.',html:`<strong>Kortversjon: ${reduceWorkoutTitle(f.title)}.</strong> Samme eller litt roligere fart enn planen; aldri kompensér med raskere drag.`};
   if(long)return{short:'Kort ned, ikke gjør langturen raskere.',html:`<strong>Kutt rundt 20–30 % av varigheten/distansen.</strong> Hold samme rolige intensitet.`};
   return{short:'Gjør økten tydelig lettere i dag.',html:'<strong>Reduser 20–30 %.</strong> Ingen progresjon, ingen ekstra strides hvis beina føles tunge.'};
 }
 if(reason==='time'){
   if(gate)return{short:'Ikke forkort Gate-testen – da mister den verdi.',html:'<strong>Flytt testen heller enn å gjøre en «halv test».</strong> Bevar minst 48 timer til neste kvalitetsøkt dersom du flytter den.'};
   if(quality)return{short:'Kutt volum – aldri øk farten for å «få mer igjen».',html:`<strong>Kortversjon: ${reduceWorkoutTitle(f.title)}.</strong> Kortere opp-/nedjogg er også greit, men behold kontrollert intensitet.`};
   if(long)return{short:'60 minutter rolig er et godt kompromiss.',html:'<strong>Løp 55–65 min rolig.</strong> Ikke legg inn tempo for å kompensere for færre kilometer.'};
   return{short:'Kort og lett er fortsatt trening.',html:'<strong>30–40 min rolig</strong> eller omtrent 5 km er nok.'};
 }
 if(reason==='skip'){
   if(gate)return{short:'Gate-test kan flyttes, men ikke på bekostning av resten av uka.',html:'<strong>Flytt 24–48 timer bare hvis du fortsatt får god avstand til neste kvalitet.</strong> Ellers bør planen justeres, ikke komprimeres.'};
   if(quality)return{short:'Ikke jag den tapte økten inn mellom andre kvalitetsdager.',html:'<strong>Hopp over eller flytt bare hvis det ikke skaper back-to-back kvalitet.</strong> Kontinuitet slår «gjeld» i treningskalenderen.'};
   return{short:'En mistet rolig dag trenger ikke betales tilbake.',html:'<strong>Fortsett med planen neste dag.</strong> Ikke legg kilometer på senere økter for å hente inn tapet.'};
 }
 return{short:'',html:''};
}
