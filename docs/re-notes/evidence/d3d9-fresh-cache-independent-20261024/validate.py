import pathlib,json,hashlib,subprocess
P=pathlib.Path(__file__).parent;R=P/'repo';E=R/'docs/re-notes/evidence/d3d9-fresh-cache-independent-20261024';E.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
def git(*a):
 r=subprocess.run(['git','-C',str(R),*a],capture_output=True,check=True);(P/'git-read.log').open('ab').write(r.stderr);return r.stdout
old=R/'docs/re-notes/evidence/d3d9-fresh-target-cache-repair-20261024'
seals=json.loads((old/'artifact-seals.json').read_text())
for f,h in seals.items():assert sha(git('show','6bac6611339ef571014e557f168ef4ecb8db1f57:'+f))==h,f
for c in ['f6571101e38985b3fa34d328f2ccadd9735a7573','ffe822a9d50ad79439330609915eb84475acd2bc','c1bfc2c696e8b88749a3b8ab04f935b5e52d7cb1','77180c76b312efe465ad91e60286d40330d77d0d','912cd44a9e0b4ffedf106ecc80031351773f5302']:
 assert git('rev-parse',c+'^{commit}').decode().strip()==c
 git('merge-base','--is-ancestor',c,'6bac6611339ef571014e557f168ef4ecb8db1f57')
for f,h in [('test/test-d3d9-clear-fresh-target-independent.js','4b550a8b7966228cddb3957c789803835c1df05bc128c45c5fac14a3b7e86408'),('test/test-d3d9-clear-fresh-target-cache.js','825ff9e55f47395a5d00ecffee602aa2e8b06bb0745bfc2105095d6b272e12e6')]:assert sha((R/f).read_bytes())==h
probe='test/test-d3d9-clear-independent-review.js';current=(R/probe).read_bytes();original=git('show','c1bfc2c696e8b88749a3b8ab04f935b5e52d7cb1:'+probe)
assert current[:2072]==original[:2072];assert sha(current[:2072])=='12c84f2b97688fdee0c805d746e78d52c6e1d90397e0041d33210c4b04b5e522'
cp=json.loads((old/'compiler-checkpoint.json').read_text());CR=pathlib.Path(cp['compilerRoot'])
for f,pin in cp['compiler'].items():
 b=(CR/f).read_bytes();assert len(b)==pin['bytes'] and sha(b)==pin['sha256'];assert git('rev-parse','6bac6611339ef571014e557f168ef4ecb8db1f57:'+f).decode().strip()==pin['blob'];assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==pin['blob']
slices=[]
for name,pin in cp['functions'].items():
 b=(R/pin['file']).read_bytes();assert b==git('show','6bac6611339ef571014e557f168ef4ecb8db1f57:'+pin['file'])
 s=b''.join(b.splitlines(keepends=True)[pin['startLine']-1:pin['endLine']]).strip();assert len(s)==pin['bytes'] and sha(s)==pin['sha256'];assert s.startswith(('(func $'+name+' ').encode());slices.append(s)
source=b'(memory 1 1)\n(export "memory" (memory 0))\n'+b'\n'.join(slices)+b'\n';assert len(source)==5257 and sha(source)==cp['source']['sha256']
out={'candidate':'6bac6611339ef571014e557f168ef4ecb8db1f57','seals_verified':len(seals),'probe_body_unchanged':True,'compiler':cp,'source_bytes':len(source),'source_sha256':sha(source),'mount_argv':'N/A: no runtime or guest','pass':True}
(E/'identity-checkpoint.json').write_text(json.dumps(out,indent=2)+'\n');print('PASS identities, '+str(len(seals))+' seals, unchanged probes, exact compiler/blobs and 5257-byte ordered excerpt')
