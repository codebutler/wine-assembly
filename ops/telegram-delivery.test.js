'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const inbox=require('./telegram-inbox'),{deliverReply,receiptPath}=require('./telegram-delivery');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'telegram-delivery-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const dir=path.join(root,'scratch/telegram');fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,'inbox.jsonl'),consumer={agent:'codex-test',agentId:'codex:abc',kind:'codex',deliveryRequiredAfter:123};
 fs.writeFileSync(file,[123,124,125].map(id=>JSON.stringify({id,text:'question '+id,at:'2026-01-01T00:00:00Z'})).join('\n')+'\n');
 fs.writeFileSync(inbox.cursorPath(dir,consumer.agent),'125\n');
 return {root,dir,file,consumer,options:{dir,consumer:consumer.agent,inboxId:124,text:'No new screenshots.'}};
}
test('read cursor cannot hide unanswered messages; acknowledged delivery clears only its inbox id',async t=>{
 const f=fixture(t);assert.deepEqual(inbox.readPendingSync(f.file,f.consumer).map(x=>x.id),[124,125]);
 let calls=0;const send=async()=>{calls++;assert.deepEqual(inbox.readPendingSync(f.file,f.consumer).map(x=>x.id),[124,125]);return {message_id:10};};
 const r=await deliverReply({...f.options,send});assert.equal(r.status,'delivered');assert.deepEqual(r.messageIds,[10]);
 assert.deepEqual(inbox.readPendingSync(f.file,f.consumer).map(x=>x.id),[125]);
 await deliverReply({...f.options,send});assert.equal(calls,1);
 await assert.rejects(deliverReply({...f.options,text:'Different reply',send}),/different saved text/);assert.equal(calls,1);
});
test('API rejection keeps pending; retry resumes after acknowledged chunks without resending them',async t=>{
 const f=fixture(t);let calls=0;
 const options={...f.options,text:'a'.repeat(3500)};
 await assert.rejects(deliverReply({...options,send:async()=>{
  if(++calls===2){const e=Error('rate limited');e.definitelyRejected=true;throw e;}return {message_id:11};
 }}),/rate limited/);
 assert.equal(inbox.readPendingSync(f.file,f.consumer).length,2);
 const r=await deliverReply({...options,send:async text=>{assert.equal(text.length,500);calls++;return {message_id:12};}});
 assert.deepEqual(r.messageIds,[11,12]);assert.equal(calls,3);
});
test('network ambiguity and missing acknowledgements remain pending and are not blindly resent',async t=>{
 for(const send of [async()=>{throw Error('timeout');},async()=>({})]){
  const f=fixture(t);await assert.rejects(deliverReply({...f.options,send}));
  assert.equal(inbox.readPendingSync(f.file,f.consumer).length,2);
  await assert.rejects(deliverReply({...f.options,send:async()=>{assert.fail('must not resend');}}),/uncertain/);
 }
});
test('concurrent send is excluded; partial or corrupt receipt never counts as delivered',async t=>{
 const f=fixture(t);let release,entered;
 const ready=new Promise(r=>entered=r),pause=new Promise(r=>release=r);
 const first=deliverReply({...f.options,send:async()=>{entered();await pause;return {message_id:20};}});
 await ready;
 await assert.rejects(deliverReply({...f.options,send:async()=>assert.fail('concurrent send')}),{code:'EEXIST'});
 release();await first;
 const file=receiptPath(f.dir,f.consumer.agent,124);fs.writeFileSync(file,'broken');
 assert.equal(inbox.readPendingSync(f.file,f.consumer).length,2);
 fs.writeFileSync(file,JSON.stringify({consumer:f.consumer.agent,inboxId:124,status:'delivered',chunks:[{},{}],messageIds:[20]}));
 assert.equal(inbox.readPendingSync(f.file,f.consumer).length,2);
});
test('watchdog nudges read-but-undelivered inbox and stops after confirmed delivery',async t=>{
 const f=fixture(t),{inboxNudges}=require('./work-watchdog');
 const dir=path.join(f.root,'scratch/work-watchdog');fs.mkdirSync(dir,{recursive:true});
 const state={},requests=[],now=Date.now(),args={root:f.root,dir,state,now,save:()=>{},config:{telegramInbox:{consumers:[f.consumer]}},
  terminals:[{id:'orchestrator',agentId:'codex:abc',idle:true,screenHash:'hash'}],request:async(...a)=>requests.push(a)};
 await inboxNudges(args);assert.equal(requests.length,1);assert.match(requests[0][1].message,/2 pending.*delivery receipts/);
 assert(inbox.NUDGE_RE.test(requests[0][1].message));
 await deliverReply({...f.options,send:async()=>({message_id:21})});
 await deliverReply({...f.options,inboxId:125,send:async()=>({message_id:22})});
 await inboxNudges({...args,now:now+20*60000});assert.equal(requests.length,1);
});
test('actual sender CLI records Telegram acknowledgement, updates cursor, and deduplicates repeat',t=>{
 const f=fixture(t),{spawnSync}=require('node:child_process'),ops=path.join(f.root,'ops');fs.mkdirSync(ops);
 for(const name of ['telegram-send.js','telegram-delivery.js','telegram-inbox.js','telegram-replies.js'])fs.copyFileSync(path.join(__dirname,name),path.join(ops,name));
 fs.writeFileSync(path.join(f.root,'scratch/telegram-token.txt'),'1:fixture');
 fs.writeFileSync(path.join(f.dir,'state.json'),JSON.stringify({owner:{chatId:1}}));
 fs.writeFileSync(path.join(ops,'work-watchdog.json'),JSON.stringify({telegramInbox:{consumers:[f.consumer]}}));
 fs.writeFileSync(inbox.cursorPath(f.dir,f.consumer.agent),'123\n');
 const preload=path.join(f.root,'transport.cjs'),calls=path.join(f.root,'calls.jsonl'),body=path.join(f.root,'reply.txt');
 fs.writeFileSync(body,'Reply from file');
 fs.writeFileSync(preload,`global.fetch=async(url,options)=>{require('fs').appendFileSync(${JSON.stringify(calls)},JSON.stringify(JSON.parse(options.body))+'\\n');return {status:200,json:async()=>({ok:true,result:{message_id:55}})};};`);
 const run=args=>spawnSync(process.execPath,['--require',preload,path.join(ops,'telegram-send.js'),...args],{encoding:'utf8'});
 const args=['--consumer',f.consumer.agent,'--reply-to','124','--text-file',body];
 let r=run(args);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).status,'delivered');
 assert.equal(inbox.readCursorSync(inbox.cursorPath(f.dir,f.consumer.agent)),124);
 r=run(args);assert.equal(r.status,0,r.stderr);assert.equal(fs.readFileSync(calls,'utf8').trim().split('\n').length,1);
 r=run(['--pending','--consumer',f.consumer.agent]);assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout).map(x=>x.id),[125]);
 r=run(['--consumer',f.consumer.agent,'--reply-to','999','--text-file',body]);assert.notEqual(r.status,0);assert.equal(fs.readFileSync(calls,'utf8').trim().split('\n').length,1);
});
