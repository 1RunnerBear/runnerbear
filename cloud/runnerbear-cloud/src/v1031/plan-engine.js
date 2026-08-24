import { config as normalizeConfig, dateOnly, finite } from './validation.js';

const RUN_TYPES = new Set(['easy', 'quality', 'race', 'long']);
const TERMINAL = new Set(['completed', 'cancelled', 'replaced', 'skipped']);
const NO_VOLUME = new Set(['cancelled', 'replaced', 'skipped']);
const ms = date => Date.parse(`${dateOnly(date)}T12:00:00Z`);
const addDays = (date, days) => new Date(ms(date) + days * 86400000).toISOString().slice(0, 10);
const dayIndex = date => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
const monday = date => addDays(date, -dayIndex(date));
const weekKey = date => monday(date);
const roundHalf = value => Math.round(Number(value || 0) * 2) / 2;
const isLong = row => /langtur|long/i.test(`${row.title || ''} ${row.intent || ''}`) || row.workoutType === 'long';
const isQuality = row => ['quality', 'race'].includes(row.workoutType || row.type);
const isRun = row => RUN_TYPES.has(row.workoutType || row.type) || String(row.sport || '').toLowerCase() === 'running';
const isHard = row => isQuality(row) || isLong(row);
const countsVolume = row => !NO_VOLUME.has(String(row.status || 'scheduled'));
const distance = row => finite(row.plannedDistanceM ?? row.planned_distance_m ?? finite(row.km) * 1000);
const raceKm = key => ({ five: 5, ten: 10, half: 21.1 }[key] || 10);
const dayGap = (a, b) => Math.abs((ms(a) - ms(b)) / 86400000);
const clone = row => ({
  ...row,
  localDate: dateOnly(row.localDate || row.local_date || row.ds),
  slotIndex: Number(row.slotIndex || row.slot_index || 0),
  status: row.status || 'scheduled',
  sport: row.sport || 'running',
  workoutType: row.workoutType || row.workout_type || row.type || 'easy',
  plannedDistanceM: distance(row),
  prescription: { ...(row.prescription || {}) },
  plannedLoad: { ...(row.plannedLoad || {}) },
});

function hash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}

function legacyFor(type, index = 0) {
  if (type === 'quality') return index % 2
    ? { desc: '5 × 1000 m kontrollert VO₂.', detail: 'Hardt, men kontrollert. Avslutt med reserve; dette skal ikke bli en all-in-økt.', shoe: '', fuel: '' }
    : { desc: '6 × 6 min kontrollert terskel.', detail: 'Stabil terskelfølelse og jevn belastning. Ingen sluttspurt eller ekstra drag.', shoe: '', fuel: '' };
  if (type === 'long') return { desc: 'Rolig langtur.', detail: 'Snakketempo og kontrollert totalbelastning. Ingen progressiv avslutning med mindre planen uttrykkelig sier det.', shoe: '', fuel: '' };
  return { desc: 'Rolig løping.', detail: 'Lav kostnad og kontrollert intensitet. Denne økten skal støtte neste kvalitetsøkt, ikke konkurrere med den.', shoe: '', fuel: '' };
}

function recoveryLegacy(cross) {
  return cross
    ? { desc: 'Rolig alternativ trening eller full hvile.', detail: 'Restitusjonsdag. Ingen intervaller, terskel, progresjon eller skjult kvalitetsarbeid.', shoe: '', fuel: '' }
    : { desc: 'Hvile eller svært lett bevegelse.', detail: 'Restitusjonsdag. Ikke ta igjen kilometer eller kvalitet som mangler fra ukeplanen.', shoe: '', fuel: '' };
}

