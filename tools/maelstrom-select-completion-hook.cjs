'use strict';

// Offline source transformer. No compiler, guest, runner, clocks or host imports.
// Enabled output requires a NEW canonical diagnostic build and qualification.
const { createHash } = require('node:crypto');
const { isProxy } = require('node:util').types;
const PINS = Object.freeze({
  'src/09d-winsock.wat': 'c281da4763624a29910386d2d6b05a66f98ca92b2a9194827d880c0234ba89ab',
  'src/09b-dispatch.wat': 'd8f3ac461c9dca62cdf074cb28b3324080718bd98e5ba696de15577c598dbcce',
  'src/09b2-dispatch-table.generated.wat': '5067cb4767d5e4dc092dfba12942c36f546cbbeb1874f97e5c3033dac632eb3e',
  'src/05-alu.wat': 'e70c56e06d7568d5b9a6c09022659ef27ca8ac5eaef56409bf042c7e57a2edb6',
  'src/06b-core-handlers.wat': 'e8c04a58a5a6c7e15d8d6fb7f2c9c4a39bfe38b3178da41f746df8c457294f21',
  'src/13-exports.wat': 'bf07357361b6d6f1e9c6bd93953d2ca14ccbb55c68f8647149d2a47eaefbb51e',
});
const CAP = 4096;
const FIELDS = Object.freeze(['started', 'phase', 'token', 'entries', 'parks', 'completions',
  'fault', 'capped', 'active', 'api', 'thunk', 'thread', 'regs', 'pre', 'ret', 'post', 'result']);
const sha = s => createHash('sha256').update(s).digest('hex');
function once(s, a, b) {
  if (s.split(a).length !== 2) throw Error('missing/duplicate exact anchor: ' + a.slice(0, 100));
  return s.replace(a, b);
}
const get = n => `(global.get $msc_${n})`;
const set = (n, x) => `(global.set $msc_${n} ${x})`;
const c = n => `(i32.const ${n})`;
const load = offset => `(i32.load offset=${offset} (global.get $reg_base))`;
const fail = `(call $msc_fail) (return)`;
function storage() {
  // Per-instance scalars, never shared guest memory. No public setter/reset.
  const fields = [...FIELDS, 'armed'];
  return fields.map(n => `(global $msc_${n} (mut i32) ${c(0)})`).join('\n') + '\n' +
    FIELDS.map(n => `(func (export "msc_${n}") (result i32) ${get(n)})`).join('\n') + `
(func (export "msc_start") ${set('started', c(1))})
(func $msc_fail
  ${set('fault', c(1))} ${set('phase', c(4))} ${set('active', c(0))} ${set('armed', c(0))})
(func $msc_arm (param $ret i32) (param $pre i32) (param $thread i32) (param $regs i32) (param $thunk i32)
  (if (i32.eqz ${get('started')}) (then (return)))
  (if (i32.or ${get('fault')} ${get('completions')}) (then (return)))
  (if (i32.or ${get('active')} ${get('armed')}) (then ${fail}))
  (if (i32.ge_u ${get('token')} ${c(CAP)})
    (then ${set('capped', c(1))} (return)))
  ${set('ret', '(local.get $ret)')} ${set('pre', '(local.get $pre)')}
  ${set('thread', '(local.get $thread)')}
  ${set('regs', '(local.get $regs)')}
  ${set('thunk', '(local.get $thunk)')}
  ${set('armed', c(1))})
(func $msc_enter (result i32)
  (if (i32.eqz ${get('started')}) (then (return ${c(0)})))
  (if (i32.or ${get('completions')} (i32.or ${get('fault')} ${get('capped')})) (then (return ${c(0)})))
  (if (i32.eqz ${get('armed')}) (then (call $msc_fail) (return ${c(0)})))
  (if (i32.or
        (i32.ne ${load(16)} ${get('pre')})
        (i32.or (i32.ne (global.get $yield_reason) ${c(0)})
          (i32.or (i32.gt_u ${get('pre')} ${c('0xffffffe7')})
            (i32.or (i32.ne (global.get $current_thread_id) ${get('thread')})
              (i32.or (i32.ne (global.get $reg_base) ${get('regs')})
                (i32.ne (global.get $current_thunk_eip) ${get('thunk')}))))))
    (then (call $msc_fail) (return ${c(0)})))
  ${set('armed', c(0))} ${set('active', c(1))}
  ${set('token', `(i32.add ${get('token')} ${c(1)})`)}
  ${set('entries', get('token'))} ${set('api', c(934))}
  ${set('post', c(0))} ${set('result', c(0))} ${set('phase', c(1))}
  ${get('token')})
(func $msc_end (param $token i32) (param $phase i32)
  (if (i32.eqz (local.get $token)) (then (return)))
  (if ${get('fault')} (then (return)))
  (if (i32.or (i32.eqz ${get('active')})
        (i32.or (i32.ne (local.get $token) ${get('token')})
          (i32.or (i32.ne (global.get $current_thread_id) ${get('thread')})
            (i32.or (i32.ne (global.get $reg_base) ${get('regs')})
              (i32.ne (global.get $current_thunk_eip) ${get('thunk')})))))
    (then ${fail}))
  (if (i32.eq (local.get $phase) ${c(2)})
    (then
      (if (i32.or (i32.ne ${load(16)} ${get('pre')})
            (i32.ne (global.get $yield_reason) ${c(8)})) (then ${fail}))
      ${set('parks', `(i32.add ${get('parks')} ${c(1)})`)}
      ${set('result', c(0))})
    (else
      (if (i32.or (i32.ne (local.get $phase) ${c(3)})
            (i32.or (i32.ne (global.get $yield_reason) ${c(0)})
              (i32.ne ${load(16)} (i32.add ${get('pre')} ${c(24)})))) (then ${fail}))
      ${set('result', load(0))}
      ${set('completions', `(i32.add ${get('completions')} ${c(1)})`)}))
  ${set('post', load(16))} ${set('active', c(0))}
  ${set('phase', '(local.get $phase)')})
`;
}

