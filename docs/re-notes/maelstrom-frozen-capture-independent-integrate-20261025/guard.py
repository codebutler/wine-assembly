import subprocess,resource,os,signal,time,pathlib,json,sys
O=pathlib.Path(__file__).resolve().parent
def run(name,argv):
 def limits():
  resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(131072,131072))
 start=time.monotonic();out=O/(name+'.stdout');err=O/(name+'.stderr')
 with out.open('wb') as a,err.open('wb') as b:
  p=subprocess.Popen(argv,stdout=a,stderr=b,start_new_session=True,preexec_fn=limits)
  reason='natural'
  while p.poll() is None:
   if time.monotonic()-start>60 or out.stat().st_size+err.stat().st_size>=131072:
    reason='guard';os.killpg(p.pid,signal.SIGTERM)
    try:p.wait(timeout=1)
    except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=3)
    break
   time.sleep(.02)
  p.wait()
 try:os.killpg(p.pid,0);remaining=True
 except ProcessLookupError:remaining=False
 j=dict(argv=argv,returncode=p.returncode,reason=reason,elapsed=time.monotonic()-start,remainingGroup=remaining,stdoutBytes=out.stat().st_size,stderrBytes=err.stat().st_size)
 (O/(name+'.json')).write_text(json.dumps(j,indent=2));assert not remaining and reason=='natural';return j
if __name__=='__main__':print(json.dumps(run(sys.argv[1],sys.argv[2:])))
