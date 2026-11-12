from control import *
import gzip
docs=R/'docs/re-notes/maelstrom-current-main-uop-build-native-20261026'
manifest=json.loads((docs/'evidence-manifest.json').read_text())
for row in manifest:
 p=docs/row['path'];assert hashlib.file_digest(p.open('rb'),'sha256').hexdigest()==row['sha256'],row
pins=json.loads((P/'publication-integrity.json').read_text())['selectedPins']
for p,h in pins.items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==h,p
rows=json.loads((P/'current-manifest.json').read_text())['files']
# Stream immutable Git payloads without capturing their full contents or copying sources.
p=subprocess.Popen(['git','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m','cat-file','--batch'],cwd=R,preexec_fn=limits,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
started=time.monotonic();identities=[];selected={}
for row in rows:
 path=row['path'];p.stdin.write((BASE+':'+path+'\n').encode());p.stdin.flush()
 header=p.stdout.readline(256).decode().split();assert len(header)==3 and header[1]=='blob',header
 left=int(header[2]);assert left==row['bytes'] and left<=25165824
 h=hashlib.sha256();chunks=[]
 while left:
  assert time.monotonic()-started<120
  b=p.stdout.read(min(left,8192));assert b;left-=len(b);h.update(b)
  if path in ['src/09d-winsock.wat','src/09b-dispatch.wat','src/09b2-dispatch-table.generated.wat','src/05-alu.wat','src/06b-core-handlers.wat','src/13-exports.wat']:chunks.append(b)
 assert p.stdout.read(1)==b'\n';assert h.hexdigest()==row['sha256'],path
 identities.append(dict(path=path,blob=header[0],sha256=h.hexdigest(),bytes=row['bytes']))
 if chunks:selected[path]=b''.join(chunks).decode()
p.stdin.close();assert p.wait(timeout=10)==0;assert not p.stderr.read(8193)
assert len(identities)==140
save('source-verification.json',dict(candidate=CAND,base=BASE,payloads=len(manifest),pins=pins,objects=identities,streamedNotCaptured=True))
def unpack(n):return json.loads(gzip.decompress((P/n).read_bytes()))
build=unpack('allocation-corrected-build.json.gz');old=unpack('build-static-evidence.json.gz')
exe=json.loads(build['execution-canonical-build-allocation-corrected.json'])
assert exe['exit']==0 and exe['reason'] is None and exe['localFullAdmission']['passChecks'] and exe['localFullAdmission']['peak']<=67108864
assert exe['allocated']<=exe['remoteBudget'] and exe['memAvailable']>=exe['minMemory'] and exe['diskFree']-exe['remoteBudget']>=exe['diskFloor']
assert build['canonical-build-allocation-corrected.stderr']==''
bi=json.loads(build['build-inputs.json']);assert bi['inputSeals']==rows and bi['candidate']==BASE
assert bi['hookSHA256']==pins['tools/maelstrom-native-errno-latch.cjs']
out=json.loads(build['build-outputs.json']);mods=[r['sha256'] for r in out]
assert mods==['fec642f6c711e57e1c4a3dfaeaff0e11be587c56fc64cde394ed7f54147b5988','85c8e2c1137a9120ed161a68a1dfc0ed18c71b25c68a43c311b8048bf18cf503']
assert build['static-abi.json']==old['static-abi.json']
assert json.loads(old['build-outputs.json'])==out
abi=[]
for mode in ['tail','compat']:
 b=json.loads(old['abi-base-'+mode+'.json']);assert b['storageBase']==b['storageDiagnostic']
 dg=b['diagnostic'];base=b['base'];assert dg['imports']==base['imports'] and dg['noStart']
 assert len(dg['exports'])==len(base['exports'])+49
 expected={e['name']:e for e in base['exports']}
 actual={e['name']:e for e in dg['exports']}
 # Private function insertion shifts indices; preserve export kind/signature.
 for name,e in expected.items():
  assert {k:v for k,v in e.items() if k!='index'}=={k:v for k,v in actual[name].items() if k!='index'}
 rem=iter(b['globalsDiagnostic'])
 for g in b['globalsBase']:
  while True:
   new=next(rem)
   if new==g:break
   assert new=='7f0141000b'
 assert all(g=='7f0141000b' for g in rem)
 assert len(b['globalsDiagnostic'])==len(b['globalsBase'])+49
 abi.append(dict(mode=mode,base=base['sha256'],diagnostic=dg['sha256'],storageEqual=True,privateZeroGlobals=49))
checkpoint=json.loads((P/'checkpoint-native.json').read_text());assert len(checkpoint['completed'])==36 and not checkpoint['remaining']
cases=[]
for row in checkpoint['completed']:
 blob=(P/row['evidence']).read_bytes();assert hashlib.sha256(blob).hexdigest()==row['evidenceSHA256']
 f=json.loads(gzip.decompress(blob));case=row['scenario']+('-compat' if row['compat'] else '-tail')
 ex=json.loads(f['execution-'+case+'.json']);attempt=json.loads(f['attempt-'+case+'.json']);result=json.loads(f['native-result-'+case+'.json'])
 assert ex['exit']==0 and ex['reason'] is None and ex['localFullAdmission']['passChecks'] and ex['localFullAdmission']['peak']<=67108864
 assert ex['at']>=exe['at']+exe['elapsed'] and attempt['at']==ex['at']
 assert ex['allocated']<=ex['remoteBudget'] and ex['memAvailable']>=ex['minMemory'] and ex['diskFree']-ex['remoteBudget']>=ex['diskFloor']
 assert f[case+'.stderr']=='' and result['status']=='PASS' and result['moduleSHA256']==mods[int(row['compat'])]
 assert result['capture']==row['capture'] and result['nativeInstances']==1
 assert result['preflight']['moduleSHA256']==result['moduleSHA256']
 if case.startswith('errno'):
  assert result['equivalent'] and result['off']==result['on'] and result['capture']['status']==4
  assert result['capture']['pc']==0x7a3366 and result['capture']['errno']==int(row['scenario'][5:])
  assert result['warm'][0]['call']==result['warm'][0]['ret']==0
 cases.append(dict(case=case,module=result['moduleSHA256'],at=ex['at'],admissionPeak=ex['localFullAdmission']['peak'],evidenceSHA256=row['evidenceSHA256']))
failure=json.loads((P/'allocation-first-failure.json').read_text());assert failure['peak']==118281378 and not failure['passChecks']
save('evidence-review.json',dict(candidate=CAND,source=BASE,verdict='EVIDENCE_ADMISSIBLE_BOUNDED_SYNTHETIC',manifestPayloads=len(manifest),sourceObjects=140,pins=8,buildExecution=exe,modules=mods,abi=abi,cases=cases,originalFailurePreserved=failure,notRerun=True))
save('checkpoint-integrity.json',dict(candidate=CAND,status='INTEGRITY_SOURCE_AND_ADMITTED_EVIDENCE_PASS',remaining=['bounded pin-migration challenge','final independent decision','conditional publication']))
print(json.dumps(dict(manifestPayloads=len(manifest),sourceObjects=140,cases=len(cases),modules=mods,abi=abi)))
