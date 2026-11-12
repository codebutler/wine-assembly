'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const candidate=require('/tmp/maelstrom-select-hook-independent-closeout-oct24/repo/tools/maelstrom-select-completion-hook.cjs');
const repaired=require(path.resolve(__dirname,'../repo/tools/maelstrom-select-completion-hook.cjs'));
const input=Object.fromEntries(Object.keys(candidate.PINS).map(p=>[p,fs.readFileSync(path.join('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23',p),'utf8')]));
const a=candidate.transform(input,{enabled:true}),b=repaired.transform(input,{enabled:true});
assert.deepEqual(a,b);console.log(JSON.stringify({transformedSources:'byte-identical to rejected candidate (source instrumentation unchanged)',sha256:Object.fromEntries(Object.entries(b).map(([p,s])=>[p,crypto.createHash('sha256').update(s).digest('hex')]))}));