function transform(sources, options = {}) {
  if (options.enabled !== true) return sources; // Do not inspect any unused input/options.
  const input = {};
  for (const [p, h] of Object.entries(PINS)) {
    const s = sources[p];
    if (typeof s !== 'string' || sha(s) !== h) throw Error('historical source pin: ' + p);
    input[p] = s;
  }
  // Every adapter is anchored and checked before returning ANY transformed source.
  let d = input['src/09b-dispatch.wat'];
  const read = '(local.set $return_eip (call $gl32 (i32.load offset=16 (global.get $reg_base))))';
  d = once(d, '(local $resource_pins i64) (local $return_eip i32) (local $entry_eip i32)',
    '(local $msc_pre i32) (local $msc_thread i32) (local $msc_regs i32)\n    (local $resource_pins i64) (local $return_eip i32) (local $entry_eip i32)');
  d = once(d, read, '(local.set $msc_thread (global.get $current_thread_id))\n' +
    '    (local.set $msc_regs (global.get $reg_base))\n' +
    '    (local.set $return_eip (call $gl32 (local.tee $msc_pre (i32.load offset=16 (global.get $reg_base)))))');
  d = once(d, '(call $win32_dispatch_inner (local.get $thunk_idx))',
    '(call $win32_dispatch_inner (local.get $thunk_idx) (local.get $return_eip) (local.get $msc_pre) (local.get $msc_thread) (local.get $msc_regs))');
  d = once(d, '(func $win32_dispatch_inner (param $thunk_idx i32)',
    '(func $win32_dispatch_inner (param $thunk_idx i32) (param $msc_ret i32) (param $msc_pre i32) (param $msc_thread i32) (param $msc_regs i32)');
  const table = '(call $dispatch_api_table (local.get $api_id) (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))';
  d = once(d, table, '(if (i32.eq (local.get $api_id) (i32.const 934))\n' +
    '      (then (call $msc_arm (local.get $msc_ret) (local.get $msc_pre) (local.get $msc_thread) (local.get $msc_regs)\n' +
    '        (i32.add (global.get $thunk_guest_base) (i32.mul (local.get $thunk_idx) (i32.const 8))))))\n    ' + table);
  let w = input['src/09d-winsock.wat'];
  const head = '(local $total i32) (local $ms i32)\n    ';
  const start = w.indexOf('  (func $handle_select ');
  const end = w.indexOf('\n  ;; __WSAFDIsSet', start);
  if (start < 0 || end < start) throw Error('select bounds');
  let body = w.slice(start, end);
  body = once(body, head, head + '(local $msc_token i32)\n    (local.set $msc_token (call $msc_enter))\n    ');
  const park = '(then (call $vsock_block (i32.const 24)) (return))';
  if (body.split(park).length !== 3) throw Error('select park anchors');
  body = body.split(park).join('(then (call $vsock_block (i32.const 24))\n' +
    '            (call $msc_end (local.get $msc_token) (i32.const 2)) (return))');
  const store = '(i32.store offset=0 (global.get $reg_base) (local.get $total)))';
  body = once(body, store, store.slice(0, -1) + '\n    (call $msc_end (local.get $msc_token) (i32.const 3)))');
  w = w.slice(0, start) + body + w.slice(end) + '\n;; Opt-in exact select diagnostic storage.\n' + storage();
  return { ...input, 'src/09b-dispatch.wat': d, 'src/09d-winsock.wat': w };
}

