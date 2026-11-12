from stage import *
import sys,subprocess
put(R/'tools/maelstrom-current-main-baseline.cjs',REMOTE+'/repo/tools/maelstrom-current-main-baseline.cjs')
for compat in [False,True]:
 mode='compat' if compat else 'tail';subprocess.run([sys.executable,str(O/'account.py'),'resource-baseline-'+mode+'.json'],check=True,stdout=subprocess.DEVNULL)
 # Fresh local admission is passed as a uniquely named file, exact locked wrapper binds it.
 put(O/('resource-baseline-'+mode+'.json'),REMOTE+'/ops/resource-baseline-'+mode+'.json')
 s=(O/'remote-run-v2.py').read_text().replace("resource-before-compile.json",'resource-baseline-'+mode+'.json');f=O/('run-baseline-'+mode+'.py');f.write_text(s);put(f,REMOTE+'/ops/'+f.name)
 cmd=['python3',REMOTE+'/ops/'+f.name,'compiler','baseline-'+mode,'/home/user/.nvm/versions/node/v24.22.1/bin/node','--max-old-space-size=512','--require','/home/user/maelstrom-uop-canonical-native-qualification-oct26/ops/native-module-bound.cjs',REMOTE+'/repo/tools/maelstrom-current-main-baseline.cjs']+(['--compat'] if compat else [])
 call(cmd,'baseline-'+mode,330)
 code='''import pathlib,json,importlib.util,hashlib
O=pathlib.Path(REMOTEOPS)
spec=importlib.util.spec_from_file_location('a','/home/user/maelstrom-uop-canonical-native-qualification-oct26/ops/static-abi-helper.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
def sections(p):
 r=a.Reader(p.read_bytes()[8:]);out={}
 while r.p<len(r.b):
  k=r.byte();b=r.take(r.leb())
  if k:out[k]=b
 return out
def globals_(body):
 r=a.Reader(body);out=[]
 for _ in range(r.leb()):
  start=r.p;ty=r.byte();mut=r.byte();op=r.byte();assert op in (0x41,0x42,0x43,0x44)
  if op in (0x41,0x42):
   while r.byte()&128:pass
  else:r.take(4 if op==0x43 else 8)
  assert r.byte()==0xb;out.append(body[start:r.p].hex())
 r.end();return out
base=O/'baseline.wasm';target=O/TARGET
b=a.parse(base);d=a.parse(target);bs=sections(base);ds=sections(target)
exports={e['name']:e['signature'] for e in b['exports'] if e['kind']=='function'}
for prefix,fields in [('msc','started phase token entries parks completions fault capped active api thunk thread regs pre ret post result'),('mne','status event token thread regs pre post selectRet parks result nativeEntry callBlock sourceBlock pc esp eax ebp errno caller socketSet timeout rejectReason rejectModes rejectExpectedRet rejectObservedRet rejectPhase rejectCompletions rejectFault rejectActive rejectCapped')]:
 for n in fields.split():exports[prefix+'_'+n]=dict(params=[],results=['i32'])
 exports[prefix+'_start']=dict(params=[],results=[])
# a.compare format is original import oracle dictionary; derive from baseline parse.
print(json.dumps({'baseKeys':list(b),'importSample':b['imports'][:1],'exportSample':b['exports'][:1]}))
(O/('abi-base-'+MODE+'.json')).write_text(json.dumps(dict(base=b,diagnostic=d,globalsBase=globals_(bs[6]),globalsDiagnostic=globals_(ds[6]),storageBase={str(k):hashlib.sha256(bs.get(k,b'')).hexdigest() for k in [4,5,9,11]},storageDiagnostic={str(k):hashlib.sha256(ds.get(k,b'')).hexdigest() for k in [4,5,9,11]})))
base.unlink()
'''.replace('REMOTEOPS',repr(REMOTE+'/ops')).replace('TARGET',repr('errno-latch.compat.wasm' if compat else 'errno-latch.wasm')).replace('MODE',repr(mode))
 print(py(code,'abi-base-'+mode)['stdout'])
