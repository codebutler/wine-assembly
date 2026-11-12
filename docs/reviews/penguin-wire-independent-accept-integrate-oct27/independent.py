import os,pathlib,sys,json,hashlib,importlib.util,subprocess,copy,zlib,base64,struct,binascii
H=pathlib.Path(os.environ.get('PENGUIN_ACCEPT_EVIDENCE',pathlib.Path(__file__).parent));R=pathlib.Path(os.environ.get('PENGUIN_ACCEPT_REPO',H.parent/'repo'));D=H/'attacks';D.mkdir(exist_ok=True)
s=importlib.util.spec_from_file_location('contract',R/'tools/penguin_capture_contract.py');c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
C='2b5da26741c04ab0759c719d5c18bade58547387';results=[]
def checkpoint(group):
 q=dict(candidate=C,sourceSHA256=c.sha((R/'tools/penguin_capture_contract.py').read_bytes()),fixtureSHA256=c.sha((R/'test/fixtures/penguin-wire-envelope.json').read_bytes()),results=results,completed=group,remaining=['hostile CLI','ledger/decode','merged-tree/publication'][group:],evidence=str(D),offlineOnly=True)
 t=H/'checkpoint.tmp';t.write_text(json.dumps(q,indent=2)+'\n');t.replace(H/'checkpoint.json')
def chunk(k,b):return struct.pack('>I',len(b))+k+b+struct.pack('>I',binascii.crc32(k+b)&0xffffffff)
# Deterministic valid 7x5 RGBA PNG, independently derived rather than donor payload.
pixels=b''.join(b'\0'+bytes((x*13+y*19)%256 for x in range(28)) for y in range(5))
image=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',7,5,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(pixels))+chunk(b'IEND',b'')
png=D/'independent.png';png.write_bytes(image);env=json.loads((R/'test/fixtures/penguin-wire-envelope.json').read_bytes())
p=c.plan_provider_images([png],used=0,tail_reserve=100)
def frames(plan):
 out=[]
 for i,r in enumerate(plan['records']):
  e=dict(env,stdout=json.dumps(r,indent=1)+'\n',commandId='independent_'+str(i),cwd='/tmp/é/工',startMs=31+i,noticedMs=90+i)
  e=dict(reversed(list(e.items())))
  raw=json.dumps(e,ensure_ascii=False,indent=1).encode().replace(b'independent',b'\\u0069ndependent')
  out.append(raw)
 return out
f=frames(p)
# Preserve every actual serialized transcript, including failing ones.
def cli(label,raws,accepted,used=0,tail=100,entries=None):
 d=D/label;d.mkdir(exist_ok=True);trans=[]
 for i,raw in enumerate(raws):
  (d/(str(i)+'.json')).write_bytes(raw);trans.append(dict(kind='capture',path=str(i)+'.json'))
 if entries is not None:trans=entries
 (d/'transcript.json').write_text(json.dumps(trans))
 argv=[sys.executable,'-B',str(R/'tools/penguin_capture_contract.py'),'restore-provider',str(png),'--transcript',str(d/'transcript.json'),'--output',str(d/'published'),'--used',str(used),'--tail-reserve',str(tail)]
 q=subprocess.run(argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE);(d/'stdout.log').write_bytes(q.stdout);(d/'stderr.log').write_bytes(q.stderr)
 actual=q.returncode==0
 assert actual==accepted,(label,q.returncode,q.stdout)
 assert (d/'published').exists()==accepted,label
 assert not list(d.glob('.published-*')),label
 if accepted:
  assert (d/'published'/png.name).read_bytes()==image
  result=json.loads(q.stdout);assert result['charged']==used+sum(map(len,raws)),(label,result)
 results.append(dict(case=label,accepted=actual,exit=q.returncode,rawBytes=sum(map(len,raws)),rawSHA256=[c.sha(x) for x in raws]))
cli('legal-raw-utf8-escaped-reversed',f,True)
# The genuine fixture is framing only; delivered is not a manifest.
cli('genuine-delivered-is-not-png',[(R/'test/fixtures/penguin-wire-envelope.json').read_bytes()]+f[1:],False)
checkpoint(1)
# Schema/status and structural failures traverse the exact production CLI.
for key,value in [('success',False),('timedOut',True),('oomKilled',True),('launcherFailed',True),('stdoutTruncated',True),('stderrTruncated',True),('exitCode',1),('signal','SIGTERM'),('stderr','failure')]:
 e=json.loads(f[0]);e[key]=value;cli('failed-'+key,[json.dumps(e).encode()]+f[1:],False)
