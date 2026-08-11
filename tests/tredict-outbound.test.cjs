const test=require('node:test');
const assert=require('node:assert/strict');
const compiler=require('../runnerbear-tredict-outbound.js');

const sixBySix={
  externalId:'runnerbear-2026-08-11-6x6',date:'2026-08-11',type:'quality',title:'6 × 6 min subterskel',km:13,
  desc:'60 s rolig jogg.',detail:'Start 4:10–4:12/km og jobb kontrollert mot 4:03–4:05/km.',purpose:'Kontrollert terskel.',target:'4:03–4:05/km'
};

test('6 × 6 becomes open warmup, repeat block and open cooldown',()=>{
  const out=compiler.workout(sixBySix),steps=out.structuredWorkout.steps;
  assert.equal(steps[0].durationType,'open');
  assert.equal(steps[0].intensityType,'warmup');
  assert.equal(steps[1].repetitions,6);
  assert.equal(steps[1].steps[0].duration,360);
  assert.equal(steps[1].steps[0].targets.pace.value,244);
  assert.equal(steps[1].steps[1].duration,60);
  assert.equal(steps.at(-1).durationType,'open');
  assert.equal(steps.at(-1).intensityType,'cooldown');
});

test('3 × 10 × 45/15 keeps series recovery without nested repeats',()=>{
  const out=compiler.workout({...sixBySix,externalId:'runnerbear-series',date:'2026-08-21',title:'3 × 10 × 45/15',desc:'2 min rolig mellom seriene.'});
  const middle=out.structuredWorkout.steps.slice(1,-1);
  assert.equal(middle.length,5);
  assert.deepEqual(middle.filter(x=>x.repetitions).map(x=>x.repetitions),[10,10,10]);
  assert.deepEqual(middle.filter(x=>!x.repetitions).map(x=>x.duration),[120,120]);
  assert.equal(middle[0].steps[0].duration,45);
  assert.equal(middle[0].steps[1].duration,15);
});

test('easy runs stay flexible and strides are explicit',()=>{
  const easy=compiler.workout({externalId:'runnerbear-easy',date:'2026-08-13',type:'easy',title:'7 km + 6 strides',km:7,desc:'Rolig + 6 × 15 s lett raske.'});
  const steps=easy.structuredWorkout.steps;
  assert.equal(steps[0].durationType,'open');
  assert.equal(steps[1].repetitions,6);
  assert.equal(steps[1].steps[0].duration,15);
  assert.equal(steps[1].steps[1].duration,60);
});

test('plan uses relative days and a stable content signature',()=>{
  const queue=[sixBySix,{externalId:'runnerbear-easy',date:'2026-08-13',type:'easy',title:'7 km rolig',km:7,desc:'Restitusjon.'}];
  const out=compiler.plan(queue);
  assert.deepEqual(out.payload.planTrainings.map(x=>x.day),[1,3]);
  assert.equal(out.source.startDate,'2026-08-11');
  assert.equal(out.source.endDate,'2026-08-13');
  assert.match(out.payload.planTrainings[0].structuredWorkout.notes,/\[RB:runnerbear-2026-08-11-6x6\]/);
  assert.equal(compiler.signature(queue),compiler.signature(queue));
  assert.notEqual(compiler.signature(queue),compiler.signature(queue.map((x,i)=>i?{...x,date:'2026-08-14'}:x)));
});
