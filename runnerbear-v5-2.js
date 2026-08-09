function evaluateStimulus(f,fb){
 if(!fb||(!fb.rpe&&!fb.hr&&!fb.achilles&&!fb.pace))return null;
 const rpe=Number(fb.rpe||0),hr=Number(fb.hr||0),ach=fb.achilles;
 if(ach==='worse')return{level:'red',label:'FOR HØY KOSTNAD',text:'Akillesresponsen gjør at hensikten ikke regnes som vellykket, uansett fart.'};
 if(f.type==='quality'){
   const actual=paceSec(fb.pace),range=extractPaceRange(f.detail),tooFast=actual&&range&&actual<Math.min(...range)-5;
   if(/x-element/i.test(f.title)){
     if(rpe>=9)return{level:'red',label:'FOR HARDT',text:'X-elementet ble hardere enn planlagt. Det skal være et kontrollert supplement.'};
     if(rpe>=8)return{level:'yellow',label:'LITT DYRT',text:'Farten kan være riktig, men RPE er i øvre kant for denne ukas hensikt.'};
     return{level:'green',label:'STIMULUS TRAFF',text:'Raskt nok til å vedlikeholde toppfart, kontrollert nok til å beskytte terskeluka.'};
   }
   if(/gate/i.test(f.title)){
     if(rpe>=9||hr>=178)return{level:'red',label:'IKKE KONTROLLERT',text:'Dette ligner mer en test av vilje enn en bekreftelse på HM-kapasitet.'};
     if(rpe>=8||hr>=176)return{level:'yellow',label:'GRENSETILFELLE',text:'Farten ble gjennomført, men kostnaden er for høy til et klart grønt Gate-signal.'};
     return{level:'green',label:'KONTROLLERT',text:'Responsen støtter at Gate-farten satt med ønsket kontroll.'};
   }
   if(rpe>=9||hr>175)return{level:'red',label:'FOR HARDT',text:'Økten traff ikke subterskel-hensikten. Neste kvalitet skal ikke bli raskere.'};
   if(rpe>=8||hr>=173||tooFast)return{level:'yellow',label:'LITT FOR DYRT',text:'God gjennomføring, men kostnaden ligger over det vi ønsker for repeterbar terskel.'};
   if(rpe&&rpe<=7)return{level:'green',label:'STIMULUS TRAFF',text:'Kontrollert nok til å kunne gjentas. Det er akkurat dette Bakken-prinsippet belønner.'};
   return{level:'neutral',label:'TRENGER MER DATA',text:'Legg inn RPE for å vurdere om intensiteten traff hensikten.'};
 }
 if(/langtur/i.test(f.title)){
   if(rpe>=7)return{level:'red',label:'FOR HARD LANGTUR',text:'Langturen kostet for mye i forhold til planens hensikt.'};
   if(rpe>=5)return{level:'yellow',label:'LITT TUNG',text:'Hold neste rolige tur tydelig lettere.'};
   if(rpe)return{level:'green',label:'STIMULUS TRAFF',text:'Varighet uten unødvendig kostnad – riktig langtur.'};
 }
 return null;
}
function feedbackHTML(f){
 const fb=getFeedback(f.label),stim=evaluateStimulus(f,fb);
 const shoes=Object.keys(shoeMeta).map(s=>`<option value="${s}" ${fb.shoe===s?'selected':''}>${s}</option>`).join('');
 const rpeBtns=Array.from({length:10},(_,i)=>i+1).map(n=>`<button type="button" data-rpe="${n}" class="${Number(fb.rpe)===n?'active':''}">${n}</button>`).join('');
 return`<details class="feedback" ${Object.keys(fb).length?'open':''}><summary>Etter økten · respons</summary>
 <div class="quick-feedback" data-date="${f.label}">
   <div class="micro">RPE</div><div></div><div class="rpe-row">${rpeBtns}</div>
   <div class="micro">Akilles neste morgen</div><div></div><div class="ach-row"><button type="button" data-ach="better" class="${fb.achilles==='better'?'active':''}">Bedre</button><button type="button" data-ach="same" class="${fb.achilles==='same'?'active':''}">Lik</button><button type="button" data-ach="worse" class="${fb.achilles==='worse'?'active':''}">Verre</button></div>
   <details class="extra-data"><summary>Legg til fart, puls, sko eller notat</summary><div class="extra-grid"><input name="pace" value="${fb.pace||''}" placeholder="Arbeidsfart, f.eks. 4:06/km"><input name="hr" type="number" value="${fb.hr||''}" placeholder="Puls arbeidsdel"><select name="shoe"><option value="">Faktisk sko</option>${shoes}</select><textarea name="note" placeholder="Kort notat">${fb.note||''}</textarea></div></details>
   ${stim?`<div class="stimulus ${stim.level}">${stim.label}</div><div class="daydetail">${stim.text}</div>`:''}
 </div></details>`;
}
function bindFeedback(root=document){
 root.querySelectorAll('.quick-feedback').forEach(g=>{
   g.querySelectorAll('[data-rpe]').forEach(b=>b.addEventListener('click',()=>{const fb=getFeedback(g.dataset.date);fb.rpe=b.dataset.rpe;setFeedback(g.dataset.date,fb);renderAll()}));
   g.querySelectorAll('[data-ach]').forEach(b=>b.addEventListener('click',()=>{const fb=getFeedback(g.dataset.date);fb.achilles=b.dataset.ach;setFeedback(g.dataset.date,fb);renderAll()}));
   g.querySelectorAll('input[name],select[name],textarea[name]').forEach(inp=>inp.addEventListener('change',()=>{const fb=getFeedback(g.dataset.date);fb[inp.name]=inp.value;if(!inp.value)delete fb[inp.name];setFeedback(g.dataset.date,fb);renderAll()}));
 });
}
function renderToday(){
 const f=nextSession(),t=targetSummary(f),adj=adjustedPace(f);
 $('todayDate').textContent=sameDay(f.date,today)?'I dag':f.label;$('todayType').textContent=classLabel[f.type];$('todayType').className=`tag ${f.type}`;
 $('todayTitle').textContent=f.title;$('todayDesc').textContent=f.desc;$('todayPace').textContent=t.pace;$('todayHr').textContent=t.hr;$('todayKm').textContent=f.km?`${f.km} km`:'–';
 $('todayPurpose').textContent=workoutPurpose(f);$('todayShoe').textContent=f.shoe?`👟 ${f.shoe}`:'';$('todayFuel').textContent=f.fuel?`⚡ ${f.fuel}`:'';
 $('todayCoach').textContent=`RB Coach · ${coachBefore(f)}`;$('todayDone').checked=isDone(f.label);
 $('paceAdjustmentToday').classList.toggle('hidden',!adj);$('paceAdjustmentToday').textContent=adj?`Coach-justert terskelmål: ${adj} · Gate-/raceøkter endres ikke.`:'';
 const existing=localStorage.getItem(adaptKey(f.label));$('adaptPanel').classList.toggle('hidden',!existing);if(existing){document.querySelectorAll('#adaptPanel [data-reason]').forEach(b=>b.classList.toggle('active',b.dataset.reason===existing));renderAdapt(f,existing)}
 $('todayFeedbackWrap').innerHTML=(f.type==='quality'||f.type==='race'||/langtur/i.test(f.title))?feedbackHTML(f):'';
 bindFeedback($('todayFeedbackWrap'));
 $('todayDone').onchange=e=>{setDone(f.label,e.target.checked);renderAll()};
 $('adaptBtn').onclick=()=>{$('adaptPanel').classList.toggle('hidden')};
 document.querySelectorAll('#adaptPanel [data-reason]').forEach(b=>b.onclick=()=>{localStorage.setItem(adaptKey(f.label),b.dataset.reason);document.querySelectorAll('#adaptPanel [data-reason]').forEach(x=>x.classList.toggle('active',x===b));renderAdapt(f,b.dataset.reason);renderCoach()});
}
function renderAdapt(f,reason){const a=adaptationAdvice(f,reason);$('adaptAdvice').innerHTML=`${a.html}<div class="adapt-save"><button class="secondary" id="clearAdapt">Tilbakestill</button></div>`;$('clearAdapt').onclick=()=>{localStorage.removeItem(adaptKey(f.label));$('adaptPanel').classList.add('hidden');renderAll()}}
