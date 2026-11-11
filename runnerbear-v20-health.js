/* RunnerBear 2.0 · Editorial Athlete · phase 1 health surface.
 * Read-only projection of the existing canonical Body Response and health-trend API.
 * Never infers a diagnosis or substitutes missing health data with illustrative values.
 */
(function () {
  'use strict';
  const root = document.getElementById('health');
  if (!root) return;

  const ALLOWED_RANGES = [7, 28, 30, 90];
  const cache=new Map();
  const CACHE_TTL=60000, REQUEST_TIMEOUT=12000;
  let pending=null;
  const cacheKey=(page,days)=>`${page}:${days}:observed-v1`;
  const state = { ranges:{overview:7,breathing:30}, range: 7, metric:'hrvMs', page: 'overview', loading: false, error: '', summary: null, request: 0 };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const numeric = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const numberText = (value, digits = 0) => numeric(value) == null ? 'Mangler' :
    new Intl.NumberFormat('nb-NO', { maximumFractionDigits: digits }).format(value);
  const secondsText = (value) => {
    if (numeric(value) == null || value < 0) return 'Mangler';
    const minutes = Math.round(value / 60);
    return `${Math.floor(minutes / 60)} t ${String(minutes % 60).padStart(2, '0')} min`;
  };
  const dateText = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ?
    `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}` : 'Ukjent';
  const sourceText=value=>({garmin_personal_observed:'Garmin · direkte måling',garmin:'Garmin',tredict:'Registrert via Tredict',mixed:'Flere datakilder',registered:'Registrert måling'}[value]||'Registrerte målinger');
  const dateTimeText=value=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Oslo'}).format(new Date(value)):'ikke tilgjengelig';
  const bodyResponse = () => {
    const snapshot = window.RunnerBearCloudV11?.snapshot?.();
    const body = snapshot?.bodyResponse;
    return body?.version === 'body-response-1' &&
      body.planRevisionId === snapshot?.planRevisionId ? body : null;
  };

  function metricRow(label, value, unit, samples, annotation) {
    const hasValue = value !== 'Mangler';
    const note = samples > 0 ? `${samples} av ${state.range} dager` : 'Ingen tilgjengelige målinger';
    return `<div class="rb20-metric-row">
      <dt>${escapeHtml(label)}</dt>
      <dd><strong>${escapeHtml(value)}</strong>${hasValue ? ` <small>${escapeHtml(unit)}</small>` : ''}</dd>
      <span>${escapeHtml(annotation || note)}</span>
    </div>`;
  }

  function summaryNote() {
    const observed=window.RunnerBearV22Agent?.snapshot?.()?.health;
    if(observed)return observed.brief||observed.summary;
    const body = bodyResponse();
    if(state.summary?.daysWithAnyData>0&&body?.freshness?.status!=='fresh')return 'Registrerte målinger vises med datadekning. Dagens samlede coachvurdering venter fortsatt på et bekreftet helsegrunnlag.';
    if (!body) return 'Vi trenger bekreftede, ferske data før RunnerBear kan vurdere kroppens respons.';
    if (body.freshness?.status !== 'fresh') return 'Siste tilgjengelige helseverdier vises. De er ikke bekreftet ferske nok for en ny vurdering i dag.';
    return body.summary || body.stateLabel || 'Målingene er hentet. Se detaljene for grunnlaget.';
  }

  function periodOptions() {
    return `<div class="rb20-ranges" role="group" aria-label="Velg periode">
      ${(state.page==='breathing'?[7,30,90]:[7,28,90]).map((days) => `<button type="button" data-rb20-range="${days}" aria-pressed="${state.range === days}">${days} dager</button>`).join('')}
    </div>`;
  }

  function sourceNote() {
    const period = state.summary;
    if (!period) return '';
    return `<details class="rb20-source-details"><summary>Datadekning og kilde · ${escapeHtml(String(period.daysWithAnyData ?? 0))} av ${state.range} dager</summary><p class="rb20-source">Datagrunnlag: ${escapeHtml(String(period.daysWithAnyData ?? 0))} av ${state.range} dager med minst én måling.
      Siste måledato: ${escapeHtml(dateText((period.series||[]).filter(row=>['hrvMs','sleepSeconds','restingHeartRateBpm','spo2AveragePct','spo2MinimumPct'].some(key=>numeric(row[key])!=null)).map(row=>row.date).sort().at(-1)))}. Kilde: Garmin og registrerte helsedata. ${escapeHtml(state.summary?.series?.at(-1)?.syncedAt?"Sist mottatt: "+dateTimeText(state.summary.series.at(-1).syncedAt):"Importtid ikke tilgjengelig.")}</p></details>`;
  }

  function loadingOrError() {
    if (state.loading) return `<p class="rb20-feedback" role="status">${state.summary?'Viser sist hentede målinger mens vi oppdaterer …':'Henter registrerte målinger …'}</p>`;
    if (state.error) return `<div class="rb20-feedback" role="alert"><p>${escapeHtml(state.error)}</p><button type="button" data-rb20-retry>Prøv igjen</button></div>`;
    if (!state.summary) return '<p class="rb20-feedback">Ingen målinger er tilgjengelige ennå.</p>';
    return '';
  }

  const appBar=()=>window.RunnerBearCoachOS?.appBarHtml?.().replace('data-rb126-more','data-rb20-settings')||'<header class="rb20-appbar"><b>RunnerBear</b><button type="button" data-rb20-settings aria-label="Åpne profil og innstillinger">Profil</button></header>';
  function responseHtml(){
    const snapshot=window.RunnerBearV22Agent?.snapshot?.();if(!snapshot)return'';
    const health=snapshot.health,latest=snapshot.activities?.[0],primary=snapshot.primary;
    return `<section class="rb22-response"><p class="rb20-smallcaps">OPPFØLGING ETTER TRENING</p><h2>${latest?'Fra økt til kroppens respons.':'Dette følger vi videre.'}</h2>${latest?`<h3>${escapeHtml(latest.title)}</h3><p>${escapeHtml(latest.response.summary)}</p><p class="rb20-source">${escapeHtml(latest.response.limitation)}</p>`:''}${health.guidance?`<p class="rb23-advice">${escapeHtml(health.guidance.text)}</p>`:''}${snapshot.subjective?`<p>Egenfølelse registrert i dag: ${escapeHtml(({fresh:'som normalt',tired:'litt redusert',heavy:'klart redusert'})[snapshot.subjective.state]||'ukjent')}.</p>`:''}${primary.action==='checkin'?'<button data-rb22-checkin>Hvordan kjennes kroppen i dag?</button>':''}<details><summary>Se personlig referanse og begrensninger</summary>${health.domains.map(d=>`<p><b>${escapeHtml(d.label)}</b> · ${escapeHtml(({missing:'Ingen målinger',stale:'Siste måling er eldre',building:'Referansen bygges',steady:'Ingen tydelig endring',higher:'Høyere enn referansen',lower:'Lavere enn referansen'})[d.state])}. ${escapeHtml(d.summary)} Dekning: ${d.coverage} av 7 dager. Referanse: ${d.referenceCoverage} av 28 dager, ${escapeHtml(d.referenceFrom)} – ${escapeHtml(d.referenceTo)}.</p>`).join('')}<p>${escapeHtml(health.limitation)}</p></details>${window.RunnerBearV22Agent.receipt()?'':'<button data-rb22-seen>Forstått · behold i historikken</button>'}<p data-rb22-save-status role="status"></p><details><summary>Oppfølging siste 7 dager</summary><p>${escapeHtml(snapshot.review.summary)}</p><h3>Det vi tar med videre</h3><p>${escapeHtml(snapshot.review.learning||snapshot.health.brief||'')}</p><p>${escapeHtml(snapshot.review.focus)}</p></details>${snapshot.patterns?.length?`<details><summary>Personlige observasjoner</summary>${snapshot.patterns.map(p=>`<p>${escapeHtml(p.text)}</p>`).join('')}</details>`:''}<details><summary>Tidligere innsikter</summary>${(snapshot.history||[]).length?snapshot.history.map(i=>`<article><h3>${escapeHtml(i.date)} · ${escapeHtml(i.title)}</h3><p>${escapeHtml(i.summary)}</p></article>`).join(''):'<p>Nye innsikter blir bevart her etter hvert.</p>'}</details></section>`;
  }
  function focusHtml(){
    if(!window.RunnerBearV22Agent?.snapshot?.())return'';const f=window.RunnerBearV22Agent.focus?.();
    return `<section class="rb23-focus"><p class="rb20-smallcaps">DITT VALGFRIE FOKUS</p>${f?`<h2>${escapeHtml(f.label)}</h2><p>${escapeHtml(f.observation)}</p><p class="rb20-source">${escapeHtml(dateText(f.from))} – ${escapeHtml(dateText(f.through))}. ${escapeHtml(f.limitation)}</p>`:'<h2>Én liten prioritet om gangen.</h2><p>Velg et frivillig fokus i 14 dager. Det følges opp med tilgjengelige målinger og dine egne innsjekker.</p>'}${f?.status==='active'?`<p>${escapeHtml(f.description)}</p><div class="rb23-focus-actions"><button data-rb23-focus="complete" data-focus-id="${escapeHtml(f.id)}">${f.readyToReview?'Avslutt og se perioden':'Avslutt fokus'}</button><button data-rb23-focus="dismiss" data-focus-id="${escapeHtml(f.id)}">Legg bort</button>${f.kind==='body_response'?'<button data-rb22-checkin>Åpne kroppssjekken</button>':''}</div>`:`<div class="rb23-focus-actions"><button data-rb23-focus="start" data-focus-kind="sleep_routine">Følg en jevnere søvnrutine</button><button data-rb23-focus="start" data-focus-kind="body_response">Følg kroppens respons</button></div>`}<p data-rb23-focus-status role="status"></p></section>`;
  }
  function overviewHtml() {
    const m = state.summary?.metrics || {};
    const hrv = m.hrvMs || {}, sleep = m.sleepSeconds || {}, rhr = m.restingHeartRateBpm || {};
    const body = bodyResponse();
    const load = body?.domains?.find((part) => part.id === 'load');
    const fresh = body?.freshness?.status === 'fresh';
    return `${appBar()}<div class="rb20-shell">
      <div class="rb20-landscape" aria-hidden="true"></div>
      <div class="rb20-content">
        <div class="rb20-eyebrow"><span>DAGENS HELSEVURDERING · SISTE 7 DAGER</span><span class="rb20-data-label">Registrerte data</span></div>
        <h1>Slik svarer kroppen.</h1>
        <p class="rb20-lead">${escapeHtml(summaryNote())}</p><p class="rb20-source">Sist vurdert: ${escapeHtml(dateText(window.RunnerBearV22Agent?.snapshot?.()?.localDate))}. Historikken nedenfor har eget periodevalg.</p>
        <h2 class="rb23-history-title">Målingene over tid · ${state.range} dager</h2>${periodOptions()}
        ${loadingOrError()}
        ${state.summary ? `<dl class="rb20-metrics">
          ${metricRow('HRV', numberText(hrv.median, 1), 'ms', hrv.samples, `Median · ${hrv.samples||0} av ${state.range} dager`)}
          ${metricRow('Søvn', secondsText(sleep.median), '', sleep.samples, `Median · ${sleep.samples||0} av ${state.range} dager`)}
          ${metricRow('Hvilepuls', numberText(rhr.median, 1), 'bpm', rhr.samples, `Median · ${rhr.samples||0} av ${state.range} dager`)}
        </dl>` : ''}
        ${state.summary ? trendHtml()+sourceNote() : ''}
        ${responseHtml()}${focusHtml()}
        ${window.RunnerBearV22Agent?.snapshot?.()?'':`<section class="rb20-coach">
          <p class="rb20-smallcaps">FRA ØKT TIL RESPONS</p>
          <h2>${fresh ? 'Se belastningen i sammenheng.' : 'Vi følger med videre.'}</h2>
          <p>${escapeHtml(fresh && load?.summary ?
            load.summary :
            'RunnerBear ser etter sammenheng mellom gjennomført trening, søvn, puls og egne symptomer. Ingen enkeltmåling avgjør neste økt.')}</p>
        </section>`}
        <div class="rb20-links">
          <button type="button" data-rb20-page="breathing"><span>Søvn og pust</span><span aria-hidden="true">›</span></button>
          <button type="button" data-rb20-checkin><span>Akilles og kroppssjekk</span><span aria-hidden="true">›</span></button>
        </div>
      </div>
    </div>`;
  }

  function breathingHtml() {
    const m = state.summary?.metrics || {}, avg = m.spo2AveragePct || {}, minimum = m.spo2MinimumPct || {};
    const coverage = Number(avg.samples || 0);
    const below90 = state.summary?.recordedMinimumBelow90Nights;
    return `${appBar()}<div class="rb20-shell rb20-breathing">
      <div class="rb20-landscape rb20-landscape-small" aria-hidden="true"></div>
      <div class="rb20-content">
        <button type="button" class="rb20-back" data-rb20-page="overview" aria-label="Tilbake til helse">‹ &nbsp; Helse</button>
        <div class="rb20-eyebrow"><span>SØVN OG PUST</span><span class="rb20-data-label">Klokkemålinger</span></div>
        <h1>Se mønsteret over tid.</h1>
        <p class="rb20-lead">Ikke bare nattens laveste måling.</p>
        ${periodOptions()}
        ${loadingOrError()}
        ${state.summary ? `<section class="rb20-spo2">
          <div class="rb20-spo2-head"><div><span>Nattlig SpO₂</span><strong>${escapeHtml(numberText(avg.mean, 1))}${numeric(avg.mean) == null ? '' : ' %'}</strong><small>Gjennomsnitt av tilgjengelige nattverdier</small></div></div>
          <div class="rb20-spo2-facts">
            <div><span>Måledekning</span><b>${coverage} av ${state.range} netter</b></div>
            <div><span>Dekning gjennom natten</span><b>Ukjent fra dagsverdier</b></div>
          </div>
          ${sourceNote()}
        </section>` : ''}
        ${state.summary?trendHtml(true)+`<details class="rb23-minimum"><summary>Minimumsverdier og målebegrensninger</summary><p>Laveste registrerte minimum: ${escapeHtml(numberText(minimum.lowestRecorded,0))} %. Netter med minimum under 90 %: ${minimum.samples>0&&Number.isInteger(below90)?below90:'Mangler'}. Dette er ikke antall pustestopp. Dagsverdiene forteller ikke hvor lenge et utslag varte eller hvor god dekningen var gjennom natten.</p></details>`+nightTableHtml():''}
        <section class="rb20-explainer">
          <h2>Hva betyr dette?</h2>
          <p>Registrerte minimumsverdier kan påvirkes av målefeil. Antall netter under en grense er ikke antall pustestopp og kan ikke brukes som diagnose.</p>
        </section>
        <section class="rb20-coach rb20-care">
          <h2>Snorking eller pustestopp?</h2>
          <p>Ved observerte pustepauser eller vedvarende dagtretthet bør du snakke med fastlegen om søvnutredning.</p>
        </section>
        <p class="rb20-footnote">Garmin Pulse Ox er et trenings- og velværemål, ikke et medisinsk diagnoseverktøy.</p>
      </div>
    </div>`;
  }

  function trendHtml(breathing=false){
    const series=state.summary?.series||[],key=breathing?'spo2AveragePct':state.metric,labels={hrvMs:'HRV · ms',sleepSeconds:'Søvn · timer',restingHeartRateBpm:'Hvilepuls · bpm',spo2AveragePct:'Nattlig SpO₂ · %'};
    const rows=series.filter(r=>numeric(r[key])!=null),values=rows.map(r=>key==='sleepSeconds'?r[key]/3600:r[key]);
    const options=breathing?'':`<div class="rb20-ranges" role="group" aria-label="Velg helsemåling">${[['hrvMs','HRV'],['sleepSeconds','Søvn'],['restingHeartRateBpm','Hvilepuls']].map(([k,label])=>`<button data-rb20-metric="${k}" aria-pressed="${state.metric===k}">${label}</button>`).join('')}</div>`;
    if(!values.length)return options+'<p class="rb20-source">Ingen gyldige målinger for denne kurven i perioden.</p>';
    const domain=window.RunnerBearV22Agent?.snapshot?.()?.health?.domains?.find(d=>d.id===({hrvMs:'hrv',sleepSeconds:'sleep',restingHeartRateBpm:'rhr'})[key]),reference=!breathing&&domain?.referenceCoverage>=14&&numeric(domain.baseline)!=null?(key==='sleepSeconds'?domain.baseline/3600:domain.baseline):null,scale=reference==null?values:[...values,reference];
    const min=breathing?Math.max(50,Math.floor(Math.min(...values)-2)):Math.max(0,Math.floor(Math.min(...scale)-2)),max=breathing?100:Math.ceil(Math.max(...scale)+2),span=Math.max(1,max-min),last=Date.parse(state.summary.dateTo+'T12:00:00Z'),first=last-(state.range-1)*86400000;
    const points=rows.map((r,i)=>({x:34+((Date.parse(r.date+'T12:00:00Z')-first)/(86400000*(state.range-1)))*276,y:132-(values[i]-min)/span*108,value:values[i],date:r.date}));
    return `<section class="rb20-trend">${options}<figure><figcaption>${labels[key]} · registrerte dagsverdier</figcaption><svg viewBox="0 0 330 160" role="img" aria-label="${labels[key]}. ${points.length} registrerte dager. Nøyaktige verdier kan åpnes nedenfor."><path d="M30 24H318 M30 78H318 M30 132H318" class="grid"/><text x="0" y="28">${max}</text><text x="0" y="136">${min}</text>${reference!=null?`<path d="M34 ${(132-(reference-min)/span*108).toFixed(1)}H310" class="reference"/>`:''}${points.map((p,i)=>`${i&&Date.parse(p.date)-Date.parse(points[i-1].date)===86400000?`<path d="M${points[i-1].x.toFixed(1)} ${points[i-1].y.toFixed(1)}L${p.x.toFixed(1)} ${p.y.toFixed(1)}" class="trend"/>`:''}<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3"><title>${escapeHtml(p.date)}: ${p.value.toFixed(1)}</title></circle>`).join('')}</svg><p class="rb20-source">Punkter viser observerte verdier. Hull i målingene fylles ikke ut.${reference!=null?' Stiplet linje: median i de 28 kalenderdagene før siste 7-dagersperiode. Dette er en statistisk referanse.':''}</p></figure>${breathing?'':`<details><summary>Se daglige målinger</summary><div class="rb20-table-wrap"><table><thead><tr><th>Dato</th><th>${labels[key]}</th><th>Kilde</th></tr></thead><tbody>${rows.slice().reverse().map(r=>`<tr><th>${escapeHtml(dateText(r.date))}</th><td>${numberText(key==='sleepSeconds'?r[key]/3600:r[key],1)}</td><td>${escapeHtml(sourceText(r.metricSources?.[{hrvMs:'hrv_ms',sleepSeconds:'sleep_seconds',restingHeartRateBpm:'rhr_bpm'}[key]]||r.source))}</td></tr>`).join('')}</tbody></table></div></details>`}</section>`;
  }
  function nightTableHtml(){
    const rows=(state.summary?.series||[]).slice().reverse();
    return `<details class="rb20-nightly"><summary>Se natt for natt</summary><div class="rb20-table-wrap"><table><caption>Klokkemålinger · ikke diagnostikk</caption><thead><tr><th>Natt</th><th>Snitt</th><th>Minimum</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${escapeHtml(dateText(r.date))}</th><td>${numberText(r.spo2AveragePct,1)}${numeric(r.spo2AveragePct)!=null?' %':''}</td><td>${numberText(r.spo2MinimumPct,0)}${numeric(r.spo2MinimumPct)!=null?' %':''}</td></tr>`).join('')}</tbody></table></div></details><button type="button" class="rb20-export" data-rb20-export>Eksporter registrerte observasjoner</button>`;
  }
  function render() {
    const active=document.activeElement;
    const focus=root.contains?.(active)?Object.entries(active.dataset||{}).find(([key])=>key.startsWith('rb20')||key.startsWith('rb22')):null;
    const opened=Array.from(root.querySelectorAll?.('details[open]')||[]).map(el=>el.querySelector('summary')?.textContent);
    const html=state.page === 'breathing' ? breathingHtml() : overviewHtml();
    if(root.innerHTML===html)return;
    root.innerHTML=html;
    for(const el of root.querySelectorAll?.('details')||[])if(opened.includes(el.querySelector('summary')?.textContent))el.open=true;
    if(focus)for(const el of root.querySelectorAll?.('button')||[])if(el.dataset[focus[0]]===focus[1]){el.focus({preventScroll:true});break;}
  }

  async function loadRange(days = state.range, force=false) {
    const ranges=state.page==='breathing'?[7,30,90]:[7,28,90];
    if (!ALLOWED_RANGES.includes(days)||!ranges.includes(days)) return;
    const page=state.page,key=cacheKey(page,days);
    if(pending?.key===key)return pending.promise;
    pending?.controller.abort();
    pending=null;
    state.range=days;
    state.ranges[page]=days;
    const cached=cache.get(key);
    state.summary=cached?.payload||null;
    state.error='';
    const request=++state.request;
    if(!force&&cached&&Date.now()-cached.receivedAt<CACHE_TTL){state.loading=false;render();return;}
    state.loading=true;
    render();
    const controller=new AbortController();
    let timedOut=false;
    const timeout=setTimeout(()=>{timedOut=true;controller.abort();},REQUEST_TIMEOUT);
    const promise=(async()=>{
      try {
        const response=await fetch(`/api/v2/health/${page==='breathing'?'sleep-breathing':'trends'}?window=${days}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
        if(!response.ok)throw new Error('Målingene kunne ikke lastes akkurat nå.');
        const payload=await response.json();
        if(payload?.ok!==true||payload.windowDays!==days||!payload.metrics)throw new Error('Datagrunnlaget var ufullstendig.');
        if(request!==state.request)return;
        state.summary=payload;
        cache.set(key,{payload,receivedAt:Date.now()});
      }catch(error){
        if(request!==state.request)return;
        if(error?.name==='AbortError'&&!timedOut)return;
        state.error=timedOut?'Det tok for lang tid å hente målingene. Prøv igjen.':error?.message||'Målingene kunne ikke lastes akkurat nå.';
      }finally{
        clearTimeout(timeout);
        if(request===state.request){state.loading=false;pending=null;render();}
      }
    })();
    pending={key,controller,promise};
    return promise;
  }

  function open(page = 'overview') {
    state.page = page === 'breathing' ? 'breathing' : 'overview';
    state.range=state.ranges[state.page];
    return loadRange(state.range);
  }

  let focusSaving=false;
  root.addEventListener('click', (event) => {
    const focusButton=event.target.closest('[data-rb23-focus]');if(focusButton){if(focusSaving)return;focusSaving=true;focusButton.disabled=true;window.RunnerBearV22Agent.focusAction(focusButton.dataset.rb23Focus,focusButton.dataset.focusKind,focusButton.dataset.focusId).then(()=>render()).catch(()=>{const status=root.querySelector('[data-rb23-focus-status]');if(status)status.textContent='Kunne ikke lagre fokuset. Prøv igjen.'}).finally(()=>{focusSaving=false;focusButton.disabled=false});return;}
    if(event.target.closest('[data-rb22-checkin]')){window.RunnerBearCoachOS?.openBodyResponse?.();return}
    if(event.target.closest('[data-rb22-seen]')){const button=event.target.closest('[data-rb22-seen]');button.disabled=true;window.RunnerBearV22Agent.markSeen().then(()=>render()).catch(()=>{button.disabled=false;const status=root.querySelector('[data-rb22-save-status]');if(status)status.textContent='Kunne ikke lagre akkurat nå. Prøv igjen.'});return}
    if(event.target.closest('[data-rb20-settings]')){window.RunnerBearCoachOS?.switchView?.('more');return}
    const metric=event.target.closest('[data-rb20-metric]');if(metric&&['hrvMs','sleepSeconds','restingHeartRateBpm'].includes(metric.dataset.rb20Metric)){state.metric=metric.dataset.rb20Metric;render();return}
    if(event.target.closest('[data-rb20-export]')&&state.summary){const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),note:'Registrerte klokkemålinger. Ikke diagnose eller opptelling av pustestopp.',...state.summary},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='RunnerBear-helseobservasjoner.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return}
    const range = event.target.closest('[data-rb20-range]');
    if (range) { loadRange(Number(range.dataset.rb20Range)); return; }
    const page = event.target.closest('[data-rb20-page]');
    if (page) { state.page = page.dataset.rb20Page === 'breathing' ? 'breathing' : 'overview';open(state.page); window.scrollTo({ top: 0, behavior: 'instant' }); return; }
    if (event.target.closest('[data-rb20-retry]')) { loadRange(state.range,true); return; }
    if (event.target.closest('[data-rb20-checkin]')) { window.RunnerBearCoachOS?.openBodyResponse?.(); }
  });

  window.addEventListener('runnerbear:agent',()=>{if(root.classList?.contains('active'))render()});
  window.addEventListener('runnerbear:view', (event) => {
    if (event.detail?.view === 'health')open(state.page);
    else if(pending){++state.request;pending.controller.abort();pending=null;state.loading=false;}
  });
  window.RunnerBearV20Health = Object.freeze({ version: '2.1.0', open, loadRange, render });
})();
