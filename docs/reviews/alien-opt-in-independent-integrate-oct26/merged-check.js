'use strict';
const fs=require('fs'),assert=require('assert/strict'),vm=require('vm'),crypto=require('crypto'),path=require('path');
const root=path.resolve(__dirname,'../repo'),pins=JSON.parse(fs.readFileSync(__dirname+'/pins.json'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const [n,p] of Object.entries(pins))assert.equal(sha(fs.readFileSync(root+'/'+n)),p.sha256,n);
const s=fs.readFileSync(root+'/test/run.js','utf8');
const importLine=s.split('\n').filter(x=>x.includes("require('../lib/render-wait-attribution')"));assert.equal(importLine.length,1);
const scope={require:require('module').createRequire(root+'/test/run.js')};vm.createContext(scope);
vm.runInContext(importLine[0]+'\nglobalThis.factory=createRenderWaitAttribution;',scope);
assert.equal(scope.factory,require(root+'/lib/render-wait-attribution').createRenderWaitAttribution);
// The complete runner delta is restricted to diagnostic plumbing; all legacy
// dispatch/initializers/return/error/order/deadline bodies are byte-identical.
let old=s.replace("const { createRenderWaitAttribution } = require('../lib/render-wait-attribution');\n",'')
.replace("  // --trace-render-wait: opt in to bounded software-D3D wait attribution.\n  // Legacy render-park waits/counters remain active without this diagnostic.\n",'')
.replace("  const renderWaitAttribution = hasFlag('trace-render-wait') ? createRenderWaitAttribution() : null;\n  if (renderWaitAttribution) ctx.renderWaitAttribution = renderWaitAttribution.stats;\n",'')
.replace('        renderWaitAttribution?.begin(wait, ctx.d3d9Bridge?.requests.get(token));\n','')
.replace(".catch(error => { renderWaitAttribution?.reject(wait); console.error('[render]',error); })",".catch(error => console.error('[render]',error))")
.replace('.then(() => { wait.done = true; renderWaitAttribution?.settle(wait); });','.then(() => { wait.done = true; });')
.replace('    renderWaitAttribution?.parkStart(wait, started);\n    let renderParkDeadline = false;\n','')
.replace('if (deadlineMs && Date.now() > deadlineMs) { renderParkDeadline = true; break; }','if (deadlineMs && Date.now() > deadlineMs) break;')
.replace("    const renderParkEnded = Date.now();\n    renderParkStats.waits++; renderParkStats.wallMs += renderParkEnded - started;\n    renderWaitAttribution?.parkEnd(wait, renderParkEnded,\n      stopped ? 'stopped' : (renderParkDeadline ? 'deadline' : 'pending'));","    renderParkStats.waits++; renderParkStats.wallMs += Date.now() - started;")
.replace("  renderWaitAttribution?.close(deadlineMs && Date.now() > deadlineMs ? 'deadline' : 'stopped');\n  if (renderWaitAttribution?.stats.requests) console.log(renderWaitAttribution.summary());\n",'');
assert.equal(old,fs.readFileSync(path.resolve(root,'../main-source/test/run.js'),'utf8'));
console.log(JSON.stringify({PASS:true,exactCandidateFiles:Object.keys(pins),productionImport:importLine[0],wholeLegacyRunnerIdentity:true,reusedIndependent:'independent-wiring.json:32 cases/16 omissions; same complete source bytes',scope:'isolated current-main affected validation, no full CLI/guest'}));