function template(type, date, km, index = 0, week = '') {
  const quality = type === 'quality', long = type === 'long';
  return {
    workoutId: `wo-${hash(`${week || weekKey(date)}|${type}|${index}`)}`,
    lineageId: `lin-${hash(`${week || weekKey(date)}|${type}|${index}`)}`,
    localDate: date, slotIndex: 0, status: 'scheduled', sport: 'running',
    workoutType: quality ? 'quality' : 'easy',
    title: quality ? (index % 2 ? '5 × 1000 m · VO₂' : '6 × 6 min terskel') : long ? `${km} km rolig langtur` : `${km} km rolig`,
    intent: quality ? (index % 2 ? 'vo2' : 'threshold') : long ? 'long' : 'easy',
    plannedDistanceM: km * 1000, lockLevel: 'none', source: 'runnerbear-v10.27',
    prescription: {
      version: 1,
      main: quality ? (index % 2
        ? { kind: 'intervals', repetitions: 5, workMeters: 1000, recoverySeconds: 120 }
        : { kind: 'intervals', repetitions: 6, workSeconds: 360, recoverySeconds: 120 })
        : { kind: 'continuous', intensity: 'easy' },
      legacy: legacyFor(type, index),
    },
  };
}
function unusedTemplate(type,date,index,week,used){
  let candidate=template(type,date,0,index,week),offset=0;
  while(used.has(candidate.workoutId)){offset++;candidate=template(type,date,0,index+offset*1000,week)}
  return candidate;
}

function overrideFor(cfg, week) { return cfg.constraints.safetyOverrides.find(row => row.week === week) || null; }
export function targetWeeklyVolume(rawConfig = {}) { return normalizeConfig(rawConfig).profile.targetWeeklyVolume; }

function targetForWeek(cfg, week, fromDate) {
  const explicit = overrideFor(cfg, week);
  if (explicit) return { targetKm: explicit.targetWeeklyVolume ?? cfg.profile.targetWeeklyVolume, volumeReason: explicit.reason, expectedQualitySessions: explicit.expectedQualitySessions, safetyOverrideReason: explicit.reason };
  const raceWeek = cfg.goal.mode === 'race' && cfg.goal.date && weekKey(cfg.goal.date) === week;
  if (raceWeek) return { targetKm: roundHalf(Math.max(cfg.profile.targetWeeklyVolume * .76, raceKm(cfg.goal.distance) + 16)), volumeReason: 'Konkurranseuke · volumet er kontrollert redusert.', expectedQualitySessions: 2, safetyOverrideReason: 'Konkurranseuke' };
  const secondary=(cfg.goal.secondary||[]).find(row=>row.status!=='cancelled'&&row.date>=fromDate&&weekKey(row.date)===week);
  if(secondary){const full=secondary.effort==='race';return{targetKm:roundHalf(Math.max(cfg.profile.targetWeeklyVolume*(full ? 0.84 : 0.92),raceKm(secondary.distance)+(full?18:20))),volumeReason:`B-løpsuke · ${full?'løpet erstatter ukas hardeste kvalitetsdose':'løpet inngår som en kontrollert kvalitetsdose'}.`,expectedQualitySessions:2,safetyOverrideReason:'B-løpsuke'};}
  const nextWeekRace=[cfg.goal.mode==='race'?cfg.goal.date:'',...(cfg.goal.secondary||[]).filter(row=>row.status!=='cancelled').map(row=>row.date)].filter(Boolean).find(date=>date>addDays(week,6)&&date<=addDays(week,8));
  if(nextWeekRace)return{targetKm:roundHalf(cfg.profile.targetWeeklyVolume*.88),volumeReason:'Oppladingsuke · én kvalitetsdose tas ut før løp tidlig i neste uke.',expectedQualitySessions:1,safetyOverrideReason:'Løp tidlig i neste uke'};
  const index = Math.max(0, Math.round((ms(week) - ms(monday(fromDate))) / (7 * 86400000)));
  if (index % 4 === 2) return { targetKm: roundHalf(Math.max(cfg.profile.targetWeeklyVolume * .88, cfg.profile.normalLow * .84)), volumeReason: 'Planlagt absorberingsuke · lavere volum med to kontrollerte kvalitetsdoser.', expectedQualitySessions: Math.min(2, cfg.constraints.qualityDays.length), safetyOverrideReason: 'Planlagt absorberingsuke' };
  const progression = index % 4 === 1 ? Math.min(cfg.profile.normalHigh, cfg.profile.targetWeeklyVolume + 2) : cfg.profile.targetWeeklyVolume;
  return { targetKm: roundHalf(progression), volumeReason: '', expectedQualitySessions: Math.min(2, cfg.constraints.qualityDays.length), safetyOverrideReason: '' };
}

