'use strict';
// Keep the raw update before advancing Telegram's acknowledgement cursor.
// This includes commands/callbacks and attachment metadata, even if handling
// later fails. These private records are recovery evidence, not an action queue.
const fs=require('node:fs/promises'),path=require('node:path');
async function archiveUpdate(dir,update){
  if(!Number.isSafeInteger(update?.update_id)||update.update_id<0)throw Error('invalid Telegram update id');
  await fs.mkdir(dir,{recursive:true,mode:0o700});
  const file=path.join(dir,update.update_id+'.json');
  try{JSON.parse(await fs.readFile(file,'utf8'));return file;}catch(e){if(e.code!=='ENOENT')throw e;}
  const temp=file+'.tmp',handle=await fs.open(temp,'w',0o600);
  try{await handle.writeFile(JSON.stringify({receivedAt:new Date().toISOString(),update})+'\n');await handle.sync();}
  finally{await handle.close();}
  await fs.rename(temp,file);
  const directory=await fs.open(dir,'r');try{await directory.sync();}finally{await directory.close();}
  return file;
}
async function receiveUpdate({dir,update,state,save,handle}){
  await archiveUpdate(dir,update);
  const previous=state.offset||0;
  if(update.update_id<previous)return;
  state.offset=update.update_id+1;
  try{await save();}catch(e){state.offset=previous;throw e;}
  // Do not automatically replay ambiguous approvals/actions after a crash.
  // The archived update survives, including when handle throws.
  return handle(update);
}
module.exports={archiveUpdate,receiveUpdate};
