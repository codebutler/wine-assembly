'use strict';
const assert=require('node:assert/strict');
const {validateSoftwareSamples:v}=require('./arcanum-software-samples');
const r={errors:[],seconds:20,frames:2,fps:.1,samples:[{t:0,count:0,writeSeq:0,valid:true,sink:{}},{t:10000,count:1,writeSeq:1,valid:true,sink:{}},{t:20000,count:2,writeSeq:2,valid:true,sink:{}}],events:[{seq:1,submittedAt:1,sink:{},kind:'completed visible filter.present'},{seq:2,submittedAt:10001,sink:{},kind:'completed visible filter.present'}]};
assert(v(r).ok);
for(const change of [x=>x.frames=0,x=>x.fps=null,x=>x.errors.push('missing OffscreenCanvas'),x=>x.samples[1].valid=false,x=>x.samples[1].sink=null,x=>x.samples[2].count=3,x=>x.events[1].seq=1,x=>x.events[1].submittedAt=21000,x=>x.events[1].kind='raw Flip',x=>x.seconds=0,x=>x.samples[1].t=-1]){
 const x=structuredClone(r);change(x);assert(!v(x).ok);
}
console.log('PASS positive raw sample case and 11 rejection controls');
