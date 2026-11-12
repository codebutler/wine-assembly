'use strict';
// Arithmetic/source regression only. No compiler, native module, or arena.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const f = Math.fround;
const source = fs.readFileSync(path.join(__dirname, '../../../src/09ah-d3d-software.wat'), 'utf8');
const tokens = source.replace(/;;[^\n]*/g, '').match(/"(?:\\.|[^"\\])*"|[()]|[^\s()]+/g);
let cursor = 0;
function parse() {
  const token = tokens[cursor++];
  assert.notEqual(token, undefined, 'unterminated source expression');
  if (token !== '(') { assert.notEqual(token, ')'); return token; }
  const node = [];
  while (tokens[cursor] !== ')') node.push(parse());
  cursor++;
  return node;
}
const forms = [];
while (cursor < tokens.length) forms.push(parse());
const helper = forms.find(n => n[0] === 'func' && n[1] === '$d3d_software_perspective');
assert(helper, 'production correction helper');
const body = helper.at(-1);
assert.equal((source.match(/\(call \$d3d_software_perspective /g) || []).length, 3,
  'fog, primary/texture varyings, and secondary color must all use correction');
// Interpret only the scalar production helper, rounding after each f32 op.
// Unknown instructions fail closed; this is not a WAT compiler or raster run.
function evaluate(n, locals) {
  const ev = x => evaluate(x, locals);
  switch (n[0]) {
    case 'local.get': return locals[n[1]];
    case 'f32.const': return f(Number(n[1]));
    case 'f32.abs': return Math.abs(ev(n[1]));
    case 'f32.le': return ev(n[1]) <= ev(n[2]);
    case 'f32.mul': return f(ev(n[1]) * ev(n[2]));
    case 'f32.div': return f(ev(n[1]) / ev(n[2]));
    case 'if': return ev(n[2]) ? ev(n[3][1]) : ev(n[4][1]);
    default: throw new Error(`unsupported arithmetic probe instruction ${n[0]}`);
  }
}
const oldBody = ['f32.mul', ['local.get', '$value'], ['local.get', '$riw']];
const selected = process.argv.includes('--control-remove-overflow-branch') ? oldBody : body;
const correct = (value, iw) => evaluate(selected, {$value: value, $iw: iw, $riw: f(1 / iw)});
const interp = (a, b, c, u, v, w) => f(f(f(u*a) + f(v*b)) + f(w*c));
const rhw = f(1e-39), bytes = new ArrayBuffer(4), view = new DataView(bytes);
view.setFloat32(0, rhw, true);
assert.equal(view.getUint32(0, true), 0x000ae398);
assert(Number.isFinite(rhw) && rhw > 0);
assert.equal(f(1/rhw), Infinity);
assert(rhw < 2**-16, 'shared admission rejects before descriptor allocation');
let covered = 0, checked = 0;
for (let y=0; y<4; y++) for (let x=0; x+y<4; x++) {
  const u=f((16-4*x-4*y)/16), v=f(x/4), w=f(y/4);
  const iw=interp(rhw,rhw,rhw,u,v,w);
  for (const varying of [0, 1, .25]) {
    const overW=f(varying*rhw), numerator=interp(overW,overW,overW,u,v,w);
    assert.equal(correct(numerator,iw), f(numerator/iw), 'finite tiny-RHW quotient');
    assert(Number.isFinite(correct(numerator,iw)));
    checked++;
  }
  // Opaque red and white 1x1 texture need finite UVs and exact 0/1 color.
  assert.equal(correct(iw,iw),1); assert.equal(correct(0,iw),0);
  covered++;
}
// The optimization remains bit-identical whenever its reciprocal is finite,
// including unequal per-vertex weights. Zero inputs must remain exact zero.
for (const weights of [[1,1,1],[2**-16,1,2**16],[.25,.5,2]]) {
  const iw=interp(...weights,.5,.25,.25);
  for (const value of [0,.25,1,-1,17]) {
    const numerator=f(value*iw);
    assert.equal(correct(numerator,iw),f(numerator*f(1/iw)));
  }
}
const oldZero=evaluate(oldBody,{$value:0,$iw:rhw,$riw:f(1/rhw)});
assert(Number.isNaN(oldZero));
console.log(JSON.stringify({rhw, bits:'0x'+view.getUint32(0,true).toString(16).padStart(8,'0'),
  reciprocal:String(f(1/rhw)), coveredPixels:covered, tinyQuotients:checked,
  oldZero:String(oldZero), oldUV:String(f(f(.25*rhw)*f(1/rhw))),
  correctedUV:correct(f(.25*rhw),rhw), result:'PASS arithmetic/source only'}));