for label,raw in [('unknown',f[0][:-1]+b',"extra":0}'),('duplicate',f[0][:-1]+b',"success":true}'),('truncated',f[0][:-9]),('missing',json.dumps({k:v for k,v in json.loads(f[0]).items() if k!='cwd'}).encode())]:cli(label,[raw]+f[1:],False)
cli('missing-end',f[:-1],False);cli('duplicate-chunk',f[:2]+[f[1]]+f[2:],False);cli('reordered',list(reversed(f)),False)
for label,field,value in [('image-identity','image',1),('chunk-order','index',7),('bad-base64','data','%%%%')]:
 e=json.loads(f[1]);r=json.loads(e['stdout']);r[field]=value;e['stdout']=json.dumps(r);cli(label,[f[0],json.dumps(e).encode(),*f[2:]],False)
checkpoint(2)
# Raw-accounting boundary: actual metadata/error/poll bytes, capture framing,
# and unspent tail must sum to exactly one MiB, without reserialization.
accounts=[(R/'test/fixtures/penguin-wire-envelope.json').read_bytes(),b'{"success":false,"stderr":"offline synthetic error"}',b'poll pending\n']
tail=sum(map(len,accounts))+17
base=c.plan_provider_images([png],used=0,tail_reserve=tail)
used=c.API_BYTES-base['total'];bp=c.plan_provider_images([png],used=used,tail_reserve=tail)
bf=[raw+b' '*(bound-len(raw)) for raw,bound in zip(frames(bp),bp['frame_limits'])]
ledger=c.ProviderCapture(bp)
for a in accounts:ledger.account(a)
for a in bf:ledger.accept(a)
got,charged=ledger.finish();assert got==[image];assert charged+ledger.tail==c.API_BYTES;assert ledger.tail==17
(D/'boundary.json').write_text(json.dumps(dict(used=used,accounts=list(map(len,accounts)),captures=list(map(len,bf)),charged=charged,remaining=ledger.tail,total=charged+ledger.tail,cap=c.API_BYTES)))
# Persist chronological ledger bytes, including interleaved non-capture bodies.
raws=[accounts[0],bf[0],accounts[1],bf[1],accounts[2],*bf[2:]]
entries=[dict(kind=('account' if i in (0,2,4) else 'capture'),path=str(i)+'.json') for i in range(len(raws))]
cli('exact-boundary-raw-ledger',raws,True,used,tail,entries)
try:c.plan_provider_images([png],used=used+1,tail_reserve=tail)
except c.ContractError:results.append(dict(case='plan-one-byte-over',rejected=True))
else:raise AssertionError('overfull plan accepted')
poison=c.ProviderCapture(bp)
try:poison.account(b'x'*(tail+1))
except c.ContractError:pass
else:raise AssertionError('account overrun accepted')
assert poison.charged==used+tail+1 and poison.failed
try:
 for raw in bf:poison.accept(raw)
 poison.finish()
except c.ContractError:results.append(dict(case='account-failure-poisons',rejected=True))
else:raise AssertionError('poisoned collector accepted')
cli('capture-one-byte-over',[bf[0]+b' ',*bf[1:]],False,used,tail)
# Isolate decoder guards with coherent adversarial records and planned metadata;
# exact-identity outer guard otherwise prevents reaching these deeper checks.
packed=zlib.compress(image)
for label,bad,size,digest in [('zlib-truncated',packed[:-1],len(image),c.sha(image)),('zlib-trailing',packed+b'x',len(image),c.sha(image)),('zlib-extra-stream',packed+packed,len(image),c.sha(image)),('zlib-output-bound',packed,len(image)-1,c.sha(image)),('hash',packed,len(image),'0'*64)]:
 cp=copy.deepcopy(p);meta=cp['canonical']['images'][0];meta.update(compressed=len(bad),size=size,sha256=digest,chunks=1)
 cp['records']=[dict(kind='manifest',images=[meta],chunk_bytes=8192),dict(kind='chunk',image=0,index=0,data=base64.b64encode(bad).decode()),dict(kind='end',images=1)]
 cap=c.ProviderCapture(cp)
 try:
  for raw in frames(cp):cap.accept(raw)
  cap.finish()
 except c.ContractError:results.append(dict(case=label,rejected=True))
 else:raise AssertionError(label+' accepted')
# Mutation controls: removing raw charge and decoder verification must make
# independent equality/hash oracles fail; no candidate code is edited.
real=c.restore_records;c.restore_records=lambda plan,records:[b'wrong image']
cap=c.ProviderCapture(p)
for raw in f:cap.accept(raw)
assert cap.finish()[0]!=[image]
c.restore_records=real
assert sum(len(c.wire(json.loads(x))) for x in f)!=sum(map(len,f))
results.append(dict(case='mutation-controls',decoderBypassDetected=True,canonicalUnderchargeDetected=True))
checkpoint(3)
print(json.dumps(dict(status='PASS',cases=len(results),imageSHA256=c.sha(image),imageBytes=len(image),sourceSHA256=c.sha((R/'tools/penguin_capture_contract.py').read_bytes()),remaining='merged-tree/publication; gameplay and provider sizing open')))
