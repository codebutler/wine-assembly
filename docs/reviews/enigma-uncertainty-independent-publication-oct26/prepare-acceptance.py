from common import *
V=R/'docs/reviews'/H.name;V.mkdir(parents=True,exist_ok=True)
# Preserve original fixture and oracle verbatim in their original tracked locations.
f=(R/'docs/reviews/enigma-atomic-click-independent-accept-oct26/fixture.cjs').read_text()
f=f.replace("require('../enigma-atomic-presented-click-repair-oct26/runner-slices.json')","require('./tracked-runner-slices.json')")
f=f.replace("if(fault==='malformedAck')", "if(fault==='missingValue')return {ok:true};\n   if(fault==='missingEnvelope')return undefined;\n   if(fault==='nullAck')return {ok:true,value:null};\n   if(fault==='wrongBatch')return {ok:true,value:{queued:true,batch:100001}};\n   if(fault==='badOk')return {ok:1,value:{queued:true,batch:100000}};\n   if(fault==='malformedAck')")
(V/'fixture.cjs').write_text(f)
s=(O/'tracked-run.js').read_text();ls=s.splitlines(keepends=True)
# Full functions/blocks extracted by unchanged historical exact strings or explicit anchors.
old=json.loads((R/'docs/reviews/enigma-atomic-presented-click-repair-oct26/runner-slices.json').read_text())
parts={};recipes={}
def take(k,start,end):
 a=s.index(start);b=s.index(end,a);val=s[a:b];parts[k]=val;recipes[k]=dict(startByte=a,endByteExclusive=b,firstLine=s[:a].count('\n')+1,lastLine=s[:b].count('\n')+1,bytes=len(val.encode()),sha256=sha(val.encode()),startAnchor=start,endAnchorExclusive=end)
for k in ['presentForRead','dxPresentHook','controlEval','controlPng','snapshotAndSafeValue']:
 v=old[k];a=s.index(v);parts[k]=v;recipes[k]=dict(startByte=a,endByteExclusive=a+len(v),firstLine=s[:a].count('\n')+1,lastLine=s[:a+len(v)].count('\n')+1,bytes=len(v.encode()),sha256=sha(v.encode()),recipe='exact full block selected by committed historical block bytes, independently found exactly once in immutable tracked runner');assert s.count(v)==1
# Two complete changed blocks: exact range to next declaration.
take('parseInputEntries','  const parseInputEntries = (entries) => {','  if (INPUT_SPEC)')
take('handleControlCommand','  const handleControlCommand = (cmdIn) => {','  const control = (CONTROL || CONTROL_STDIN)')
take('drainPrefix','    while (scheduledInput.length && scheduledInput[0].batch <= batch) {','      // Start the input->blit clock')
take('clickBody',"      } else if (ev.action === 'click' && renderer && renderer.handleMouseDown) {","      } else if (ev.action === 'mousedown'")
(V/'tracked-runner-slices.json').write_text(json.dumps(parts,indent=2)+'\n')
save('runner-extraction.json',dict(candidate=REV,path='test/run.js',blob='4b8461338f4bcddde6b5d5504991523b28d3ac35',sha256=sha(s.encode()),bytes=len(s.encode()),recipes=recipes,extractionOrder=list(parts),historicalComparison={k:parts[k]==old.get(k) for k in parts}))
# No production wiring bypass: inserted branch used solely in the explicit controlled fixture.
print(json.dumps({k:{'bytes':v['bytes'],'lines':[v['firstLine'],v['lastLine']]} for k,v in recipes.items()}))
