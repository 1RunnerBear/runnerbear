/* RunnerBear 2.0 · Editorial Athlete · phase 1 health surface.
 * Read-only projection of the existing canonical Body Response and health-trend API.
 * Never infers a diagnosis or substitutes missing health data with illustrative values.
 */
(function () {
  'use strict';
  const root = document.getElementById('health');
  if (!root) return;

  const ALLOWED_RANGES = [7, 28, 90];
  const state = { range: 7, page: 'overview', loading: false, error: '', summary: null, request: 0 };
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
    const body = bodyResponse();
    if (!body) return 'Vi trenger bekreftede, ferske data før RunnerBear kan vurdere kroppens respons.';
    if (body.freshness?.status !== 'fresh') return 'Siste tilgjengelige helseverdier vises. De er ikke bekreftet ferske nok for en ny vurdering i dag.';
    return body.summary || body.stateLabel || 'Målingene er hentet. Se detaljene for grunnlaget.';
  }

  function periodOptions() {
    return `<div class="rb20-ranges" role="group" aria-label="Velg periode">
      ${ALLOWED_RANGES.map((days) => `<button type="button" data-rb20-range="${days}" aria-pressed="${state.range === days}">${days} dager</button>`).join('')}
    </div>`;
  }

  function sourceNote() {
    const period = state.summary;
    if (!period) return '';
    return `<p class="rb20-source">Datagrunnlag: ${escapeHtml(String(period.daysWithAnyData ?? 0))} av ${state.range} dager med minst én måling.
      Siste tilgjengelige dato: ${escapeHtml(dateText(period.dateTo))}. Kilde: registrerte helsedata.</p>`;
  }

  function loadingOrError() {
    if (state.loading) return '<p class="rb20-feedback" role="status">Henter registrerte målinger …</p>';
    if (state.error) return `<div class="rb20-feedback" role="alert"><p>${escapeHtml(state.error)}</p><button type="button" data-rb20-retry>Prøv igjen</button></div>`;
    if (!state.summary) return '<p class="rb20-feedback">Ingen målinger er tilgjengelige ennå.</p>';
    return '';
  }

  function overviewHtml() {
    const m = state.summary?.metrics || {};
    const hrv = m.hrvMs || {}, sleep = m.sleepSeconds || {}, rhr = m.restingHeartRateBpm || {};
    const body = bodyResponse();
    const load = body?.domains?.find((part) => part.id === 'load');
    const fresh = body?.freshness?.status === 'fresh';
    return `<div class="rb20-shell">
      <div class="rb20-landscape" aria-hidden="true"></div>
      <div class="rb20-content">
        <div class="rb20-eyebrow"><span>HELSE · SISTE ${state.range} DAGER</span><span class="rb20-data-label">Registrerte data</span></div>
        <h1>Slik svarer kroppen.</h1>
        <p class="rb20-lead">${escapeHtml(summaryNote())}</p>
        ${periodOptions()}
        ${loadingOrError()}
        ${state.summary ? `<dl class="rb20-metrics">
          ${metricRow('HRV', numberText(hrv.median, 1), 'ms', hrv.samples)}
          ${metricRow('Søvn', secondsText(sleep.median), '', sleep.samples)}
          ${metricRow('Hvilepuls', numberText(rhr.median, 1), 'bpm', rhr.samples)}
        </dl>` : ''}
        ${state.summary ? sourceNote() : ''}
        <section class="rb20-coach">
          <p class="rb20-smallcaps">FRA ØKT TIL RESPONS</p>
          <h2>${fresh ? 'Se belastningen i sammenheng.' : 'Vi følger med videre.'}</h2>
          <p>${escapeHtml(fresh && load?.summary ?
            load.summary :
            'RunnerBear ser etter sammenheng mellom gjennomført trening, søvn, puls og egne symptomer. Ingen enkeltmåling avgjør neste økt.')}</p>
        </section>
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
    return `<div class="rb20-shell rb20-breathing">
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
            <div><span>Laveste registrerte minimum</span><b>${escapeHtml(numberText(minimum.lowestRecorded, 0))}${numeric(minimum.lowestRecorded) == null ? '' : ' %'}</b></div>
            <div><span>Netter med minimum under 90 %</span><b>${minimum.samples > 0 && Number.isInteger(below90) ? below90 : 'Mangler'}</b></div>
          </div>
          ${sourceNote()}
        </section>` : ''}
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

  function render() {
    root.innerHTML = state.page === 'breathing' ? breathingHtml() : overviewHtml();
  }

  async function loadRange(days = state.range) {
    if (!ALLOWED_RANGES.includes(days)) return;
    state.range = days;
    state.loading = true;
    state.error = '';
    state.summary = null;
    const request = ++state.request;
    render();
    try {
      const response = await fetch(`/api/v2/health/trends?window=${days}`, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Målingene kunne ikke lastes akkurat nå.');
      const payload = await response.json();
      if (payload?.ok !== true || payload.windowDays !== days || !payload.metrics) throw new Error('Datagrunnlaget var ufullstendig.');
      if (request !== state.request) return;
      state.summary = payload;
    } catch (error) {
      if (request !== state.request) return;
      state.error = error?.message || 'Målingene kunne ikke lastes akkurat nå.';
    } finally {
      if (request === state.request) { state.loading = false; render(); }
    }
  }

  function open(page = 'overview') {
    state.page = page === 'breathing' ? 'breathing' : 'overview';
    if (state.page === 'breathing' && state.range === 7) state.range = 28;
    render();
    loadRange(state.range);
  }

  root.addEventListener('click', (event) => {
    const range = event.target.closest('[data-rb20-range]');
    if (range) { loadRange(Number(range.dataset.rb20Range)); return; }
    const page = event.target.closest('[data-rb20-page]');
    if (page) { state.page = page.dataset.rb20Page === 'breathing' ? 'breathing' : 'overview'; open(state.page); window.scrollTo({ top: 0, behavior: 'instant' }); return; }
    if (event.target.closest('[data-rb20-retry]')) { loadRange(); return; }
    if (event.target.closest('[data-rb20-checkin]')) {
      window.RunnerBearCoachOS?.switchView?.('today');
      requestAnimationFrame(() => {
        const trigger = document.querySelector('#today [data-rb111-body-open]');
        if (trigger) trigger.click();
      });
    }
  });

  document.querySelector('[data-rb20-settings]')?.addEventListener('click', () => {
    window.RunnerBearCoachOS?.switchView?.('more');
  });
  window.addEventListener('runnerbear:view', (event) => {
    if (event.detail?.view === 'health') open();
  });
  window.RunnerBearV20Health = Object.freeze({ version: '2.0.0-stage1', open, loadRange });
})();
