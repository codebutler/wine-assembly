from stage import *
p=R/'test/maelstrom-current-main-static.py';put(p,REMOTE+'/repo/test/'+p.name)
r=call(['python3',REMOTE+'/repo/test/'+p.name],'static-current',60);print(r['stdout'])
code='import pathlib,json,gzip,base64;O=pathlib.Path('+repr(REMOTE+'/ops')+');names=["static-abi.json","build-inputs.json","build-outputs.json","execution-canonical-build-qualified.json","canonical-build-qualified.stdout","canonical-build-qualified.stderr","abi-base-tail.json","abi-base-compat.json"];print(base64.b64encode(gzip.compress(json.dumps({n:(O/n).read_text() for n in names}).encode(),mtime=0)).decode())'
r=py(code,'retain-build-static');(O/'build-static-evidence.json.gz').write_bytes(base64.b64decode(r['stdout']))
import gzip
files=json.loads(gzip.decompress((O/'build-static-evidence.json.gz').read_bytes()));abi=json.loads(files['static-abi.json']);(O/'checkpoint-build.json').write_text(json.dumps(dict(status='PASS',sourceClosure=abi['sourceClosure'],outputs=[{k:r[k] for k in ['sha256','bytes']} for r in abi['outputs']],baselines=abi['baselines'],layout=abi['computedLayout'],evidenceSHA256=hashlib.sha256((O/'build-static-evidence.json.gz').read_bytes()).hexdigest(),remaining='actual current-main native UOP errno4 OFF/ON and rejection controls both backends'),indent=2))
