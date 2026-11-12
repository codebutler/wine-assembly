'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const inbox=require('./telegram-inbox'),{inboxNudges,queueCodexInbox}=require('./work-watchdog');
const {deliverReply}=require('./telegram-delivery');
const thread='01a0ff91-cf9d-7f42-ba93-f9e7616b35a5';
function setup(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tg-queue-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const dir=path.join(root,'scratch/work-watchdog');fs.mkdirSync(dir,{recursive:true});
 const consumer={agent:'codex-test',agentId:'codex:'+thread,kind:'codex',deliveryRequiredAfter:0,deliveryMode:'codex-queue'};
 const terminal={id:'orchestrator',agentId:consumer.agentId,idle:false,promptOpen:true,screenHash:'draft'};
 const args={root,dir,config:{enabled:true,telegramInbox:{consumers:[consumer]}},terminals:[terminal],state:{},save:()=>{},now:Date.now(),request:async()=>assert.fail('must never type into terminal')};
 return {root,dir,consumer,terminal,args,file:path.join(root,inbox.INBOX)};
}
test('fresh pending request reaches busy/draft Codex via native queue, once, without marking delivered',async t=>{
 const f=setup(t);await inbox.appendInbox(f.file,{text:'PRIVATE screenshot question',at:new Date(f.args.now).toISOString()});
 fs.writeFileSync(inbox.cursorPath(path.dirname(f.file),f.consumer.agent),'1');
 const calls=[];f.args.queue=async a=>{assert.ok(f.args.state.telegramInbox[f.consumer.agent].lastQueueAt>=f.args.now);calls.push(a);};
 await inboxNudges(f.args);await inboxNudges({...f.args,now:f.args.now+30000});
 assert.equal(calls.length,1);assert.equal(calls[0].thread,thread);assert(!calls[0].message.includes('PRIVATE'));
 assert.equal(inbox.readPendingSync(f.file,f.consumer).length,1);
 await inbox.appendInbox(f.file,{text:'second question',at:new Date(f.args.now+40000).toISOString()});
 await inboxNudges({...f.args,now:f.args.now+40000});assert.equal(calls.length,2,'new IDs bypass old notification cooldown');
 for(const id of [1,2])await deliverReply({dir:path.dirname(f.file),consumer:f.consumer.agent,inboxId:id,text:'status',send:async()=>({message_id:100+id})});
 await inboxNudges({...f.args,now:f.args.now+3600000});assert.equal(calls.length,2,'delivered requests never requeue');
});
test('queue respects disabled/paused configuration and missing or malformed terminal registration',async t=>{
 const f=setup(t);await inbox.appendInbox(f.file,{text:'question',at:new Date(f.args.now-500000).toISOString()});
 const queue=async()=>assert.fail('must not queue');
 for(const config of [{...f.args.config,enabled:false},{...f.args.config,paused:true},{...f.args.config,pausedTerminals:['orchestrator']},
  {...f.args.config,telegramInbox:{...f.args.config.telegramInbox,paused:true}}])await inboxNudges({...f.args,config,queue});
 await inboxNudges({...f.args,terminals:[],queue});
 const d=inbox.nudgeDecision({unread:[{id:1,at:'2026-01-01'}],terminal:{...f.terminal,agentId:'codex:short'},consumer:f.consumer});
 assert.equal(d.send,false);
});
test('ambiguous native-queue failure persists cooldown and leaves reply pending',async t=>{
 const f=setup(t);await inbox.appendInbox(f.file,{text:'question',at:new Date(f.args.now).toISOString()});
 let calls=0;const queue=async()=>{calls++;throw Error('timeout');};
 await inboxNudges({...f.args,queue});assert.match(f.args.state.telegramInbox[f.consumer.agent].reason,/not confirmed/);
 await inboxNudges({...f.args,queue,now:f.args.now+30000});assert.equal(calls,1);
 assert.equal(inbox.readPendingSync(f.file,f.consumer).length,1);
});
test('CLI adapter uses argument boundaries, receipt instructions and no terminal input',async()=>{
 let call;
 await queueCodexInbox({root:'/work dir',thread,message:inbox.nudgeLine(1,true),consumer:'codex-test',exec:async(...args)=>{call=args;}});
 assert.deepEqual(call[1].slice(0,4),['queue','--thread',thread,'--message']);
 assert.match(call[1][4],/Prioritize this owner request/);assert.match(call[1][4],/--reply-to ID/);
 assert.equal(call[2].cwd,'/work dir');assert.equal(call[2].timeout,15000);
 await assert.rejects(queueCodexInbox({root:'.',thread:'bad',message:'oops',consumer:'x'}),/Invalid/);
 await assert.rejects(queueCodexInbox({root:'.',thread,message:inbox.nudgeLine(1,true),consumer:'x; touch bad'}),/invalid/);
});