// snapshot() is a trusted capture boundary, not a record-signing API for
// untrusted exports. Its input must be the actual diagnostic export object
// supplied by the host (or the explicitly synthetic source model in tests).
// Private state never comes from the returned, mutable inspection record.
const captures = new WeakMap();
const sources = new WeakMap();
const object = x => x !== null && (typeof x === 'object' || typeof x === 'function');

// owner is a routing identity, NOT evidence of module ownership. Captures are
// authenticated by private identity and bound to their export source. Supply
// that source explicitly to pin it before the first observation; otherwise the
// first authentic capture binds it. One bounded oracle per trusted source.
// A poll missing any attempt is rejected. No synthetic input proves runtime.
function createOracle(instance, source) {
  if ((typeof instance !== 'object' && typeof instance !== 'function') || instance === null)
    throw Error('instance identity required');
  let last = { token: 0, entries: 0, parks: 0, completions: 0, phase: 0 };
  let pending = null, closed = false;
  let boundSource = source;
  const lease = {};
  function reject() { closed = true; return { kind: 'rejected' }; }
  const keys = ['api', 'thunk', 'thread', 'regs', 'pre', 'ret', 'token'];
  return Object.freeze({
    accept(owner, record) {
      if (closed || owner !== instance) return reject();
      // No reads, enumeration or coercion of arbitrary caller records: proxies,
      // copies and invented snapshots cannot enter the validation path.
      const capture = object(record) && captures.get(record);
      if (!capture || capture.used || capture.source.failed || capture.source.capturing ||
          (capture.source.lease && capture.source.lease !== lease) || capture.serial !== capture.source.serial ||
          (boundSource !== undefined && boundSource !== capture.exports)) return reject();
      const s = capture.state;
      // Allow inspection-record mutation for compatibility, but never accept it
      // as a new observation. Known records are ordinary objects we allocated.
      for (const k of FIELDS) {
        const d = Object.getOwnPropertyDescriptor(record, k);
        if (!d || !Object.hasOwn(d, 'value') || d.value !== s[k]) return reject();
      }
      boundSource = capture.exports;
      capture.used = true;
      capture.source.lease = lease;
      if (!s || FIELDS.some(k => !Number.isInteger(s[k]) || s[k] < 0 || s[k] > 0xffffffff)) return reject();
      if (s.started !== 1 || s.fault || s.capped || s.token > CAP || s.entries !== s.token || s.api !== 934 ||
          s.completions > 1 || s.entries !== s.parks + s.completions + s.active ||
          !s.thread || !s.regs || !s.thunk || s.pre > 0xffffffe7) return reject();
      if (s.phase === 1) {
        if (pending || s.active !== 1 || s.token !== last.token + 1 ||
            s.parks !== last.parks || s.completions !== last.completions || s.result || s.post) return reject();
        pending = Object.fromEntries(keys.map(k => [k, s[k]]));
      } else {
        // Terminal snapshots contain the entry-owned identity; observing a
        // normal entry from JS during synchronous execution is not required.
        // Counter gaps still reject. No retry is linked to an earlier call.
        if (pending ? keys.some(k => pending[k] !== s[k]) || s.token !== last.token :
            s.token !== last.token + 1) return reject();
        if (s.active !== 0 || ![2, 3].includes(s.phase)) return reject();
        if (s.phase === 2) {
          if (s.parks !== last.parks + 1 || s.completions !== last.completions ||
              s.post !== s.pre || s.result) return reject();
        } else if (s.completions !== last.completions + 1 || s.parks !== last.parks || s.post !== s.pre + 24) return reject();
        pending = null;
      }
      last = s;
      if (s.phase === 3) closed = true;
      return s.phase === 3 ? { kind: 'completion', attempt: s.token, result: s.result, identity: { ...s } } :
        { kind: s.phase === 2 ? 'park' : 'entry', attempt: s.token };
    },
  });
}

