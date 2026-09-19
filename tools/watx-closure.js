#!/usr/bin/env node
'use strict';

// The WATX source closure, in one place.
//
// Two callers need to compile the Wine tree with the vendored WATX compiler and
// they must not drift apart: tools/watx-matrix.js (the Milestone 3 differential
// gate, which compares WATX artifacts against legacy ones) and
// tools/build-compile-wat.js (the Milestone 5 canonical build under
// WINE_WAT_COMPILER=watx). If the two ever built a *different* closure, the
// matrix would be certifying bytes the build does not ship — the exact failure
// mode the whole differential gate exists to prevent. So the closure lives here
// and both require it.
//
// The WATX compiler takes one source string plus a VFS the (include ...) forms
// resolve against. src/main.watx is THE entry point and there is no fallback:
// the synthesized-from-WAT_FILES branch that used to live here is gone, because
// WAT_FILES is itself now a parse of main.watx (lib/wat-manifest.js). A tree
// without that file has no source order at all, from any direction, so absence
// is a hard error rather than a quiet reconstruction.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// Sources are read as BYTES and decoded through the compiler's own boundary,
// never with `fs.readFileSync(..., 'utf8')`. The two differ by 9.7 MB of live
// heap on this closure — see `watxSourceTextFromBytes` in
// tools/watx-src/compiler-parser.js for why one non-ASCII character in a banner
// comment doubles a whole file's cost.
function readSourceText(file) {
  const { sourceTextFromBytes } = require(path.join(__dirname, 'watx.js'));
  return sourceTextFromBytes(fs.readFileSync(file));
}

// The dispatch mode of a closure: 'replicated' (the canonical build, see
// lib/dispatch-replicate.js) or 'shared' (one $next site, the A/B baseline).
// Resolved from the caller's option, then WINE_DISPATCH, then the default.
function dispatchMode(option) {
  const raw = option != null ? option : (process.env.WINE_DISPATCH || 'replicated');
  const value = String(raw).trim();
  if (value === 'replicated' || value === 'all' || value === '1' || value === 'true') return 'replicated';
  if (value === 'shared' || value === 'none' || value === '0' || value === 'false') return 'shared';
  throw new Error(`watx-closure: dispatch must be "replicated" or "shared" (got ${JSON.stringify(raw)})`);
}

function watxSourceClosure(options = {}) {
  const mainFile = path.join(SRC, 'main.watx');
  if (!fs.existsSync(mainFile)) {
    throw new Error('watx-closure: src/main.watx is missing. It is the root of the ' +
      '(include ...) closure — the build has no source order without it.');
  }
  // Every src file goes into the vfs under all three spellings an (include ...)
  // may use ('f', 'src/f', './f'); main.watx's own forms name the bare basename.
  // Only the includes actually reached are parsed, so listing a file here does
  // not put it in the module — main.watx does.
  const texts = new Map();
  for (const f of fs.readdirSync(SRC)) {
    if (!/\.(wat|watx)$/.test(f)) continue;
    texts.set(f, readSourceText(path.join(SRC, f)));
  }
  // Dispatch replication rewrites the closure text HERE, in memory, so src/
  // on disk stays the one-site source every grep and census gate reads and
  // the compiled bytes carry the per-handler copies. Same transform as the
  // browser's source-compile path (lib/watx-launcher.js fetchSources), so
  // the two produce the same module.
  const dispatch = dispatchMode(options.dispatch);
  let replication = null;
  if (dispatch === 'replicated') {
    const { WAT_FILES } = require(path.join(ROOT, 'lib', 'wat-manifest.js'));
    const { replicateSources } = require(path.join(ROOT, 'lib', 'dispatch-replicate.js'));
    replication = replicateSources(WAT_FILES, name => texts.get(name), (name, text) => texts.set(name, text));
  }
  const vfs = new Map();
  for (const [f, text] of texts) {
    vfs.set(f, text);
    vfs.set(`src/${f}`, text);
    vfs.set(`./${f}`, text);
  }
  return { source: readSourceText(mainFile), vfs, entry: 'src/main.watx', dispatch, replication };
}

// The compile options are part of the closure contract, not a caller's choice:
// `production` + `standardWat` + no runtime builtins is what Milestone 3
// certified, so the build and the gate must pass exactly these. Only the
// tail-call mode varies, and only because the two shipped artifacts differ in
// precisely that.
// `regionShake` is the one exception to "the caller does not choose": it is a
// deliberate NON-canonical build (docs/watx-region-safety-design.md §8) whose
// whole purpose is to move the memory map and see what breaks, and it reaches
// the region allocator and nothing else. Absent, it is not passed at all.
function compileClosure(closure, { tailCalls, regionShake, nameSection } = {}) {
  const { compile } = require(path.join(__dirname, 'watx.js'));
  const options = {
    mode: 'production',
    standardWat: true,
    runtimeBuiltins: false,
    tailCalls: !!tailCalls,
    // A duplicate `(func $name …)` is a SILENT miscompile, not a redefinition.
    // The compiler builds two maps from the declarations: `funcDeclByName`, used
    // to type-check a call, is first-wins, and `funcIndexMap`, used to emit the
    // call's target index, is last-wins. So a second body under the same name
    // with a different signature type-checks against the FIRST one and then
    // calls the SECOND — no error anywhere, and a wrong function at runtime.
    // The compiler has guarded this since it was written, behind
    // `strictDeclarations`, and until now nothing but tools/watx-rejection-
    // pairs.js ever passed it: every shipped build had the guard switched off.
    // It is set here rather than in the compiler because this is the contract
    // for OUR closure, and turning it on inside tools/watx-src/ would be a
    // vendored-compiler change requiring a re-seal to say "the tree has no
    // duplicates today" — which is a property of the tree, not of the compiler.
    strictDeclarations: true,
  };
  if (regionShake) options.regionShake = regionShake;
  // Only ever set when explicitly asked for. A name section changes the emitted
  // bytes, and byte-identity against the canonical artifact is the instrument
  // every compiler change here is proved with.
  if (nameSection) options.nameSection = nameSection;
  return compile(closure.source, closure.vfs, options);
}

module.exports = { watxSourceClosure, compileClosure, dispatchMode };
