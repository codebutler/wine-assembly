import pathlib,runpy,subprocess,json,os,hashlib
B=pathlib.Path(__file__).parent;R=pathlib.Path('/tmp/legacy-texture-operation-caps-oct23/repo')
g=runpy.run_path(str(B/'implementation-guard.py'));g['sample']()
base='5406777ecbcef9cf9b03b40d592d722bb0086de0'
git=lambda f:subprocess.check_output(['git','-C',str(R),'show',base+':'+f])
core=(B/'baseline-core.wat').read_bytes();assert core==git('src/09ab-handlers-d3dim-core.wat')
lib=R/'lib/d3dim-gpu.js';candidate=lib.read_bytes();original=git('lib/d3dim-gpu.js')
(B/'implementation-gpu-recovery.js').write_bytes(candidate)
receipts=[]
try:
 lib.write_bytes(original)
 env=dict(os.environ,LEGACY_CAPS_CORE=str(B/'baseline-core.wat'),LEGACY_CAPS_RECEIPT=str(B/'implementation-baseline-manifest.json'))
 g['run'](['node','--max-old-space-size=256','test/test-legacy-texture-operation-caps.js','--manifest-only'],cwd=str(R),env=env)
 m=json.loads((B/'implementation-baseline-manifest.json').read_text()); accepted=json.loads((B/'implementation-preflight.json').read_text())
 assert m['compiler']==[{k:c[k] for k in ['file','sha256']} for c in accepted['compilers']]
 sources={f:(R/f).read_bytes() for f in ['src/09a8-handlers-directx.wat','src/09a8g-gl-raster.wat','src/09a8cc-gl-stencil.wat','src/09a8cd-gl-color-mask.wat']}
 sources['src/09ab-handlers-d3dim-core.wat']=core
 sha=lambda b:hashlib.sha256(b).hexdigest()
 for x in m['excerpts']:
  pool=sources.values() if x['file']=='import-signature-only' else [sources[x['file']]]
  valid=[s for s in pool if sha(s[x['startByte']:x['endByteExclusive']])==x['sha256']]
  assert len(valid)==1 and x['bytes']==x['endByteExclusive']-x['startByte'];s=valid[0]
  assert s[:x['startByte']].count(b'\n')+1==x['startLine'] and s[:x['endByteExclusive']].count(b'\n')+1==x['endLine']
 (B/'implementation-baseline-preflight.json').write_text(json.dumps({'baseline':base,'status':'PASS','compilerPreflight':'implementation-preflight.json','manifest':'implementation-baseline-manifest.json','assembledSHA256':m['assembledSHA256'],'assembledBytes':m['assembledBytes']},indent=2)+'\n')
 for name,script,expected,args in [
  ('argument','/tmp/legacy-texture-caps-independent-accept-oct23/argument-reproducer.js','SELECTARG1 must honor stored COLORARG1=DIFFUSE',[]),
  ('producer','test/test-legacy-texture-operation-caps.js','TextureOpCaps must advertise exactly proven',[])]:
  env=dict(os.environ,LEGACY_CAPS_CORE=str(B/'baseline-core.wat'),REPRO_RECEIPT=str(B/'implementation-baseline-argument.json'),LEGACY_CAPS_RECEIPT=str(B/'implementation-baseline-producer.json'),CAPTURE_COMMAND_LIMIT='65536')
  try:
   g['run'](['node','--max-old-space-size=256',script,*args],cwd=str(R),env=env)
   raise AssertionError('baseline unexpectedly passed')
  except RuntimeError:
   r=json.loads((B/'execution.jsonl').read_text().splitlines()[-1]);assert r['exit']==1 and not r['failure'] and r['cleanupVerified'] and expected in r['output'],r['failure']
   receipts.append({'test':name,'expectedRejection':expected,'exit':r['exit'],'cleanupVerified':r['cleanupVerified']})
finally:
 lib.write_bytes(candidate)
 assert lib.read_bytes()==candidate
out={'baseline':base,'baselineCoreSHA256':hashlib.sha256(core).hexdigest(),'baselineGpuSHA256':hashlib.sha256(original).hexdigest(),'candidateRestoredSHA256':hashlib.sha256(candidate).hexdigest(),'results':receipts,'status':'PASS'}
(B/'implementation-baseline-rejections.json').write_text(json.dumps(out,indent=2)+'\n');g['sample']();print('PASS retained exact baseline rejects unchanged argument reproducer and producer mask oracle; candidate JS restored')
