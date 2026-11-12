import pathlib,json,hashlib,subprocess,sys
R=pathlib.Path(sys.argv[1]);E=R/'docs/re-notes/maelstrom-frozen-original-recovered-capture-20261025';H=pathlib.Path('/tmp/maelstrom-frozen-original-recovered-capture-oct25')
REV='669d61a2ce2731700fc7a65a5828611572df55f7';BASE='81eb33d4e8a4cba52107ef40ecd7cb3bd041557c';MODULE='ed9d74e5ab4c8bf03bb9f94a56ec41e6e28d9abfa282a20c6654e35e9d177ea7'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while b:=f.read(8192):h.update(b)
 return h.hexdigest()
def load(n):return json.loads((E/n).read_text())
def check(c,m):
 if not c:raise ValueError(m)
records=[json.loads(x) for x in (E/'frozen.jsonl').read_text().splitlines()];check(len(records)==1,'exactly one persisted record');r=records[0];t=load('terminal.json');c=load('command.json');summary=load('capture-summary.json');m=load('manifest.json');control=sys.argv[2] if len(sys.argv)>2 else None
if control=='stored-result':r['historicalCompletion']['identity']['result']=1
if control=='call-identity':r['historicalCompletion']['identity']['ret']+=4
if control=='wrong-module':summary['moduleSHA256']='0'*64
if control=='wrong-argv':c['argv'][4]='--wasm=/wrong.wasm'
if control=='live-substitution':r['historicalCompletion']['result']=r['historicalCompletion']['identity']['result']=r['liveHostObservation']['state']['eax']
if control=='historical-substitution':r['liveHostObservation']['state']['eax']=0
if control=='park-as-completion':r['historicalCompletion']['identity'].update(phase=2,completions=0,parks=7,post=0x074ffb18)
if control=='missing-terminal':t=None
if control=='remaining-group':t['remainingGroup']=True
if control=='multiple-guests':summary['guestStarts']=2
check(r['schema']=='maelstrom-select-frozen-record/v1','schema')
h=r['historicalCompletion'];s=h['identity'];live=r['liveHostObservation']
expected=dict(started=1,phase=3,token=7,entries=7,parks=6,completions=1,fault=0,capped=0,active=0,api=934,thunk=0x075040f8,thread=1,regs=86228992,pre=0x074ffb18,ret=0x007a3362,post=0x074ffb30,result=0)
for k,v in expected.items():check(s.get(k)==v,'historical identity '+k)
check(h['attempt']==7 and h['result']==0 and h['result']==s['result'],'historical stored result')
check(h['observation']=='historical in-handler observation after real result store','historical label')
check(live['state']==dict(eax=0x53000001,esp=0x074ffb18,eip=0x075040f8) and live['batch']==36170,'later live binding')
check(live['observation']=='later live host state at ordinary run return; not completion-time state','later label')
check(t is not None,'terminal required')
check(t['returncode']==0 and t['reason']=='natural' and t['remainingGroup'] is False and t['TERM'] is False and t['KILL'] is False,'natural reaped terminal/no group')
check(summary['guestStarts']==1 and load('one-guest-launch.json')['guestStartsAuthorized']==1,'one guest')
check(summary['moduleSHA256']==MODULE,'module binding')
check(c['argv']==load('guest-args.json'),'actual argv binding')
argv=c['argv'];check(argv[2]==str(H/'runner/test/run.js'),'runner argv')
for arg in ['--no-build','--wasm='+str(H/'runtime/build/wine-assembly.wasm'),'--max-batches=42000','--tick-ms-per-batch=200','--max-seconds=60','--memory-mb=512','--input=31000:keydown:80,31200:keyup:80,35000:keydown:37,35200:keydown:38,35500:keydown:32,36000:keyup:37,36200:keyup:38,36500:keyup:32','--maelstrom-select-frozen-record='+str(H/'guest/frozen.jsonl')]:check(arg in argv,'argv '+arg)
check(len(argv)==22 and not any(x.startswith(('--batch-size','--trace-','--break','--count')) for x in argv),'no extra budget/fence flags')
check(c['pid']==c['pgid'] and t['outputBytes']==5399,'group/output binding')
check(c['startedAt']<=live['timeMs']/1000<=c['startedAt']+t['elapsed'],'capture within run')
out=(E/'output.log').read_text();check('42000 batches' in out and '[select-frozen-record]' not in out and 'RuntimeError:' not in out,'terminal log')
cleanup=json.loads(load('cleanup-api.json')['stdout']);check(cleanup['remainingGroup'] is False and cleanup['heavyLockAvailable'] and cleanup['terminal']==t,'API terminal evidence')
for x in load('collected-seals.json'):
 p=H/'collected'/x['path'];check(sha(p)==x['sha256'] and sha(E/pathlib.Path(x['path']).name)==x['sha256'],'raw persisted seal '+x['path'])
check(len(m)==249 and len({x['target'] for x in m})==249,'manifest inventory')
total=0
for x in m:
 p=H/x['target'];check(p.stat().st_size==x['bytes'] and sha(p)==x['sha256'],'consumed input '+x['target']);total+=x['bytes']
check(total==17048410,'consumed bytes')
check(sha(H/'runtime/build/wine-assembly.wasm')==MODULE,'actual module')
for n in ['maelstrom-select-frozen-record.cjs','maelstrom-select-completion-hook.cjs']:
 p='tools/'+n;b=subprocess.check_output(['git','show',BASE+':'+p],cwd=R);check(hashlib.sha256(b).hexdigest()==sha(R/p)==sha(H/'runner'/p),'unchanged accepted '+n)
for x in load('effective-identities.json'):
 p=H/x['path'];check(p.stat().st_size==x['bytes'] and sha(p)==x['sha256'],'effective identity '+x['path'])
for x in load('accepted-references.json'):check(sha(pathlib.Path(x['path']))==x['sha256'],'accepted qualification reference')
pre=load('preflight-api.json');check(pre['success'] and json.loads(pre['stdout'])['files']==249,'remote consumed preflight')
root=pathlib.Path('/home/user/wine-assembly');receipt=json.loads((root/'scratch/usage-watch/maelstrom-frozen-original-capture-coordinator-review-oct25.json').read_text());check(receipt['commit']==REV,'coordinator revision')
for x in receipt['verifiedFiles']:
 b=subprocess.check_output(['git','show',REV+':'+x['path']],cwd=R);check(hashlib.sha256(b).hexdigest()==x['sha256']==sha(R/x['path']),'unchanged candidate evidence '+x['path'])
print(json.dumps(dict(passReceiptProvenance=True,candidate=REV,storedResult=0,attempt=7,parks=6,completions=1,liveEAX='0x53000001',consumedFiles=len(m),consumedBytes=total,candidateBlobs=len(receipt['verifiedFiles']),qualificationReused=True,runtimeReruns=0,control=control)))
