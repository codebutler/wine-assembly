#!/usr/bin/env node
'use strict';
// Send a text message to the owner's Telegram chat.
// Usage: node ops/telegram-send.js "<text>"   (or pipe the text on stdin)
// Uses the same bot token and owner chat as ops/telegram.js.
const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
  const args=process.argv.slice(2);let consumer,inboxId,textFile,pending=false;
  while(args[0]?.startsWith('--')){
    const key=args.shift();
    if(key==='--consumer')consumer=args.shift();
    else if(key==='--reply-to')inboxId=Number(args.shift());
    else if(key==='--text-file')textFile=args.shift();
    else if(key==='--pending')pending=true;
    else throw Error('Unknown option: '+key);
  }
  const dir=path.join(root,'scratch/telegram'),inbox=require('./telegram-inbox');
  if(pending){
    const config=JSON.parse(await fs.readFile(path.join(root,'ops/work-watchdog.json'),'utf8'));
    const c=config.telegramInbox?.consumers?.find(c=>c.agent===consumer);
    if(!c)throw Error('Unknown inbox consumer');
    console.log(JSON.stringify(inbox.readPendingSync(path.join(root,inbox.INBOX),c)));return;
  }
  if(consumer!==undefined||inboxId!==undefined){
    require('./telegram-delivery').receiptPath(dir,consumer,inboxId);
    if(!(await inbox.readInbox(path.join(root,inbox.INBOX))).some(e=>e.id===inboxId))throw Error('Unknown inbox id');
  }
  let text=textFile?await fs.readFile(textFile,'utf8'):args.join(' ');
  if(!text){const chunks=[];for await(const c of process.stdin)chunks.push(c);text=Buffer.concat(chunks).toString('utf8');}
  text=text.trim();if(!text)throw Error('usage: telegram-send.js "<text>"');
  const token=(await fs.readFile(process.env.TELEGRAM_TOKEN_FILE||path.join(root,'scratch/telegram-token.txt'),'utf8')).trim();
  if(!/^\d+:[A-Za-z0-9_-]+$/.test(token))throw Error('Invalid bot token file');
  const state=JSON.parse(await fs.readFile(path.join(root,'scratch/telegram/state.json'),'utf8'));
  const chatId=state.owner&&state.owner.chatId;if(!chatId)throw Error('No owner chat in scratch/telegram/state.json');
  async function send(text,options={}){
    let response;try{response=await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({chat_id:chatId,text,...options}),signal:AbortSignal.timeout(30000)});}catch{throw Error('Telegram delivery uncertain: network request failed');}
    const data=await response.json();if(!data.ok){const e=Error('sendMessage rejected ('+response.status+')');e.definitelyRejected=true;throw e;}
    return data.result;
  }
  if(consumer){
    const r=await require('./telegram-delivery').deliverReply({dir,consumer,inboxId,text,send});
    const cursor=inbox.cursorPath(dir,consumer),next=Math.max(inbox.readCursorSync(cursor),inboxId);
    await fs.writeFile(cursor+'.tmp',next+'\n',{mode:0o600});await fs.rename(cursor+'.tmp',cursor);
    console.log(JSON.stringify({inboxId,status:r.status,messageIds:r.messageIds}));return;
  }
  for(let i=0;i<text.length;i+=4000){
    const result=await send(text.slice(i,i+4000));console.log(JSON.stringify({messageId:result.message_id}));
  }
})().catch(e=>{console.error(e.message);process.exitCode=1});
