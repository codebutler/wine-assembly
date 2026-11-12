from common import *
E=R/'docs/reviews'/H.name;E.mkdir(parents=True,exist_ok=True)
old=pathlib.Path('/tmp/enigma-presented-controller-independent-accept-oct26/repo/docs/reviews/enigma-presented-controller-independent-accept-oct26/independent.cjs').read_bytes()
(E/'unchanged-before-oracle.cjs').write_bytes(old)
prefix=old.decode().split('(async()=>{')[0]
prefix=prefix.replace("const parts=require('./runner-slices.json');", "const parts=require('../enigma-atomic-presented-click-repair-oct26/runner-slices.json');\nconst {ATOMIC_ACTION,ATOMIC_BRANCH,wireRunner}=require('../../../tools/enigma-presented-menu-controller.cjs');")
prefix=prefix.replace('${parts.handleControlCommand}', '${parts.handleControlCommand.replace("    if (cmd.action === \'eval\') return controlEval(cmd.code || \'\');",ATOMIC_BRANCH+"    if (cmd.action === \'eval\') return controlEval(cmd.code || \'\');")}')
prefix=prefix.replace('const ask=async cmd=>{','const innerAsk=async cmd=>{')
prefix=prefix.replace("return {run:createController(ask,", "const atomicRequests=[];let requests=0,duplicateReply=null;\n const ask=async cmd=>{\n  requests++;\n  if(typeof fault==='object' && requests===fault.at)vm.runInContext(fault.code,context);\n  if(cmd.action===ATOMIC_ACTION){\n   atomicRequests.push({...cmd});\n   if(fault==='beforeTransportLoss')throw Error('transport lost before dispatch');\n   const reply=await innerAsk(cmd);\n   if(fault==='lostReplyEnvelope')return {ok:false,error:'transport lost AFTER enqueue'};\n   if(fault==='lostReplyThrow')throw Error('transport lost AFTER enqueue');\n   if(fault==='malformedAck')return {ok:true,value:{queued:false,batch:100000}};\n   if(fault==='duplicateRequest')duplicateReply=await innerAsk(cmd);\n   return reply;\n  }\n  return innerAsk(cmd);\n };\n return {atomicRequests,get duplicateReply(){return duplicateReply},run:createController(ask,")
(E/'fixture.cjs').write_text(prefix+'\nmodule.exports={fixture};\n')
print('FIXTURE PREPARED; no acceptance execution')
