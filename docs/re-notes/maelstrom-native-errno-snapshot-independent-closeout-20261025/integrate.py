import pathlib,json,subprocess,os,fcntl,hashlib,shutil,time
from account import account
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';ROOT=pathlib.Path('/home/user/wine-assembly');NAME=O.parent.name;BRANCH='task/'+NAME
C='1a87b46728222df4df0b1fee33f83e88776735a9';BASE='1ccd6130970d3151a1be23e388f0aa2b820188b2'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=dict(os.environ,GIT_SSH_COMMAND=SSH)
def git(*a):return subprocess.check_output(['git',*a],cwd=R,env=env,text=True,timeout=60).strip()
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
def remote():
 p=subprocess.run(['git','ls-remote','origin','refs/heads/main','refs/heads/'+BRANCH],cwd=R,env=env,capture_output=True,text=True,timeout=30)
 save('remote-latest.json',dict(returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0
 return {l.split()[1]:l.split()[0] for l in p.stdout.splitlines()}
assert json.loads((O/'acceptance.json').read_text())['verdict']=='ACCEPT_SCOPED_SOURCE_MODEL'
account('prepublication')
with open(ROOT/'scratch/usage-watch/shared-integration.lock','a+') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);save('integration-lock.json',dict(acquired=True,pid=os.getpid(),at=time.time()))
 refs=remote();assert refs['refs/heads/main']==BASE,refs
 assert git('rev-parse','HEAD')==C;git('merge-base','--is-ancestor',BASE,C)
 E=R/('docs/re-notes/'+NAME.replace('-oct25','-20261025'));E.mkdir(parents=True,exist_ok=False)
 names=['setup.py','guard.py','account.py','verify.py','independent.cjs','integrate.py','acceptance.json','configuration.json','checkout.json','standing-inputs.json','resource-precheckout.json','resource-preintegration.json','resource-prepublication.json','integration-lock.json','remote-latest.json']
 names+=['baseline/pin-repro.cjs','baseline/pin-repro-results.json','repair/pin-repro.cjs','repair/pin-repro-results.json']
 for n in ['snapshot','independent','repair-repro','baseline-repro','reject-repeat-read']:names += [n+'.json',n+'.log']
 for n in names:
  p=E/n;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(O/n,p)
 manifest=[dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(E.rglob('*')) if p.is_file()]
 (E/'manifest.json').write_text(json.dumps(dict(candidate=C,evidence=manifest),indent=2)+'\n')
 report=E.with_suffix('.md')
 report.write_text('''Accepted unchanged repair `1a87b46728222df4df0b1fee33f83e88776735a9` after independent scoped source/model review. Candidate tree `d5d61c946b9ad76920bf330a718493ca2356cbf8`. The sole production diff captures each canonical source property once into a primitive string, validates that string, and composes/emits the same captured value. No later path reads the supplied source object. Inherited properties and proxies follow that path; disabled mode returns input identity after reading only enabled.

The unchanged published reproducer SHA-256 is `83376305f77386948a2f9bcc22f2df6dbbb111db1ef7473e39a6c7f1e22c1ac5`. Independently rerun: original4542e115 exit1/defect true/three reads; repair exit0/defect false/one read. Six snapshot regression groups and eight additional independent groups pass. Additional groups cover every inherited accessor, proxy traps, invalid first values, original throwing exceptions without retry, later getter mutations, non-string coercion rejection and disabled inertness. A two-read mutation actually fails the new oracle; implementation remains unchanged.

Exact original thirteen supplied groups, nine independent semantic groups and four actually rejecting output controls are reused by committed blob and receipt hashes in acceptance.json. All twelve consumed source files are independently hash/length checked. Stable output equals the original reviewed transform and all four published fragment hashes. Existing decoder CALL EDI/H119/reg7 and RET/H41/op0 semantics, pre-successor insertion, native CRT tail/frame derivation, invocation/thread/register/result linkage, conservative direct spans, one-shot cap, mode rejection and private write/call closure are unaffected. Prior accepted select result0/attempt7/six parks evidence is reused. No packaging reaudit or prior47-group rerun.

This is source/model acceptance. Numerical CRT base is a fixture, never loader proof. Native _errno is distinct from select result, WSAGetLastError and emulator errno. Native errno/caller, gameplay, fdsets/timeval, native overhead and equivalence remain UNKNOWN. Canonical compilation, compiled-native qualification and separately authorized original capture with a loader-proven CRT base remain required. No build, module instantiation, native/guest/box, acquisition, deployment or worker operations.

Integration uses the shared integration lock, reconciles actual remote main, and fast-forwards main/task atomically without force. No relevant input changed at integration; no checks invalidated. Publication and actual remote commit/tree are recorded in task ops/publication.json. Evidence manifest binds all committed review artifacts. Guards: Node heap256MiB, CPU/wall60s, output131072 bytes, file24MiB, narrow capture2MiB, TERM/KILL/reap5s. Full task/log/SQLite/publication growth and8MiB reserve stay within64MiB. Initial owned setup dispatch-key typo corrected before checkout; no denial or candidate repair. Root tracked/index/refs and donor are read-only; board append-only. No box assigned; bx_g84h8h98 coordinator-reported stopped/unqueried, hostbx_69aem736 untouched, lifecycle coordinator-owned. Final ops/result.json is written last after cleanup and remote/evidence verification.
''')
 paths=[str(p.relative_to(R)) for p in E.rglob('*') if p.is_file()]+[str(report.relative_to(R))]
 with (R/'.git/info/sparse-checkout').open('a') as f:f.write('\n'+'\n'.join('/'+p for p in paths)+'\n')
 git('add','--',*paths);git('diff','--cached','--check');assert sorted(git('diff','--cached','--name-only').splitlines())==sorted(paths)
 tree=git('write-tree');git('commit','-m','Accept unchanged Maelstrom source snapshot repair with independent controls')
 commit=git('rev-parse','HEAD');assert git('rev-parse','HEAD^')==C and git('rev-parse','HEAD^{tree}')==tree
 subprocess.run(['python3',str(O/'verify.py')],cwd=R,check=True,timeout=60)
 assert not git('status','--porcelain')
 blobs=[]
 dispatch=json.loads((ROOT/'scratch/usage-watch/maelstrom-native-errno-snapshot-independent-closeout-oct25-dispatch.json').read_text())
 for p in paths+[x['path'] for x in dispatch['verifiedFiles']]:
  b=subprocess.check_output(['git','show',commit+':'+p],cwd=R);expected=(R/p).read_bytes() if p in paths else subprocess.check_output(['git','show',C+':'+p],cwd=R);assert b==expected
  blobs.append(dict(path=p,sha256=hashlib.sha256(b).hexdigest(),bytes=len(b)))
 save('committed-evidence.json',dict(commit=commit,tree=tree,blobs=blobs,candidateUnchanged=True))
 account('before-push');assert remote()['refs/heads/main']==BASE
 p=subprocess.run(['git','push','--atomic','origin','HEAD:refs/heads/'+BRANCH,'HEAD:refs/heads/main'],cwd=R,env=env,capture_output=True,text=True,timeout=60)
 save('push-command.json',dict(returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0
 refs=remote();assert refs['refs/heads/main']==commit and refs['refs/heads/'+BRANCH]==commit
 save('publication.json',dict(commit=commit,tree=tree,candidate=C,branch=BRANCH,verifiedRemote=refs,atomic=True,fastForwardOnly=True,committedBlobsVerified=len(blobs),evidenceManifestSHA256=hashlib.sha256((E/'manifest.json').read_bytes()).hexdigest(),report=str(report.relative_to(R))))
save('integration-lock-release.json',dict(released=True,at=time.time()))
print((O/'publication.json').read_text())
