import pathlib,json,hashlib,copy,importlib.util,sys,subprocess
sys.dont_write_bytecode=True
O=pathlib.Path(__file__).parent;R=O.parent/'repo';E=R/'docs/re-notes/maelstrom-select-hook-recovered-canonical-native-20261024-evidence';ROOT=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23')
sha=lambda b:hashlib.sha256(b).hexdigest()
def j(n):return json.loads((E/n).read_text())
rejects=[]
def reject(name,f):
 try:f()
 except (AssertionError,ValueError):rejects.append(name)
 else:raise AssertionError('escaped '+name)
# Exact immutable identity, separately checked from ABI or self-declared PASS.
expected={'select-hook.wasm':('ed9d74e5ab4c8bf03bb9f94a56ec41e6e28d9abfa282a20c6654e35e9d177ea7',1880716),'select-hook.compat.wasm':('b0674d48d612fad540bc7dd6da1c431ac29682108dfbf13cac3dddad2bf650e8',1883289)}
def identity(b,n):assert (sha(b),len(b))==expected[n]
for n in expected:identity((E/n).read_bytes(),n)
reject('wrong module identity',lambda:identity((E/'select-hook.compat.wasm').read_bytes(),'select-hook.wasm'))
inputs=j('build-inputs.json')
def input_check(row,b):assert len(b)==row['bytes'] and sha(b)==row['sha256']
for row in inputs['inputSeals']:input_check(row,(ROOT/row['path']).read_bytes())
row=inputs['inputSeals'][0];reject('wrong source input',lambda:input_check(row,(ROOT/row['path']).read_bytes()+b' '))
for p,v in j('execution-identities.json').items():
 if '/repo/' in p: b=(R/p.split('/repo/',1)[1]).read_bytes();assert len(b)==v['bytes'] and sha(b)==v['sha256']
guard=j('guard-identity.json');assert sha(pathlib.Path(guard['path']).read_bytes())==guard['sha256']
for prefix in ['compiler','native']:
 attempt=j(prefix+'-attempt.json');terminal=next(E.glob(prefix+'-[0-9]*.json'));t=json.loads(terminal.read_text());assert t['argv']==attempt['argv'] and t['exit']==0 and t['reason'] is None and t['reaped'] and not t['remainingGroup'];assert t['argv'][2:4]==['--require',guard['path']]
# Raw terminal serialization must match the committed final result.
n=j('native-result.json');lines=next(E.glob('native-[0-9]*.stdout')).read_text().splitlines();assert json.loads(lines[-1])==n
assert n['moduleSHA256']==expected['select-hook.wasm'][0] and n['nativeInstances']==1
assert len(n['states'])==14 and len(n['snapshots'])==3
assert [s['capture']['token'] for s in n['snapshots']]==[1,2,3]
for i,s in enumerate(n['snapshots']):
 c=s['capture'];assert c['api']==934 and c['thunk']==0x75040f8 and c['thread']==1 and c['regs']==86228992 and c['fault']==c['capped']==c['active']==0
 assert c['entries']==i+1 and c['parks']==min(i+1,2) and c['completions']==int(i==2)
 assert c['result']==int(i==2) and c['phase']==(3 if i==2 else 2) and c['post']==c['pre']+(24 if i==2 else 0)
 assert s['accepted']['kind']==('completion' if i==2 else 'park')
# Real addresses rather than only the preflight's declared intervals: CALL's
# return stub is pc+2. Account actual bytes and all lane setup spans.
def spans(states):
 result=[]
 for s in states:
  route=s['row']['route'];result += [(s['pc'],2 if route in ['call','jmp'] else 1),(s['ret'],7),(s['fd'],8),(s['tv'],8),(s['pre'],24)]
 return result
actual=spans(n['states'])
def disjoint(a):
 for i,(p,z) in enumerate(a):
  for q,w in a[:i]:assert p+z<=q or q+w<=p
# CALL's saved return and argument area are one contiguous stack interval.
disjoint(actual)
reject('fixture contamination',lambda:disjoint(actual+[actual[0]]))
def compare(x):
 a,b=x['equivalence'];assert a['enabled']==False and b['enabled']==True and len(a['rows'])==len(b['rows'])==7
 assert a['rows']==b['rows']
 for lane in x['equivalence']:
  for s in lane['rows']:
   assert s['starting']==[0,0] and s['counts'][1]==0
   for h in s['hosts']:assert h['name']=='get_ticks' and h['args']==[]
 for enabled in [False,True]:assert [s['row'] for s in x['states'] if s['enabled']==enabled]==x['equivalence'][int(enabled)]['rows']
compare(n)
for key,value in [('eax',123),('fdHandle',0),('counts',[0,1]),('hosts',[{'name':'socket_event','args':[0]}]),('cache',[99,0,0])]:
 bad=copy.deepcopy(n);bad['equivalence'][1]['rows'][0][key]=value;reject('OFF/ON '+key,lambda:compare(bad))
# Parser is binary-only. A forbidden start section must reject before native use.
spec=importlib.util.spec_from_file_location('abi',ROOT/'docs/re-notes/shadow-man-span-static-canonical-20261023/static-abi.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
p=O/'forbidden-start.wasm';p.write_bytes((E/'select-hook.wasm').read_bytes()+bytes([8,1,0]));reject('binary start section',lambda:a.parse(p));p.unlink()
# Every added global, including trailing globals, must be private mutable i32 0.
def section(b,k):
 r=a.Reader(b[8:])
 while r.p<len(r.b):
  kind=r.byte();body=r.take(r.leb())
  if kind==k:return body

def globals(b):
 r=a.Reader(section(b,6));v=[]
 for _ in range(r.leb()):
  start=r.p;ty=r.byte();mut=r.byte();op=r.byte();assert op in [0x41,0x42,0x43,0x44]
  if op in [0x41,0x42]:
   while r.byte()&128:pass
  else:r.take(4 if op==0x43 else 8)
  assert r.byte()==11;v.append(r.b[start:r.p])
 r.end();return v
for suffix in ['', '.compat']:
 old=globals((ROOT/('build/wine-assembly'+suffix+'.wasm')).read_bytes());new=globals((E/('select-hook'+suffix+'.wasm')).read_bytes());i=0;added=[]
 for g in new:
  if i<len(old) and g==old[i]:i+=1
  else:added.append(g)
 assert i==len(old) and len(added)==18 and all(g==bytes.fromhex('7f0141000b') for g in added)
out=dict(status='PASS',candidate='9e09d9c7660948d00f022171b1edf36e2d2ef656',tree='d877bcc4ff0d95bd004ec88c667e0a2523455fb2',rejects=rejects,actualFixtureIntervals=len(actual),sourcePins=len(inputs['inputSeals']),nativeReruns=0,compilerReruns=0,scope='static and sealed record controls, no native mutants',qualifications=['guard identity receipt after compiler; preload verified in argv','initial watcher lacked regular-file guard, corrected and reaped','historical checker errors retained','zero diagnostic/same-frame retry/exceptions/compat native/intra-invocation/game/overhead unqualified'])
(O/'independent.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
