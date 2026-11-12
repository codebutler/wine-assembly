exec(compile(open(__file__.replace('deep-controls.py','independent.py')).read().split("cli('legal-raw")[0],__file__,'exec'))
source=(R/'tools/penguin_capture_contract.py').read_text();out=[]
# Controlled mutant executes the pinned source with only one status guard
# removed in memory. The same failed-success envelope must be caught by oracle.
mut={};exec(compile(source.replace("p[key] == (key == 'success')","True"),'<status-guard-removed>','exec'),mut)
bad=json.loads(f[0]);bad['success']=False;bad=json.dumps(bad).encode()
try:
 cap=c.ProviderCapture(p);cap.accept(bad)
except c.ContractError:pass
else:raise AssertionError('status failure not caught')
cap=mut['ProviderCapture'](p)
for raw in [bad,*f[1:]]:cap.accept(raw)
assert cap.finish()[0]==[image]
out.append(dict(control='removed-success-guard',missingGuardDetected=True))
mut={};assert source.count('self.charged += len(raw)')==1
exec(compile(source.replace('self.charged += len(raw)','self.charged += 0'),'<raw-charge-removed>','exec'),mut)
cap=mut['ProviderCapture'](p)
for raw in f:cap.accept(raw)
assert cap.finish()[1]!=sum(map(len,f))
out.append(dict(control='removed-raw-charge',underchargeDetected=True))
packed=zlib.compress(image)
for label,bad,size,digest in [('truncated',packed[:-1],len(image),c.sha(image)),('trailing',packed+b'x',len(image),c.sha(image)),('extra-stream',packed+packed,len(image),c.sha(image)),('output-bound',packed,len(image)-1,c.sha(image)),('hash',packed,len(image),'0'*64)]:
 cp=copy.deepcopy(p);meta=cp['canonical']['images'][0];meta.update(compressed=len(bad),size=size,sha256=digest,chunks=1)
 cp['records']=[dict(kind='manifest',images=[meta],chunk_bytes=8192),dict(kind='chunk',image=0,index=0,data=base64.b64encode(bad).decode()),dict(kind='end',images=1)]
 cap=c.ProviderCapture(cp)
 for raw in frames(cp):cap.accept(raw)
 assert cap.cursor==len(cp['records'])
 try:cap.finish()
 except c.ContractError as e:assert 'lossless PNG verification failed' in str(e);out.append(dict(case=label,decoderReached=True,rejected=str(e)))
 else:raise AssertionError(label)
(D/'deep-controls.json').write_text(json.dumps(out,indent=2)+'\n');print('PASS two missing-guard controls, five isolated decoder guards reached')
