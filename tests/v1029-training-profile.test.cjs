const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('automatic volume model derives a safe explained range from continuity',()=>{
  const model=require('../runnerbear-v1029-training-profile.js'),volume=model.automaticVolume({anchorKm:50,baseKm:44});
  assert.deepEqual(volume,{baseKm:50,normalLow:48,normalHigh:52,maxKm:55,targetWeeklyVolume:50,autoVolume:true,source:'history-continuity-goal'});
});

test('non-running weekdays become automatic recovery or alternative days',()=>{
  const model=require('../runnerbear-v1029-training-profile.js'),rhythm=model.rhythm({runDays:[1,2,3,4,6],qualityDays:[1,4],longRunDay:6});
  assert.deepEqual(rhythm.alternativeDays,[0,5]);assert.equal(rhythm.minRunDays,5);assert.equal(rhythm.flexibleSessions,2);
});

test('training profile exposes only the three athlete choices and explains automatic volume',()=>{
  const ui=fs.readFileSync('runnerbear-ui-v1027-source.js','utf8');
  const start=ui.indexOf('function trainingPreferencesHtml()'),end=ui.indexOf('async function saveTrainingPreferences',start),form=ui.slice(start,end);
  assert.match(form,/Vanlige løpedager/);assert.match(form,/Foretrukne kvalitetsdager/);assert.match(form,/Langturdag/);assert.match(form,/Volum styres automatisk/);assert.match(form,/Se hvordan volumet styres/);
  assert.doesNotMatch(form,/name="baseKm"|name="normalLow"|name="normalHigh"|name="maxKm"|name="alternativeDays"/);
});

test('saving rhythm requires two quality days and regenerates the canonical plan',()=>{
  const ui=fs.readFileSync('runnerbear-ui-v1027-source.js','utf8');
  assert.match(ui,/qualityDays\.length!==2/);assert.match(ui,/preferencesVersion:4/);assert.match(ui,/training_preferences_changed/);assert.match(ui,/confirm:false,force:true/);assert.match(ui,/alternativeDays=schedule\.alternativeDays/);
});
