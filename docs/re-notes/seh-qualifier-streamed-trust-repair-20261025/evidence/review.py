import pathlib,json,hashlib,subprocess
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';P=R/'docs/re-notes/seh-current-canonical-qualifier-20261025'
D=pathlib.Path('/tmp/seh-current-canonical-qualifier-oct25');B='806117a11f1b347340b5cc44fb52b79d0ac200e5'
def sha(b):return hashlib.sha256(b).hexdigest()
def gitblob(p):
 r=subprocess.run(['git','-C',str(R),'cat-file','blob',B+':docs/re-notes/seh-current-canonical-qualifier-20261025/'+p],capture_output=True,timeout=10)
 assert r.returncode==0 and not r.stderr and len(r.stdout)<=131072
 return r.stdout
contract=gitblob('evidence/contract.json');binding=gitblob('evidence/source-binding.json')
assert contract==(D/'ops/contract.json').read_bytes() and binding==(D/'ops/source-binding.json').read_bytes()
assert sha(contract)=='4aca68bf97038d771390dd499703fac2e559146186d23f34e6e27425a5083a4b'
old=gitblob('qualify.cjs').decode();new=(P/'qualify.cjs').read_text()
assert old[old.index('function select('):]==new[new.index('function select('):],'parser/metadata/guard/main unchanged'
assert gitblob('test-qualifier.cjs')==(P/'test-qualifier.cjs').read_bytes()
assert new.count('new WebAssembly.Module(b)')==1
controls=json.load(open(O/'controls.json'));assert sum(x.get('rejected',False) for x in controls['results'])==35
assert sum(x.get('repairStaticPass',False) for x in controls['results'])==2
assert len([x for x in json.load(open(O/'substitutions/results.json'))['results'] if x.get('rejected')])==12
assert json.load(open(O/'reproducer-repair-result.json'))['exactOriginalReviewerMaliciousInputs']['baselineAllStaticChecksPassed']
modules=[]
for stem in ['module-tail-1792962254995280249','module-compat-1792962261316200243']:
 receipt=(D/'ops'/(stem+'.stdout')).read_bytes();q=json.loads(receipt)
 assert q['nativeModuleReturned'] and q['imports']==291 and q['functionExports']==2224 and q['typeCount']==172 and q['noStart']
 assert q['qualifierSHA256']==sha(old.encode())
 modules.append(dict(path=str(D/'ops'/(stem+'.stdout')),sha256=sha(receipt),qualification=q,reuseOnly=True))
for base in [D,pathlib.Path('/tmp/seh-canonical-qualifier-independent-integrate-oct25')]:
 m=json.load(open(base/'ops/final-evidence-manifest.json'))
 for row in m if isinstance(m,list) else m['files']:
  p=pathlib.Path(row['path']);assert p.stat().st_size==row['bytes'] and sha(p.read_bytes())==row['sha256'],str(p)
ROOT=pathlib.Path('/home/user/wine-assembly')
refs=subprocess.run(['python3',str(ROOT/'scratch/usage-watch/stream-root-ref-digest-oct25.py')],capture_output=True,timeout=20);assert refs.returncode==0 and len(refs.stdout)<8192
before=json.load(open(O/'root-before.json'));after=json.loads(refs.stdout)
assert before['refs']==after,'root refs unchanged'
assert before['indexSHA256']==sha((ROOT/'.git/index').read_bytes())
status=subprocess.run(['git','-C',str(ROOT),'status','--porcelain=v1'],capture_output=True,timeout=15);assert status.returncode==0 and len(status.stdout)<131072
assert status.stdout.decode()==before['status']
result=dict(state='REPAIR_REVIEW_PASS',base=B,source='a3fe340b962da3f31df249881074afe41d6c69a2',contractSHA256=sha(contract),sourceBindingSHA256=sha(binding),qualifierSHA256=sha(new.encode()),provenance='contract and source receipt exact blobs from remotely verified candidate commit',unchangedParserMetadataGuardAndNativeCallsite=True,existingRejections=35,newSubstitutionRejections=12,legitimateStaticBinaries=2,modulesReused=modules,nativeCallsThisTask=0,rootRefs=after,rootRefsUnchanged=True,rootIndexUnchanged=True,rootTrackedStatusUnchanged=True,box=None,stateBox='notassigned',expiry=None,Boat403='api_key_action_forbidden; no query or retry',protectedBox='bx_69aem736 untouched')
(O/'review.json').write_text(json.dumps(result,indent=2)+'\n')
print('REVIEW PASS: independent committed contract authority; unchanged parser/metadata/guard/main; 35+12 controls; two retained genuine Module receipts; root refs/index unchanged')
