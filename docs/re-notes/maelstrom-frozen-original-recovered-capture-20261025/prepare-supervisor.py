import pathlib,json,hashlib,ast,datetime
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';old=pathlib.Path('/tmp/maelstrom-single-return-sync-capture-oct24/supervise.py');s=old.read_text();assert hashlib.sha256(s.encode()).hexdigest()=='37c33ade9b889f4116009efa18228eb10524c70053dabca1d305b557b4d312ef'
s=s.replace("H=pathlib.Path(__file__).parent","H=pathlib.Path(__file__).parent.parent")
s=s.replace("assert time.time()<1792835520,'latest start09:52UTC'","assert time.time()+65<1792880460+9000,'insufficient time before01:01UTC'") # replaced below using parsed schedule
schedule=json.load(open(O/'schedule.json'));cutoff=datetime.datetime.fromisoformat(schedule['guestCutoff'].replace('Z','+00:00')).timestamp()
s=s.replace('1792880460+9000',str(cutoff))
s=s.replace("E=H/'guest';E.mkdir(exist_ok=False)","import fcntl\nlock=open('/tmp/wine-ops-heavy-runtime.lock','a+')\nfcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)\nE=H/'guest';E.mkdir(exist_ok=False)")
s=s.replace("env['MAELSTROM_CAPTURE_INSTALL']='1'","env.pop('MAELSTROM_CAPTURE_INSTALL',None)")
s=s.replace("environment=dict(MAELSTROM_CAPTURE_INSTALL='1',removed=['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP'])","environment=dict(removed=['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','MAELSTROM_CAPTURE_INSTALL'])")
s=s.replace("if time.monotonic()-start>60:","if time.time()>="+str(cutoff)+" or time.monotonic()-start>60:")
s=s.replace("capture dimensions',tail)","capture dimensions|\\[select-frozen-record\\] (?:disabled|rejected)',tail)")
s=s.replace("box='bx_rfd49qx6'","box='bx_g84h8h98'").replace('shutdown09:57UTC','shutdown01:06UTC').replace('2026-10-24T10:02:43.642Z',schedule['expiry'])
s=s.replace("if sys.argv[1]=='negative-control':", "if sys.argv[1]=='inherited-limit-check':\n limits()\n print(json.dumps(dict(fileLimit=resource.getrlimit(resource.RLIMIT_FSIZE),cpu=resource.getrlimit(resource.RLIMIT_CPU),plannedArtifacts={'output.log':131072,'command.json':8192,'terminal.json':4096,'frozen.jsonl':65536})))\n sys.exit(0)\nif sys.argv[1]=='negative-control':")
# Verify unchanged tested TERM/KILL/reap primitive and exact intended guards.
a=ast.parse(old.read_text());b=ast.parse(s)
for name in ['stop','limits']:
 get=lambda t:ast.dump(next(x for x in t.body if isinstance(x,ast.FunctionDef) and x.name==name),include_attributes=False)
 assert get(a)==get(b),name
assert 'disabled|rejected' in s and 'output-guard' in s and 'first-observable-fault' in s
(O/'supervise.py').write_text(s)
(O/'supervisor-source-check.json').write_text(json.dumps(dict(baseSHA256=hashlib.sha256(old.read_bytes()).hexdigest(),effectiveSHA256=hashlib.sha256(s.encode()).hexdigest(),unchangedAST=['stop','limits'],cutoff=cutoff,finiteBudgetUnchanged=True,acceptedControlReceipts='/tmp/maelstrom-single-return-sync-capture-oct24/{watchdog-descendant-api,output-control-api}.json',addedFaultDetection='frozen adapter rejection/start failure',noGuest=True),indent=2))
print('supervisor checked',cutoff)
