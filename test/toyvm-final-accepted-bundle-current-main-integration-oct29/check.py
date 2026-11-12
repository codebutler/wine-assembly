#!/usr/bin/env python3
"""Bounded integration smoke; never invokes the accounted adapter."""
import hashlib, importlib.util, json, marshal, pathlib, sys, tempfile
HERE=pathlib.Path(__file__).resolve().parent
REPO=HERE.parents[1]
P=json.loads((HERE/'provenance.json').read_text())
def module(path,name):
 spec=importlib.util.spec_from_file_location(name,path)
 m=importlib.util.module_from_spec(spec)
 exec(compile(path.read_bytes(),str(path),'exec',dont_inherit=True),m.__dict__)
 return m
def main():
 for name,pin in P['sourcePins'].items():
  b=(REPO/name).read_bytes()
  assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'],name
 caller=REPO/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
 adapter=REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py'
 c=module(caller,'exact_integration_caller')
 f=c.load_backend()
 expected=module(adapter,'exact_adapter_comparison').supervise_accounted
 assert marshal.dumps(f.__code__)==marshal.dumps(expected.__code__)
 assert f.__name__=='supervise_accounted'
 g=f.__globals__
 assert f.__code__.co_filename==str(adapter)
 assert g['__file__']==str(adapter) and g['__spec__'].origin==str(adapter)
 assert g['HERE']==adapter.parent and g['__name__']=='accepted_accounted_adapter'
 supervisor='test/toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py'
 assert g['PIN']==P['sourcePins'][supervisor]['sha256']
 assert c.BACKEND_PINS=={n.removeprefix('test/'):v['sha256'] for n,v in P['sourcePins'].items() if n!=str(caller.relative_to(REPO))}
 audit={'armed':False,'root':'','events':[]}
 def hook(event,args):
  if audit['armed'] and event=='exec' and str(args[0].co_filename).startswith(audit['root']):
   audit['events'].append(args[0].co_filename)
 sys.addaudithook(hook)
 rejected=[]
 with tempfile.TemporaryDirectory(prefix='integration-tamper-',dir=REPO.parent) as td:
  root=pathlib.Path(td)
  for relative in c.BACKEND_PINS:
   for name in P['sourcePins']:
    target=root/name
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes((REPO/name).read_bytes())
   target=root/'test'/relative
   target.write_bytes(target.read_bytes()+b"\nraise AssertionError('TAMPER_EXECUTED')\n")
   private=module(root/caller.relative_to(REPO),'exact_private_caller')
   audit.update(armed=True,root=str(root),events=[])
   try:
    try: private.load_backend()
    except RuntimeError as e:
     assert str(e)=='accepted backend identity mismatch: '+relative
    else: raise AssertionError('tampered dependency accepted')
   finally: audit['armed']=False
   assert audit['events']==[]
   rejected.append(relative)
 result=dict(PASS=True,sourcePins=P['sourcePins'],boundary='exact production caller.load_backend',returned='accepted_accounted_adapter.supervise_accounted',transitiveSupervisorPin=g['PIN'],tamperRejectedBeforeExecution=rejected,adapterInvocations=0,scope=P['scope'])
 (HERE/'results.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(dict(PASS=True,sourceCount=5,tamperRejections=len(rejected),adapterInvocations=0)))
if __name__=='__main__': main()
