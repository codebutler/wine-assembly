import pathlib,json,hashlib,subprocess
B=pathlib.Path(__file__).parent; R=pathlib.Path('/tmp/legacy-texture-operation-caps-oct23/repo')
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda *a:subprocess.check_output(['git','-C',str(R),*a])
m=json.loads((B/'implementation-manifest.json').read_text());old=json.loads((B/'identity.json').read_text())
out={'revision':git('rev-parse','HEAD').decode().strip(),'fixtureSHA256':sha((R/'test/test-legacy-texture-operation-caps.js').read_bytes()),'compilers':[],'excerpts':m['excerpts'],'assembledBytes':m['assembledBytes'],'assembledSHA256':m['assembledSHA256']}
for c in m['compiler']:
 p=R/c['file'];raw=p.read_bytes();blob=git('rev-parse','HEAD:'+c['file']).decode().strip()
 assert raw==git('show','HEAD:'+c['file']) and sha(raw)==c['sha256']
 assert any(x['file']==c['file'] and x['blob']==blob and x['sha256']==c['sha256'] for x in old['compilers'])
 out['compilers'].append(dict(c,path=str(p.resolve()),blob=blob,bytes=len(raw)))
sources={f:(R/f).read_bytes() for f in ['src/09ab-handlers-d3dim-core.wat','src/09a8-handlers-directx.wat','src/09a8g-gl-raster.wat','src/09a8cc-gl-stencil.wat','src/09a8cd-gl-color-mask.wat']}
for x in m['excerpts']:
 candidates=list(sources.values()) if x['file']=='import-signature-only' else [sources[x['file']]]
 valid=[s for s in candidates if sha(s[x['startByte']:x['endByteExclusive']])==x['sha256']]
 assert len(valid)==1,x['marker'];raw=valid[0];part=raw[x['startByte']:x['endByteExclusive']]
 assert len(part)==x['bytes'] and part.startswith(x['marker'].encode())
 assert raw[:x['startByte']].count(b'\n')+1==x['startLine'] and raw[:x['endByteExclusive']].count(b'\n')+1==x['endLine']
out['reproducerSHA256']=sha((B/'argument-reproducer.js').read_bytes())
assert (B/'argument-reproducer.js').read_bytes()==git('show','d84f4da79fce87e80e998d48e6fdb2a11c9961fe:docs/re-notes/legacy-texture-caps-independent-accept-20261023/argument-reproducer.js')
out['status']='PASS';(B/'implementation-preflight.json').write_text(json.dumps(out,indent=2)+'\n')
print('PASS compiler exact paths/blobs/full SHA; byte-exact excerpt ranges/order verified; unchanged reproducer hash retained')
