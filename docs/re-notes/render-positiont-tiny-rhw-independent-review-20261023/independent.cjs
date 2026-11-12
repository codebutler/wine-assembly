'use strict';
// Offline only: builtins, scalar expression reader; no project imports.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const root=require('node:path').resolve(__dirname,'../../..');
const f=Math.fround, buf=new ArrayBuffer(4), dv=new DataView(buf);
function bits(x){dv.setFloat32(0,x);return dv.getUint32(0);}
function float(b){dv.setUint32(0,b);return dv.getFloat32(0);}
let source=fs.readFileSync(root+'/src/09ah-d3d-software.wat','utf8');
const tok=source.replace(/;;[^\n]*/g,'').match(/"(?:\\.|[^"\\])*"|[()]|[^\s()]+/g);let pos=0;
function parse(){const t=tok[pos++];assert(t!==undefined);if(t!=='('){assert(t!==')');return t;}const a=[];while(tok[pos]!==')')a.push(parse());pos++;return a;}
const forms=[];while(pos<tok.length)forms.push(parse());
const helper=forms.find(a=>a[0]==='func'&&a[1]==='$d3d_software_perspective');assert(helper);
let body=helper.at(-1);
const mode=process.argv[2];
if(mode==='--old')body=['f32.mul',['local.get','$value'],['local.get','$riw']];
if(mode==='--no-abs')body=JSON.parse(JSON.stringify(body).replace('["f32.abs",["local.get","$riw"]]','["local.get","$riw"]'));
if(mode==='--always-divide')body=['f32.div',['local.get','$value'],['local.get','$iw']];
function ev(a,l){switch(a[0]){case'local.get':assert(Object.hasOwn(l,a[1]));return l[a[1]];case'f32.const':return f(Number(a[1]));case'f32.abs':return Math.abs(ev(a[1],l));case'f32.le':return ev(a[1],l)<=ev(a[2],l);case'f32.mul':return f(ev(a[1],l)*ev(a[2],l));case'f32.div':return f(ev(a[1],l)/ev(a[2],l));case'if':return ev(a[2],l)?ev(a[3][1],l):ev(a[4][1],l);default:throw Error('unsupported '+a[0]);}}
const correct=(n,d)=>ev(body,{$value:f(n),$iw:f(d),$riw:f(1/f(d))});
const same=(a,b,label)=>assert(Object.is(a,b)||(Number.isNaN(a)&&Number.isNaN(b)),label+': '+a+' vs '+b);
// Independent integer-rational nearest-even oracle. Positive finite binary32
// is an integer number of minimum subnormal units. No floating division used.
function units(b){const e=b>>>23,m=BigInt(b&0x7fffff);return e===0?m:(0x800000n+m)<<BigInt(e-1);}
function rational(n,d){assert(n>=0n&&d>0n);const scaled=n<<149n;let lo=0,hi=0x7f7fffff;
  while(lo<hi){const mid=lo+Math.ceil((hi-lo)/2);if(units(mid)*d<=scaled)lo=mid;else hi=mid-1;}
  assert(lo<0x7f7fffff,'oracle bounded finite quotient');
  const down=scaled-units(lo)*d,up=units(lo+1)*d-scaled;
  return float(down<up?lo:down>up?lo+1:(lo&1)?lo+1:lo);
}
let tiny=0;
for(const d of [1,2,3,4,7,8,16,0xae398,0x1fffff,0x200000])for(const n of [0,1,2,3,7,d,d*2,d*7])for(const sign of [1,-1]){
  const den=sign*float(d),num=float(n),expected=rational(BigInt(n),BigInt(d))*sign;
  same(correct(num,den),expected,'tiny exact rational');tiny++;
}
// Exact dyadic weights and subnormal values divisible by eight: nonuniform
// vertices and varying values 1/2/4 produce known exact lattice numerators.
const weights=[.5,.25,.25], rhws=[0x40000,0x80000,0x100000];
const interpolate=a=>f(f(f(weights[0]*a[0])+f(weights[1]*a[1]))+f(weights[2]*a[2]));
const den=interpolate(rhws.map(float)),num=interpolate(rhws.map((b,i)=>float(b)*(1<<i)));
same(correct(num,den),rational(0x160000n,0x80000n),'nonuniform tiny weighted quotient');
// Explicit boundary/signed zero/nonfinite truth table, independent of branch.
for(const [n,d,e] of [[0,0,NaN],[-0,0,NaN],[1,0,Infinity],[1,-0,-Infinity],[-1,-0,Infinity],
 [0,-float(1),-0],[-0,float(1),-0],[-0,-float(1),0],[Infinity,float(1),Infinity],
 [-Infinity,-float(1),Infinity],[NaN,float(1),NaN],[1,NaN,NaN],[Infinity,Infinity,NaN],
 [1,Infinity,0],[1,-Infinity,-0]])same(correct(n,d),e,'special classification/sign');
// Ordinary finite reciprocal behavior is a compatibility requirement, not a
// demand for exact division. Include a deterministic bit-level sample.
let finite=0,differences=0,seed=0x7163;
for(let i=0;i<4096;i++){
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;
 const d=float((seed&0x807fffff)|(((i%240)+7)<<23));
 const n=f(((i%127)-63)/19),r=f(1/d);
 if(Number.isFinite(r)){const old=f(n*r);same(correct(n,d),old,'finite reciprocal compatibility');finite++;if(!Object.is(old,f(n/d)))differences++;}
}
assert(differences>0,'sample distinguishes always-divide mutation');
// IEEE reciprocal overflow threshold adjacent binary32 denominators.
assert.equal(f(1/float(0x200000)),Infinity);
assert(Number.isFinite(f(1/float(0x200001))));
for(const d of [float(0x200001),-float(0x200001),float(0x7f7fffff),-float(0x7f7fffff)])
 same(correct(.25,d),f(f(.25)*f(1/d)),'finite boundary unchanged');
// Call-site structure reviewed separately; catch loss of any of the 3 sites.
let calls=[];function visit(a){if(!Array.isArray(a))return;if(a[0]==='call'&&a[1]==='$d3d_software_perspective')calls.push(a);a.forEach(visit);}forms.forEach(visit);
assert.equal(calls.length,3);for(const a of calls){assert.deepEqual(a.slice(-2),[['local.get','$iw'],['local.get','$riw']]);assert.equal(a[2][1],'$d3d_software_interp');}
assert(source.includes('(i32.const 128)'));assert(source.includes('(i32.const 144)'));
console.log(JSON.stringify({result:'PASS OFFLINE arithmetic only',tinyExactRational:tiny,nonuniformExpected:2.75,finiteCompatibility:finite,divisionDifferences:differences,callSites:calls.length}));