function secondaryRaceRow(race,existing){
  const km=raceKm(race.distance),base=clone(existing||template('quality',race.date,km,97,weekKey(race.date))),full=race.effort==='race';
  return{...base,workoutId:`wo-b-race-${hash(race.id)}`,lineageId:`lin-b-race-${hash(race.id)}`,localDate:race.date,slotIndex:0,status:'scheduled',sport:'running',workoutType:'race',title:`${race.name} · B-løp`,intent:'b_race',plannedDurationSeconds:null,plannedDistanceM:km*1000,lockLevel:'system',source:'runnerbear-v10.31.2',prescription:{version:1,main:{kind:'continuous',intensity:full?'race':'controlled'},legacy:{desc:full?'Full innsats. Løpet erstatter ukas hardeste kvalitetsøkt.':'Kontrollert testløp som del av treningsuka.',detail:full?'Åpne kontrollert. Ingen ekstra kvalitet tett på, og ingen treningsgjeld etterpå.':'Løp kontrollert og avslutt med overskudd. Resultatet brukes som datapunkt mot A-målet.',shoe:base.prescription?.legacy?.shoe||'',fuel:base.prescription?.legacy?.fuel||''}},plannedLoad:{...(base.plannedLoad||{}),bRace:{id:race.id,name:race.name,date:race.date,distance:race.distance,effort:race.effort,primaryGoalDate:''}}};
}

function applySecondaryRaces(rows,cfg,fromDate){
  const races=(cfg.goal.secondary||[]).filter(row=>row.status!=='cancelled'&&row.date>=fromDate&&(!cfg.goal.date||row.date<cfg.goal.date)),activeIds=new Set(races.map(row=>row.id));
  let out=rows.map(clone).filter(row=>!row.plannedLoad?.bRace||activeIds.has(row.plannedLoad.bRace.id));
  for(const race of races){
    if(cfg.goal.mode==='race'&&cfg.goal.date===race.date)continue;
    const existing=out.find(row=>row.localDate===race.date&&!row.plannedLoad?.bRace&&row.workoutType!=='race');
    out=out.filter(row=>row.localDate!==race.date||row.slotIndex!==0);
    const inserted=secondaryRaceRow(race,existing);inserted.plannedLoad.bRace.primaryGoalDate=cfg.goal.date||'';out.push(inserted);
  }
  return out;
}

function integrityOf(items = []) { return [...items].reverse().map(row => row.plannedLoad?.integrity).find(Boolean) || {}; }
function weekGroups(rows = []) {
  const weeks = new Map();
  for (const source of rows) {
    const row = clone(source); if (!row.localDate) continue;
    const key = weekKey(row.localDate); weeks.set(key, [...(weeks.get(key) || []), row]);
  }
  return weeks;
}
function immutableFingerprint(row) {
  const x = clone(row);
  return JSON.stringify([x.workoutId, x.lineageId, x.localDate, x.slotIndex, x.status, x.sport, x.workoutType, x.title, x.intent, x.prescription, x.plannedDurationSeconds ?? null, x.plannedDistanceM, x.plannedLoad, x.source, x.lockLevel, x.flexible === true, x.explicitChoice === true]);
}
export function historicalRowsUnchanged(before = [], after = [], fromDate) {
  const next = new Map(after.filter(row => dateOnly(row.localDate || row.ds) < fromDate).map(row => [String(row.workoutId || row.lineageId || `${row.localDate}:${row.slotIndex || 0}`), row]));
  return before.filter(row => dateOnly(row.localDate || row.ds) < fromDate).every(row => {
    const key = String(row.workoutId || row.lineageId || `${row.localDate}:${row.slotIndex || 0}`), candidate = next.get(key);
    return candidate && immutableFingerprint(row) === immutableFingerprint(candidate);
  });
}

