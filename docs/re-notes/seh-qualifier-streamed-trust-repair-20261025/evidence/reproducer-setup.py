import pathlib,hashlib,json,shutil
O=pathlib.Path(__file__).resolve().parent
D=pathlib.Path('/tmp/seh-canonical-qualifier-independent-integrate-oct25/ops')
P=O/'reproducer';P.mkdir()
files=[]
for name in ['reproduce.cjs','forged-contract.json','forged-source-binding.json','reproducer-result.json']:
 b=(D/name).read_bytes();dst=P/'originals'/name;dst.parent.mkdir(exist_ok=True);dst.write_bytes(b)
 files.append(dict(path=str(D/name),retained=str(dst),bytes=len(b),sha256=hashlib.sha256(b).hexdigest()))
assert files[0]['sha256']=='dccbc1f1667332d85805146fb499bff94a744c6e95437368eedfa9dbcfa9f91c'
(P/'reproduce.cjs').write_bytes((D/'reproduce.cjs').read_bytes())
(O/'reproducer-originals.json').write_text(json.dumps(files,indent=2)+'\n')
print('Original reviewer inputs preserved byte-for-byte; unchanged reproducer copied to owned output directory')
