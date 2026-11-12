#!/usr/bin/env node

'use strict';

// Put the toy VM in a <script> tag.
//
//   node tools/toyvm/bundle-browser.js --out=docs/dos-corpus/live
//
// The corpus report is a file on disk that people open by double-clicking it,
// and a Run button on a tile has to work there. That rules out almost every
// normal answer: `fetch` is refused for a file:// URL, ES module imports are
// refused for a file:// URL, and a Worker cannot be created from one either.
// What DOES work from a local file is a plain <script src> and a <script> the
// page appends later. So the whole VM ships as one such script.
//
// Nothing here transforms the sources. Each module goes in verbatim as a string
// and is evaluated on demand behind a CommonJS `require` small enough to read
// in one sitting -- the same files Node runs, so a fix to dos.js reaches the
// page by re-running this, and the page cannot drift into being a second
// implementation.
//
// Two host modules are faked. `fs` reads from a map of Uint8Arrays the caller
// mounts -- which is exactly the shape dos.js already wants, since a DOS
// program's whole filesystem here is the directory it was started from. `path`
// is join/basename/dirname over '/' and nothing else. Both are tiny because the
// VM's contact with the host is tiny: three fs calls and one path.join.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// The modules the page enters through. Everything they require is DISCOVERED
// from the sources rather than listed here -- a hand-written list is a second
// copy of the dependency graph, and it went stale exactly the way one does:
// emit.js grew a `require('./emit-decoder')` and the list did not, so the
// bundle threw `cannot resolve ./emit-decoder` at load with nothing in the
// build to say so.
//
// Only two entries can be roots. `live.js` is what the page calls, and
// `lib/compile-wat.js` is reached through `require(path.join(__dirname, ...))`,
// which is not a literal and so cannot be followed.
const ROOTS = [
  'tools/toyvm/live.js',
  'lib/compile-wat.js',
];

// TWO BUNDLES, AND THE SECOND ONE IS NOT IN THE FIRST. The region JIT's
// preparation half -- pick, audit, emit, compile -- runs in a Worker so the
// page's thread is never holding a ~2s compile (docs/toyvm-region-live.md), and
// a Worker gets its code through `importScripts`, so that half has to be a
// script of its own. Putting it in the page's bundle instead would work and
// would cost every visitor its bytes: it drags in region-jit.js, trace-jit.js
// and run-dos.js, which is a third again on top of a megabyte, for a feature
// that is OFF unless somebody asks for it. So it is built separately and
// fetched only by the worker the JIT starts.
//
// The overlap between the two files is most of the VM, because the audit builds
// a whole second emulator to run the interpreter arm against. That duplication
// is on disk, never in one process.
const JIT_ROOTS = [
  'tools/toyvm/region-prepare.js',
  'lib/compile-wat.js',
];

