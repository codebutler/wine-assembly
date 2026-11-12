const fs=require('fs'),path=require('path'),Module=require('module');
const file='/tmp/legacy-texture-operation-caps-oct23/repo/test/test-legacy-texture-operation-caps.js';
const src=fs.readFileSync(file,'utf8'),cut=src.indexOf('\ntry {\n  const f = makeFixture(assembled);');
if(cut<0)throw Error('boundary changed');
const probe=String.raw`
const f=makeFixture(assembled);
for(let stage=0;stage<8;stage++) {
 for(const [type,value] of [[1,stage?1:4],[2,2],[3,1],[4,2],[5,2],[6,1]])
  assert.equal(f.e.d3dim_tss_load(4096,stage,type),value,'initialized stage '+stage+' type '+type);
}
const memory=new Uint8Array(f.e.memory.buffer),begin=16384+64,end=begin+180;
memory.fill(0xa5,16384,16384+260);
assert.equal(f.e.d3dim_gpu_describe(1),begin);
assert(memory.slice(16384,begin).every(v=>v===0xa5),'descriptor prefix canary');
assert(memory.slice(end,16384+260).every(v=>v===0xa5),'descriptor end and allocation canary');
assert.equal(end-16384,244);assert(end<=16384+256);
let rejected=false;
try {
 const bad=makeFixture(assembled.replace('(call $d3dim_tss_init (local.get $state_guest))',''));
 assert.equal(bad.e.d3dim_tss_load(4096,0,2),2,'missing initializer must reject default texture selector');
} catch(e) {assert(e instanceof assert.AssertionError);assert.equal(e.message,'missing initializer must reject default texture selector');rejected=true;}
assert(rejected);
console.log('PASS independent eight-stage initialized defaults, 180-byte descriptor canaries/end+244 within256, rejecting omitted initializer');
`;
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(src.slice(0,cut)+'\n'+probe,file);
