/* RunnerBear v5.6 · core renderers
   Zwift is available throughout the plan. Rendering preserves open plan cards across updates. */
function zwiftAvailableFor(){return true}

function renderPlan(){
 const sel=$('weekFilter');if(!sel.options.length||sel.options.length===1){weeks.forEach(w=>{const o=document.createElement('option');o.value=w.n;o.textContent=`Uke ${w.n} · ${w.range}`;sel.appendChild(o)})}
 const openLabels=new Set([...document.querySelectorAll('#weeks .day.open .daydate')].map(el=>el.textContent));
 const val=sel.value;$('weeks').innerHTML='';
 weeks.filter(w=>val==='all'||String(w.n)===val).forEach(w=>{
   const sec=document.createElement('section');sec.className='week';const wd=flat.filter(f=>f.week===w.n),dn=wd.filter(f=>isDone(f.label)).length;
   sec.innerHTML=`<div class="weekhead"><div><span class="phase">${w.phase}</span><h2>Uke ${w.n} · ${w.range}</h2><div class="muted small">${w.focus}</div></div><div><b>${w.km} km</b><div class="muted small">${dn}/7 registrert</div></div></div><div class="days"></div>`;
   const days=sec.querySelector('.days');
   wd.forEach(f=>{const d=document.createElement('article'),stim=evaluateStimulus(f,getFeedback(f.label)),adj=adjustedPace(f);const shouldOpen=sameDay(f.date,today)||openLabels.has(f.label);d.className=`day ${isDone(f.label)?'done':''} ${sameDay(f.date,today)?'today':''} ${shouldOpen?'open':''}`.trim();
    d.innerHTML=`<div class="day-summary"><span class="daydate">${f.label}</span><h3>${f.title}</h3><span class="daystatus">${isDone(f.label)?'✓':sameDay(f.date,today)?'I DAG':'›'}</span></div>
    <div class="day-body"><span class="tag ${f.type}">${classLabel[f.type]}</span><div class="daydetail">${f.desc}</div><div class="daydetail">${f.detail}</div><div class="intent"><b>Hensikt:</b> ${workoutPurpose(f)}</div>${adj?`<div class="adjustment">Coach-justert: ${adj}</div>`:''}${f.shoe?`<div class="daymeta">👟 ${f.shoe}</div>`:''}${f.fuel?`<div class="daymeta fuel">⚡ ${f.fuel}</div>`:''}<div class="day-actions"><label class="complete"><input type="checkbox" data-done="${f.label}" ${isDone(f.label)?'checked':''}> <span>Gjennomført</span></label></div>${(f.type==='quality'||f.type==='race'||/langtur/i.test(f.title))?feedbackHTML(f):''}${stim?`<div class="stimulus ${stim.level}">${stim.label}</div>`:''}</div>`;
    d.querySelector('.day-summary').onclick=()=>d.classList.toggle('open');days.appendChild(d)
   });$('weeks').appendChild(sec)
 });
 document.querySelectorAll('[data-done]').forEach(i=>i.onchange=e=>{setDone(e.target.dataset.done,e.target.checked);renderAll()});bindFeedback($('weeks'));
}
function renderLoadChart(){const m=Math.max(...weeks.map(w=>w.km));$('loadChart').innerHTML=weeks.map(w=>`<div class="loadbar"><b>${w.km}</b><i style="height:${25+w.km/m*78}px"></i><span>U${w.n}</span></div>`).join('')}
function updateRace(total=4980){const avg=total/21.0975;$('goalPace').textContent=`${fmtTime(total)} · ${paceFmt(avg)}/km`;const range=(a,b)=>`${paceFmt(avg+a)}–${paceFmt(avg+b)}/km`;$('rOpen').textContent=range(2,4);$('rMid').textContent=range(-1,1);$('rLate').textContent=range(-3,0);[5,10,15,20].forEach(k=>$('r'+k).textContent=fmtTime(Math.round(avg*k)))}
function renderGates(){
 [1,2].forEach(n=>{$('gate'+n).value=gateVal(n)});
 const g1=gateVal(1),g2=gateVal(2),el=$('gateAdvice');el.className='advice';
 if(g2==='green')el.innerHTML='<b>Grønt lys:</b> 1:23 er et forsvarlig A-mål. Åpne likevel kontrollert.';
 else if(g2==='yellow'){el.classList.add('yellow');el.innerHTML='<b>Gult:</b> 1:24-ish er et bedre utgangspunkt. La løpet komme til deg.'}
 else if(g2==='red'){el.classList.add('red');el.innerHTML='<b>Rødt:</b> 3:56/km skal ikke tvinges. Start rundt 1:24:30–1:25-fart.'}
 else if(g1==='red'){el.classList.add('yellow');el.innerHTML='<b>Gate 1 var rød:</b> ikke øk treningsfarten. Gate 2 får avgjøre endelig raceplan.'}
 else el.innerHTML='1:23 står som A-mål, men racefarten låses ikke før Gate-dataene støtter den.';
}
function renderThreshold(){
 const h=thresholdHistory(),last=h[h.length-1],tr=thresholdTrendInfo(),prop=thresholdProposalInfo();$('thresholdCurrent').textContent=`${last.pace}/km · ${last.hr} bpm`;$('thresholdTrend').textContent=tr.text;$('thresholdTrend').className=`advice ${tr.tone==='yellow'?'yellow':''}`;
 $('thresholdList').innerHTML=[...h].reverse().map(x=>`<div class="threshold-row"><span>${x.date}</span><b>${x.pace}/km</b><span>${x.hr} bpm</span></div>`).join('');
 const p=$('thresholdProposal');p.innerHTML=`<b>Treningsfart:</b> ${prop.text}`;
 if(prop.ok)p.innerHTML+=`<br><button class="secondary" id="acceptShift">Godta ${Math.abs(prop.shift)} s/km justering</button><button class="secondary" id="keepShift">Behold nåværende</button>`;
 if(prop.ok){setTimeout(()=>{$('acceptShift').onclick=()=>{localStorage.setItem('runfest26_threshold_offset',String(prop.shift));renderAll()};$('keepShift').onclick=()=>{localStorage.setItem('runfest26_threshold_offset','0');renderAll()}},0)}
 $('thDate').value=new Date().toISOString().slice(0,10);
}
function addThreshold(){
 const date=$('thDate').value,pace=$('thPace').value.trim(),hr=Number($('thHr').value);if(!date||!paceSec(pace)||!hr)return alert('Fyll inn dato, fart (f.eks. 3:59) og puls.');
 let arr=[];try{arr=JSON.parse(localStorage.getItem('runfest26_threshold_history')||'[]')}catch{};arr.push({date,pace:pace.match(/\d:\d{2}/)[0],hr,source:'Garmin'});localStorage.setItem('runfest26_threshold_history',JSON.stringify(arr));$('thPace').value='';$('thHr').value='';renderAll()
}
function renderShoes(){const tot={};Object.keys(shoeMeta).forEach(s=>tot[s]=0);flat.forEach(f=>{if(!isDone(f.label)||!f.km)return;const fb=getFeedback(f.label),s=fb.shoe||(f.shoe?f.shoe.split('/')[0].replace(/\(.*?\)/g,'').trim():'');if(tot[s]!=null)tot[s]+=f.km});$('shoeWall').innerHTML=Object.keys(tot).map(s=>`<div class="shoebox"><strong>${tot[s].toFixed(1).replace('.0','')} km</strong><b>${s}</b><span class="muted small">${shoeMeta[s]}</span></div>`).join('')}
function buildStatusText(){const w=currentWeek(),wd=flat.filter(f=>f.week===w.n),km=wd.filter(f=>isDone(f.label)).reduce((a,f)=>a+f.km,0),q=wd.filter(f=>f.type==='quality'&&isDone(f.label)).map(f=>{const fb=getFeedback(f.label),s=evaluateStimulus(f,fb);return`${f.label} ${f.title}: ${fb.pace||'fart –'}, HR ${fb.hr||'–'}, RPE ${fb.rpe||'–'}, akilles ${fb.achilles||'–'}, stimulus ${s?.label||'–'}`});const th=thresholdHistory().slice(-1)[0];return`RunnerBear · uke ${w.n}\nTerskel: ${th.pace}/km · ${th.hr} bpm. 1:23 readiness: ${readiness().name}.\nUke: ${km.toFixed(1).replace('.0','')} / ${w.km} km. Kroppssjekk: ${weekCheck()||'ikke registrert'}.\n${q.length?'Kvalitet:\n- '+q.join('\n- '):'Ingen kvalitetsøkter registrert.'}\nGate 1: ${gateVal(1)||'–'} · Gate 2: ${gateVal(2)||'–'}.`}
async function copyStatus(){const t=buildStatusText();try{await navigator.clipboard.writeText(t)}catch{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove()}$('copyToast').style.display='inline';setTimeout(()=>$('copyToast').style.display='none',1800)}
function switchTab(id,scroll=false){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));if(scroll)window.scrollTo({top:0,behavior:'smooth'})}
function renderAll(){const diff=Math.max(0,Math.ceil((RACE-today)/86400000));$('countdown').textContent=diff;renderToday();renderCoach();renderReadiness();renderWeekStrip();renderCheckin();renderReview();renderPlan();renderGates();renderThreshold();renderShoes()}
document.querySelectorAll('.navbtn').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab,true));
document.querySelectorAll('[data-check]').forEach(b=>b.onclick=()=>{localStorage.setItem(`runfest26_weekcheck_${currentWeek().n}`,b.dataset.check);renderAll()});
$('weekFilter').onchange=renderPlan;document.querySelectorAll('.goal').forEach(b=>b.onclick=()=>{document.querySelectorAll('.goal').forEach(x=>x.classList.toggle('active',x===b));updateRace(Number(b.dataset.goal))});
[1,2].forEach(n=>$('gate'+n).onchange=e=>{localStorage.setItem(`runfest26_gate${n}`,e.target.value);renderAll()});
const addThresholdButton=$('addThreshold'),copyStatusButton=$('copyStatus'),resetDataButton=$('resetData');if(addThresholdButton)addThresholdButton.onclick=addThreshold;if(copyStatusButton)copyStatusButton.onclick=copyStatus;if(resetDataButton)resetDataButton.onclick=()=>{if(confirm('Nullstille avhukinger, feedback, Gate-status, check-ins og terskelhistorikk?')){Object.keys(localStorage).filter(k=>k.startsWith('runfest26_')).forEach(k=>localStorage.removeItem(k));renderAll()}};
renderLoadChart();updateRace();renderAll();