// A small lexical walk, not a source rewrite. Only direct calls with one string
// literal argument are followed. Trivia, quoted/template text and regexp bodies
// cannot introduce calls; template substitutions are executable and are walked.
function literalRequires(source, importer) {
  const tokens = [];
  let i = source.startsWith('#!') ? source.indexOf('\n') : 0;
  if (i < 0) return [];
  const fail = () => { throw new Error(`bundle: ${importer}: unsupported or unterminated JavaScript token at ${i}`); };
  const identifier = c => c !== undefined && /[\w$\u0080-\uffff]/.test(c);
  function quoted(quote) {
    let value = '';
    i++;
    while (i < source.length) {
      let c = source[i++];
      if (c === quote) return value;
      if (c === '\n' || c === '\r') fail();
      if (c !== '\\') { value += c; continue; }
      c = source[i++];
      if (c === '\n') continue;
      if (c === '\r') { if (source[i] === '\n') i++; continue; }
      const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v' };
      if (Object.hasOwn(escapes, c)) value += escapes[c];
      else if (c === 'x' || c === 'u') {
        let hex;
        if (c === 'u' && source[i] === '{') {
          const end = source.indexOf('}', ++i);
          if (end < 0) fail();
          hex = source.slice(i, end); i = end + 1;
        } else { const n = c === 'x' ? 2 : 4; hex = source.slice(i, i + n); i += n;
          if (hex.length !== n) fail(); }
        if (!/^[\da-f]+$/i.test(hex) || parseInt(hex, 16) > 0x10ffff) fail();
        value += String.fromCodePoint(parseInt(hex, 16));
      } else if (/[0-7]/.test(c)) {
        // Legacy octal is legal in non-strict CommonJS modules too.
        let octal = c;
        while (octal.length < (c <= '3' ? 3 : 2) && /[0-7]/.test(source[i] || 'x')) octal += source[i++];
        value += String.fromCharCode(parseInt(octal, 8));
      } else if (c !== undefined) value += c;
      else fail();
    }
    fail();
  }
  function regexp() {
    i++;
    let inClass = false;
    while (i < source.length) {
      const c = source[i++];
      if (c === '\n' || c === '\r') fail();
      if (c === '\\') { i++; continue; }
      if (c === '[') inClass = true;
      if (c === ']') inClass = false;
      if (c === '/' && !inClass) {
        while (identifier(source[i])) i++;
        return;
      }
    }
    fail();
  }
  function template() {
    i++;
    tokens.push({ value: '`' });
    while (i < source.length) {
      const c = source[i++];
      if (c === '\\') { i++; continue; }
      if (c === '`') { tokens.push({ value: '`' }); return; }
      if (c === '$' && source[i] === '{') {
        i++;
        tokens.push({ value: '${' });
        code(true);
        tokens.push({ value: '}' });
      }
    }
    fail();
  }
  function code(substitution = false) {
    let previous = '', expression = true, pendingFunction = null, functionBody = null, pendingClass = null;
    let statementStart = true, asyncOperand = false;
    const parens = [], braces = [];
    const control = new Set(['if', 'while', 'for', 'with', 'switch', 'catch']);
    const prefix = new Set(['return', 'throw', 'case', 'delete', 'void', 'typeof', 'new', 'in', 'of', 'instanceof', 'yield', 'await', 'else', 'do']);
    while (i < source.length) {
      const c = source[i], next = source[i + 1];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '/' && next === '/') {
        i += 2; while (i < source.length && !/[\n\r\u2028\u2029]/.test(source[i])) i++;
        continue;
      }
      if (c === '/' && next === '*') {
        const end = source.indexOf('*/', i + 2); if (end < 0) fail(); i = end + 2; continue;
      }
      if (c === '}' && !braces.length && substitution) { i++; return; }
      let value, kind;
      if (c === "'" || c === '"') { value = quoted(c); kind = 'string'; expression = false; }
      else if (c === '`') { template(); previous = '`'; expression = false; continue; }
      else if (c === '/' && expression) { if (expression === 'ambiguous') fail(); regexp(); value = '/regexp/'; expression = false; }
      else if (/[a-zA-Z_$\u0080-\uffff]/.test(c)) {
        const start = i++;
        while (identifier(source[i])) i++;
        value = source.slice(start, i); kind = 'identifier';
        const property = ['.', '?.'].includes(previous);
        if (value === 'function' && !property) pendingFunction = { expression: !statementStart && (expression || (previous === 'async' && asyncOperand)) };
        if (value === 'class' && !property) pendingClass = { expression: !statementStart && expression, depth: parens.length };
        if (value === 'async') asyncOperand = expression;
        expression = !property && (prefix.has(value) || ['break', 'continue', 'debugger'].includes(value));
      } else if (/\d/.test(c)) {
        const start = i++;
        while (identifier(source[i]) || source[i] === '.') i++;
        value = source.slice(start, i); expression = false;
      } else {
        if (c === '\\') fail();
        value = c; i++;
        if (['?.', '++', '--', '=>', '&&', '||', '??', '**'].includes(c + next)) { value += next; i++; }
        if (value === '(') {
          const property = ['.', '?.'].includes(tokens[tokens.length - 2]?.value);
          parens.push(pendingFunction ? { function: pendingFunction } : { control: control.has(previous) && !property });
          pendingFunction = null; expression = true;
        } else if (value === ')') {
          const head = parens.pop(); expression = !!head?.control;
          functionBody = head?.function || null;
        }
        else if (value === '{') {
          // A brace after a control head, statement boundary or arrow is a
          // statement body; a brace in an operand position is an object.
          // Optional catch bindings have no parenthesized control head. Their
          // body is still a statement block, so its closing brace admits a
          // regexp statement just like catch (error) {} does.
          const block = previous === ')' || previous === '=>' || previous === 'else' || previous === 'do' || previous === 'try' || previous === 'catch' || previous === 'finally' || previous === ';' || previous === '' || previous === '{' || previous === '}';
          if (pendingClass && parens.length === pendingClass.depth) { functionBody = pendingClass; pendingClass = null; }
          const endExpression = previous === '=>' || functionBody?.expression;
          // A colon may introduce either a label or an object value. Keep an
          // ambiguity marker: a later slash must fail rather than guess and
          // silently swallow a real import as a regexp.
          braces.push({ regexpAfter: functionBody ? !functionBody.expression : block && !endExpression,
            ambiguous: previous === ':' });
          functionBody = null; expression = true;
        } else if (value === '}') {
          const brace = braces.pop(); expression = !!brace?.regexpAfter;
          if (brace?.ambiguous) expression = 'ambiguous';
        }
        else expression = ![']', '.', '?.', '++', '--'].includes(value);
      }
      tokens.push({ value, kind });
      statementStart = value === ';' || value === '{' || (value === '}' && expression === true) ||
        (value === ')' && expression === true) || ['else', 'do', 'try', 'finally'].includes(value) ||
        (statementStart && ['async', 'export', 'default'].includes(value));
      previous = value;
    }
    if (substitution) fail();
  }
  code();
  const imports = [];
  for (let t = 0; t + 3 < tokens.length; t++) {
    const [name, open, argument, close] = tokens.slice(t, t + 4);
    if (name.kind === 'identifier' && name.value === 'require' &&
        !['.', '?.'].includes(tokens[t - 1]?.value) && open.value === '(' &&
        argument.kind === 'string' && close.value === ')' && argument.value.startsWith('.')) imports.push(argument.value);
  }
  return imports;
}

