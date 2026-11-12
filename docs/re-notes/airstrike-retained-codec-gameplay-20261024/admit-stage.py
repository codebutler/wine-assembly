import os,sys,json,pathlib,hashlib,subprocess,shutil,time,base64
H=pathlib.Path(__file__).parent
D='/home/user/wine-assembly-shadow-man-span-static-canonical-oct23'
C='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
P=pathlib.Path('/tmp/airstrike-original-bounded-runtime-oct24/repo/docs/re-notes/airstrike-original-bounded-runtime-20261024')
G=pathlib.Path('/tmp/airstrike-original-private-oct23/docs/re-notes/airstrike-original-20261023/release/airstrike-pre6a')
K=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-codec-recovery-oct22')
B='/home/user/.ascii/boat'; BOX='bx_754uted8'; R='/home/user/airstrike-retained-oct24'
env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def git(p):return subprocess.check_output(['git','-C',D,'show',C+':'+p],env=env)
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,v): (H/n).write_text(json.dumps(v,indent=2)+'\n')
def remote(code,*args):
 p=subprocess.run([B,'--no-update','--json','exec',BOX,'--timeout','30','--','python3','-c',code,*args],capture_output=True,text=True)
 try:r=json.loads(p.stdout)
 except Exception:raise RuntimeError(p.stdout[:1500]+p.stderr[:1500])
 if p.returncode or r.get('exitCode')!=0 or not r.get('success'): save('first-access-failure.json',r);raise RuntimeError(str(r)[:2000])
 return r
def inventory():
 out=[]
 for f in json.loads((P/'historical-harness-manifest.json').read_text())['files']:
  b=git(f['path']);assert len(b)==f['bytes'] and sha(b)==f['sha256'],f['path'];out.append(dict(f,kind='git',source=f['path'],dest='runner/'+f['path']))
 for f in json.loads((K/'receipt.json').read_text())['files']:
  p=K/f['path'].removeprefix('runner/');b=p.read_bytes();assert len(b)==f['size'] and sha(b)==f['sha256'];out.append(dict(path=str(p),bytes=len(b),sha256=sha(b),kind='file',source=str(p),dest=f['path']))
 for f in json.loads(pathlib.Path('/tmp/airstrike-legacy-zlib-private-oct23/docs/re-notes/airstrike-legacy-zlib-20261023/minimal-vfs.json').read_text())['files']:
  p=G/f['path'];b=p.read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'];out.append(dict(f,kind='file',source=str(p),dest='game/'+f['path']))
 for f in json.loads((P/'dll-identities.json').read_text()):
  b=pathlib.Path(f['path']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'];out.append(dict(f,kind='file',source=f['path'],dest='game/'+pathlib.Path(f['path']).name))
 p=pathlib.Path(D+'/build/wine-assembly.wasm');b=p.read_bytes();assert len(b)==1879746 and sha(b)=='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686';out.append(dict(bytes=len(b),sha256=sha(b),kind='file',source=str(p),dest='runner/build/wine-assembly.wasm'))
 return out
if __name__=='__main__':
 H.mkdir(exist_ok=True)
 if sys.argv[1]=='admit':
  files=inventory();save('transfer-manifest.json',files)
  baseline={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('state_5.sqlite*')};save('external-baseline.json',baseline)
  r=remote('import os,json,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/home/user").free,memAvailable=int(next(x.split()[1] for x in open("/proc/meminfo") if x.startswith("MemAvailable:")))*1024)))')
  save('remote-admission.raw.json',r);rr=json.loads(r['stdout']);local=shutil.disk_usage('/tmp').free
  allocations={'remoteFinalPayload':sum(x['bytes'] for x in files),'boundedTransportMemoryNotPersisted':1048576,'localFocusedGitCheckoutReport':4*1048576,'remoteLogsEvidenceAndHelpers':4*1048576,'localRetrievedEvidence':4*1048576,'sessionEventsExistingAndFuture':8*1048576,'positiveSQLiteGrowthAndFuture':8*1048576,'reserve':8*1048576}
  peak=sum(allocations.values());ok=peak<=64*1048576 and local-peak>=2982150144 and rr['free']-peak>=2982150144 and rr['memAvailable']>=2684354560 and max(x['bytes'] for x in files)<=24*1048576
  save('admission.json',dict(at=time.time(),allocations=allocations,peak=peak,cap=64*1048576,localFree=local,remote=rr,passGate=ok,standingReadOnlyManifestBytes=sum(x['bytes'] for x in files),initialCaptureConservativeBytes=200000,perCapturePolicy='future normal<=8192 bytes; instructions<=65536; cumulative<=1048576'))
  assert ok,'admission rejected';print(json.dumps({'pass':ok,'peak':peak,'files':len(files),'payload':allocations['remoteFinalPayload']}))
 elif sys.argv[1]=='stage':
  assert json.loads((H/'admission.json').read_text())['passGate']
  files=json.loads((H/'transfer-manifest.json').read_text());batch=[];sz=0;receipts=[]
  code='import sys,json,base64,pathlib,hashlib; root=pathlib.Path("'+R+'"); rows=json.loads(base64.b64decode("".join(sys.argv[1:]))); [( (root/f[0]).parent.mkdir(parents=True,exist_ok=True),(root/f[0]).open("ab").write(base64.b64decode(f[1]))) for f in rows];print(json.dumps({"writes":len(rows),"bytes":sum(len(base64.b64decode(f[1])) for f in rows)}))'
  def flush():
   global batch,sz
   if not batch:return
   s=base64.b64encode(json.dumps(batch,separators=(',',':')).encode()).decode();assert len(s)<1048576
   receipts.append(remote(code,*[s[i:i+50000] for i in range(0,len(s),50000)]));batch=[];sz=0
  for f in files:
   b=git(f['source']) if f['kind']=='git' else pathlib.Path(f['source']).read_bytes();assert sha(b)==f['sha256']
   for i in range(0,len(b),36000):
    chunk=b[i:i+36000]
    if sz+len(chunk)>40000:flush()
    batch.append([f['dest'],base64.b64encode(chunk).decode()]);sz+=len(chunk)
  flush();save('transfer-receipts.json',receipts)
  manifest=json.dumps(files,separators=(',',':'))
  verify='import json,hashlib,pathlib,sys;root=pathlib.Path("'+R+'");rows=json.loads(sys.argv[1]);bad=[f["dest"] for f in rows if (root/f["dest"]).stat().st_size!=f["bytes"] or hashlib.sha256((root/f["dest"]).read_bytes()).hexdigest()!=f["sha256"]];assert not bad,bad;print(json.dumps({"verified":len(rows),"bytes":sum(f["bytes"] for f in rows)}))'
  save('remote-manifest-verification.json',remote(verify,manifest));print('all staged and hash verified')
