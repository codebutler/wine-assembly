import guard as g,json,os,subprocess,pathlib
B=g.B;R=B/'repo';m=json.loads((B/'focused-manifest.json').read_text());test=str(R/'test/test-legacy-texture-operation-caps.js');node='/usr/local/bin/node'
baseline=B/'baseline-core.wat';baseline.write_bytes(subprocess.check_output(['git','-C',m['donor'],'show',m['revision']+':src/09ab-handlers-d3dim-core.wat']))
for label,source in [('baseline',baseline),('candidate',R/'src/09ab-handlers-d3dim-core.wat')]:
 env=dict(os.environ,LEGACY_CAPS_CORE=str(source),LEGACY_CAPS_RECEIPT=str(B/(label+'-excerpt-manifest.json')))
 g.run([node,'--max-old-space-size=256',test,'--manifest-only'],env=env)
 g.run(['python3',str(B/'check-excerpts.py'),env['LEGACY_CAPS_RECEIPT']],phase='python')
 env['LEGACY_CAPS_RECEIPT']=str(B/(label+'-results.json'))
 try:g.run([node,'--max-old-space-size=256',test]+(['--negative-controls'] if label=='candidate' else []),env=env)
 except RuntimeError:
  if label!='baseline':raise
  r=json.loads(pathlib.Path(env['LEGACY_CAPS_RECEIPT']).read_text());assert r['status']=='FAIL' and r['error'].startswith('TextureOpCaps must advertise exactly')
  assert len(r['cases'])==7
base=json.loads((B/'baseline-results.json').read_text());cand=json.loads((B/'candidate-results.json').read_text())
assert cand['status']=='PASS' and len(cand['controls'])==5
a=bytes.fromhex(base['descriptorHex']);b=bytes.fromhex(cand['descriptorHex'])
assert int.from_bytes(a[180:184],'little')==1023 and int.from_bytes(b[180:184],'little')==14
changed=[i for i in range(236) if a[i]!=b[i]]
assert changed==[180,181],changed
assert a[:180]==b[:180] and a[184:]==b[184:]
g.write(B/'descriptor-comparison.json',{'bytes':236,'changedOffsets':changed,'allOutsideTextureOpCapsIdentical':True,'baselineMask':int.from_bytes(a[180:184],'little'),'candidateMask':int.from_bytes(b[180:184],'little'),'baselineRejectedAtCapabilityAssertion':True})
print('PASS exact baseline rejection; all 232 unrelated descriptor bytes identical; candidate plus 5 controls PASS')
