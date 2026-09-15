#!/usr/bin/env node

'use strict';

// The FPS HUD lives inside the same page as the guest screen, and index.html
// styles every bare <canvas> as the full-bleed screen surface -- in several
// fullscreen states with `height: 0 !important`, which is a canvas that draws
// nothing. The HUD injects its own rule to opt out of that.
//
// A rule that loses this fight fails SILENTLY: the HUD box is still there,
// still positioned, still painted by JS -- it is just 0px tall inside its own
// border, which reads as "the graph does not render" with nothing in the
// console. It already happened once. The HUD's opt-out enumerated the body
// states to beat, index.html grew `body:not(.no-debug).exclusive-fullscreen`,
// and the graph vanished on every app that asks for the screen (SimGolf) in
// the only session that can turn it on (?debug, which is what makes that
// `:not(.no-debug)` true).
//
// So this checks the cascade itself, statically: every rule in index.html
// that would style the HUD's canvas, against the HUD's own rule, by real CSS
// specificity. It is the enumeration-free property that matters -- the HUD
// must win without naming any body state.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const perfHud = fs.readFileSync(path.join(root, 'lib', 'perf-hud.js'), 'utf8');

// CSS specificity as (ids, classes, elements). :not()/:is() contribute their
// most specific argument, which is why `canvas:not(#touch-cursor)` counts an
// id -- the exact term that made the old guard lose.
function specificity(selector) {
  let s = selector.trim();
  let ids = 0, classes = 0, elements = 0;
  s = s.replace(/:(?:not|is|has)\(([^()]*)\)/g, (_, inner) => {
    const best = inner.split(',').map(specificity).sort(compare).pop();
    if (best) { ids += best[0]; classes += best[1]; elements += best[2]; }
    return ' ';
  });
  ids += (s.match(/#[\w-]+/g) || []).length;
  classes += (s.match(/\.[\w-]+/g) || []).length
    + (s.match(/\[[^\]]*\]/g) || []).length
    + (s.match(/:(?!:)[\w-]+/g) || []).length;
  elements += (s.match(/(?:^|[\s>+~(])([a-zA-Z][\w-]*)/g) || []).length
    + (s.match(/::[\w-]+/g) || []).length;
  return [ids, classes, elements];
}

const compare = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
const show = t => `(${t.join(',')})`;

// Sanity-check the calculator on the two selectors this test exists for,
// before trusting it about anything else.
assert.deepStrictEqual(
  specificity('body:not(.no-debug).exclusive-fullscreen canvas:not(#touch-cursor)'),
  [1, 2, 2], 'specificity(): :not() contributes its argument');
assert.deepStrictEqual(specificity('#perf-hud canvas'), [1, 0, 1],
  'specificity(): plain id + element');
assert.deepStrictEqual(specificity('#perf-hud#perf-hud canvas'), [2, 0, 1],
  'specificity(): a repeated id counts twice');

// What the HUD actually injects, read out of the source rather than restated,
// so editing the rule and not this test cannot pass.
const hudSelectors = [...perfHud.matchAll(/'(#perf-hud[^']*)'/g)].map(m => m[1]);
assert.ok(hudSelectors.length, 'perf-hud.js still injects an id-scoped rule');
const hudCanvas = hudSelectors.filter(s => /canvas/.test(s));
assert.ok(hudCanvas.length, 'perf-hud.js still guards its own canvas');

// Every selector in index.html's stylesheet that matches a bare canvas and so
// would also capture the HUD's. A rule naming #perf-hud would be deliberate
// and is excluded; #touch-cursor and #screen-canvas-stack name other elements
// the HUD's canvas is not.
// Comments come out FIRST: index.html's stylesheet is heavily commented, and
// prose sitting just above a rule is otherwise swept up as part of its
// selector (a 27-word "selector" at specificity (2,0,27) that outranks
// everything and means nothing).
const css = [...indexHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
  .map(m => m[1]).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const competing = [...css.matchAll(/(^|[}\n])([^{}@]+)\{/g)]
  .map(m => m[2])
  .join(',')
  .split(',')
  .map(s => s.trim())
  .filter(s => /(^|[\s>+~])canvas(?![\w-])/.test(s))
  .filter(s => !/#perf-hud|#touch-cursor(?![\w-])\s*\{?$/.test(s))
  .filter(s => !/#screen-canvas-stack/.test(s))
  .filter(s => !s.includes('#perf-hud'));

assert.ok(competing.length >= 2,
  `expected index.html to still style bare canvases, found ${competing.length}`);

// Only an UNCONDITIONAL guard counts. A state-gated one
// (`#screen-wrap:fullscreen #perf-hud canvas`, (2,1,1)) scores higher than the
// rule that has to carry every other state, so ranking by the best selector
// would have called the old, broken list healthy. Rank by the weakest-case
// rule that is always in force instead: no class, no pseudo-class, no id but
// the HUD's own.
const unconditional = hudCanvas.filter(s => !/[.:]|#(?!perf-hud\b)/.test(s));
assert.ok(unconditional.length,
  'perf-hud.js must guard its canvas with a rule that applies in every page'
  + ` state; found only state-gated ones: ${hudCanvas.join(' | ')}`);
const best = unconditional.map(specificity).sort(compare).pop();
let checked = 0;
for (const selector of competing) {
  const theirs = specificity(selector);
  assert.ok(compare(best, theirs) > 0,
    `the HUD canvas rule ${show(best)} does not outrank\n  ${selector}\n  ${show(theirs)}`
    + '\nAdd specificity to the HUD rule in lib/perf-hud.js -- repeat its id,'
    + ' do not enumerate another body state.');
  checked++;
}

// The regression itself, pinned so the reasoning above cannot rot: the guard
// this replaced really did lose to the rule index.html grew, and the state it
// lost in is the only state the HUD runs in. The FPS toggle lives in the
// ?debug toolbar, and ?debug is precisely what makes `:not(.no-debug)` true.
const offender = 'body:not(.no-debug).exclusive-fullscreen canvas:not(#touch-cursor)';
assert.ok(css.includes('.exclusive-fullscreen canvas:not(#touch-cursor)'),
  'index.html still has the full-bleed exclusive-fullscreen canvas rule');
assert.ok(compare(specificity('#perf-hud canvas'), specificity(offender)) < 0,
  'the historical single-id guard is supposed to LOSE to the offender; if this'
  + ' fails the calculator is wrong, not the shell');
assert.ok(compare(best, specificity(offender)) > 0,
  'the current guard must beat it');

console.log(`PASS  unconditional HUD canvas rule '${unconditional.join("','")}'`
  + ` ${show(best)} outranks all ${checked} bare-canvas rules in index.html`);
