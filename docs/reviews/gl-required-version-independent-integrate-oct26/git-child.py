import fcntl,os,resource,subprocess,sys,json,pathlib,shutil
with open('/tmp/wine-ops-production-git.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 def limit():
  resource.setrlimit(resource.RLIMIT_DATA,(512*1048576,512*1048576))
  operation=os.environ.get('GL_TASK_OPERATION','git-child')
  p=pathlib.Path(__file__).resolve().parent/('git-inherited-'+operation+'.json')
  p.write_text(json.dumps(dict(pid=os.getpid(),executable=shutil.which('git'),argv=['git',*sys.argv[1:]],DATA=resource.getrlimit(resource.RLIMIT_DATA),AS=resource.getrlimit(resource.RLIMIT_AS),CPU=resource.getrlimit(resource.RLIMIT_CPU),FSIZE=resource.getrlimit(resource.RLIMIT_FSIZE))))
 sys.exit(subprocess.call(['git',*sys.argv[1:]],preexec_fn=limit))
