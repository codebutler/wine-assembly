import pathlib,subprocess,json,hashlib,gzip,base64,re,resource,os,difflib
O=pathlib.Path(__file__).parent;R=O.parent/'repo';REV='e486b6814a00518a6d9cb14ef376e69ab2f92c49'
def lim():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
def blob(p):return subprocess.check_output(['git','show',REV+':'+p],cwd=R,preexec_fn=lim,timeout=30)
def sha(b):return hashlib.sha256(b).hexdigest()
manifest=json.load(open('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/docs/re-notes/shadow-man-span-static-canonical-20261023/manifest.json'))
paths=[];sources={}
def visit(p):
 if p in sources:return
 b=blob(p);sources[p]=b
 for hit in re.findall(rb'\(include\s+"([^"]+)"\s*\)',b):visit('src/'+hit.decode())
visit('src/main.watx')
rows=[]
with gzip.GzipFile(filename=str(O/'sources.json.gz'),mode='wb',mtime=0) as f:
 f.write(b'{')
 for i,(p,b) in enumerate(sources.items()):
  if i:f.write(b',')
  f.write(json.dumps(p).encode()+b':'+json.dumps(base64.b64encode(b).decode()).encode())
 f.write(b'}')
for p,b in sources.items():rows.append(dict(path=p,bytes=len(b),sha256=sha(b)))
for row in manifest['files']:
 p=row['path']
 if p.startswith('src/'):continue
 b=blob(p);q=R/p;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(b);rows.append(dict(path=p,bytes=len(b),sha256=sha(b),unchangedStanding=sha(b)==row['sha256']))
(O/'current-manifest.json').write_text(json.dumps(dict(candidate=REV,files=rows,sourceCount=len(sources),sourceBytes=sum(map(len,sources.values())),bundleSHA256=sha((O/'sources.json.gz').read_bytes())),indent=2))
hist=json.loads(gzip.decompress(pathlib.Path('/tmp/maelstrom-errno-api-canonical-native-oct25/ops/sources.json.gz').read_bytes()))
changed={}
for p in ['src/09b-dispatch.wat','src/13-exports.wat']:
 old=base64.b64decode(hist[p]).decode();new=sources[p].decode();diff=''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='historical/'+p,tofile=REV+'/'+p));(O/(pathlib.Path(p).name+'.diff')).write_text(diff);changed[p]=dict(old=sha(old.encode()),new=sha(new.encode()),diffBytes=len(diff.encode()));print(p,diff[:8192])
(O/'changed-pins.json').write_text(json.dumps(changed,indent=2));print('CLOSURE',len(sources),sum(map(len,sources.values())),(O/'sources.json.gz').stat().st_size)
