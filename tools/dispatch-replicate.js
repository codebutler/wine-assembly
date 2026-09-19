#!/usr/bin/env node
// Dispatch replication: give every handler its own indirect-branch site.
//
//   node tools/dispatch-replicate.js [--root=DIR] [--dry]
//
// Every handler ends in `(return_call $next)`, so the whole interpreter has
// ONE `return_call_indirect` and the branch predictor has to guess the next
// handler from that one site's history -- the switch-loop shape, despite
// the code being threaded. This rewrites each `(return_call $next)` inside a
// function into an inline copy of $next's body, so each handler ends in its
// own `return_call_indirect` and the predictor keys per handler ("after
// this MOV comes an ADD"). V8's inliner does the same thing when given
// --wasm-inlining-min-budget=600 (8-13% on Heroes II), which a browser
// cannot be asked for; this does it at build time instead.
//
// The body is taken from $next itself (the table bound, the hist hook, the
// $steps park) so the copies cannot drift from it; $next stays for the
// non-tail callers. Locals $nx_fn/$nx_op are added to each rewritten
//
// Measured 2026-09-19 on the quiet Ryzen 9 9950X box (tools/gameplay-ab-flags.js,
// StarCraft gameplay window, lo route mode, 3 reps, perf stat counters):
//   landed  51.24s  branches 176.6G  instr 952G  miss 0.24%  ipc 3.43
//   null    50.66s  branches 176.2G  instr 950G  miss 0.24%  ipc 3.44
//   replic  48.75s  branches 161.7G  instr 892G  miss 0.26%  ipc 3.37
//   -4.86% CPU against a 1.13% null band.  NOT a prediction win: the shared
//   site already missed 0.24%, and the rate went up slightly.  The saving is
//   8% fewer branches and 6% fewer instructions per dispatch -- the call into
//   $next, its frame setup and stack check are gone.  +32 KB of wasm.
// Not a build step yet; the build compiles the untransformed source.
// function. Source-rewriting, idempotent, paren-aware, comment-safe.
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const root = (argv.find(a => a.startsWith('--root=')) || '').slice(7) || path.join(__dirname, '..');
const dry = argv.includes('--dry');
const { WAT_FILES } = require(path.join(root, 'lib', 'wat-manifest'));
const SRC = path.join(root, 'src');

// Walk s-expression text, calling cb(kind, i) for '(' and ')' outside comments/strings.
function scan(s, cb) {
  let i = 0; const n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === ';' && s[i + 1] === ';') { while (i < n && s[i] !== '\n') i++; continue; }
    if (c === '(' && s[i + 1] === ';') { let d = 1; i += 2; while (i < n && d) { if (s[i] === '(' && s[i + 1] === ';') { d++; i += 2; } else if (s[i] === ';' && s[i + 1] === ')') { d--; i += 2; } else i++; } continue; }
    if (c === '"') { i++; while (i < n && s[i] !== '"') { if (s[i] === '\\') i++; i++; } i++; continue; }
    if (c === '(' || c === ')') { if (cb(c, i) === false) return; }
    i++;
  }
}

// Extract $next's dispatch body: everything after the header, minus the
// declared locals, with $fn/$op renamed to $nx_fn/$nx_op.
function nextBody(cacheSrc) {
  const start = cacheSrc.indexOf('(func $next\n');
  if (start < 0) throw new Error('$next not found');
  let end = -1, depth = 0;
  scan(cacheSrc.slice(start), (k, i) => { depth += k === '(' ? 1 : -1; if (depth === 0) { end = start + i; return false; } });
  let body = cacheSrc.slice(start + '(func $next\n'.length, end);
  body = body.replace(/;;[^\n]*/g, '');
  body = body.replace(/\(local \$fn i32\)\s*\(local \$op i32\)/, '');
  body = body.replace(/\$fn\b/g, '$nx_fn').replace(/\$op\b/g, '$nx_op');
  body = body.replace(/\s+/g, ' ').trim();
  if (!body.includes('return_call_indirect')) throw new Error('unexpected $next body');
  return body;
}

const body = nextBody(fs.readFileSync(path.join(SRC, '04-cache.wat'), 'utf8'));
const SITE = '(return_call $next)';
let funcs = 0, sites = 0;
for (const f of WAT_FILES) {
  const p = path.join(SRC, f);
  const s = fs.readFileSync(p, 'utf8');
  if (!s.includes(SITE)) continue;
  // Function extents at module level (depth 0 in a fragment, 1 under (module).
  const fns = []; let depth = 0; let cur = null;
  scan(s, (k, i) => {
    if (k === '(') {
      depth++;
      if (depth <= 2 && s.startsWith('(func ', i) && !cur) {
        const m = /^\(func\s+(\$[^\s()]+)/.exec(s.slice(i, i + 200));
        if (m) cur = { start: i, name: m[1], depth };
      }
    } else {
      if (cur && depth === cur.depth) { cur.end = i + 1; fns.push(cur); cur = null; }
      depth--;
    }
  });
  const edits = [];
  for (const fn of fns) {
    if (fn.name === '$next') continue;
    const text = s.slice(fn.start, fn.end);
    // Sites: exact token, outside comments.
    const local = [];
    let j = 0; scan(text, (k, i) => { if (k === '(' && text.startsWith(SITE, i)) local.push(fn.start + i); });
    if (!local.length) continue;
    // Header end: after the name and any (export ..)/(param ..)/(result ..) groups.
    let pos = fn.start + ('(func ' + fn.name).length + 1;
    for (;;) {
      const rest = s.slice(pos);
      const ws = /^\s*/.exec(rest)[0].length; pos += ws;
      if (/^\((export|param|result|type) /.test(s.slice(pos))) { let d = 0; let q = pos; for (;;) { if (s[q] === '(') d++; else if (s[q] === ')') { d--; if (!d) break; } q++; } pos = q + 1; continue; }
      break;
    }
    if (!text.includes('(local $nx_fn i32)')) edits.push({ at: pos, ins: ' (local $nx_fn i32) (local $nx_op i32)' });
    for (const at of local) edits.push({ at, del: SITE.length, ins: body });
    funcs++; sites += local.length;
  }
  if (!edits.length) continue;
  edits.sort((a, b) => (b.at - a.at) || ((b.del || 0) - (a.del || 0))); // same offset: site replace first, then the locals go in front of it
  let out = s;
  for (const e of edits) out = out.slice(0, e.at) + e.ins + out.slice(e.at + (e.del || 0));
  if (!dry) fs.writeFileSync(p, out);
}
console.log(`dispatch-replicate: ${sites} site(s) in ${funcs} function(s)${dry ? ' (dry)' : ''}`);
