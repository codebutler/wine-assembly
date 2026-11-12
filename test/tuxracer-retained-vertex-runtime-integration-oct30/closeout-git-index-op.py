"""Bounded Git index plumbing, no checkout or parent DATA restriction for Git."""
import pathlib,sys,os,subprocess,resource,json
O=pathlib.Path(__file__).parent;R=pathlib.Path('/tmp/tuxracer-glcolor4dv-repair-oct30/repo')
spec=json.loads(pathlib.Path(sys.argv[1]).read_text());index=O/spec['index']
assert index.parent==O
env=dict(os.environ,GIT_INDEX_FILE=str(index),GIT_NO_LAZY_FETCH='1')
def child():
 s,h=resource.getrlimit(resource.RLIMIT_DATA);assert s==128*1048576 or s==-1
 resource.setrlimit(resource.RLIMIT_DATA,(256*1048576,h))
def git(*args,input=None):
 p=subprocess.run(['git','-C',str(R),*args],env=env,input=input,stdout=subprocess.PIPE,stderr=subprocess.PIPE,preexec_fn=child,timeout=90)
 assert len(p.stdout)+len(p.stderr)<=512*1024
 assert p.returncode==0,(args,p.returncode,p.stderr.decode()[-3000:])
 return p.stdout.decode().strip()
assert git('remote','get-url','origin')=='git@github.com:vgrichina/wine-assembly.git'
if spec['action']=='commit':
 assert not index.exists()
 git('read-tree',spec['base'])
 for path,x in spec['paths'].items():
  assert not path.startswith('/') and '..' not in pathlib.PurePosixPath(path).parts
  if isinstance(x,str):
   f=pathlib.Path(x);assert f.is_relative_to(O) or f.is_relative_to(R)
   oid=git('hash-object','-w','--',str(f))
  else:oid=x['oid']
  git('update-index','--add','--cacheinfo','100644',oid,path)
 tree=git('write-tree','--missing-ok')
 parentArgs=[v for p in spec['parents'] for v in ['-p',p]]
 sha=git('-c','user.name=Wine Ops','-c','user.email=wine-ops@users.noreply.github.com','commit-tree',tree,*parentArgs,input=spec['message'].encode())
 git('update-ref',spec['ref'],sha,spec['expected'])
 result=dict(commit=sha,tree=tree,parents=spec['parents'],indexBytes=index.stat().st_size)
else:raise AssertionError(spec['action'])
(O/spec['result']).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
