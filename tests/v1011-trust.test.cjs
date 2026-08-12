const test=require('node:test');
const assert=require('node:assert/strict');
const {syncHealth,evidenceConfidence,thresholdSummary,publicationState}=require('../runnerbear-v1011-trust.js');

test('sync health distinguishes fresh, aging, stale and error states',()=>{
  const now=Date.parse('2026-08-12T10:00:00Z');
  assert.equal(syncHealth({now,syncedAt:now-60_000}).code,'fresh');
  assert.equal(syncHealth({now,syncedAt:now-7*3600_000}).code,'aging');
  assert.equal(syncHealth({now,syncedAt:now-25*3600_000}).code,'stale');
  assert.equal(syncHealth({now,syncedAt:now-60_000,error:'boom'}).code,'error');
});

test('race forecast stays limited before three relevant datapoints',()=>{
  assert.equal(evidenceConfidence({evidence:2,history:2,distance:'half',longKm:16,anchorKm:50}).code,'limited');
  assert.equal(evidenceConfidence({evidence:3,history:2,distance:'half',longKm:16,anchorKm:50}).code,'adequate');
  assert.equal(evidenceConfidence({evidence:4,history:2,distance:'half',longKm:16,anchorKm:50}).code,'solid');
});

test('threshold trend requires at least three comparable sessions',()=>{
  assert.equal(thresholdSummary([{pace:245,hr:171},{pace:242,hr:172}]).code,'building');
  assert.equal(thresholdSummary([{pace:245,hr:171},{pace:243,hr:172},{pace:240,hr:172}]).code,'positive');
  assert.equal(thresholdSummary([{pace:242,hr:171},{pace:241,hr:172},{pace:242,hr:171}]).code,'stable');
  assert.equal(thresholdSummary([{pace:245,hr:171,family:'6x6'},{pace:242,hr:172,family:'5x8'},{pace:240,hr:172,family:'4x10'}]).code,'building');
});

test('publication status detects active current plan and changed plan',()=>{
  assert.equal(publicationState({outbound:{status:'calendar-active',planId:'p1',clientSignature:'abc',calendarCount:8},signature:'abc',queueLength:8}).code,'active');
  assert.equal(publicationState({outbound:{status:'published',planId:'p1',clientSignature:'old'},signature:'new',queueLength:8}).code,'changed');
});