// Called explicitly at a known safe host boundary; never wraps run/instantiate.
// No emission, guest memory access, setters, clock or scheduler operations.
function snapshot(exports) {
  if (!object(exports) || isProxy(exports)) throw Error('trusted diagnostic exports required');
  let source = sources.get(exports);
  if (!source) {
    source = { serial: 0, failed: false, capturing: false, functions: null };
    sources.set(exports, source);
  }
  if (source.failed) throw Error('diagnostic capture closed');
  if (source.capturing) {
    source.failed = true;
    throw Error('reentrant diagnostic capture');
  }
  source.capturing = true;
  try {
    // Inspect own data properties only. Do not execute getters, including
    // inherited accessors. Pin function identity on the first capture.
    const functions = FIELDS.map(n => {
      const d = Object.getOwnPropertyDescriptor(exports, 'msc_' + n);
      if (!d || !Object.hasOwn(d, 'value') || typeof d.value !== 'function' || isProxy(d.value))
        throw Error('own diagnostic function required: ' + n);
      return d.value;
    });
    if (source.functions && functions.some((f, i) => f !== source.functions[i]))
      throw Error('diagnostic export identity changed');
    source.functions = functions;
    const state = Object.create(null);
    for (let i = 0; i < FIELDS.length; i++) {
      const value = Reflect.apply(functions[i], exports, []);
      // Wasm i32 exports are signed JS integers. Never coerce hostile values.
      if (!Number.isInteger(value) || value < -0x80000000 || value > 0xffffffff)
        throw Error('invalid diagnostic i32');
      state[FIELDS[i]] = value >>> 0;
    }
    if (source.failed) throw Error('diagnostic capture closed');
    Object.freeze(state);
    const record = { ...state };
    captures.set(record, { exports, source, serial: ++source.serial, state });
    return record;
  } catch (e) {
    source.failed = true; // Preserve even null/primitive exception identity.
    throw e;
  } finally {
    source.capturing = false;
  }
}

module.exports = { transform, createOracle, snapshot, PINS, FIELDS, CAP };
if (require.main === module) {
  const fs = require('node:fs'), path = require('node:path');
  const [mode, src, out] = process.argv.slice(2);
  if (mode === '--disabled') {
    // A single supplied fragment is copied; no pin directory/options are read.
    fs.writeFileSync(out, fs.readFileSync(src), { flag: 'wx' });
  } else if (mode === '--enable-exact-hook') {
    const sources = Object.fromEntries(Object.keys(PINS).map(p => [p, fs.readFileSync(path.join(src, p), 'utf8')]));
    const result = transform(sources, { enabled: true });
    fs.mkdirSync(out); // New output only; never patch an input or retained binary.
    for (const p of ['src/09b-dispatch.wat', 'src/09d-winsock.wat']) {
      fs.writeFileSync(path.join(out, path.basename(p)), result[p], { flag: 'wx' });
    }
  } else throw Error('usage: --disabled INPUT NEW_OUTPUT | --enable-exact-hook HISTORICAL_ROOT NEW_FRAGMENT_DIR');
}
