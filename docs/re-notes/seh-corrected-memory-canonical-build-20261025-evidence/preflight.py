import pathlib,json,hashlib,subprocess,importlib.util,re,sys,os
sys.dont_write_bytecode=True
O=pathlib.Path(__file__).resolve().parent;T=O.parent;R=T/'repo';S=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23');C='a3fe340b962da3f31df249881074afe41d6c69a2'
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,d):(O/n).write_text(json.dumps(d,indent=2)+'\n')
def git(*a):return subprocess.check_output(['git','-C',str(R),*a],timeout=60)
P=json.load(open(O/'input-pins.json'));A=S/'docs/re-notes/shadow-man-span-static-canonical-20261023/static-abi.py'
assert sha(A.read_bytes())=='f7313b509c59cd6b01d51f9337b423d5e89c81e18df75ce233a9b308ce241cee'
spec=importlib.util.spec_from_file_location('abi',A);abi=importlib.util.module_from_spec(spec);spec.loader.exec_module(abi)
inventory={r['path']:r for r in P['files']};data={};rows=[];overlays=[]
def read(p):
 if p in data:return data[p]
 b=git('show',C+':'+p); standing=S/p;match=standing.is_file() and sha(standing.read_bytes())==sha(b)
 if p in inventory:
  r=inventory[p];assert len(b)==r['bytes'] and sha(b)==r['sha256'] and match==r['standingMatchesCurrent'],p
 if not p.startswith('src/'):assert match,('compiler/JS input must be used in place unchanged',p)
 row=dict(path=p,bytes=len(b),sha256=sha(b),blob=git('rev-parse',C+':'+p).decode().strip(),standingPath=str(standing),standingMatchesCurrent=match)
 rows.append(row);data[p]=b
 if not match:overlays.append(p)
 return b
for p in inventory:read(p)
reached=[];edges=[];active=[]
def walk(p):
 assert p not in active,('include cycle',p)
 if p in reached:return
 reached.append(p);active.append(p);s=read(p).decode();it=iter(abi.tokens(s));prev=None
 for x in it:
  if prev=='(' and x=='include':
   f=json.loads(next(it));assert next(it)==')';q=f.removeprefix('./');q=q if q.startswith('src/') else 'src/'+q
   assert '..' not in pathlib.PurePosixPath(q).parts;edges.append(dict(source=p,include=f,resolved=q));walk(q)
  prev=x
 active.pop()
walk('src/main.watx')
assert set(overlays)=={r['path'] for r in P['currentOverlaysRequired']},overlays
# Replace includes only in reached sources. No combined source materialized.
def expand(p):
 s=data[p].decode()
 def sub(m):
  f=json.loads(m.group(1)).removeprefix('./');q=f if f.startswith('src/') else 'src/'+f
  assert any(e['source']==p and e['resolved']==q for e in edges);return expand(q)
 return re.sub(r'\(include\s+("(?:\\.|[^"\\])*")\s*\)',sub,s)
combined=expand('src/main.watx')
class Text:
 def read_text(self):return combined
regions,serialization,layout=abi.inventory(combined,data['lib/region-map.generated.js'].decode());imports,exports=abi.source_abi(Text())
for mutate in ['omission','duplicate','change']:
 bad=[dict(x) for x in regions]
 if mutate=='omission':bad=bad[:-1]
 elif mutate=='duplicate':bad.append(dict(bad[0]))
 else:bad[0]['base']+=4;bad[0]['end']+=4
 try:
  value=sha(abi.layout_lines(bad).encode())[:16];assert value==layout
 except AssertionError:pass
 else:raise AssertionError(('inventory control accepted',mutate))
save('closure.json',dict(candidate=C,entry='src/main.watx',reached=reached,includeEdges=edges,files=rows,streamedOverlays=overlays,combinedSHA256=sha(combined.encode()),combinedBytes=len(combined.encode()),closureSHA256=sha(('\n'.join(f"{r['path']} {r['sha256']}" for r in sorted(rows,key=lambda r:r['path']))+'\n').encode()),compilerPath=str(S/'tools/watx.js'),compilerFullSHA256=sha(data['tools/watx.js']),compilerStagePaths=[str(S/p) for p in data if p.startswith('tools/watx-src/')],excerptsUsed=False))
save('expected-abi-layout.json',dict(helperPath=str(A),helperSHA256=sha(A.read_bytes()),regions=regions,serialization=serialization,layout=layout,imports=imports,exports=exports,rejectingControls=['omission','duplicate','change'],noNativeExecution=True))
# Reuse the exact accepted guard review receipts; no guard review chain replay.
review=pathlib.Path('/home/user/wine-assembly-render-positiont-guarded-com-qualification-oct23/docs/re-notes/render-positiont-guarded-com-qualification-20261023')
accepted=json.load(open(review/'independent-review.json'));boundary=json.load(open(review/'boundary-acceptance.json'))
guard=P['additionalPins'][0];assert accepted['guardAcceptance']=='ACCEPTED' and boundary['accepted'] and boundary['guardSha256']==guard['sha256']
save('guard-reuse.json',dict(guard=guard,qualifier=P['additionalPins'][-1],receipts=[dict(path=str(review/n),sha256=sha((review/n).read_bytes())) for n in ['independent-review.json','boundary-acceptance.json']],accepted=True,scope='Exact synchronous Buffer Module callsite only; not a hostile-code sandbox',explicitSourceRoots=[str(S),str(R)],Memory=False,Instance=False,guest=False))
print(json.dumps(dict(preflight='PASS',reached=len(reached),dependencies=len(rows),streamed=len(overlays),layout=layout,inventory=len(regions),imports=len(imports),exports=len(exports))))
