import pathlib,json,subprocess,hashlib,base64,time,os
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';REMOTE='/home/user/maelstrom-current-main-uop-build-native-oct26';BOX='bx_h44cmz3t'
def call(args,label='api',timeout=60):
 p=subprocess.run(['boat','--no-update','--json','exec',BOX,'--timeout',str(timeout),'--',*args],capture_output=True,text=True,timeout=timeout+30)
 assert len(p.stdout)+len(p.stderr)<=131072,'capture overflow'
 r=json.loads(p.stdout)
 with (O/'api-commands.jsonl').open('a') as f:f.write(json.dumps(dict(label=label,at=time.time(),result=r))+'\n')
 assert p.returncode==0 and r.get('success') and r.get('exitCode')==0,(label,r)
 return r
def py(code,label='python',timeout=60):return call(['python3','-c',code],label,timeout)
def put(p,remote):
 p=pathlib.Path(p);b=p.read_bytes();h=hashlib.sha256(b).hexdigest()
 for off in range(0,len(b),49152):
  code='import pathlib,base64;p=pathlib.Path('+repr(remote)+');p.parent.mkdir(parents=True,exist_ok=True);b=base64.b64decode('+repr(base64.b64encode(b[off:off+49152]).decode())+');'
  code+= 'assert not p.exists();p.write_bytes(b)' if off==0 else 'assert p.stat().st_size=='+str(off)+';p.open("ab").write(b)'
  py(code,'stage-'+p.name+'-'+str(off))
 # Independent API command reopens all final bytes. No execution until hash matches.
 r=py('import pathlib,hashlib,json;p=pathlib.Path('+repr(remote)+');b=p.read_bytes();assert len(b)=='+str(len(b))+';assert hashlib.sha256(b).hexdigest()=='+repr(h)+';print(json.dumps(dict(path=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())))','readback-'+p.name)
 row=json.loads(r['stdout'])
 with (O/'transfers.jsonl').open('a') as f:f.write(json.dumps(row)+'\n')
 return row
