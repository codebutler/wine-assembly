import pathlib,subprocess,json,hashlib,tarfile,shutil,datetime
R=pathlib.Path('/home/user/deus-ex-training');E=R/'native-support-evidence'
assert (E/'run.exit').read_text().strip()=='0'
log=(E/'run.log').read_text();assert 'UNIMPLEMENTED API:' not in log and 'RuntimeError:' not in log
p=subprocess.check_output(['ps','-eo','pid,args'],text=True);lines=[x for x in p.splitlines() if 'node test/run.js --app=deus_ex_demo' in x and 'python3 -c' not in x]
assert not lines,lines
ss=subprocess.check_output(['ss','-ltnp'],text=True);assert ':8123 ' not in ss
r=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),exitCode=0,testProcesses=lines,controlListenerAbsent=True,freeBytes=shutil.disk_usage(R).free,boxState='left running; lifecycle coordinator-owned')
(E/'closeout.json').write_text(json.dumps(r,indent=2))
with tarfile.open(R/'native-support-evidence.tar.gz','w:gz') as t:t.add(E,arcname='native-support-evidence')
p=R/'native-support-evidence.tar.gz';print(json.dumps(dict(closeout=r,archiveBytes=p.stat().st_size,archiveSha256=hashlib.sha256(p.read_bytes()).hexdigest()),indent=2))
