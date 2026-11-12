import pathlib,sys,hashlib
O=pathlib.Path(__file__).resolve().parent
D=pathlib.Path('/tmp/seh-current-canonical-qualifier-oct25/ops')
s=(D/'supervise.py').read_text()
assert hashlib.sha256(s.encode()).hexdigest()==__import__('json').load(open(O/'bootstrap.json'))['supervisorSHA256']
# Reuse the inspected supervisor implementation in place, never its native stages.
sys.argv=['run.py','cheap']+sys.argv[1:]
exec(compile(s.split("if stage in ['compiler','module-tail','module-compat']:")[0],str(D/'supervise.py'),'exec'))
tag=str(time.time_ns())
assert bounded([sys.executable,str(O/'account.py'),'execution-admission-'+tag+'.json'],'admission-'+tag,cwd=O,cpu=60,wall=60)==0
sys.exit(bounded(argv,'control-'+tag,cwd=O,cpu=60,wall=60))