export function validatePlan(rows = [], rawConfig = {}, options = {}) {
  const cfg = normalizeConfig(rawConfig), fromDate = dateOnly(options.fromDate || ''), issues = [], weeks = weekGroups(rows), slots = new Set(), scheduledQuality = [];
  for (const source of rows) {
    const row = clone(source), mutable = !fromDate || row.localDate >= fromDate, slot = `${row.localDate}:${row.slotIndex}`;
    if (slots.has(slot)) issues.push({ code: 'SLOT_COLLISION', localDate: row.localDate, slotIndex: row.slotIndex });
    slots.add(slot);
    if (mutable && row.status === 'scheduled' && isRun(row) && !cfg.constraints.runDays.includes(dayIndex(row.localDate)) && row.workoutType !== 'race' && !row.explicitChoice) issues.push({ code: 'RUN_DAY_CONFLICT', workoutId: row.workoutId, localDate: row.localDate });
    if (mutable && row.status === 'scheduled' && isQuality(row)) scheduledQuality.push(row);
  }
  for (const [week, items] of weeks) {
    const mutableWeek = !fromDate || items.some(row => row.localDate >= fromDate), runs = items.filter(row => isRun(row) && countsVolume(row)), km = roundHalf(runs.reduce((sum, row) => sum + distance(row) / 1000, 0)), quality = items.filter(row => isQuality(row) && countsVolume(row)).sort((a, b) => a.localDate.localeCompare(b.localDate)), meta = integrityOf(items), longs = items.filter(row => isLong(row) && countsVolume(row));
    if (mutableWeek && runs.length > cfg.constraints.maxRunDays) issues.push({ code: 'MAX_RUN_DAYS', week, actual: runs.length, limit: cfg.constraints.maxRunDays });
    if (mutableWeek && km > cfg.constraints.weeklyKmCap + .01) issues.push({ code: 'WEEKLY_KM_CAP', week, actual: km, limit: cfg.constraints.weeklyKmCap });
    if (mutableWeek) for (let i = 1; i < quality.length; i++) if (dayGap(quality[i].localDate, quality[i - 1].localDate) < 2) issues.push({ code: 'ADJACENT_QUALITY', week, workoutIds: [quality[i - 1].workoutId, quality[i].workoutId] });
    if (mutableWeek) for (const q of quality) for (const l of longs) if (dayGap(q.localDate, l.localDate) < 2) issues.push({ code: 'QUALITY_LONG_ADJACENCY', week, workoutIds: [q.workoutId, l.workoutId] });
    if (mutableWeek) {
      const expected = Number.isFinite(Number(meta.expectedQualitySessions)) ? Number(meta.expectedQualitySessions) : Math.min(2, cfg.constraints.qualityDays.length), reason = String(meta.safetyOverrideReason || '');
      if (quality.length !== expected && !reason) issues.push({ code: 'QUALITY_SESSION_INVARIANT', week, expected, actual: quality.length });
      const target = Number(meta.targetWeeklyVolume || 0);
      if (target > 0 && Math.abs(km - target) > .51 && !String(meta.volumeReason || reason)) issues.push({ code: 'WEEKLY_VOLUME_INVARIANT', week, target, actual: km });
    }
  }
  scheduledQuality.sort((a, b) => a.localDate.localeCompare(b.localDate));
  for (let i = 1; i < scheduledQuality.length; i++) if (dayGap(scheduledQuality[i].localDate, scheduledQuality[i - 1].localDate) < 2) issues.push({ code: 'ADJACENT_QUALITY', workoutIds: [scheduledQuality[i - 1].workoutId, scheduledQuality[i].workoutId] });
  for (let i = 0; i < scheduledQuality.length; i++) if (scheduledQuality[i + 2] && (ms(scheduledQuality[i + 2].localDate) - ms(scheduledQuality[i].localDate)) / 86400000 <= 6) issues.push({ code: 'ROLLING_QUALITY_CAP', workoutIds: scheduledQuality.slice(i, i + 3).map(row => row.workoutId) });
  const hard = rows.map(clone).filter(row => countsVolume(row) && isHard(row)).sort((a, b) => a.localDate.localeCompare(b.localDate));
  for (let i = 1; i < hard.length; i++) {
    const prior = hard[i - 1], next = hard[i];
    if ((!fromDate || next.localDate >= fromDate) && dayGap(prior.localDate, next.localDate) < 2 && !issues.some(issue => issue.code === 'QUALITY_LONG_ADJACENCY' && issue.workoutIds?.includes(prior.workoutId) && issue.workoutIds?.includes(next.workoutId))) issues.push({ code: 'HARD_DAY_ADJACENCY', workoutIds: [prior.workoutId, next.workoutId], dates: [prior.localDate, next.localDate] });
  }
  return { valid: issues.length === 0, issues, weeks: [...weeks].map(([week, items]) => {
    const meta = integrityOf(items);
    return { week, targetWeeklyVolume: Number(meta.targetWeeklyVolume || 0), plannedKm: roundHalf(items.filter(row => isRun(row) && countsVolume(row)).reduce((sum, row) => sum + distance(row) / 1000, 0)), expectedQualitySessions: Number(meta.expectedQualitySessions ?? Math.min(2, cfg.constraints.qualityDays.length)), actualQualitySessions: items.filter(row => isQuality(row) && countsVolume(row)).length, safetyOverrideReason: String(meta.safetyOverrideReason || '') };
  }) };
}

