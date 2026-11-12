import subprocess,base64,json,hashlib,pathlib,sys,time,os
E=pathlib.Path(__file__).resolve().parent
assert os.statvfs(E).f_bavail*os.statvfs(E).f_frsize>=2982150144
log=[]
for name in ['candidate-source.tar.gz','candidate-metadata.pack','source-manifest.json']:
 data=(E/name).read_bytes(); dst='/home/user/timer-qualification/'+name
 for off in range(0,len(data),60000):
  b=base64.b64encode(data[off:off+60000]).decode()
  code="import base64;open(%r,%r).write(base64.b64decode(%r))"%(dst,'wb' if off==0 else 'ab',b)
  r=subprocess.run(['boat','exec','bx_pfv6b6wu','--','python3','-c',code],capture_output=True,text=True)
  try: receipt=json.loads(r.stdout)
  except: raise RuntimeError(r.stdout+r.stderr)
  if r.returncode or receipt.get('exitCode')!=0:raise RuntimeError(receipt)
  log.append(dict(file=name,offset=off,commandId=receipt['commandId'],exitCode=receipt['exitCode']))
 print(name,len(data),hashlib.sha256(data).hexdigest(),flush=True)
(E/'transfer-receipts.json').write_text(json.dumps(log,indent=2))
