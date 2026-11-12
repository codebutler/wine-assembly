import pathlib,json,subprocess,os,hashlib,fcntl,time,shutil
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';ROOT=pathlib.Path('/home/user/wine-assembly');BASE='a3fe340b962da3f31df249881074afe41d6c69a2';C='19b32dad2ac09a6ae022f1f5f619a91e3f7dde4c';BR='task/seh-trust-anchor-independent-closeout-oct25'
ENV=dict(os.environ,GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes')
ENV.pop('GIT_OBJECT_DIRECTORY',None);ENV.pop('GIT_ALTERNATE_OBJECT_DIRECTORIES',None)
def save(n,d):(O/n).write_text(json.dumps(d,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def command(a,cwd=R):
 p=subprocess.run(a,cwd=cwd,env=ENV,capture_output=True,timeout=45);assert len(p.stdout)+len(p.stderr)<=131072;assert p.returncode==0,(a,p.returncode,p.stdout[-2000:],p.stderr[-2000:]);return p.stdout
def git(*a):return command(['git',*a])
def board(s):
 command(['bash','-c','echo "$ENTRY" >> messageboard.txt'],ROOT) if False else None
 e=dict(ENV,ENTRY=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())+' seh-trust-anchor-independent-closeout-oct25 '+s)
 subprocess.run(['bash','-c','echo "$ENTRY" >> messageboard.txt'],cwd=ROOT,env=e,check=True)
 tail=command(['tail','-n','1','messageboard.txt'],ROOT);assert s.encode() in tail
def refs():return dict(line.split()[::-1] for line in git('ls-remote','origin','refs/heads/main','refs/heads/'+BR,'refs/heads/task/seh-qualifier-streamed-trust-repair-oct25').decode().splitlines())
def tests(label):
 p=R/'docs/re-notes/seh-current-canonical-qualifier-20261025';node=['node','--max-old-space-size=256','--require',str(O/'no-native.cjs')]
 commands=[node+[str(p/'test-qualifier.cjs'),'/tmp/seh-current-canonical-qualifier-oct25/ops/contract.json',str(O/(label+'-controls.json'))],node+[str(p/'test-trust-anchor.cjs'),'/tmp/seh-current-canonical-qualifier-oct25/ops/contract.json',str(O/(label+'-substitutions'))],node+[str(O/'independent.cjs'),str(O/(label+'-independent'))]]
 results=[]
 for i,a in enumerate(commands):
  stdout=command(a,O);(O/(label+'-'+str(i)+'.stdout')).write_bytes(stdout);results.append(dict(argv=a,exit=0,stdoutSHA256=sha(stdout)))
 return results
with open('/home/user/wine-assembly/scratch/usage-watch/shared-integration.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 save('integration-lock.json',dict(path=lock.name,exclusive=True,pid=os.getpid(),at=time.time()))
 wfile=(O/'board-watch.txt').open('wb');watch=subprocess.Popen(['tail','-n','3','-f',str(ROOT/'messageboard.txt')],stdout=wfile,stderr=subprocess.STDOUT)
 try:
  board('OWNS isolated repo/ops and '+BR+'; semantic checks PASS, conditional serialized static integration; donors/root tracked/index/refs readonly. No native/build/box/workers.')
  before=refs();save('remote-before.json',before);assert before['refs/heads/main']==BASE,'remote main changed; qualification reconciliation required';assert before['refs/heads/task/seh-qualifier-streamed-trust-repair-oct25']==C
  assert 'refs/heads/'+BR not in before
  git('checkout','-q',BASE);git('checkout','-q','-B',BR)
  git('merge','--no-ff','--no-commit',C)
  assert git('write-tree').decode().strip()==git('rev-parse',C+'^{tree}').decode().strip()
  initial=tests('merged-initial');save('merged-initial-tests.json',initial)
  P='docs/re-notes/seh-trust-anchor-independent-closeout-20261025';dest=R/P;dest.mkdir(parents=True)
  files=['provenance-pins.json','provenance.json','merged-initial-tests.json','merged-initial-controls.json','independent-initial/result.json','merged-initial-substitutions/results.json','trusted-configuration.json']
  evidence=dest/'evidence';evidence.mkdir()
  for n in files:shutil.copyfile(O/n,evidence/n.replace('/','-'))
  for n in ['independent.cjs','no-native.cjs','provenance.py','setup.py','integrate.py','account.py','run.py','bootstrap.json']:shutil.copyfile(O/n,evidence/n)
  (dest/'README.md').write_text('''# Exact canonical qualifier: independent semantic acceptance

ACCEPT candidate `19b32dad2ac09a6ae022f1f5f619a91e3f7dde4c` against source/main
`a3fe340b962da3f31df249881074afe41d6c69a2`. Integration retains the repaired code
unchanged; source, binaries, guard and all donors are read-only.

The literal contract authority is independently grounded in the byte-identical
committed contract and source receipt from original candidate `806117a11f1b347340b5cc44fb52b79d0ac200e5`.
The contract SHA256 is `4aca68bf97038d771390dd499703fac2e559146186d23f34e6e27425a5083a4b`;
qualifier SHA256 is `c4f2d1383bb7fa253b2134443548820a4b6cd40991c4581cdd10d5a8db97cf70`.
It checks the digest before JSON parsing or any supplied path. Every supplied
identity, length, binary path, helper, guard and source receipt is thereby fixed.
Future contract changes require a reviewed code change. This is an exact
candidate authority, with no caller-configurable trust anchor.

Independent provenance checks matched all 140 source Git blobs at the pinned
revision and the compiler Git blob/full SHA256, without executing the compiler.
The accepted historical source derivation is reused. Both retained binaries
pass their complete hashes, lengths, types (172), imports (291), function exports
(2224), memory import/export (shared 8192/32768), custom sections and noStart
checks. All 269 storage/span records independently serialize to fingerprint
`9a3bc9149d58209c`, including DIRECT_WINDOW. Omission/change/duplicate controls
reject. All four historical diagnostic exports remain genuinely absent.

The supplied 35 rejection controls and 12 substitutions pass. Independent cases
add ten contract/path/nonzero/omission attacks, each rejected after reading only
the contract, plus same-count import/export substitutions, memory export index,
shared flag, type ordering, custom-section name and raw binary hash/length
changes for each binary. An exact relocated contract passes. No parse-only
acceptance is claimed for arbitrary modules: exact authenticated binary hashes
precede native construction, so the static parser is not a general validator.

The original reviewer script is byte-identical. It accepts the original baseline
and rejects the repair with identical regenerated malicious bytes; the adapter
only substitutes the exact qualifier module location, preserving the original
file/hash assertion. The original reviewer's malicious contract is also applied
directly to both modules without adapting any bytes. No zero-hash special case
or source-count-only workaround exists.

No remaining authority/path/provenance hole was found within this sealed,
read-only-input scope. Concurrent hostile mutation of trusted filesystem or
the reviewed JavaScript process is outside that scope. Artifact paths are fixed
and required on recovery; only the exact contract itself may relocate.

The genuine prior tail/compat Module-return receipts are reused only for the
baseline qualifier. The entire select/parser/metadata/main/native callsite is
unchanged. This task makes zero native WebAssembly API calls; static tests run
with throwing substitutes for every native entry point. No repaired native
rerun, compiler execution, rebuild, instantiation, SEH execution,
Configuration-to-Play, gameplay, full build-gate or deployment claim is made.

Evidence includes test commands and results, source/compiler blob verification,
independent test source and recovery scripts. Restore this branch and retained
readonly donors; place the saved scripts in an owned sibling ops directory and
use run.py with fresh full admission (heap256MiB, CPU/wall60s, file24MiB,
stdout+stderr128KiB, reap5s, task64MiB including reserve8MiB). Do not restore or
commit binaries. Exact merged/final tree and verified remote refs are recorded
in external ops/final-tree-tests.json, publication.json and sealed result.json.

Remaining gates: source changes invalidate qualification; native repair rerun,
runtime SEH, Configuration-to-Play, gameplay and full build gates remain open.
Actual Boat SSH403 api_key_action_forbidden is preserved, without query/retry.
No assigned box (null/notassigned/null), protected bx_69aem736 untouched;
coordinator owns lifecycle. No workers/successors were launched.
''')
  # Add only the explicit report/evidence files to the existing sparse set.
  with (R/'.git/info/sparse-checkout').open('a') as f:
   for p in sorted(dest.rglob('*')):
    if p.is_file():f.write('/'+str(p.relative_to(R))+'\n')
  git('add','--',P)
  tree=git('write-tree').decode().strip();final=tests('final-tree');assert git('write-tree').decode().strip()==tree
  save('final-tree-tests.json',dict(tree=tree,candidate=C,base=BASE,tests=final,WebAssemblyCalls=0,scope='exact staged merged tree; no tracked changes after tests'))
  # Fresh full admission immediately before commit/publication.
  command(['python3',str(O/'account.py'),'prepublication-admission.json'],O)
  git('diff','--cached','--check')
  git('commit','-q','-m','Accept exact canonical qualifier trust repair with independent static evidence')
  commit=git('rev-parse','HEAD').decode().strip();assert git('rev-parse','HEAD^{tree}').decode().strip()==tree
  assert git('status','--porcelain')==b''
  assert refs()['refs/heads/main']==BASE
  # Atomic, ordinary fast-forward publication; never force a shared ref.
  output=git('push','--atomic','origin','HEAD:refs/heads/'+BR,'HEAD:refs/heads/main')
  after=refs();assert after['refs/heads/main']==commit and after['refs/heads/'+BR]==commit
  # A second independent strict-SSH query verifies the actual remote identities.
  verify=dict(line.split()[::-1] for line in git('ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/main','refs/heads/'+BR).decode().splitlines());assert verify=={k:commit for k in ['refs/heads/main','refs/heads/'+BR]}
  save('publication.json',dict(commit=commit,tree=tree,branch=BR,candidate=C,previousMain=BASE,remoteRefs=after,independentVerifiedRefs=verify,atomic=True,force=False,strictSSH=ENV['GIT_SSH_COMMAND']))
  board('ACCEPT merged exact tree '+tree+' commit '+commit+' verified remote main and '+BR+' atomic strict-SSH. Static suites 35+12 plus independent path/provenance/ABI/layout and unchanged original attack PASS; no native rerun/build. Evidence '+str(O/'final-tree-tests.json')+' '+str(O/'publication.json')+'. Remaining native/runtime SEH/Configuration-to-Play/gameplay/full build gates; Boat403 preserved. Box null/notassigned/null, coordinator lifecycle. Final seal/cleanup follows.')
 finally:
  watch.terminate();watch.wait(timeout=5);wfile.close();save('integration-cleanup.json',dict(watcherPID=watch.pid,watcherReaped=True,lockReleasedOnContextExit=True))
save('integration-lock-released.json',dict(released=True,at=time.time()))
print(json.dumps(dict(state='ACCEPT_PUBLISHED',commit=commit,tree=tree)))
