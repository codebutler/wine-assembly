import pathlib,json,hashlib,tarfile,os,subprocess,datetime
R=pathlib.Path('/home/user/aow2-software');os.chdir(R)
assert (R/'driver.exit').read_text().strip()=='0'
pins=json.loads((R/'pins.json').read_text());bad=[]
for x in pins['files']:
 if hashlib.sha256((R/x['path']).read_bytes()).hexdigest()!=x['sha256']:bad.append(x['path'])
assert not bad,bad
deps=json.loads((R/'runner-dependencies.json').read_text())
for x in deps:assert hashlib.sha256((R/x['path']).read_bytes()).hexdigest()==x['sha256'],x['path']
pids=[]
for n in ['run']:
 d=json.loads((R/n/'identity.json').read_text());pids.extend([d['pid'],d['chromePid']])
alive=[p for p in pids if pathlib.Path('/proc/'+str(p)).exists()];assert not alive,alive
ss=subprocess.check_output(['ss','-ltnp'],text=True)
processes=subprocess.check_output(['ps','-eo','pid,args'],text=True)
owned=[s for s in processes.splitlines() if ('chrome' in s and d['profile'] in s) and 'closeout' not in s]
assert not owned,owned
handoff=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),box='bx_y5a3vk8g',state='RUNNING; exec healthy; no lifecycle action taken',expiry='2026-10-22T05:33:29.742Z',shutdownOwner='coordinator',checkpoint='2026-10-22T05:23:00Z',path=str(R),pids=pids,alive=alive,listening=ss,freeBytes=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize,pinsVerified=len(pins['files']),dependenciesVerified=len(deps))
(R/'handoff.json').write_text(json.dumps(handoff,indent=2))
(R/'HANDOFF.txt').write_text('Coordinator owns snapshot-stop. Leave this SAME box RUNNING until coordinator shutdown. All task test processes have exited. Retained source c26252c4, shipping module f644bbb2, original assets, fonts, runner, and one browser session at '+str(R)+'. No further task authorized.\n')
paths=['run','driver.log','driver.exit','measure.log','measure.exit','pins.json','preflight.json','runner-dependencies.json','runtime/package.json','runtime/package-lock.json','handoff.json','HANDOFF.txt']
with tarfile.open(R/'evidence.tar.gz','w:gz') as t:
 for p in paths:t.add(R/p,arcname=p)
d=(R/'evidence.tar.gz').read_bytes()
receipt=dict(path=str(R/'evidence.tar.gz'),bytes=len(d),sha256=hashlib.sha256(d).hexdigest(),handoff=handoff)
(R/'archive-receipt.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
