from control import *
NODE=shutil.which('node')
env={'PATH':'/usr/local/bin:/usr/bin:/bin','LANG':'C.UTF-8','TZ':'UTC'}
argv=[NODE,'--max-old-space-size=16']
def node_limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def run(args,data=None):
 p=subprocess.Popen(argv+args,env=env,cwd=R,preexec_fn=node_limits,stdin=subprocess.PIPE if data else None,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 out,err=p.communicate(data,timeout=120);assert len(out)+len(err)<=131072
 row=dict(argv=argv+args,exit=p.returncode,stdout=out.decode(),stderr=err.decode(),maxChildRSS=resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss*1024)
 return row
admission('admission-challenge-final.json')
startup=run(['-e',"const fs=require('node:fs');console.log(JSON.stringify({execPath:process.execPath,execArgv:process.execArgv,limits:fs.readFileSync('/proc/self/limits','utf8'),rss:process.memoryUsage().rss,node:process.version}))"])
startup.update(executableSHA256=hashlib.file_digest(open(NODE,'rb'),'sha256').hexdigest(),environment=env,nodeDATAApplied=False,physicalAllowance=536870912,heapIsNotTotalProcessCap=True)
save('node-startup-final.json',startup);assert startup['exit']==0 and not startup['stderr']
s=json.loads(startup['stdout']);assert 'Max data size             unlimited' in s['limits'] and s['rss']<=536870912
paths=['src/09d-winsock.wat','src/09b-dispatch.wat','src/09b2-dispatch-table.generated.wat','src/05-alu.wat','src/06b-core-handlers.wat','src/13-exports.wat']
sources=dict(current={},historical={})
proc=subprocess.Popen(['git','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m','cat-file','--batch'],cwd=R,preexec_fn=limits,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
for group,rev,ps in [('current',BASE,paths),('historical','b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a',paths[1::4])]:
 for path in ps:
  proc.stdin.write((rev+':'+path+'\n').encode());proc.stdin.flush();header=proc.stdout.readline(256).decode().split();assert header[1]=='blob'
  left=int(header[2]);chunks=[]
  while left:
   b=proc.stdout.read(min(left,8192));assert b;left-=len(b);chunks.append(b)
  assert proc.stdout.read(1)==b'\n';sources[group][path]=b''.join(chunks).decode()
proc.stdin.close();assert proc.wait(timeout=120)==0
import gzip
raw=json.dumps(sources).encode();data=gzip.compress(raw,mtime=0)
save('challenge-input-size-preflight.json',dict(originalJSONBytes=len(raw),compressedInputBytes=len(data),limit=2097152,priorPlainJSONExceeded=True,acceptanceGroupsPreviouslyExecuted=0))
assert len(data)<=2097152
save('challenge-input.json',dict(source=BASE,historical='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a',bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),streamedImmutableGitBlobs=True,files={g:{p:hashlib.sha256(s.encode()).hexdigest() for p,s in rows.items()} for g,rows in sources.items()}))
row=run([str(O/'challenge.cjs')],data);save('challenge-execution-corrected.json',row);assert row['exit']==0 and not row['stderr']
assert row['maxChildRSS']<=536870912
result=json.loads(row['stdout']);save('challenge-result.json',result)
save('checkpoint-challenge.json',dict(candidate=CAND,status='PIN_MIGRATION_CHALLENGE_PASS',newRejectingControls=result['rejects'],remaining=['final independent decision','conditional publication']))
print(json.dumps(result))
