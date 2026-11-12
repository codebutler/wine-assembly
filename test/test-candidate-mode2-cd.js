'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {createRequire}=require('module');
const file=path.resolve(__dirname,'../tools/fetch-candidate-corpus.js');
const source=fs.readFileSync(file,'utf8').split('\n(async () => {')[0];
let extracted;
const context=vm.createContext({require:createRequire(file),__dirname:path.dirname(file),process:{argv:['node',file]},console,Buffer});
vm.runInContext(source+'\nextractArchive=(p)=>capture(p); globalThis.convert=extractRawCd;',context);
context.capture=p=>{extracted=fs.readFileSync(p);};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mode2-test-'));
function sector(mode,value){const b=Buffer.alloc(2352);b.fill(255,1,11);b[15]=mode;if(mode===2){b[16]=b[20]=1;b[18]=b[22]=8;}b.fill(value,mode===2?24:16,(mode===2?24:16)+2048);return b;}
function run(b,mode=2){const f=path.join(dir,'disc.bin');fs.writeFileSync(f,b);extracted=null;context.convert(f,dir,mode);return extracted;}
try {
 const data=Buffer.concat(Array.from({length:130},(_,i)=>sector(2,i)));
 const actual=run(data);assert.equal(actual.length,130*2048);for(let i=0;i<130;i++)assert(actual.subarray(i*2048,(i+1)*2048).equals(Buffer.alloc(2048,i)));
 assert(run(sector(1,91),1).equals(Buffer.alloc(2048,91)));
 for(const [name,mutate] of [['form2',b=>{b[18]|=32;b[22]|=32;}],['mismatched subheader',b=>b[20]++],['bad sync',b=>b[3]=0],['mixed mode',b=>b[15]=1]]) {const b=sector(2,42);mutate(b);assert.throws(()=>run(b),/MODE2/,name);assert.equal(extracted,null);}
 assert.throws(()=>run(Buffer.alloc(2351)),/whole-sector/);assert.throws(()=>run(Buffer.alloc(0)),/whole-sector/);
 console.log('PASS MODE2 Form1 offsets across chunks, MODE1 compatibility, malformed/XA Form2/mixed-sector rejection before extraction');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