function moduleList(roots = ROOTS) {
  const seen = new Set();
  const order = [];
  const visit = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const file = path.join(ROOT, id);
    if (!fs.existsSync(file)) throw new Error(`bundle: ${id} does not exist`);
    const text = fs.readFileSync(file, 'utf8');
    for (const request of literalRequires(text, id)) {
      let dep = path.posix.join(path.posix.dirname(id), request);
      if (!fs.existsSync(path.join(ROOT, dep))) dep += '.js';
      // Relative literals are required source dependencies, including lazy
      // ones (the ROM font loader is used only when a Machine is created).
      // Bare Node packages and computed CLI-only requires, such as fnt-read's
      // optional PNG writer, remain outside this literal-source walk.
      if (!fs.existsSync(path.join(ROOT, dep))) {
        throw new Error(`bundle: ${id} requires missing literal dependency ${request} (resolved ${dep})`);
      }
      visit(dep);
    }
    order.push(id);           // dependencies first, for a readable listing
  };
  for (const r of roots) visit(r);
  return order;
}

// Files the VM reads through `fs` regardless of which program is running. The
// ROM character generator is the only one: dos.js loads a 12-row strike out of
// Terminal.fon and copies it into the ROM font tables at F400/F500/F600, and a
// program that reads a glyph out of those gets blanks without it.
const ASSETS = [
  'fonts/Terminal.fon',
];

