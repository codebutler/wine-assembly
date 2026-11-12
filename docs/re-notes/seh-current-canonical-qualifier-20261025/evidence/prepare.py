import pathlib,json,hashlib,subprocess,importlib.util,re,sys
sys.dont_write_bytecode=True
O=pathlib.Path(__file__).resolve().parent;D=pathlib.Path('/tmp/seh-corrected-memory-canonical-build-oct25/ops');R=O.parent/'repo';C='a3fe340b962da3f31df249881074afe41d6c69a2'
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,d):(O/n).write_text(json.dumps(d,indent=2)+'\n')
seal=json.load(open(D/'final-evidence-manifest.json'))
def pinned(p):
 p=pathlib.Path(p);b=p.read_bytes();r=next(x for x in seal if x['path']==str(p));assert sha(b)==r['sha256'] and len(b)==r['bytes'];return dict(path=str(p),bytes=len(b),sha256=sha(b))
inputs={n:pinned(D/n) for n in ['closure.json','expected-abi-layout.json','static-abi.json','build.cjs','guard-reuse.json','trusted-configuration.json']}
M=json.load(open(D/'closure.json'));E=json.load(open(D/'expected-abi-layout.json'));S=json.load(open(D/'static-abi.json'));G=json.load(open(D/'guard-reuse.json'))
assert M['candidate']==C and M['closureSHA256']=='e9c212ccd85445de89271af25660b331b548f8cb2d40ffa5271b312c6c0e699d'
assert M['compilerFullSHA256']=='d04ed1d5ca74fc1b6f10357576a38e726d58f0ad908ccf34a29de35052aa1a33'
for pin in [G['guard'],G['qualifier']]+G['receipts']:
 b=pathlib.Path(pin['path']).read_bytes();assert sha(b)==pin['sha256'];inputs[pathlib.Path(pin['path']).name]=dict(path=pin['path'],sha256=sha(b),bytes=len(b))
A=pathlib.Path(E['helperPath']);assert sha(A.read_bytes())==E['helperSHA256'];spec=importlib.util.spec_from_file_location('abi',A);abi=importlib.util.module_from_spec(spec);spec.loader.exec_module(abi)
data={};rows=[]
for row in M['files']:
 p=subprocess.run(['git','-C',str(R),'cat-file','blob',C+':'+row['path']],capture_output=True,timeout=60);assert p.returncode==0 and not p.stderr
 b=p.stdout;assert sha(b)==row['sha256'] and len(b)==row['bytes'];data[row['path']]=b;rows.append(row)
assert sha(('\n'.join(f"{r['path']} {r['sha256']}" for r in sorted(rows,key=lambda r:r['path']))+'\n').encode())==M['closureSHA256']
def expand(p):
 def sub(m):
  f=json.loads(m.group(1)).removeprefix('./');q=f if f.startswith('src/') else 'src/'+f;assert any(e['source']==p and e['resolved']==q for e in M['includeEdges']);return expand(q)
 return re.sub(r'\(include\s+("(?:\\.|[^"\\])*")\s*\)',sub,data[p].decode())
src=expand('src/main.watx');assert sha(src.encode())==M['combinedSHA256']
class Text:
 def read_text(self):return src
imports,exports=abi.source_abi(Text());assert imports==E['imports'] and exports==E['exports']
# Accepted full independent layout/census reused; verify its serialization binding without repeating census.
assert len(E['regions'])==269 and sha(E['serialization'].encode())[:16]==E['layout']=='9a3bc9149d58209c'
diag=['set_null_diag','null_diag_field','null_diag_token','null_diag_root'];assert not set(diag)&set(exports)
hist=pathlib.Path('/home/user/wine-assembly-shadow-man-capture-build-readiness-oct23/docs/re-notes/shadow-man-capture-build-readiness-20261023/source-boundaries.json');H=json.load(open(hist))
def find(d):
 if isinstance(d,dict):
  if all(k in d for k in diag):return {k:d[k] for k in diag}
  for v in d.values():
   r=find(v)
   if r:return r
 if isinstance(d,list):
  for v in d:
   r=find(v)
   if r:return r
histExports=find(H);assert histExports
allowed=[]
for out,expected in zip(S['outputs'],['bf707aa41e2883e1407c71810a15fd5f1816961938c1103c8d1d5bd40cb701d9','ff495de2b12c308013fa489b9fb291ca836171929655ca20df03440946c54dbc']):
 p=pathlib.Path(out['file']);b=p.read_bytes();assert sha(b)==out['sha256']==expected and len(b)==out['bytes'];allowed.append(dict(path=str(p),sha256=sha(b),bytes=len(b)))
save('source-binding.json',dict(candidate=C,sourceFilesVerified=len(rows),closureSHA256=M['closureSHA256'],combinedSHA256=M['combinedSHA256'],compilerPath=M['compilerPath'],compilerSHA256=M['compilerFullSHA256'],sourceDerivedImports=len(imports),sourceDerivedFunctionExports=len(exports),diagnosticExportsAbsent=diag,historicalDeclarations=histExports,historicalSourceEvidence=dict(path=str(hist),sha256=sha(hist.read_bytes())),layout=dict(hash=E['layout'],entries=269,reusedIndependentInventory=True),excerptsUsed=False,sourceReviewRepeated=False,passed=True))
save('contract.json',dict(version=1,candidate=C,allowed=allowed,inputs=inputs,helper=dict(path=str(A),sha256=E['helperSHA256']),sourceBinding=dict(path=str(O/'source-binding.json'),sha256=sha((O/'source-binding.json').read_bytes())),guard=G['guard'],qualifierHistorical=G['qualifier'],nativeCallsite='const mod=new WebAssembly.Module(b);',scope='synchronous fixed Buffer Module only; no Memory, Instance, compile, validate, instantiate or guest'))
print(json.dumps(dict(passed=True,sourceFiles=len(rows),imports=len(imports),exports=len(exports),layout=E['layout'],allowedBinaries=len(allowed),noCompilation=True)))
