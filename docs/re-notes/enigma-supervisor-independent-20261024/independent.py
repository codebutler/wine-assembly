"""Fresh external acceptance of actual transformed helper/stop/try-through-EOF."""
import pathlib as P, subprocess as S, gzip, hashlib, json, os, sys, tempfile, difflib
repo=P.Path('/tmp/enigma-supervisor-independent-integrate-oct24/repo');ops=repo.parent/'ops'
ev=repo/'docs/re-notes/enigma-supervisor-independent-20261024';ev.mkdir(parents=True,exist_ok=True)
old=repo/'docs/re-notes/enigma-runner-repairs-independent-20261024'
sha=lambda b:hashlib.sha256(b).hexdigest()
original=gzip.decompress((old/'original-supervise.py.gz').read_bytes()).decode()
assert sha(original.encode())=='73be15954cedc19340779ff6bda2397cb94927ca702d2baebdccd5e763cf7b73'
oracle=(repo/'test/test-enigma-supervisor-denial-independent.py').read_text()
assert oracle==S.check_output(['git','-C','/tmp/enigma-runner-repairs-independent-integrate-oct24/repo','show','53990b0c159b2c6a46824ca038ab2a1fefa70c75:test/test-enigma-supervisor-denial-independent.py']).decode()
bound=oracle.replace("evidence = repo / 'docs/re-notes/enigma-runner-repairs-independent-20261024'", "evidence = repo / 'docs/re-notes/enigma-supervisor-independent-20261024'")
(repo/'test/test-enigma-supervisor-denial-accepted.py').write_text(bound)
(ev/'oracle-binding.diff').write_text(''.join(difflib.unified_diff(oracle.splitlines(True),bound.splitlines(True),fromfile='original-independent.py',tofile='accepted-binding.py',n=0)))
adapter=(repo/'tools/enigma-terminal-capture-guard.cjs').read_bytes()
(ev/'candidate-terminal.cjs.gz').write_bytes(gzip.compress(adapter,mtime=0))
(ev/'original-supervise.py.gz').write_bytes((old/'original-supervise.py.gz').read_bytes())
raw=dict(version=1,terminal=True,reason='capture-byte-limit',artifactAccepted=False,runnerSHA256='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809',captureSHA256='6d64a146f2daf8b598dbf13e3c13f890dbc783d8f5286aacba6d343758d22079',code='ERR_ASSERTION',message='capture byte limit',name='AssertionError')
results=[]
with tempfile.TemporaryDirectory(prefix='enigma-external-accept-') as tmp:
 root=P.Path(tmp);inputfile=root/'supervisor.py';inputfile.write_text(original)
 transformed=S.check_output(['node','--max-old-space-size=256','-e','process.stdout.write(require(process.argv[1]).transformSupervisor(require("fs").readFileSync(process.argv[2],"utf8")))',str(repo/'tools/enigma-terminal-capture-guard.cjs'),str(inputfile)],timeout=10).decode()
 stop=original[original.index('def stop(p):'):original.index('def limits():')]
 assert stop in transformed
 helper=transformed[transformed.index('def terminal_capture():'):transformed.index('H=pathlib.Path')]
 def tail(s):return s[s.index('try:\n while p.poll() is None:',s.index("why='natural'")):]
 assert transformed.endswith('if capture_terminal is not None:raise SystemExit(1)\n')
 mutant=transformed.removesuffix('if capture_terminal is not None:raise SystemExit(1)\n')
 # Bind mutation to the actual former adapter, not just an assumed code pattern.
 oldadapter=root/'old.cjs';oldadapter.write_bytes(gzip.decompress((old/'candidate-terminal.cjs.gz').read_bytes()))
 oldtransformed=S.check_output(['node','--max-old-space-size=256','-e','process.stdout.write(require(process.argv[1]).transformSupervisor(require("fs").readFileSync(process.argv[2],"utf8")))',str(oldadapter),str(inputfile)],timeout=10).decode()
 assert mutant==oldtransformed
 def run(name,source,record,fast=False,enabled=True,failure=None):
  case=root/name;case.mkdir();(case/'output.log').write_bytes(b'')
  if record is not None:(case/'raw.json').write_text(record)
  prelude='''import os,json,pathlib,types,signal,re
E=pathlib.Path(CASE)
events=[]
def event(*v):
 events.append(v);(E/'events.json').write_text(json.dumps(events))
def killpg(pid,sig):
 event('killpg',pid,sig)
 if sig==0:raise ProcessLookupError()
def waitpid(pid,flag):
 event('waitpid',pid,flag)
 if len([e for e in events if e[0]=='waitpid'])==1:return 456,9
 raise ChildProcessError()
os=types.SimpleNamespace(environ=os.environ,path=os.path,killpg=killpg,waitpid=waitpid,WNOHANG=os.WNOHANG)
class Child:
 pid=123
 returncode=None
 calls=0
 def poll(self):
  self.calls+=1;event('poll',self.calls)
  if FAILURE=='poll' and self.calls==1:raise LookupError('original polling error')
  return 0 if FAST else None
 def wait(self):
  event('wait');self.returncode=-9
  if FAILURE=='cleanup':raise LookupError('original cleanup error')
class Clock:
 def monotonic(self):return 61
 def sleep(self,n):raise AssertionError('unexpected sleep')
class Log:
 def close(self):
  event('close')
  if FAILURE=='publication':(E/'terminal.json').mkdir()
p=Child();time=Clock();log=Log();start=0;why='natural';offset=0;tail=b''
'''.replace('CASE',repr(str(case))).replace('FAILURE',repr(failure)).replace('FAST',repr(fast))
  program=prelude+(helper if 'def terminal_capture()' in source else '')+stop+tail(source)
  script=case/'run.py';script.write_text(program)
  environment=dict(os.environ);environment.pop('ENIGMA_TERMINAL_RECEIPT',None)
  if enabled:environment['ENIGMA_TERMINAL_RECEIPT']=str(case/'raw.json')
  dep=case/'dep.py';dep.write_text('import pathlib\npathlib.Path('+repr(str(case/'dependent'))+').touch()\n')
  p=S.run(['bash','-c','"$1" "$2" && "$1" "$3"','accept',sys.executable,str(script),str(dep)],env=environment,capture_output=True,timeout=10)
  terminal=case/'terminal.json';receipt=json.loads(terminal.read_text()) if terminal.is_file() else None
  result=dict(name=name,exit=p.returncode,dependent=(case/'dependent').exists(),receipt=receipt,events=json.loads((case/'events.json').read_text()),stderr=p.stderr.decode())
  assert len(p.stdout)+len(p.stderr)<8192
  results.append(result);return result
 def accept(r):
  assert r['exit']==1 and not r['dependent']
  assert r['receipt']['captureTerminal']==raw and r['receipt']['reason']=='capture-byte-limit'
  assert r['receipt']['TERM'] and r['receipt']['KILL'] and r['receipt']['reaped']==[[456,9]]
  assert r['receipt']['returncode']==-9 and not r['receipt']['remainingGroup']
  assert r['events'][-1]==['close']
 for fast in [False,True]:accept(run('denial-'+str(fast),transformed,json.dumps(raw),fast))
 m=run('revert-exit',mutant,json.dumps(raw))
 try:accept(m)
 except AssertionError:assert m['exit']==0 and m['dependent']
 else:raise AssertionError('mutation survived')
 for name,record,enabled in [('success',None,True),('disabled',json.dumps(raw),False),('missing',None,True)]:
  a=run(name,transformed,record,fast=True,enabled=enabled);b=run(name+'-original',original,record,fast=True,enabled=enabled)
  assert a==dict(b,name=name) and a['exit']==0 and a['dependent']
 for failure in ['poll','cleanup','publication']:
  r=run('exception-'+failure,transformed,json.dumps(raw),failure=failure)
  assert r['exit']==1 and not r['dependent']
  assert ('LookupError: original '+('polling' if failure=='poll' else 'cleanup')+' error') in r['stderr'] if failure!='publication' else 'IsADirectoryError' in r['stderr']
  assert 'SystemExit' not in r['stderr']
 for name,record in [('malformed','{}'),('oversized','x'*1025),('wrong-pin',json.dumps(dict(raw,runnerSHA256='0'*64)))]:
  r=run(name,transformed,record);assert r['exit']!=0 and not r['dependent'] and 'AssertionError' in r['stderr']
(ev/'external-cases.json').write_text(json.dumps(dict(passTests=True,adapterSHA256=sha(adapter),transformedSHA256=sha(transformed.encode()),originalStopSHA256=sha(stop.encode()),unchangedOracleSHA256=sha(oracle.encode()),mutationEqualsRejectedSource=True,results=results),indent=2))
print(json.dumps(dict(passed=True,cases=len(results),mutationRejected=True,actualStopReapAndCompleteEOF=True,oracleIdentityOnly=True)))
