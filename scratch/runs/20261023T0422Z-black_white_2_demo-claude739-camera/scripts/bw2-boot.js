#!/usr/bin/env node
'use strict';
// Boot driver for the B&W2 free-play route (docs/re-notes/black-white-2.md,
// "2026-10-11: route to free play"). Waits AT seconds after start, then sends
// the menu inputs through tools/ctl.js against the probe's --control port.
// Usage: node bw2-boot.js REPO LOGFILE [AT=450]
const {execFileSync}=require('child_process'),fs=require('fs'),path=require('path');
const [repo,logFile,atArg]=process.argv.slice(2),at=Number(atArg||450);
const log=m=>fs.appendFileSync(logFile,`${new Date().toISOString()} ${m}\n`);
const ctl=(...a)=>{try{const o=execFileSync(process.execPath,[path.join(repo,'tools/ctl.js'),...a],{cwd:repo,timeout:60000}).toString().trim();log(`ctl ${a.join(' ')} -> ${o.slice(0,200)}`);}catch(e){log(`ctl ${a.join(' ')} FAILED ${e.message.slice(0,200)}`);}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const hook=process.env.BW2_RETIRE_HOOK;
  if(hook){
    log('waiting 200s to arm retire hook');await sleep(200*1000);
    ctl('eval',fs.readFileSync(hook,'utf8').replace('__OUT__',path.join(path.dirname(logFile),'failed-draw.json')));
    await sleep((at-200)*1000);
  }else{log(`boot driver waiting ${at}s`);await sleep(at*1000);}
  ctl('png',path.join(path.dirname(logFile),'boot-before.png'));
  for(const c of ['relmousemove:-2000:-2000','relmousemove:250:277'])ctl('cmd',c),await sleep(2000);
  ctl('cmd','di-mousedown:1');await sleep(300);ctl('cmd','di-mouseup:1');await sleep(5000);
  ctl('cmd','keydown:13');await sleep(300);ctl('cmd','keyup:13');await sleep(10000);
  ctl('png',path.join(path.dirname(logFile),'boot-after.png'));log('boot driver done');
})();
