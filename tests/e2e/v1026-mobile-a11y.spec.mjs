import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=file=>fs.readFileSync(new URL(`../../${file}`,import.meta.url),'utf8');
test('mobile viewport and safe area remain part of the locked shell',()=>{const html=read('index.html'),css=read('runnerbear-v1026.css');assert.match(html,/width=device-width/);assert.match(css,/safe-area-inset-bottom/);assert.match(css,/@media\(max-width:430px\)/)});
test('new feedback controls have keyboard focus and 44px targets',()=>{const css=read('runnerbear-v1026-coach-loop.css'),ui=read('runnerbear-ui-v1026-source.js');assert.match(css,/min-height:44px/);assert.match(css,/focus-visible/);assert.match(ui,/<fieldset><legend>/)});
test('dialogs retain modal semantics, labels and Escape handling',()=>{const ui=read('runnerbear-ui-v1026-source.js');assert.match(ui,/role='dialog' aria-modal='true'/);assert.match(ui,/e\.key!=='Escape'/);assert.match(ui,/aria-label/)});
test('reduced motion is explicitly respected',()=>{assert.match(read('runnerbear-v1026-coach-loop.css'),/prefers-reduced-motion:reduce/)});
