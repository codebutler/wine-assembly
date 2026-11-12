exec(compile(open(__file__.replace('multichunk.py','independent.py')).read().split("cli('legal-raw")[0],__file__,'exec'))
p=c.plan_provider_images([png],used=0,tail_reserve=100,chunk_bytes=16);f=frames(p)
assert len(f)>5
for name,raws in [('chunk-swap',[f[0],f[2],f[1],*f[3:]]),('chunk-duplicate',[*f[:2],f[1],*f[3:]]),('chunk-truncate',[*f[:2],*f[3:]]),('chunk-last-missing',f[:-2]+[f[-1]])]:
 cap=c.ProviderCapture(p)
 try:
  for raw in raws:cap.accept(raw)
  cap.finish()
 except c.ContractError:results.append(dict(case=name,rejected=True))
 else:raise AssertionError(name)
cap=c.ProviderCapture(p)
for raw in f:cap.accept(raw)
assert cap.finish()[0]==[image]
(D/'multichunk.json').write_text(json.dumps(dict(results=results,positiveChunkCount=len(f)-2,rawBytes=sum(map(len,f)),hash=c.sha(image))))
print('PASS 4 independent multi-chunk attacks and positive control')
