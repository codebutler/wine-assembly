"""Full binary ABI and independently reconstructed storage/span inventory."""
import hashlib,importlib.util,json,pathlib,sys,copy
sys.dont_write_bytecode=True
ROOT=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23')
H=pathlib.Path(__file__).resolve().parents[2]/'ops'
F=ROOT/'docs/re-notes/shadow-man-span-static-canonical-20261023'
spec=importlib.util.spec_from_file_location('accepted_static_abi',F/'static-abi.py')
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
m=json.loads((F/'manifest.json').read_text());combined=pathlib.Path(m['standingCombined']['path'])
assert hashlib.sha256(combined.read_bytes()).hexdigest()==m['standingCombined']['sha256']
imports,exports=a.source_abi(combined)
regions,serialization,layout=a.inventory(combined.read_text(),(ROOT/'lib/region-map.generated.js').read_text())
assert layout=='9a3bc9149d58209c' and len(regions)==269 and sum(r['kind']=='span' for r in regions)==1
fields='started phase token entries parks completions fault capped active api thunk thread regs pre ret post result'.split()
for n in fields:exports['msc_'+n]=dict(params=[],results=['i32'])
exports['msc_start']=dict(params=[],results=[])
def sections(p):
 r=a.Reader(p.read_bytes()[8:]);out={}
 while r.p<len(r.b):
  kind=r.byte();body=r.take(r.leb())
  if kind:out[kind]=body
 return out
def globals_(body):
 r=a.Reader(body);out=[]
 for _ in range(r.leb()):
  start=r.p;ty=r.byte();mut=r.byte();op=r.byte()
  assert op in (0x41,0x42,0x43,0x44)
  if op in (0x41,0x42):
   while r.byte()&128:pass
  else:r.take(4 if op==0x43 else 8)
  assert r.byte()==0x0b
  out.append((ty,mut,body[start:r.p]))
 r.end();return out
baseline=ROOT/'build/wine-assembly.wasm'
assert hashlib.sha256(baseline.read_bytes()).hexdigest()=='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'
base=sections(baseline);baseGlobals=globals_(base[6]);outputs=[];controls=[]
for row in json.loads((H/'build-outputs.json').read_text()):
 p=pathlib.Path(row['path']);o=a.parse(p);assert o['sha256']==row['sha256']
 a.compare(o,imports,exports,layout)
 assert not any(c['name']=='name' for c in o['customSections'])
 # Preserve all original globals in order; add exactly 18 private mutable i32 zeros.
 if not row['tailCalls']:
  originalCompat=ROOT/'build/wine-assembly.compat.wasm'
  historical=json.loads((F/'outputs.json').read_text())
  expected=next(r for r in historical if r['path'].endswith('wine-assembly.compat.wasm'))
  assert hashlib.sha256(originalCompat.read_bytes()).hexdigest()==expected['sha256']
  baseGlobals=globals_(sections(originalCompat)[6])
 gs=globals_(sections(p)[6]);remaining=iter(gs)
 for old in baseGlobals:
  while True:
   now=next(remaining)
   if now==old:break
   assert now==(127,1,b'\x7f\x01\x41\x00\x0b')
 assert len(gs)==len(baseGlobals)+18
 # Memory allocation/data payload is unaffected by private scalar state.
 current=sections(p)
 for n in (5,11):assert current.get(n)==base.get(n),('guest storage section changed',n)
 for name,mutate in [
  ('new host import',lambda x:x['imports'].append(dict(module='host',name='forged',kind=0,signature=dict(params=[],results=[])))),
  ('wrong getter signature',lambda x:next(e for e in x['exports'] if e['name']=='msc_result')['signature'].update(results=[])),
  ('wrong layout payload',lambda x:next(c for c in x['customSections'] if c['name']=='wine-region-layout').update(payloadHex=b'0000000000000000'.hex())),
 ]:
  bad=copy.deepcopy(o);mutate(bad)
  try:a.compare(bad,imports,exports,layout)
  except AssertionError:controls.append(dict(binary=p.name,control=name,rejected=True))
  else:raise AssertionError(('control escaped',name))
 outputs.append(o)
out=dict(status='PASS',outputs=outputs,importsCompared=len(imports),functionExportsCompared=len(exports),
 inventory=regions,serialization=serialization,computedLayout=layout,controls=controls,privateGlobalsAdded=18,
 helper=dict(path=str(F/'static-abi.py'),sha256=hashlib.sha256((F/'static-abi.py').read_bytes()).hexdigest()),nativeInstances=0)
(H/'static-abi.json').write_text(json.dumps(out,indent=2))
print(json.dumps(dict(status='PASS',imports=len(imports),exports=len(exports),regions=len(regions),layout=layout,controls=len(controls))))