function arg(name, fallback) {
  const hit = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

const PREAMBLE = `// GENERATED by tools/toyvm/bundle-browser.js -- do not edit.
//
// The toy VM's own source files, verbatim, behind a CommonJS require. See that
// script for why this exists rather than a module graph the browser resolves.
(function () {
  'use strict';

  const SRC = __SRC__;
  const ASSETS = __ASSETS__;

  // Normalise a '/'-separated path: resolve '.' and '..', drop empty segments.
  function norm(p) {
    const out = [];
    for (const seg of String(p).split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') out.pop();
      else out.push(seg);
    }
    return out.join('/');
  }

  const pathMod = {
    sep: '/',
    join: (...parts) => norm(parts.join('/')),
    resolve: (...parts) => norm(parts.join('/')),
    dirname: (p) => norm(p).split('/').slice(0, -1).join('/') || '.',
    basename: (p, ext) => {
      const b = norm(p).split('/').pop() || '';
      return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b;
    },
    extname: (p) => {
      const b = norm(p).split('/').pop() || '';
      const i = b.lastIndexOf('.');
      return i <= 0 ? '' : b.slice(i);
    },
  };

  // Preserve relative directories in the browser mount just as the CLI's
  // fileRoot does. Parent directories are implicit in mounted file paths.
  const disk = new Map();
  const diskKey = p => norm(String(p).replace(/\\\\/g, '/')).toLowerCase();
  function mount(name, bytes) {
    disk.set(diskKey(name), bytes);
  }
  function lookup(p) {
    return disk.get(diskKey(p));
  }
  function diskDirectory(p) {
    const key = diskKey(p), prefix = key ? key + '/' : '';
    return !key || [...disk.keys()].some(k => k.startsWith(prefix));
  }

  const fsMod = {
    readFileSync: (p) => {
      const asset = ASSETS[norm(p)];
      if (asset) return b64(asset);
      const hit = lookup(p);
      if (!hit) { const e = new Error('ENOENT: ' + p); e.code = 'ENOENT'; throw e; }
      return BufferMod.from(hit);
    },
    readdirSync: p => {
      if (!diskDirectory(p)) throw new Error('ENOTDIR: ' + p);
      const key = diskKey(p), prefix = key ? key + '/' : '';
      return [...new Set([...disk.keys()].filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length).split('/')[0]))];
    },
    statSync: p => {
      const directory = diskDirectory(p), file = lookup(p);
      if (!directory && !file) throw new Error('ENOENT: ' + p);
      return { size: file ? file.length : 0, isDirectory: () => directory };
    },
    existsSync: (p) => !!(ASSETS[norm(p)] || lookup(p) || diskDirectory(p)),
    writeFileSync: () => {},
  };

  // vm.js keys region-specific compiles with sha256 over the region bodies.
  // That key is a memoization key, not a security boundary, so in the browser
  // a deterministic FNV pair over the same input is enough -- what matters is
  // that different bodies get different keys and the same body gets the same.
  const cryptoMod = {
    createHash: () => {
      let parts = '';
      return {
        update(d) { parts += String(d); return this; },
        digest() {
          let h1 = 0x811c9dc5, h2 = 0x01000193;
          for (let i = 0; i < parts.length; i++) {
            h1 = ((h1 ^ parts.charCodeAt(i)) * 0x01000193) >>> 0;
            h2 = ((h2 + parts.charCodeAt(i)) * 31 + 7) >>> 0;
          }
          return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
        },
      };
    },
  };

  // Node's Buffer, to the extent these modules use it. The NE and FNT readers
  // walk their headers with readUInt16LE/readUInt32LE and pull names out with
  // toString('latin1', s, e), and there is no Buffer in a browser. Subclassing
  // Uint8Array is what makes this small: \`slice\` and \`subarray\` construct via
  // the species of the receiver, so a slice of a Bytes is a Bytes and keeps the
  // readers working after they narrow a header down to one record.
  class Bytes extends Uint8Array {
    readUInt8(o) { return this[o]; }
    readUInt16LE(o) { return this[o] | (this[o + 1] << 8); }
    readInt16LE(o) { return (this.readUInt16LE(o) << 16) >> 16; }
    readUInt32LE(o) {
      return (this[o] | (this[o + 1] << 8) | (this[o + 2] << 16) | (this[o + 3] << 24)) >>> 0;
    }
    readInt32LE(o) { return this.readUInt32LE(o) | 0; }
    // latin1 is the only encoding asked for, and it is the only one that is
    // right here: these are DOS-era byte strings, not UTF-8.
    toString(enc, s, e) {
      if (typeof enc === 'number') return Uint8Array.prototype.toString.call(this);
      let out = '';
      const from = s === undefined ? 0 : s;
      const to = e === undefined ? this.length : e;
      for (let i = from; i < to; i++) out += String.fromCharCode(this[i]);
      return out;
    }
  }

  const BufferMod = {
    from: (v, enc) => {
      if (typeof v === 'string') return enc === 'base64' ? b64(v) : Bytes.from(
        [...v].map(c => c.charCodeAt(0) & 0xFF));
      return v instanceof Uint8Array ? new Bytes(v.buffer, v.byteOffset, v.byteLength)
        : Bytes.from(v);
    },
    alloc: (n) => new Bytes(n),
    isBuffer: (v) => v instanceof Bytes,
  };

  function b64(s) {
    const bin = atob(s);
    const out = new Bytes(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // Node's \`process\`, to the extent these modules touch it. \`hrtime.bigint\` is
  // the one with a real job: the region JIT's snapshot audit times its two arms
  // with it, and in the JIT worker there IS no Node -- an absent hrtime is a
  // throw inside the audit, which arrives as a JIT that declines every region
  // for no stated reason. performance.now is the same clock in different units.
  const processMod = {
    argv: [], env: {}, stderr: { write() {} }, exit() {},
    hrtime: Object.assign(() => [0, 0], {
      bigint: () => BigInt(Math.round(
        (self.performance ? self.performance.now() : Date.now()) * 1e6)),
    }),
  };

  const cache = new Map();

  // Resolve an id the way Node would from a module living at \`from\`, but only
  // for the two shapes that actually occur: a relative path, and an already
  // repo-relative one (which is what path.join(__dirname, '..', '..', ...)
  // produces once __dirname is itself repo-relative).
  function resolve(id, from) {
    if (id === 'fs') return 'fs';
    if (id === 'path') return 'path';
    if (id === 'crypto') return 'crypto';
    const dir = pathMod.dirname(from);
    const tries = id.startsWith('.') ? [norm(dir + '/' + id)] : [norm(id)];
    for (const t of tries) {
      for (const cand of [t, t + '.js']) if (SRC[cand]) return cand;
    }
    throw new Error('cannot resolve ' + id + ' from ' + from);
  }

  function requireFrom(from) {
    return (id) => {
      const key = resolve(id, from);
      if (key === 'fs') return fsMod;
      if (key === 'path') return pathMod;
      if (key === 'crypto') return cryptoMod;
      if (cache.has(key)) return cache.get(key).exports;
      const module = { exports: {} };
      cache.set(key, module);
      const fn = new Function('require', 'module', 'exports', '__dirname', '__filename',
        'process', 'Buffer', SRC[key] + '\\n//# sourceURL=' + key);
      fn(requireFrom(key), module, module.exports, pathMod.dirname(key), key,
        processMod, BufferMod);
      return module.exports;
    };
  }

  self.ToyVM = {
    require: requireFrom('tools/toyvm/browser-entry.js'),
    mount,
    unmountAll: () => disk.clear(),
    diskNames: () => [...disk.keys()],
  };
})();
`;

// Load the bundle the way the page does and pull the entry module through it.
// Resolution failures are the whole failure mode here -- a missing module is
// silent until something requires it -- and they surface on this one line.
function selfCheck(js, roots) {
  const sandbox = { ToyVM: null };
  const run = new Function('self', 'atob', js);
  run(sandbox, (s) => Buffer.from(s, 'base64').toString('binary'));
  for (const r of roots) sandbox.ToyVM.require(r);
  return sandbox;
}

// One bundle: the modules reachable from `roots`, inlined, behind the preamble.
function buildBundle(roots) {
  const modules = moduleList(roots);
  const src = {};
  // Drop a leading `#!/usr/bin/env node`. Node strips a shebang before it
  // parses a module; `new Function` does not, and treats it as a syntax error
  // -- which arrives as a module that "does not exist" wherever the caller
  // wrapped its require in a try/catch.
  for (const m of modules) {
    src[m] = fs.readFileSync(path.join(ROOT, m), 'utf8').replace(/^#![^\n]*\n/, '');
  }
  const assets = {};
  for (const a of ASSETS) assets[a] = fs.readFileSync(path.join(ROOT, a)).toString('base64');

  // The replacements go in through a function, not a string. A string
  // replacement treats `$&`, `` $` `` and `$'` in it as patterns, and the WAT
  // compiler's own source contains `startsWith('$')` -- so a plain replace
  // silently spliced part of the bundle into itself and produced a file that
  // would not parse, several hundred kilobytes away from the cause.
  const js = PREAMBLE
    .replace('__SRC__', () => JSON.stringify(src))
    .replace('__ASSETS__', () => JSON.stringify(assets));
  selfCheck(js, roots);
  return { js, modules, src };
}

function emitBundle(file, built, check) {
  const { js, modules, src } = built;
  if (check) {
    // Build gate: the committed bundle must be reproducible from source.
    // The bundle inlines every module verbatim, so any toyvm source edit
    // that skips regeneration leaves the shipped page running old code
    // while the tests stay green on the committed bytes.
    const committed = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (committed === js) {
      console.log(`${path.relative(ROOT, file)}: up to date (${Math.round(js.length / 1024)}KB)`);
      return true;
    }
    if (committed === null) {
      console.error(`${path.relative(ROOT, file)}: MISSING -- run tools/toyvm/bundle-browser.js to generate it`);
    } else {
      let at = 0;
      while (at < js.length && js[at] === committed[at]) at++;
      console.error(`${path.relative(ROOT, file)}: STALE -- ${committed.length} B committed vs `
        + `${js.length} B from source, first difference at byte ${at}. `
        + `Run tools/toyvm/bundle-browser.js and commit the result.`);
    }
    return false;
  }
  fs.writeFileSync(file, js);
  const kb = (n) => `${Math.round(n / 1024)}KB`;
  console.log(`${path.relative(ROOT, file)}: ${modules.length} modules, `
    + `${ASSETS.length} asset(s), ${kb(js.length)}`);
  for (const m of modules) console.log(`  ${m.padEnd(28)} ${kb(src[m].length)}`);
  return true;
}

function main() {
  const out = arg('out', path.join('docs', 'dos-corpus', 'live'));
  fs.mkdirSync(path.join(ROOT, out), { recursive: true });
  const check = process.argv.includes('--check');
  const ok = [
    emitBundle(path.join(ROOT, out, 'toyvm-bundle.js'), buildBundle(ROOTS), check),
    emitBundle(path.join(ROOT, out, 'toyvm-jit-bundle.js'), buildBundle(JIT_ROOTS), check),
  ];
  if (!ok.every(Boolean)) process.exit(1);
}

// uop-shell-bench.js builds a private bundle from other roots.
module.exports = { buildBundle, moduleList };

if (require.main === module) main();