function chooseQualityDates({ week, cfg, available, fixedQuality, expected, longDate, hardDates = [] }) {
  const blocked = [...hardDates, ...fixedQuality, ...(longDate ? [longDate] : [])], selected = [], canUse = date => available.includes(date) && ![...blocked, ...selected].some(other => dayGap(other, date) < 2), preferred = cfg.constraints.qualityDays.map(day => addDays(week, day));
  for (const date of preferred) if (selected.length + fixedQuality.length < expected && canUse(date)) selected.push(date);
  for (const date of available) if (selected.length + fixedQuality.length < expected && canUse(date)) selected.push(date);
  return selected;
}
function sessionBounds(row, targetWeeklyKm) {
  const target = Math.max(10, finite(targetWeeklyKm, 50));
  if (isLong(row)) return { min: 12, max: roundHalf(Math.min(20, Math.max(14, target * .36))), weight: .34 };
  if (isQuality(row)) return { min: 8, max: 14, weight: .22 };
  return { min: 3, max: roundHalf(Math.min(10, Math.max(6, target * .18))), weight: .11 };
}
function allocateDistances(rows, targetRemaining, targetWeeklyKm = targetRemaining) {
  const target = Math.max(0, roundHalf(targetRemaining)), defaultLongCap = roundHalf(Math.min(20, Math.max(14, finite(targetWeeklyKm, 50) * .36)));
  if (!rows.length) return { targetRemaining: target, actualRemaining: 0, shortfall: target, overage: 0, longRunCapKm: defaultLongCap };
  const entries = rows.map(row => { const bounds = sessionBounds(row, targetWeeklyKm); return { row, ...bounds, minUnits: Math.round(bounds.min * 2), maxUnits: Math.round(bounds.max * 2), units: Math.round(bounds.min * 2) }; }), targetUnits = Math.round(target * 2), minUnits = entries.reduce((sum, row) => sum + row.minUnits, 0);
  let remaining = Math.max(0, targetUnits - minUnits);
  while (remaining > 0) {
    const eligible = entries.filter(row => row.units < row.maxUnits);
    if (!eligible.length) break;
    eligible.sort((a, b) => (b.weight / (1 + b.units - b.minUnits)) - (a.weight / (1 + a.units - a.minUnits)) || rows.indexOf(a.row) - rows.indexOf(b.row));
    eligible[0].units++; remaining--;
  }
  for (const entry of entries) {
    const km = entry.units / 2; entry.row.plannedDistanceM = km * 1000;
    if (isLong(entry.row)) entry.row.title = `${String(km).replace('.', ',')} km rolig langtur`;
    else if (!isQuality(entry.row)) entry.row.title = `${String(km).replace('.', ',')} km rolig`;
  }
  const actual = roundHalf(entries.reduce((sum, row) => sum + row.units / 2, 0)), longEntry = entries.find(entry => isLong(entry.row));
  return { targetRemaining: target, actualRemaining: actual, shortfall: roundHalf(Math.max(0, target - actual)), overage: roundHalf(Math.max(0, actual - target)), longRunCapKm: longEntry ? longEntry.max : defaultLongCap };
}

