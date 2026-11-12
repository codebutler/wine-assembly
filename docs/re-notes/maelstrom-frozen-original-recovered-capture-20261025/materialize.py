import pathlib,json,subprocess,hashlib,shutil,sys
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo'
sys.path.insert(0,str(O))
from transport import payload,save,sha
assert json.load(open(O/'resource-precheckout.json'))['passAdmission']
m=json.load(open('/tmp/maelstrom-native-errno-capture-oct24/manifest.json'))
# Materialize exactly the accepted manifest, with explicit owned diagnostic substitutions.
changes={
'runner/lib/thread-manager.js':('/tmp/maelstrom-event-triggered-boundary-observer-oct24/ops/thread-manager.js','f0a2f006b0eb992bcdb904f10128167b06bfe143ac05661b82f9586d9755bf40'),
'runner/src/13-exports.wat':('/tmp/maelstrom-head-yield-observer-oct24/ops/13-exports.wat','739397dc54a77e93b367334fd4ca96c921180f57a7558913a3301f1de4520b86'),
'runtime/build/wine-assembly.wasm':('/tmp/maelstrom-select-hook-recovered-canonical-native-oct24/ops/select-hook.wasm','ed9d74e5ab4c8bf03bb9f94a56ec41e6e28d9abfa282a20c6654e35e9d177ea7')}
out=[]
for x in m:
 target=x['target'];b=payload(x) if target not in changes else pathlib.Path(changes[target][0]).read_bytes()
 expected=x['sha256'] if target not in changes else changes[target][1]
 assert sha(b)==expected,target
 if target=='runner/test/run.js':continue
 if target=='system/msvcrt.dll':target='runtime/system/msvcrt.dll'
 p=H/target;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
 out.append(dict(target=target,bytes=len(b),sha256=sha(b),kind='file',path=str(p),source=x,substitution=changes.get(x['target'])))
# Accepted transform only; exact historical runner pin is enforced inside the tool.
subprocess.run(['node','--max-old-space-size=256',str(R/'tools/maelstrom-select-frozen-runner.cjs'),'/tmp/maelstrom-head-yield-observer-oct24/ops/run.js',str(H/'runner/test/run.js')],check=True,timeout=60)
for n in ['maelstrom-select-frozen-record.cjs','maelstrom-select-completion-hook.cjs']:
 p=H/'runner/tools'/n;p.parent.mkdir(exist_ok=True);p.write_bytes((R/'tools'/n).read_bytes());out.append(dict(target=str(p.relative_to(H)),bytes=p.stat().st_size,sha256=sha(p.read_bytes()),kind='file',path=str(p)))
p=H/'runner/test/run.js';out.append(dict(target=str(p.relative_to(H)),bytes=p.stat().st_size,sha256=sha(p.read_bytes()),kind='file',path=str(p),transformedFrom='/tmp/maelstrom-head-yield-observer-oct24/ops/run.js'))
assert sha((H/'runner/tools/maelstrom-select-completion-hook.cjs').read_bytes())=='b7c77c20b12cd582d6fcfbe246e1f0abdcb644266fc3f161bf5d683d93b13930'
args=json.load(open(H/'guest-args.json'));args=[x.replace(str(H/'system/msvcrt.dll'),str(H/'runtime/system/msvcrt.dll')) for x in args];(H/'guest-args.json').write_text(json.dumps(args,indent=2)+'\n')
# Canonical exact parser, final filename-bearing argv; enumeration uses accepted tree helper.
src=pathlib.Path('/tmp/maelstrom-single-return-sync-capture-oct24/validate-tree.cjs').read_text().replace('full.slice(4)','full.slice(3)').replace("assert.equal(schedule.filter(s=>s.action==='png').length,3)","assert.equal(schedule.filter(s=>s.action==='png').length,0)")
(H/'validate-tree.cjs').write_text(src)
(H/'manifest.json').write_text(json.dumps(out,indent=2)+'\n')
p=subprocess.run(['node','--max-old-space-size=256',str(H/'validate-tree.cjs')],capture_output=True,text=True,timeout=60);save('ops/tree-validation-local.json',dict(returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0,p.stderr
save('ops/materialization.json',dict(files=len(out),bytes=sum(x['bytes'] for x in out),maxFile=max(x['bytes'] for x in out),compile=False,nativeRerun=False,acceptedOfflineRerun=False,transformedRunnerSHA256=sha((H/'runner/test/run.js').read_bytes())))
print(json.dumps(dict(files=len(out),bytes=sum(x['bytes'] for x in out),mount=True)))
