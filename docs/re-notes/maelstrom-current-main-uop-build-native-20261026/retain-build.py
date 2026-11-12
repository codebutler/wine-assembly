from stage import *
import gzip
names=['static-abi.json','build-inputs.json','build-outputs.json','execution-canonical-build-qualified.json','canonical-build-qualified.stdout','canonical-build-qualified.stderr','abi-base-tail.json','abi-base-compat.json']
code='import pathlib,json,gzip,hashlib;O=pathlib.Path('+repr(REMOTE+'/ops')+');b=gzip.compress(json.dumps({n:(O/n).read_text() for n in '+repr(names)+'}).encode(),mtime=0);p=O/"build-static-evidence.json.gz";p.write_bytes(b);print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())))'
r=py(code,'pack-build-static');meta=json.loads(r['stdout']);data=bytearray()
for off in range(0,meta['bytes'],49152):
 r=py('import pathlib,base64;f=open('+repr(REMOTE+'/ops/build-static-evidence.json.gz')+',"rb");f.seek('+str(off)+');print(base64.b64encode(f.read(49152)).decode())','retrieve-build-chunk-'+str(off));data.extend(base64.b64decode(r['stdout']))
assert len(data)==meta['bytes'] and hashlib.sha256(data).hexdigest()==meta['sha256'];(O/'build-static-evidence.json.gz').write_bytes(data)
files=json.loads(gzip.decompress(data));abi=json.loads(files['static-abi.json']);(O/'checkpoint-build.json').write_text(json.dumps(dict(status='PASS',sourceClosure=abi['sourceClosure'],outputs=[{k:r[k] for k in ['sha256','bytes']} for r in abi['outputs']],baselines=abi['baselines'],layout=abi['computedLayout'],evidenceSHA256=meta['sha256'],remaining='actual current-main native UOP errno4 OFF/ON and rejection controls both backends'),indent=2));print(json.dumps(meta))
