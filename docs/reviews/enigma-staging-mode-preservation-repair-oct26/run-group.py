import hashlib,json,os,resource,subprocess,sys,time
from pathlib import Path
H=Path(__file__).parent
name,fixture,group,expected=sys.argv[1:5]
def limit():
 resource.setrlimit(resource.RLIMIT_DATA,(16777216,16777216))
 resource.setrlimit(resource.RLIMIT_CPU,(60,60))
 resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
 os.umask(0o002)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
wrapper='''import runpy,sys
sys.argv=sys.argv[1:]
try:runpy.run_path(sys.argv[0],run_name="__main__")
except SystemExit:raise
except BaseException as e:
 print(type(e).__name__+": "+str(e),file=sys.stderr,flush=True)
 sys.exit(1)
'''
env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1')
with (H/(name+'.stdout')).open('xb') as out,(H/(name+'.stderr')).open('xb') as err:
 args=[sys.executable,'-B','-c',wrapper,str(H/fixture)]+([] if group=='-' else [group])
 p=subprocess.run(args,stdout=out,stderr=err,env=env,preexec_fn=limit,timeout=65)
assert sum((H/(name+x)).stat().st_size for x in ['.stdout','.stderr'])<=131072
result=dict(name=name,fixtureSHA256=sha(H/fixture),helperSHA256=sha(H.parent/'repo/tools/enigma-bounded-staging.py'),baseCandidate='f1aac7b9ba83e2bbc763cb58d38646653d626468',returncode=p.returncode,expected=int(expected),stdoutSHA256=sha(H/(name+'.stdout')),stderrSHA256=sha(H/(name+'.stderr')),time=time.time(),umask='0002')
result['matchedExpected']=p.returncode==int(expected)
tmp=H/'checkpoint.new';tmp.write_text(json.dumps(result,indent=2));os.replace(tmp,H/('checkpoint-'+name+'.json'))
print(json.dumps(result))
sys.exit(not result['matchedExpected'])
