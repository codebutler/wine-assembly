from common import *
P=R/'docs/reviews'/H.name
s=''''use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm'),{createRequire}=require('node:module');
const {wireRunner,ATOMIC_BRANCH,ATOMIC_ACTION}=require('../../../tools/enigma-presented-menu-controller.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=fs.readFileSync(process.argv[2],'utf8'),parts=require('./runner-slices.json');
const wired=wireRunner(source);
assert.throws(()=>wireRunner(source+' '),/identity mismatch/);
assert.throws(()=>wireRunner(wired),/identity mismatch/);
assert.equal(wired.split(ATOMIC_BRANCH).length,2);
assert.equal(wired.replace(ATOMIC_BRANCH,''),source);
assert(wired.includes(parts.handleControlCommand.replace("    if (cmd.action === 'eval') return controlEval(cmd.code || '');",ATOMIC_BRANCH+"    if (cmd.action === 'eval') return controlEval(cmd.code || '');")));
let prefix=fs.readFileSync(__dirname+'/repaired.cjs','utf8').split('(async()=>{')[0];
prefix=prefix.replace('let evals=0,requests=0;','let evals=0,requests=0; const atomicRequests=[];');
prefix=prefix.replace('events.push(cmd.action||cmd.cmd);requests++;','events.push(cmd.action||cmd.cmd);requests++; if(cmd.action===ATOMIC_ACTION)atomicRequests.push(cmd);');
prefix=prefix.replace("if(fault==='cleanupError')return", "if(fault==='cleanupLostReply'){await context.command(cmd);return {ok:false,error:'cleanup reply lost'}}; if(fault==='cleanupError')return");
prefix=prefix.replace('get paints(){return paints}}','atomicRequests,get paints(){return paints}}');
const fixture=new Function('require','__dirname',prefix+';return fixture;')(createRequire(__dirname+'/repaired.cjs'),__dirname);
(async()=>{
 const f=fixture('lazy');await f.run();assert.equal(f.atomicRequests.length,1);
 assert.throws(()=>f.context.command(f.atomicRequests[0]),/invalidated/);
 assert.equal(f.context.schedule.length,1);
 const a=fixture('atomicLostReply');await assert.rejects(a.run());assert.equal(a.atomicRequests.length,1);
 assert.throws(()=>a.context.command(a.atomicRequests[0]),/invalidated/);assert.equal(a.context.schedule.length,1);
 const c=fixture('cleanupLostReply');await assert.rejects(c.run());assert.equal(c.context.schedule.length,0);assert.equal(c.renderer.repaint,c.original);
 // Use the unmodified actual handler for a stock-runner rejection control.
 const stockFixture=new Function('require','__dirname',prefix.replace('ATOMIC_BRANCH+"    if', '"    if')+';return fixture;')(createRequire(__dirname+'/repaired.cjs'),__dirname);
 const u=stockFixture('lazy');await assert.rejects(u.run());assert.equal(u.context.schedule.length,0);assert.equal(u.renderer.repaint,u.original);
 console.log(JSON.stringify({pass:9,checks:['source SHA rejects drift','double wiring rejects','one insertion','all other bytes identical','complete handler wired','exact successful request replay rejects','lost enqueue reply replay rejects','cleanup reply loss no enqueue restored','unwired handler rejects no enqueue'],sourceSHA256:sha(source),wiredSHA256:sha(wired),wiredBytes:Buffer.byteLength(wired),guestExecutions:0}));
})().catch(e=>{console.error(e);process.exitCode=1});
'''
(P/'wiring-controls.cjs').write_text(s)
gate('wiring')
b=run([NODE,'--max-old-space-size=192',str(P/'wiring-controls.cjs'),'/tmp/enigma-presented-frame-controller-repair-oct26/ops/pinned-run.js']);(P/'wiring-results.json').write_bytes(b)
save('wiring-checkpoint.json',dict(candidate=REV,sourceSHA256=sha((R/'tools/enigma-presented-menu-controller.cjs').read_bytes()),fixtureSHA256=sha((P/'wiring-controls.cjs').read_bytes()),resultSHA256=sha(b),results=json.loads(b),remaining='publication; fresh independent acceptance; separately authorized runtime; delivery/gameplay unknown'))
print(b.decode())
