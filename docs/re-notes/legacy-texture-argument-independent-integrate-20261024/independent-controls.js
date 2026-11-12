const fs=require('fs'),path=require('path'),Module=require('module');
const file='/tmp/legacy-texture-operation-caps-oct23/repo/test/test-legacy-texture-operation-caps.js';
const src=fs.readFileSync(file,'utf8');
const old='function reject(label, fn) { assert.throws(fn, assert.AssertionError, label); receipts.controls.push(label); }';
const replacement=`function reject(label, fn) {
 let caught; try { fn(); } catch(e) { caught=e; }
 assert(caught instanceof assert.AssertionError,label);
 assert(!/compiler must|only one fixture page|missing |unexpected fixture import/.test(caught.message),label+' unrelated rejection');
 receipts.controls.push(label);
 (receipts.independentRejections ||= []).push({label,message:caught.message,actual:caught.actual,expected:caught.expected,operator:caught.operator});
}`;
if(!src.includes(old)) throw Error('diagnostic instrumentation boundary changed');
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
m._compile(src.replace(old,replacement),file);
