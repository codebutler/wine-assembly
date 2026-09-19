// Dispatch replication: give every handler its own indirect-branch site.
//
// Every handler ends in `(return_call $next)`, so the whole interpreter has
// ONE `return_call_indirect`: every dispatch pays a call into $next, its
// frame setup and its stack-limit check before the indirect branch. This
// rewrites each `(return_call $next)` inside a function into an inline copy
// of $next's body, so each handler ends in its own `return_call_indirect`.
// V8's inliner does the same thing when given --wasm-inlining-min-budget=600
// (8-13% on Heroes II), which a browser cannot be asked for; this does it in
// the source, before the compiler sees it.
//
// The body is taken from $next itself (the table bound, the hist hook, the
// $steps park) so the copies cannot drift from it; $next stays for the
// non-tail callers ($run's resume path). Locals $nx_fn/$nx_op are added to
// each rewritten function. Idempotent, paren-aware, comment-safe. It runs
// on the closure text in memory: src/ on disk is never rewritten, so grep,
// combined.wat and the census gates see the one-site source, and the
// compiled bytes carry the copies.
//
// Measured 2026-09-19 on the quiet Ryzen 9 9950X box (tools/gameplay-ab-flags.js,
// StarCraft gameplay window, lo route mode, 3 reps, perf stat counters):
//   shared      51.24s  branches 176.6G  instr 952G  miss 0.24%  ipc 3.43
//   null        50.66s  branches 176.2G  instr 950G  miss 0.24%  ipc 3.44
//   replicated  48.75s  branches 161.7G  instr 892G  miss 0.26%  ipc 3.37
// -4.86% CPU against a 1.13% null band. NOT a prediction win: the shared
// site already missed 0.24%, and the rate went up slightly. The saving is
// 8% fewer branches and 6% fewer instructions per dispatch -- the call into
// $next, its frame setup and stack check are gone. +32 KB of wasm. The
// earlier legacy-compiler experiment (docs/repl-tailcall-main-emu.md,
// 9450d792) saw 1.08-1.11x on a loaded box and was retired with that
// compiler; this is its source-level replacement with the clean number.
//
// Off switch, for an A/B against the shared-site build:
//   WINE_DISPATCH=shared bash tools/build.sh
//   node tools/build-compile-wat.js --dispatch=shared
//
// UMD: `require('./dispatch-replicate.js')` in node, `window.DispatchReplicate`
// in the browser (index.html loads it before lib/watx-launcher.js).
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.DispatchReplicate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SITE = '(return_call $next)';
  const BODY_FILE = '04-cache.wat';

  // Walk s-expression text, calling cb(kind, i) for '(' and ')' outside
  // comments and strings. cb may return false to stop.
  function scan(s, cb) {
    let i = 0; const n = s.length;
    while (i < n) {
      const c = s[i];
      if (c === ';' && s[i + 1] === ';') { while (i < n && s[i] !== '\n') i++; continue; }
      if (c === '(' && s[i + 1] === ';') {
        let d = 1; i += 2;
        while (i < n && d) {
          if (s[i] === '(' && s[i + 1] === ';') { d++; i += 2; }
          else if (s[i] === ';' && s[i + 1] === ')') { d--; i += 2; }
          else i++;
        }
        continue;
      }
      if (c === '"') { i++; while (i < n && s[i] !== '"') { if (s[i] === '\\') i++; i++; } i++; continue; }
      if (c === '(' || c === ')') { if (cb(c, i) === false) return; }
      i++;
    }
  }

  // Extract $next's dispatch body: everything after the header, minus the
  // declared locals, with $fn/$op renamed to $nx_fn/$nx_op.
  function nextBody(cacheSrc) {
    const start = cacheSrc.indexOf('(func $next\n');
    if (start < 0) throw new Error('dispatch-replicate: $next not found in ' + BODY_FILE);
    let end = -1, depth = 0;
    scan(cacheSrc.slice(start), (k, i) => {
      depth += k === '(' ? 1 : -1;
      if (depth === 0) { end = start + i; return false; }
    });
    if (end < 0) throw new Error('dispatch-replicate: $next is unterminated');
    let body = cacheSrc.slice(start + '(func $next\n'.length, end);
    body = body.replace(/;;[^\n]*/g, '');
    body = body.replace(/\(local \$fn i32\)\s*\(local \$op i32\)/, '');
    body = body.replace(/\$fn\b/g, '$nx_fn').replace(/\$op\b/g, '$nx_op');
    body = body.replace(/\s+/g, ' ').trim();
    if (!body.includes('return_call_indirect')) throw new Error('dispatch-replicate: unexpected $next body');
    return body;
  }

  // Rewrite one source text. Returns { text, sites, funcs }; text is the
  // input object when nothing changed.
  function replicateText(s, body) {
    if (!s.includes(SITE)) return { text: s, sites: 0, funcs: 0 };
    // Function extents at module level (depth 1 in a fragment, 2 under (module)).
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
    let funcs = 0, sites = 0;
    for (const fn of fns) {
      if (fn.name === '$next') continue;
      const text = s.slice(fn.start, fn.end);
      const local = [];
      scan(text, (k, i) => { if (k === '(' && text.startsWith(SITE, i)) local.push(fn.start + i); });
      if (!local.length) continue;
      // Header end: after the name and any (export ..)/(param ..)/(result ..)/(type ..) groups.
      let pos = fn.start + ('(func ' + fn.name).length + 1;
      for (;;) {
        const ws = /^\s*/.exec(s.slice(pos))[0].length; pos += ws;
        if (/^\((export|param|result|type) /.test(s.slice(pos))) {
          let d = 0; let q = pos;
          for (;;) { if (s[q] === '(') d++; else if (s[q] === ')') { d--; if (!d) break; } q++; }
          pos = q + 1; continue;
        }
        break;
      }
      if (!text.includes('(local $nx_fn i32)')) edits.push({ at: pos, ins: ' (local $nx_fn i32) (local $nx_op i32)' });
      for (const at of local) edits.push({ at, del: SITE.length, ins: body });
      funcs++; sites += local.length;
    }
    if (!edits.length) return { text: s, sites: 0, funcs: 0 };
    // Same offset: the site replace applies first, then the locals go in front of it.
    edits.sort((a, b) => (b.at - a.at) || ((b.del || 0) - (a.del || 0)));
    let out = s;
    for (const e of edits) out = out.slice(0, e.at) + e.ins + out.slice(e.at + (e.del || 0));
    return { text: out, sites, funcs };
  }

  // Rewrite a whole closure. `getText(name)` / `setText(name, text)` over
  // `names` (the manifest order); the body comes from BODY_FILE, which must
  // be among them. Returns { sites, funcs, files }.
  function replicateSources(names, getText, setText) {
    if (!names.includes(BODY_FILE)) throw new Error('dispatch-replicate: ' + BODY_FILE + ' is not in the closure');
    const body = nextBody(getText(BODY_FILE));
    let sites = 0, funcs = 0, files = 0;
    for (const name of names) {
      const r = replicateText(getText(name), body);
      if (!r.sites) continue;
      setText(name, r.text);
      sites += r.sites; funcs += r.funcs; files++;
    }
    return { sites, funcs, files };
  }

  return { SITE, BODY_FILE, scan, nextBody, replicateText, replicateSources };
});
