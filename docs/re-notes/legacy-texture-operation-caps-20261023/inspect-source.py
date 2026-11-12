import guard as g,subprocess,re,json,pathlib,hashlib
R='/tmp/d3d-scoped-native-qualification-oct23/repo';V='5406777ecbcef9cf9b03b40d592d722bb0086de0'
def read(p):return subprocess.check_output(['git','-C',R,'show',V+':'+p])
m=json.loads((g.B/'focused-manifest.json').read_text());seen={r['path'] for r in m['files']};pending=list(seen)
while pending:
 p=pending.pop()
 if not p.endswith('.js'):continue
 b=read(p)
 for spec in re.findall(r'require\([\'\"]([^\'\"]+)[\'\"]\)',b.decode()):
  if not spec.startswith('.'):continue
  q=str(pathlib.PurePosixPath(p).parent/spec)
  import posixpath
  q=posixpath.normpath(q)
  if not q.endswith('.js'):q+='.js'
  if q in seen:continue
  z=read(q);seen.add(q);pending.append(q)
  m['files'].append({'path':q,'blob':subprocess.check_output(['git','-C',R,'rev-parse',V+':'+q],text=True).strip(),'bytes':len(z),'sha256':hashlib.sha256(z).hexdigest()})
m['selectedBytes']=sum(r['bytes'] for r in m['files']);g.write(g.B/'focused-manifest.json',m)
print('COMPLETE closure',len(seen),m['selectedBytes'],sorted(seen))
w=read('src/09ab-handlers-d3dim-core.wat').decode().splitlines()
for a,b in [(4920,5070),(8170,8270)]:
 print('\nWAT',a,b);print('\n'.join(f'{i+1}: {l}' for i,l in enumerate(w) if a<=i+1<=b))
print('outer references');print('\n'.join(f'{i+1}: {l}' for i,l in enumerate(w) if ('texture_stage_combine' in l or ('colorop' in l.lower()) or ('alphaop' in l.lower()))))
j=read('lib/d3dim-gpu.js').decode().splitlines();print('GPU');print('\n'.join(f'{i+1}: {l}' for i,l in enumerate(j) if 725<=i+1<=820))
