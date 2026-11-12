import pathlib,subprocess,json,base64,hashlib,os,tarfile
E=pathlib.Path(__file__).resolve().parent
free=os.statvfs(E).f_bavail*os.statvfs(E).f_frsize
assert free>=2982150144,free
size=3495683;expected='3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248'
receipts=[]
with (E/'qualification-artifacts.tar.gz').open('wb') as f:
 for off in range(0,size,24000):
  code="import base64;f=open('/home/user/timer-qualification/qualification-artifacts.tar.gz','rb');f.seek(%d);print(base64.b64encode(f.read(24000)).decode())"%off
  p=subprocess.run(['boat','exec','bx_pfv6b6wu','--','python3','-c',code],capture_output=True,text=True);r=json.loads(p.stdout)
  assert not p.returncode and r['exitCode']==0 and not r['stdoutTruncated'],r
  f.write(base64.b64decode(r['stdout']));receipts.append(dict(offset=off,commandId=r['commandId'],exitCode=r['exitCode']))
assert hashlib.sha256((E/'qualification-artifacts.tar.gz').read_bytes()).hexdigest()==expected
(E/'retrieval-receipts.json').write_text(json.dumps(receipts,indent=2))
with tarfile.open(E/'qualification-artifacts.tar.gz') as t:
 for m in t.getmembers():
  if m.isfile() and m.name.startswith('evidence/') and not m.name.endswith('.wasm'):
   dst=E/'logs'/pathlib.Path(m.name).name;dst.parent.mkdir(exist_ok=True);dst.write_bytes(t.extractfile(m).read())
print('Verified artifact',size,expected,flush=True)
