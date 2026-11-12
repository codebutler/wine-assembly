'use strict';
// Deliberately small source evaluator, NOT WebAssembly or a runtime qualifier.
// Operands, writes and calls are evaluated from the transformed WAT AST.
const assert = require('node:assert/strict');
// Per-invocation private identity. Catching never inspects imported exceptions.
const frames = new WeakMap();
function parse(s) {
  const tokens = s.replace(/;;[^\n]*/g, '').match(/"(?:\\.|[^"\\])*"|[()]|[^\s()]+/g) || [];
  const root = [], stack = [root];
  for (const t of tokens) {
    if (t === '(') { const n = []; stack.at(-1).push(n); stack.push(n); }
    else if (t === ')') { assert(stack.length > 1, 'unbalanced close'); stack.pop(); }
    else stack.at(-1).push(t);
  }
  assert.equal(stack.length, 1, 'unbalanced open');
  return root;
}
function func(s, name) {
  const start = s.indexOf('(func $' + name + ' ');
  // Functions without parameters can end their name with a newline.
  const pos = start < 0 ? s.indexOf('(func $' + name + '\n') : start;
  assert(pos >= 0, name);
  const text = s.slice(pos).replace(/;;[^\n]*/g, '');
  let depth = 0, quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') quoted = !quoted;
    if (quoted) continue;
    if (text[i] === '(') depth++;
    if (text[i] === ')' && --depth === 0) return parse(text.slice(0, i + 1))[0];
  }
  throw Error('unclosed ' + name);
}
function walk(n, pred, out = []) {
  if (!Array.isArray(n)) return out;
  if (pred(n)) out.push(n);
  for (const x of n) walk(x, pred, out);
  return out;
}
class Model {
  constructor(source, ready = 0, ms = 0, start = true) {
    this.g = { $reg_base: 100, $current_thread_id: 1, $current_thunk_eip: 1232,
      $yield_reason: 0, $vsock_sel_waiting: 0, $vsock_sel_deadline: 0,
      $eip: 55, $handler_set_eip: 0, $yield_flag: 0, $steps: 9 };
    this.mem = new Map([[100, 0x53000001], [116, 4096]]);
    this.trace = []; this.ready = ready; this.ms = ms; this.ticks = [10, 10];
    this.functions = new Map(); this.exports = {};
    this.functions.set('$handle_select', func(source, 'handle_select'));
    if (source.includes(';; Opt-in exact select diagnostic storage.')) {
      const declarations = parse(source.split(';; Opt-in exact select diagnostic storage.')[1]);
      for (const d of declarations) {
        if (d[0] === 'global') this.g[d[1]] = 0;
        else if (d[0] === 'func' && typeof d[1] === 'string') this.functions.set(d[1], d);
        else if (d[0] === 'func' && d[1][0] === 'export') {
          this.exports[JSON.parse(d[1][1])] = () => {
            let result;
            for (const x of d.slice(2)) if (x[0] !== 'result') result = this.eval(x, {});
            return result;
          };
        } else throw Error('unexpected declaration');
      }
      if (start) this.exports.msc_start();
    }
  }
  run(name, args = []) {
    const f = this.functions.get(name); assert(f, name);
    const locals = {}; let i = 0;
    for (const x of f.slice(2)) {
      if (x[0] === 'param') locals[x[1]] = args[i++];
      if (x[0] === 'local') locals[x[1]] = 0;
    }
    let result;
    const previous = frames.get(this), frame = { signal: Object.freeze({}), value: undefined };
    frames.set(this, frame);
    try { for (const x of f.slice(2)) if (!['param', 'local', 'result'].includes(x[0])) result = this.eval(x, locals); }
    catch (e) { if (e === frame.signal) return frame.value; throw e; }
    finally { if (previous) frames.set(this, previous); else frames.delete(this); }
    return result;
  }
  eval(n, l) {
    const op = n[0], args = n.slice(1), e = x => this.eval(x, l);
    if (op === 'i32.const') return Number(args[0]) >>> 0;
    if (op === 'global.get') { assert(Object.hasOwn(this.g, args[0]), args[0]); return this.g[args[0]]; }
    if (op === 'local.get') { assert(Object.hasOwn(l, args[0]), args[0]); return l[args[0]]; }
    if (op === 'global.set') {
      const v = e(args[1]); this.g[args[0]] = v;
      if (!args[0].startsWith('$msc_')) this.trace.push(['global.set', args[0], v]);
      return;
    }
    if (op === 'local.set' || op === 'local.tee') { const v = e(args[1]); l[args[0]] = v; return op === 'local.tee' ? v : undefined; }
    if (op === 'return') {
      const frame = frames.get(this); assert(frame, 'return outside model invocation');
      frame.value = args.length ? e(args[0]) : undefined;
      throw frame.signal;
    }
    if (op === 'if') {
      const branch = e(args[0]) ? args[1] : args[2];
      if (branch) for (const x of branch.slice(1)) e(x);
      return;
    }
    if (op === 'drop') { e(args[0]); return; }
    if (op === 'i32.load' || op === 'i32.store') {
      const hasOffset = typeof args[0] === 'string' && args[0].startsWith('offset=');
      const offset = hasOffset ? Number(args.shift().split('=')[1]) : 0;
      // Never mutate the parsed AST when removing an offset.
      const addr = e(args[0]) + offset; assert(this.mem.has(addr), 'unexpected memory address');
      if (op === 'i32.load') return this.mem.get(addr);
      const v = e(args[1]); this.mem.set(addr, v); this.trace.push(['store', addr, v]); return;
    }
    if (op === 'call') {
      const name = args[0], values = args.slice(1).map(e);
      if (name.startsWith('$msc_')) return this.run(name, values);
      this.trace.push(['call', name, ...values]);
      if (this.throwOn === name) throw this.exception;
      if (name === '$vsock_pump') return;
      if (name === '$vsock_filter_set') return values[2] === 0 && values[1] === 0 ? this.ready : 0;
      if (name === '$vsock_timeval_ms') return this.ms;
      if (name === '$host_get_ticks') return this.ticks.length > 1 ? this.ticks.shift() : this.ticks[0];
      if (name === '$vsock_block') {
        this.mem.set(116, this.mem.get(116) - values[0]);
        this.g.$handler_set_eip = 1; this.g.$eip = this.g.$current_thunk_eip;
        this.g.$yield_reason = 8; this.g.$yield_flag = 1; this.g.$steps = 0; return;
      }
      throw Error('unsupported original call ' + name);
    }
    const a = args.map(e), unsigned = x => x >>> 0;
    switch (op) {
      case 'i32.add': return (a[0] + a[1]) >>> 0;
      case 'i32.sub': return (a[0] - a[1]) >>> 0;
      case 'i32.or': return (a[0] | a[1]) >>> 0;
      case 'i32.eqz': return +!a[0];
      case 'i32.eq': return +(a[0] === a[1]);
      case 'i32.ne': return +(a[0] !== a[1]);
      case 'i32.gt_u': return +(unsigned(a[0]) > unsigned(a[1]));
      case 'i32.ge_u': return +(unsigned(a[0]) >= unsigned(a[1]));
      case 'i32.lt_s': return +((a[0] | 0) < (a[1] | 0));
      default: throw Error('unsupported AST operation ' + op);
    }
  }
  arm() { return this.run('$msc_arm', [777, this.mem.get(116), this.g.$current_thread_id, this.g.$reg_base, this.g.$current_thunk_eip]); }
  select(timeval = 1) { return this.run('$handle_select', [0, 1, 2, 3, timeval, 0]); }
}
module.exports = { parse, func, walk, Model };
