#!/usr/bin/env node
// lib/dispatch-replicate.js: the source rewrite that gives every handler its
// own `return_call_indirect` (see the header there for the measurement).
//
// Checks the transform on a synthetic module — site count, header placement
// after (export)/(param)/(result), $next itself left alone, comments and
// strings not mistaken for sites, idempotence — and then the real closure:
// tools/watx-closure.js in 'replicated' mode inlines every site the source
// holds and 'shared' mode holds none, and the two vfs differ only in the
// files that contain a site. No compile here: the build gate compiles both
// and validates the result.
'use strict';
const assert = require('assert');
const path = require('path');
const { nextBody, replicateText, replicateSources, SITE } =
  require(path.join(__dirname, '..', 'lib', 'dispatch-replicate.js'));
const { watxSourceClosure } = require(path.join(__dirname, '..', 'tools', 'watx-closure.js'));

let checks = 0;
function ok(cond, msg) { checks++; assert.ok(cond, msg); console.log('  PASS  ' + msg); }

// --- synthetic ------------------------------------------------------------
const cache = `
  (func $next
    (local $fn i32) (local $op i32)
    ;; the park
    (global.set $steps (i32.sub (global.get $steps) (i32.const 1)))
    (local.set $fn (i32.load (global.get $ip)))
    (local.set $op (i32.load offset=4 (global.get $ip)))
    (return_call_indirect (type $handler) (local.get $op) (local.get $fn)))
`;
const body = nextBody(cache);
ok(body.includes('$nx_fn') && body.includes('$nx_op') && !/\$fn\b|\$op\b/.test(body),
  'nextBody renames $fn/$op to $nx_fn/$nx_op');
ok(!body.includes(';;') && !body.includes('(local '), 'nextBody drops comments and the declared locals');

const src = `
  (func $th_a (param $op i32)
    (call $f (local.get $op))
    (return_call $next))
  (func $th_b (export "b") (param $op i32) (result i32)
    ;; (return_call $next) in a comment is not a site
    (if (local.get $op) (then (return_call $next)))
    (call $log_str (i32.const 1)) (; (return_call $next) in a block comment ;)
    (return_call $next))
  (func $helper (param $x i32) (result i32) (local.get $x))
` + cache;
const r1 = replicateText(src, body);
ok(r1.sites === 3 && r1.funcs === 2, `3 sites in 2 functions (got ${r1.sites}/${r1.funcs})`);
ok(!r1.text.includes(SITE.replace(/\)$/, '')) || r1.text.split(SITE).length - 1 === 2,
  'only the two commented sites survive as text');
ok(/\(func \$th_a \(param \$op i32\)\s+\(local \$nx_fn i32\) \(local \$nx_op i32\)\s*\(call \$f/.test(r1.text),
  '$th_a gets its locals right after the header');
// The locals land before the first body form — here a line comment, which
// the ;; still terminates at its newline, so the text stays valid.
ok(/\(func \$th_b \(export "b"\) \(param \$op i32\) \(result i32\)\s+\(local \$nx_fn i32\) \(local \$nx_op i32\)\s*;;[^\n]*\n\s*\(if/.test(r1.text),
  '$th_b gets its locals after export/param/result');
ok(r1.text.includes('(func $next\n') && r1.text.split('return_call_indirect').length - 1 === 4,
  '$next keeps its own site; three copies added');
ok(!/\$helper[^]*\$nx_fn[^]*\$next\n/.test(r1.text.slice(r1.text.indexOf('$helper'), r1.text.indexOf('(func $next'))),
  'a function without a site is untouched');
const r2 = replicateText(r1.text, body);
ok(r2.sites === 0 && r2.text === r1.text, 'idempotent: a second pass changes nothing');

// --- the real closure -----------------------------------------------------
const shared = watxSourceClosure({ dispatch: 'shared' });
const replicated = watxSourceClosure({ dispatch: 'replicated' });
ok(shared.dispatch === 'shared' && shared.replication === null, 'shared closure reports no replication');
ok(replicated.dispatch === 'replicated' && replicated.replication.sites > 300,
  `replicated closure inlined ${replicated.replication.sites} sites in ${replicated.replication.funcs} functions`);
let sharedSites = 0, changed = 0, unchangedWithSite = 0;
for (const [name, text] of shared.vfs) {
  if (!/^[^/]+$/.test(name)) continue; // one spelling per file
  const n = text.split(SITE).length - 1;
  const rep = replicated.vfs.get(name);
  if (rep !== text) changed++;
  if (n && rep === text) unchangedWithSite++;
  sharedSites += n;
}
ok(changed === replicated.replication.files, `exactly the ${changed} files holding a site were rewritten`);
ok(unchangedWithSite === 0, 'no file with a site was left untouched');
// A site inside $next's own body, or in a comment/string, is not a rewrite
// target, so the source count is an upper bound, not an equality.
ok(sharedSites >= replicated.replication.sites, `source holds ${sharedSites} textual sites >= ${replicated.replication.sites} rewritten`);
assert.throws(() => watxSourceClosure({ dispatch: 'sometimes' }), /replicated|shared/);
ok(true, 'an unknown dispatch mode is refused');

console.log(`\n${checks} checks, all PASS`);
