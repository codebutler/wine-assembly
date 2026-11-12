from work import *
def toolbytes(p):
 total=0
 for line in p.read_text().splitlines():
  try:j=json.loads(line).get('payload',{})
  except ValueError:continue
  out=j.get('output','')
  if j.get('type') in ['custom_tool_call_output','function_call_output']:
   total+=len(out.encode()) if isinstance(out,str) else sum(len(x.get('text','').encode()) for x in out if isinstance(x,dict))
 return total
def capture(extra=0):
 a=json.load(open(H/'session.json'));t=toolbytes(pathlib.Path(a['session']));r=sum(json.loads(l)['responseBytes'] for l in (H/'api-history.jsonl').read_text().splitlines())
 j=dict(toolText=t,allRemoteResponseBytes=r,newCharged=t+r,newAllowance=2097152,projectedAdditional=extra,projectedTotal=t+r+extra,historicalReceipt=str(H/'capture-history.json'),historicalFailuresRetained=True,passCapture=t+r+extra<=2097152)
 save('capture-current.json',j);assert j['passCapture'],j
 return j
info=py('import pathlib,json,hashlib;h=pathlib.Path('+repr(R)+');files=[p for p in (h/"guest").rglob("*") if p.is_file()]+[h/n for n in ["preflight.json","tree-validation.json.gz","immediate-locked-gate.json"] if (h/n).exists()];print(json.dumps([dict(path=str(p.relative_to(h)),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in files]))')
save('guest-artifact-inventory-api.json',info);rows=json.loads(info['stdout']);save('guest-artifact-inventory.json',rows)
capture(sum(((x['bytes']+2)//3)*4+((x['bytes']+17999)//18000)*500 for x in rows)+16384)
for row in rows:
 assert row['bytes']<=(2097152 if row['path'].endswith('.png') else 262144),row
 if row['path'].endswith('.png'):
  target=H/'repo/docs/re-notes/enigma-api-single-frame-startup-20261026/startup.png'
 else:target=H/'retained'/row['path']
 target.parent.mkdir(parents=True,exist_ok=True)
 with target.open('wb') as f:
  for off in range(0,row['bytes'],18000):
   code='import base64;f=open('+repr(R+'/'+row['path'])+',"rb");f.seek('+str(off)+');print(base64.b64encode(f.read(18000)).decode())'
   j=py(code);f.write(base64.b64decode(j['stdout'].strip()))
 assert target.stat().st_size==row['bytes'] and sha(target.read_bytes())==row['sha256']
capture()
# Free the remote PNG only after the durable local copy was fsynced and hashed;
# its charged transfer peak remains in inventory. Avoid three PNG publication copies.
png=next((x for x in rows if x['path'].endswith('.png')),None)
if png:
 p=H/'repo/docs/re-notes/enigma-api-single-frame-startup-20261026/startup.png'
 with p.open('rb') as f:os.fsync(f.fileno())
 save('png-remote-retirement.json',py('import pathlib,hashlib,json;p=pathlib.Path('+repr(R+'/'+png['path'])+');assert hashlib.sha256(p.read_bytes()).hexdigest()=='+repr(png['sha256'])+';p.unlink();print(json.dumps(dict(retiredAfterDurableLocal=True,sha256='+repr(png['sha256'])+')))'))
cleanup=py('import pathlib,json,subprocess;h=pathlib.Path('+repr(R)+');r=subprocess.run(["ps","-eo","pid,ppid,pgid,args"],capture_output=True,text=True);lines=[l for l in r.stdout.splitlines() if "node" in l and '+repr(R+'/runner/test/run.js')+' in l and "python3 -c" not in l];print(json.dumps(dict(taskNode=lines,guestDirectory=str(h/"guest"),terminalExists=(h/"guest/terminal.json").exists(),captureTerminalExists=(h/"guest/capture-terminal.json").exists())))')
save('ops/cleanup-api.json',cleanup);assert not json.loads(cleanup['stdout'])['taskNode']
save('ops/box-handback.json',json.loads(subprocess.check_output([B,'--no-update','--json','info',BOX])))
capture();print('COLLECTED exact hashed durable artifacts; owned nodes absent; box lifecycle untouched')