function rowFor(pool, used, type, date, index, week) {
  const match = pool.find(row => !used.has(row.workoutId) && (type === 'long' ? isLong(row) : type === 'quality' ? isQuality(row) && row.workoutType !== 'race' : row.workoutType === 'easy' && !isLong(row))), fallback = pool.find(row => !used.has(row.workoutId)), generated = unusedTemplate(type,date,index,week,used);
  let row = clone(match || fallback || generated); used.add(row.workoutId); row.localDate = date; row.slotIndex = 0; row.status = 'scheduled'; row.sport = 'running'; row.lockLevel = 'none';
  if (type === 'long') { row.workoutType = 'easy'; row.intent = 'long'; if (!match || row.prescription?.main?.kind !== 'continuous') { row.prescription = generated.prescription; row.plannedDurationSeconds = null; } }
  else if (type === 'quality') { row.workoutType = 'quality'; row.intent = row.intent && !['easy', 'long', 'recovery'].includes(row.intent) ? row.intent : generated.intent; if (!match) { row.title = generated.title; row.prescription = generated.prescription; row.plannedDurationSeconds = null; } }
  else { row.workoutType = 'easy'; row.intent = 'easy'; if (!match || row.prescription?.main?.kind !== 'continuous') { row.prescription = generated.prescription; row.plannedDurationSeconds = null; } }
  return row;
}
function restRow(pool, used, date, cfg, index, week) {
  const same = pool.find(row => !used.has(row.workoutId) && row.localDate === date), fallback = pool.find(row => !used.has(row.workoutId));
  let row = clone(same || fallback || unusedTemplate('easy',date,index,week,used)); used.add(row.workoutId);
  const cross = cfg.constraints.alternativeDays.includes(dayIndex(date));
  return { ...row, localDate: date, slotIndex: 0, status: 'scheduled', sport: cross ? 'cross' : 'rest', workoutType: cross ? 'cross' : 'rest', title: cross ? 'Alternativ eller hvile' : 'Hvile · treningsramme', intent: 'recovery', plannedDurationSeconds: null, plannedDistanceM: 0, lockLevel: 'none', flexible: true, prescription: { version: 1, main: { kind: 'recovery' }, legacy: recoveryLegacy(cross) } };
}

