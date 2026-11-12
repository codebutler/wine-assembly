import pathlib,sys,json,base64,hashlib,shlex,time
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';sys.path.insert(0,str(O));from transport import py,save,sha
j=py('import pathlib,json,hashlib;h=pathlib.Path('+repr(str(H))+');ps=list((h/"guest").glob("*"));print(json.dumps([dict(path=str(p.relative_to(h)),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in ps if p.is_file()]))');save('ops/collect-inventory-api.json',j);items=json.loads(j['stdout']);assert sum(x['bytes'] for x in items)<=2097152
for x in items:
 assert x['bytes']<=131072,x
 p=H/'collected'/x['path'];p.parent.mkdir(parents=True,exist_ok=True)
 data=bytearray()
 for off in range(0,x['bytes'],12000):
  j=py('import pathlib,base64;print(base64.b64encode(pathlib.Path('+repr(str(H/x['path']))+').read_bytes()['+str(off)+':'+str(off+12000)+']).decode())');data.extend(base64.b64decode(j['stdout'].strip()))
 assert len(data)==x['bytes'] and sha(data)==x['sha256'];p.write_bytes(data)
save('ops/collected-seals.json',items)
terminal=json.load(open(H/'collected/guest/terminal.json'));log=(H/'collected/guest/output.log').read_text();fp=H/'collected/guest/frozen.jsonl';events=[]
if fp.exists():
 raw=fp.read_text()
 # Persist format is bound to the unchanged accepted transform; don't repair output.
 for line in raw.splitlines():
  if line.strip():events.append(json.loads(line))
assert len(events)<=1
fault=any(x in log for x in ['[select-frozen-record] disabled','[select-frozen-record] rejected','RuntimeError:','[crash]'])
status='CAPTURED_HISTORICAL_COMPLETION' if len(events)==1 and not fault else 'BLOCKED_REJECTION' if fault or terminal['returncode']!=0 or terminal['reason']!='natural' else 'BOUNDED_NO_COMPLETION_RECORD'
analysis=dict(status=status,guestStarts=1,terminal=terminal,historicalCompletion=events[0]['historicalCompletion'] if events else None,liveHostObservation=events[0]['liveHostObservation'] if events else None,completionRecordCount=len(events),arrivalOrPark='Completion proves an attempt only if a genuine historical record exists. Arrival/park otherwise unobserved by this completion-only adapter.',faultDetected=fault,gameplayAcceptance=False,unknown=['gameplay','audio','input responsiveness','overhead','zero diagnostic completion','same-frame retry','exception equivalence'],finiteBudgetUnchanged=True,noFollowOnGuest=True)
save('ops/analysis.json',analysis);print(json.dumps(dict(status=status,records=len(events),reason=terminal['reason'],returncode=terminal['returncode'],logBytes=terminal['outputBytes'])),flush=True)
# Exact cleanup state, no lifecycle mutation and no synthetic call.
code='''import pathlib,json,os,fcntl,shutil,re
h=pathlib.Path(ROOT);lock=open('/tmp/wine-ops-heavy-runtime.lock','a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);fcntl.flock(lock,fcntl.LOCK_UN);terminal=json.load(open(h/'guest/terminal.json'));pid=json.load(open(h/'guest/command.json'))['pgid']
try:os.killpg(pid,0);remaining=True
except ProcessLookupError:remaining=False
assert not remaining
ps=list(h.rglob('*'));print(json.dumps(dict(remainingGroup=remaining,heavyLockAvailable=True,terminal=terminal,ownedBytes=sum(max(p.stat().st_size,p.stat().st_blocks*512) for p in ps if p.is_file()),maxFile=max(p.stat().st_size for p in ps if p.is_file()),free=shutil.disk_usage('/tmp').free,memAvailable=int(re.search(r'MemAvailable:\\s+(\\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024,lifecycle='leave RUNNING; coordinator owns shutdown01:06UTC')))
'''.replace('ROOT',repr(str(H)))
save('ops/cleanup-api.json',py(code))
