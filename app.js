const weeks=window.RUNFEST_WEEKS;
const classLabel={easy:'Rolig',quality:'Kvalitet',race:'Race',rest:'Hvile',cross:'Cross'};
const weeksEl=document.getElementById('weeks'); const filter=document.getElementById('weekFilter');
weeks.forEach(w=>{const o=document.createElement('option');o.value=w.n;o.textContent=`Uke ${w.n} · ${w.range}`;filter.appendChild(o)});
function dayKey(date){return `runfest26_date_${date.toLowerCase().replace(/\s+/g,'_')}`}
function renderWeeks(){
  const val=filter.value; weeksEl.innerHTML='';
  weeks.filter(w=>val==='all'||String(w.n)===val).forEach(w=>{
    const sec=document.createElement('section');sec.className='week';sec.dataset.week=w.n;
    sec.innerHTML=`<div class="weekhead"><div><span class="phase">${w.phase}</span><h2>Uke ${w.n} · ${w.range}</h2><div class="muted">${w.focus}</div></div><div class="kmchip"><b>${w.km}</b><br><span class="muted">km løping</span></div></div><div class="days"></div>`;
    const de=sec.querySelector('.days');
    w.days.forEach((d,i)=>{const [date,type,title,desc,detail,shoe]=d;const div=document.createElement('article');div.className='day';
      const stored=localStorage.getItem(dayKey(date))==='1';
      div.innerHTML=`<div class="date">${date}</div><h4>${title}</h4><span class="badge ${type}">${classLabel[type]}</span><div class="desc">${desc}</div><div class="detail">${detail}</div>${shoe?`<div class="shoe">${shoe}</div>`:''}<label class="checkline"><input type="checkbox" ${stored?'checked':''}> Gjennomført</label>`;
      const inp=div.querySelector('input');inp.addEventListener('change',()=>localStorage.setItem(dayKey(date),inp.checked?'1':'0'));
      de.appendChild(div)
    }); weeksEl.appendChild(sec)
  }); highlightToday();
}
function renderChart(){const el=document.getElementById('weekChart');const max=Math.max(...weeks.map(w=>w.km));weeks.forEach(w=>{const bw=document.createElement('div');bw.className='barwrap';bw.innerHTML=`<div class="bar" style="height:${Math.round(22+(w.km/max)*105)}px"><span>${w.km}</span></div><small>U${w.n}</small>`;el.appendChild(bw)})}
function highlightToday(){const now=new Date();const fmt=new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short'}).format(now).replace('.','');document.querySelectorAll('.day').forEach(d=>{if(d.querySelector('.date')?.textContent.toLowerCase().includes(fmt.toLowerCase())) d.classList.add('today')})}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.section').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById(b.dataset.tab).classList.add('active')}));
filter.addEventListener('change',renderWeeks);document.getElementById('resetChecks').addEventListener('click',()=>{if(confirm('Nullstille alle avhukinger?')){Object.keys(localStorage).filter(k=>k.startsWith('runfest26_')).forEach(k=>localStorage.removeItem(k));renderWeeks()}});
renderChart();renderWeeks();