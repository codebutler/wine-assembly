import pathlib,json,subprocess,hashlib
R=pathlib.Path('/tmp/legacy-texture-operation-caps-oct23/repo'); B=pathlib.Path('/tmp/legacy-texture-caps-independent-accept-oct23')
C='547460d4dfb6966b72cc28c04efac22a809d784f'; BASE='5406777ecbcef9cf9b03b40d592d722bb0086de0'
def git(*a):return subprocess.check_output(['git','-C',str(R),*a])
def sha(b):return hashlib.sha256(b).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==C
assert git('rev-parse',C+'^').decode().strip()==BASE
out={'candidate':C,'baseline':BASE,'compilers':[],'excerpts':[]}
for variant,rev in [('candidate',C),('baseline',BASE)]:
 m=json.loads((R/f'docs/re-notes/legacy-texture-operation-caps-20261023/{variant}-excerpt-manifest.json').read_text())
 for c in m['compiler']:
  p=R/c['file'];raw=p.read_bytes();blob=git('rev-parse',rev+':'+c['file']).decode().strip()
  assert blob==c['blob'] and sha(raw)==c['sha256'] and len(raw)==c['fullBytes'] and raw==git('show',rev+':'+c['file'])
  out['compilers'].append(dict(c,fullPath=str(p.resolve()),revision=rev))
 core=git('show',rev+':src/09ab-handlers-d3dim-core.wat'); direct=git('show',rev+':src/09a8-handlers-directx.wat')
 for x in m['excerpts']:
  if x['file']=='import-signature-only':
   sources=[raw for raw in [core,direct] if sha(raw[x['startByte']:x['endByteExclusive']])==x['sha256']];assert len(sources)==1;raw=sources[0]
  else: raw=git('show',rev+':'+x['file'])
  part=raw[x['startByte']:x['endByteExclusive']]
  assert len(part)==x['bytes'] and sha(part)==x['sha256'] and part.startswith(x['marker'].encode())
  assert raw[:x['startByte']].count(b'\n')+1==x['startLine'] and raw[:x['endByteExclusive']].count(b'\n')+1==x['endLine']
  out['excerpts'].append(dict(x,revision=rev))
 (B/f'{variant}-core.wat').write_bytes(core) if variant=='baseline' else None
out['status']='PASS';(B/'identity.json').write_text(json.dumps(out,indent=2)+'\n'); print('PASS exact compiler full paths/Git blobs/SHA and byte-exact offsets/lines, both revisions')
