import pathlib,sys,json,base64,zlib,shlex,subprocess,resource
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';sys.path.insert(0,str(O));from transport import py,remote,save,sha
# Send exact supervisor only after pinned closure transfer completes.
b=(O/'supervise.py').read_bytes();code='import pathlib,base64;h=pathlib.Path('+repr(str(H/'ops'))+');h.mkdir(exist_ok=True);(h/"supervise.py").write_bytes(base64.b64decode('+repr(base64.b64encode(b).decode())+'))';save('ops/send-supervisor.json',py(code))
save('ops/inherited-supervisor-limits.json',remote('python3 '+shlex.quote(str(O/'supervise.py'))+' inherited-limit-check'))
code='''import pathlib,json,hashlib,os,shutil,re,subprocess,resource
h=pathlib.Path(ROOT);m=json.load(open(h/'manifest.json'));bad=[x['target'] for x in m if (h/x['target']).stat().st_size!=x['bytes'] or hashlib.sha256((h/x['target']).read_bytes()).hexdigest()!=x['sha256']];assert not bad,bad
assert hashlib.sha256((h/'guest-args.json').read_bytes()).hexdigest()==ARGVHASH
assert hashlib.sha256((h/'ops/supervise.py').read_bytes()).hexdigest()==SUPERHASH
assert os.getuid()==1000
free=shutil.disk_usage('/tmp').free;mem=int(re.search(r'MemAvailable:\\s+(\\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
assert free-67108864>=2982150144 and mem>=2684354560
# Canonical parser/tree enumeration and ordinary Node preamble loading, no module instantiate.
def limits():resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(131072,131072))
p=subprocess.run(['node','--max-old-space-size=256',str(h/'validate-tree.cjs')],capture_output=True,text=True,timeout=60,preexec_fn=limits);assert p.returncode==0,p.stderr
js="""const fs=require('fs'),path=require('path'),Module=require('module');const root=process.cwd(),runner=fs.readFileSync('runner/test/run.js','utf8');const pre=new Module(path.join(root,'runner/test/preguest.cjs'),module);pre.filename=path.join(root,'runner/test/preguest.cjs');pre.paths=Module._nodeModulePaths(path.join(root,'runner/test'));pre._compile(runner.slice(0,runner.indexOf('function canvasToPng')),pre.filename);require('./runner/lib/renderer');require('./runner/tools/maelstrom-select-frozen-record.cjs');console.log(JSON.stringify({preambleLoaded:true,node:process.version,pngjs:require('./runner/node_modules/pngjs/package.json').version,guestStarted:false}));"""
p2=subprocess.run(['node','--max-old-space-size=256','-e',js],cwd=h,capture_output=True,text=True,timeout=60,preexec_fn=limits);assert p2.returncode==0,p2.stderr
print(json.dumps(dict(passPreflight=True,uid=os.getuid(),free=free,memAvailable=mem,files=len(m),bytes=sum(x['bytes'] for x in m),tree=json.loads(p.stdout),preamble=json.loads(p2.stdout),guestStarted=False)))
'''.replace('ROOT',repr(str(H))).replace('ARGVHASH',repr(sha((H/'guest-args.json').read_bytes()))).replace('SUPERHASH',repr(sha((O/'supervise.py').read_bytes())))
save('ops/preflight-api.json',py(code,60));print('materialized exact preflight PASS',flush=True)