function reflowWeek(items, cfg, week, fromDate, trigger, priorHardDates = []) {
  const source = items.map(clone), fixed = source.filter(row => row.localDate < fromDate || TERMINAL.has(row.status) || row.lockLevel === 'user' || row.lockLevel === 'system' || row.explicitChoice === true || row.plannedLoad?.manualMove === true && trigger !== 'training_preferences_changed' || row.workoutType === 'race'), mutable = source.filter(row => !fixed.includes(row)), occupied = new Set(fixed.map(row => row.localDate)), available = cfg.constraints.runDays.map(day => addDays(week, day)).filter(date => date >= fromDate && !occupied.has(date)), targetMeta = targetForWeek(cfg, week, fromDate), fixedRuns = fixed.filter(row => isRun(row) && countsVolume(row)), fixedQuality = fixedRuns.filter(isQuality).map(row => row.localDate), fixedLong = fixedRuns.find(isLong), blockedHard = [...priorHardDates, ...fixedRuns.filter(isHard).map(row => row.localDate)], preferredLong = addDays(week, cfg.constraints.longRunDay), mutableLong = mutable.find(row => isLong(row) && available.includes(row.localDate)), reserveExistingLong = !fixedLong && mutableLong && available.length <= 2 && !blockedHard.some(other => dayGap(other, mutableLong.localDate) < 2);
  let longDate = '', qualityDates = [];
  if (fixedLong) {
    qualityDates = chooseQualityDates({ week, cfg, available, fixedQuality, expected: targetMeta.expectedQualitySessions, longDate: '', hardDates: [...priorHardDates, fixedLong.localDate] });
  } else if (reserveExistingLong) {
    longDate = mutableLong.localDate;
    qualityDates = chooseQualityDates({ week, cfg, available: available.filter(date => date !== longDate), fixedQuality, expected: targetMeta.expectedQualitySessions, longDate, hardDates: priorHardDates });
  } else {
    qualityDates = chooseQualityDates({ week, cfg, available, fixedQuality, expected: targetMeta.expectedQualitySessions, longDate: '', hardDates: priorHardDates });
    const hardForLong = [...blockedHard, ...qualityDates], canLong = date => available.includes(date) && !qualityDates.includes(date) && !hardForLong.some(other => dayGap(other, date) < 2);
    longDate = canLong(preferredLong) ? preferredLong : available.find(canLong) || '';
  }
  const priorityDates=[...qualityDates,...(longDate?[longDate]:[]),...available.filter(date=>!qualityDates.includes(date)&&date!==longDate)],mutableRunLimit=Math.max(0,cfg.constraints.maxRunDays-fixedRuns.length),runDates = new Set(priorityDates.slice(0,mutableRunLimit)), types = new Map([...runDates].map(date => [date, 'easy']));
  if (longDate) types.set(longDate, 'long'); qualityDates.forEach(date => types.set(date, 'quality'));
  const used = new Set(), future = [], allDates = Array.from({ length: 7 }, (_, index) => addDays(week, index)).filter(date => date >= fromDate && !occupied.has(date));
  let qualityIndex = 0;
  for (const date of allDates) { const type = types.get(date); future.push(type ? rowFor(mutable, used, type, date, qualityIndex++, week) : restRow(mutable, used, date, cfg, qualityIndex++, week)); }
  const targetKm = Math.min(cfg.constraints.weeklyKmCap, targetMeta.targetKm), fixedKm = roundHalf(fixedRuns.reduce((sum, row) => sum + distance(row) / 1000, 0)), futureRuns = future.filter(isRun), allocation = allocateDistances(futureRuns, Math.max(0, targetKm - fixedKm), targetKm), actualQuality = fixed.filter(row => isQuality(row) && countsVolume(row)).length + future.filter(row => isQuality(row) && countsVolume(row)).length;
  let safetyOverrideReason = targetMeta.safetyOverrideReason, volumeReason = targetMeta.volumeReason;
  if (actualQuality !== targetMeta.expectedQualitySessions && !safetyOverrideReason) safetyOverrideReason = 'Begrenset gjenstående tilgjengelighet eller nødvendig restitusjonsavstand i inneværende uke.';
  if (allocation.shortfall > .5 && !volumeReason) volumeReason = 'Ukevolum er et mål, ikke treningsgjeld. Resterende kilometer presses ikke inn i én sen økt.';
  if (allocation.overage > .5 && !volumeReason) volumeReason = 'Gjenstående økter holdes på en trygg minimumsdose selv om ukesmålet allerede nesten er nådd.';
  const longRunOverrideReason = !fixedLong && longDate && longDate !== preferredLong ? 'Langturen ble flyttet fra ønsket dag for å bevare restitusjonsavstand til en hardøkt eller en låst økt.' : !fixedLong && !longDate ? 'Ingen trygg langturdag gjenstår i uken.' : '';
  const integrity = { targetWeeklyVolume: targetKm, plannedWeeklyVolume: roundHalf(fixedKm + allocation.actualRemaining), expectedQualitySessions: targetMeta.expectedQualitySessions, actualQualitySessions: actualQuality, safetyOverrideReason, volumeReason, longRunOverrideReason, longRunCapKm: allocation.longRunCapKm, volumeDebtSuppressed: allocation.shortfall > .5, generatedFromDate: fromDate, trigger, preferredQualityDays: cfg.constraints.qualityDays, preferredLongRunDay: cfg.constraints.longRunDay };
  for (const row of [...fixed.filter(row => row.localDate >= fromDate), ...future]) { row.plannedLoad = { ...(row.plannedLoad || {}), integrity }; if (trigger === 'training_preferences_changed') delete row.plannedLoad.manualMove; }
  return [...fixed, ...future].sort((a, b) => a.localDate.localeCompare(b.localDate) || a.slotIndex - b.slotIndex);
}

