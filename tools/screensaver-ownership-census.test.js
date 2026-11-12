#!/usr/bin/env node
'use strict';
// Review current include/host sources against the pending ownership census.
// This is a source guard; native lifecycle/input tests establish behavior.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { scanSources, check, checkNonlocalAPIs } = require('./callback-ownership-census');
const root = path.resolve(__dirname, '..');
const { sourceFiles } = require('./callback-ownership-census');
const files = sourceFiles(root);
const sources = files.map(file => ({file, src:fs.readFileSync(path.join(root,file),'utf8')}));
const sourceCommit = 'current-working-source';
const census = JSON.parse(fs.readFileSync(path.join(__dirname,'callback-ownership-census.json')));
const entries = scanSources(sources);
assert.deepEqual(check(entries,census), []);
const api = JSON.parse(fs.readFileSync(path.join(root,'src/api_table.json'),'utf8'));
assert.deepEqual(checkNonlocalAPIs(sources,api), []);
const changed = [
 'host.js:host-file', 'lib/apps.js:host-file', 'lib/browser-shell.js:host-file',
 'src/09c3-controls.wat:$control_wndproc_dispatch',
 'src/09ca-screensavers.wat:$scrsave_open', 'src/09ca-screensavers.wat:$scrsave_pump',
];
const key = e => e.file+':'+e.name;
let negatives = 0;
function rejects(label, file, before, after) {
 const old = sources.find(s=>s.file===file).src;
 assert(old.includes(before), `missing mutation anchor: ${label}`);
 const mutated=scanSources(sources.map(s=>s.file===file?{file,src:old.replace(before,after)}:s));
 assert(check(mutated,census).some(e=>e.includes(`changed producer ${file}:`)||
   e.includes(`unknown producer ${file}:`)),label);
 negatives++;
 return mutated;
}
// These alter actual production bodies without changing call counts. They
// verify that a digest refresh cannot be substituted for lifetime review.
rejects('startup stop guard', 'host.js',
 "if (this._stopped) throw new Error('Applet startup canceled');",
 "if (false) throw new Error('Applet startup canceled');");
rejects('registration cancellation checkpoint', 'lib/browser-shell.js',
 'await wine.loadWatApp(app.watApp);\n        throwIfCancelled(ctx);',
 'await wine.loadWatApp(app.watApp);\n        void ctx;');
rejects('dynamic export selector', 'lib/apps.js',
 "screensavers: { watApp: 'scrsave' }", "screensavers: { watApp: 'other' }");
rejects('native class routing', 'src/09c3-controls.wat',
 '(i32.eq (local.get $class) (i32.const 35))',
 '(i32.eq (local.get $class) (i32.const 36))');
rejects('open lifetime allocation', 'src/09ca-screensavers.wat',
 '(global.set $scrsave_msg (call $heap_alloc (i32.const 28)))',
 '(global.set $scrsave_msg (call $heap_alloc (i32.const 4)))');
rejects('input close guard before next dequeue', 'src/09ca-screensavers.wat',
 '(if (i32.eqz (global.get $scrsave_hwnd)) (then (return (i32.const 0))))\n      (local.set $guard',
 '(if (i32.const 0) (then (return (i32.const 0))))\n      (local.set $guard');
rejects('posted close guard before scratch reuse', 'src/09ca-screensavers.wat',
 '(br_if $posts (i32.eqz (global.get $scrsave_hwnd)))',
 '(br_if $posts (i32.const 0))');
const renamed=rejects('export name', 'src/09ca-screensavers.wat',
 '(export "wat_app_pump")','(export "unreviewed_pump")');
const refreshed=structuredClone(census);
for(const e of refreshed.entries) {
 const a=renamed.find(a=>key(a)===key(e));
 if(a)e.sha256=a.sha256;
}
assert(check(renamed,refreshed).some(e=>e.includes('$scrsave_pump (exports)')));
negatives++;
const staleCalls=structuredClone(census);
staleCalls.entries.find(e=>e.name==='$control_wndproc_dispatch').boundaryCalls.pop();
assert(check(entries,staleCalls).some(e=>e.includes('$control_wndproc_dispatch (boundaryCalls)')));
negatives++;
for(const id of changed) {
 const covered=structuredClone(census);
 covered.entries.find(e=>key(e)===id).ownership='covered';
 assert(check(entries,covered).includes(`unsupported ownership assertion ${id}`));
 negatives++;
}
for(const name of ['$scrsave_open','$scrsave_pump']) {
 const missing={...census,entries:census.entries.filter(e=>e.name!==name)};
 assert(check(entries,missing).includes(`unknown producer src/09ca-screensavers.wat:${name}`));
 negatives++;
}
const extra={file:'src/unreviewed.wat',src:'(func $unreviewed (export "unreviewed") (call $scrsave_pump))'};
assert(check(scanSources([...sources,extra]),census).includes('unknown producer src/unreviewed.wat:$unreviewed'));
negatives++;
// A full source inventory still cannot authorize nonlocal jump APIs/handlers.
assert(checkNonlocalAPIs([...sources,{file:'src/unreviewed.wat',
 src:'(func $handle_longjmp (global.set $eip (i32.const 1)))'}],
 [...api,{name:'longjmp'}]).length>=2);
negatives++;
console.log(JSON.stringify({sourceCommit,sources:files.length,entries:entries.length,
 negatives,ownership:'pending',result:'PASS',scope:'source census only; no runtime qualification'},null,2));
