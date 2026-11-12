import pathlib,hashlib,json,subprocess,os
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';B='a3fe340b962da3f31df249881074afe41d6c69a2'
def sha(b):return hashlib.sha256(b).hexdigest()
def git(*a):
 p=subprocess.run(['git','-C',str(R),*a],capture_output=True,timeout=15);assert p.returncode==0,p.stderr[:1000];return p.stdout
c=json.load(open('/tmp/seh-corrected-memory-canonical-build-oct25/ops/closure.json'));rows=[]
for x in c['files']:
 blob=git('rev-parse',B+':'+x['path']).decode().strip();assert blob==x['blob']
 b=git('cat-file','blob',blob);assert len(b)==x['bytes'] and sha(b)==x['sha256'],x['path'];rows.append(dict(path=x['path'],blob=blob,sha256=sha(b),bytes=len(b)))
compiler=pathlib.Path(c['compilerPath']);b=compiler.read_bytes();assert sha(b)==c['compilerFullSHA256']=='d04ed1d5ca74fc1b6f10357576a38e726d58f0ad908ccf34a29de35052aa1a33'
compilerBlob=git('rev-parse',B+':tools/watx.js').decode().strip();assert git('cat-file','blob',compilerBlob)==b
review=json.load(open(R/'docs/re-notes/seh-qualifier-streamed-trust-repair-20261025/evidence/review.json'))
for x in review['modulesReused']:
 p=pathlib.Path(x['path']);assert sha(p.read_bytes())==x['sha256'];assert json.loads(p.read_text())==x['qualification'];assert x['qualification']['qualifierSHA256']=='c46880319a64721493daff2d45437be3a7f329045f2203194dbc3f25ba8a80a6'
old=pathlib.Path('/tmp/seh-current-canonical-qualifier-oct25/repo/docs/re-notes/seh-current-canonical-qualifier-20261025/qualify.cjs').read_bytes()
new=(R/'docs/re-notes/seh-current-canonical-qualifier-20261025/qualify.cjs').read_bytes()
assert old[old.index(b'function select('):]==new[new.index(b'function select('):]
out=dict(state='PROVENANCE_PASS',source=B,sourceFilesVerified=len(rows),files=rows,compilerPath=str(compiler),compilerSHA256=sha(b),compilerGitBlob=compilerBlob,sourceAndCompilerReadOnly=True,compilerExecuted=False,unchangedSelectParserMetadataMainAndCallsite=True,reusedModuleReceipts=review['modulesReused'],nativeScope='Historical baseline constructor returns only; repaired qualifier not natively rerun')
(O/'provenance.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:v for k,v in out.items() if k in ['state','sourceFilesVerified','compilerGitBlob','unchangedSelectParserMetadataMainAndCallsite']}))