export function reflowFuturePlan(rows = [], rawConfig = {}, fromDate = new Date().toISOString().slice(0, 10), trigger = 'plan_adjustment') {
  const cfg = normalizeConfig(rawConfig),source=applySecondaryRaces(rows,cfg,fromDate),groups = weekGroups(source), protectedRaceDates=source.filter(row=>row.workoutType==='race'&&row.localDate>=fromDate).map(row=>row.localDate),out = [];
  for (const [week, items] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const priorHardDates = [...out.filter(row => countsVolume(row) && isHard(row)).map(row => row.localDate),...protectedRaceDates.filter(date=>weekKey(date)!==week)];
    out.push(...(items.some(row => row.localDate >= fromDate) ? reflowWeek(items, cfg, week, fromDate, trigger, priorHardDates) : items));
  }
  const result = out.sort((a, b) => a.localDate.localeCompare(b.localDate) || a.slotIndex - b.slotIndex), validation = validatePlan(result, cfg, { fromDate });
  return { rows: result, validation, config: cfg, targetWeeklyVolume: cfg.profile.targetWeeklyVolume, generatedAt: new Date().toISOString(), generatedFromDate: fromDate, trigger };
}
export function constrainExisting(rows = [], rawConfig = {}, fromDate = new Date().toISOString().slice(0, 10)) { return reflowFuturePlan(rows, rawConfig, fromDate, 'plan_adjustment'); }
export function generateGoalPlan(rawConfig = {}, fromDate = new Date().toISOString().slice(0, 10)) {
  const cfg = normalizeConfig(rawConfig), goalDate = cfg.goal.date && cfg.goal.date >= fromDate ? cfg.goal.date : addDays(fromDate, 55), rows = [];
  let cursor = monday(fromDate), week = 0;
  while (cursor <= goalDate && week < 24) { for (const day of cfg.constraints.runDays) { const date = addDays(cursor, day); if (date < fromDate || date > goalDate) continue; rows.push(template('easy', date, 0, day, cursor)); } cursor = addDays(cursor, 7); week++; }
  if (cfg.goal.mode === 'race' && cfg.goal.date) {
    for (let index = rows.length - 1; index >= 0; index--) if (rows[index].localDate === cfg.goal.date) rows.splice(index, 1);
    rows.push({ ...template('quality', cfg.goal.date, raceKm(cfg.goal.distance), 99, weekKey(cfg.goal.date)), workoutType: 'race', title: cfg.goal.name || 'Hovedmål', intent: 'race', plannedDistanceM: raceKm(cfg.goal.distance) * 1000, lockLevel: 'system' });
  }
  const reflowed = reflowFuturePlan(rows, cfg, fromDate, 'goal_changed'); return { ...reflowed, goalDate };
}
export function previewPlan({ currentItems = [], historicalItems = null, config = {}, fromDate = '', goalChanged = false, trigger = 'plan_adjustment' } = {}) {
  const start = dateOnly(fromDate) || new Date().toISOString().slice(0, 10), authoritativeHistory = (historicalItems || currentItems).map(clone).filter(row => row.localDate < start), future = currentItems.map(clone).filter(row => row.localDate >= start), generated = goalChanged ? generateGoalPlan(config, start) : reflowFuturePlan(future, config, start, trigger), occupied = new Set(authoritativeHistory.map(row => `${row.localDate}:${row.slotIndex}`)), combined = [...authoritativeHistory, ...generated.rows.filter(row => !occupied.has(`${row.localDate}:${row.slotIndex}`))], result = reflowFuturePlan(combined, config, start, trigger);
  if (!historicalRowsUnchanged(authoritativeHistory, result.rows, start)) result.validation = { valid: false, issues: [...(result.validation?.issues || []), { code: 'HISTORY_MUTATION_REJECTED' }] };
  return { ...result, goalDate: generated.goalDate || '' };
}
