import pathlib, subprocess, json, hashlib, tarfile, re, os
E=pathlib.Path(__file__).resolve().parent
W=E.parents[2]; R=W/'runtime'; ROOT=pathlib.Path('/home/user/wine-assembly')
REV='c26252c4a95babe583ade1d1c6e2da0c050be45c'
QUAL='ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c'
def sha(b): return hashlib.sha256(b).hexdigest()
def save(n,v): (E/n).write_text(json.dumps(v,indent=2)+'\n')
def git(*a): return subprocess.check_output(['git','-C',str(W),*a])
free=os.statvfs(W).f_bavail*os.statvfs(W).f_frsize
assert free>=2982150144
trees={rev:{p:git('rev-parse',rev+':'+p).decode().strip() for p in ['src','lib','tools','host.js','index.html','package-lock.json']} for rev in [REV,QUAL]}
assert trees[REV]==trees[QUAL]
archive=ROOT/'scratch/runs/20261022-mm-timer-canonical-qualification/qualification-artifacts.tar.gz'
assert sha(archive.read_bytes())=='3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248'
with tarfile.open(archive) as t: module=t.extractfile('build/wine-assembly.wasm').read()
assert sha(module)=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
(R/'build').mkdir(exist_ok=True); (R/'build/wine-assembly.wasm').write_bytes(module)
save('module-inventory.json',dict(source=REV,qualified=QUAL,trees=trees,archive=str(archive),archiveSha256=sha(archive.read_bytes()),moduleSha256=sha(module),moduleBytes=len(module),decision='Reuse accepted matching historical source/module; no build. Current main is not the tested revision.',historicalArcanumArchivePresent=(ROOT/'scratch/runs/20261008T1431Z-arcanum-gameplay-qualified').exists()))
source=[]
for p in sorted(R.rglob('*')):
 if p.is_file():
  rel=p.relative_to(R).as_posix(); b=p.read_bytes()
  if not rel.startswith('build/'): assert b==git('show',REV+':'+rel),rel
  source.append(dict(path=rel,size=len(b),sha256=sha(b)))
save('source-manifest.json',source)
base=pathlib.Path('test/binaries/candidates/arcanum-demo'); manifest=base/'.wine-assembly-browser.json'
m=json.loads((ROOT/manifest).read_text())
paths=set([base/'installed/arcanum.exe',manifest]+[base/x['url'] for x in m['files']])
actual=set(p.relative_to(ROOT) for p in (ROOT/base/'installed').rglob('*') if p.is_file())
assert actual==paths-{manifest},dict(missing=list(map(str,paths-actual-{manifest})),extra=list(map(str,actual-paths)))
assets=[dict(path=str(p),size=(ROOT/p).stat().st_size,sha256=sha((ROOT/p).read_bytes())) for p in sorted(paths)]
save('assets.json',dict(files=assets,manifestEntries=len(m['files']),installedFiles=len(actual),totalBytes=sum(x['size'] for x in assets)))
# Audit the actual registered startup native closure, including authentic exports.
native={}; imports={}; dumpdir=E/'imports';dumpdir.mkdir(exist_ok=True)
for name in ['arcanum.exe','binkw32.dll','mss32.dll']:
 s=subprocess.check_output(['objdump','-p',str(ROOT/base/'installed'/name)]).decode()
 (dumpdir/(name+'.txt')).write_text(s)
 native[name]=set(re.findall(r'^\s*\[\s*\d+\]\s+(\S+)',s,re.M))
 rows=[];dll=None
 for line in s.split('PE File Base Relocations')[0].splitlines():
  if 'DLL Name:' in line: dll=line.split('DLL Name:')[1].strip().lower()
  elif dll:
   q=re.match(r'^\s+[0-9a-f]+\s+(\d+)\s+(\S+)\s*$',line)
   if q: rows.append(dict(dll=dll,name=q[2]))
 imports[name]=rows
api={x['name'] for x in json.loads((R/'src/api_table.json').read_text())}
unresolved=[]
for owner,rows in imports.items():
 for row in rows:
  if row['dll'] in native:
   row['resolution']='authentic native export'; ok=row['name'] in native[row['dll']]
  else: row['resolution']='accepted api_table handler';ok=row['name'] in api
  if not ok: unresolved.append(dict(owner=owner,**row))
save('dependency-audit.json',dict(imports=imports,unresolved=unresolved,note='Registered original EXE + binkw32 + mss32 static import closure. SHELL32 and OLE32 use accepted named handlers; no native CRT dependency in this closure. All installed DLL/ASI files remain available in original manifest.'))
assert not unresolved,unresolved
save('allocation.json',dict(freeBefore=free,minimumFree=2982150144,totalLimit=67108864,evidenceReserved=33554432,sourceBytes=sum(x['size'] for x in source),assetsStreamedNotCopied=True))
print('PASS',len(source),'source/module pins',len(assets),'asset pins',sum(map(len,imports.values())),'resolved imports')
