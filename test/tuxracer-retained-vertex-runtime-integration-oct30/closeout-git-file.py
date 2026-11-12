"""Exact Git blob materialization: file output is distinct from command capture."""
import os,sys,resource,pathlib,subprocess,hashlib,json
repo=pathlib.Path('/tmp/tuxracer-glcolor4dv-repair-oct30/repo')
ref,path,dest=sys.argv[1:]
out=pathlib.Path(dest).resolve()
assert out.is_relative_to(repo) or out.is_relative_to(pathlib.Path(__file__).parent)
assert ':' not in ref and not path.startswith('/') and '..' not in pathlib.PurePosixPath(path).parts
def limits():
 s,h=resource.getrlimit(resource.RLIMIT_DATA)
 resource.setrlimit(resource.RLIMIT_DATA,(256*1048576 if s==-1 or s==128*1048576 else min(s,256*1048576),h))
out.parent.mkdir(parents=True,exist_ok=True)
with out.open('xb') as f:
 p=subprocess.run(['git','-C',str(repo),'show',ref+':'+path],stdout=f,stderr=subprocess.PIPE,preexec_fn=limits,timeout=90)
assert p.returncode==0,p.stderr[:1000]
print(json.dumps(dict(path=path,ref=ref,destination=str(out),bytes=out.stat().st_size,sha256=hashlib.sha256(out.read_bytes()).hexdigest())))
