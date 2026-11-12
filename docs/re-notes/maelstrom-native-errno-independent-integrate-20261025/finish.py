import pathlib,json,subprocess,os,hashlib,signal,time,shutil
from account import account
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';E=R/'docs/re-notes/maelstrom-native-errno-independent-integrate-20261025'
PUB=json.loads((O/'publication.json').read_text());C=PUB['candidate'];BR=PUB['branch'];BASE=PUB['remote']['refs/heads/main']
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=dict(os.environ,GIT_SSH_COMMAND=SSH)
def git(*a,cwd=R):return subprocess.check_output(['git',*a],cwd=cwd,env=env,text=True,timeout=60).strip()
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
before=json.loads((O/'readonly-state.json').read_text())
for p,v in before.items():
 actual={k:git(*a,cwd=p) for k,a in {'HEAD':['rev-parse','HEAD'],'refs':['show-ref'],'index':['hash-object','.git/index']}.items()};assert actual==v
save('readonly-final.json',dict(passChecks=True,unchanged=before))
pid=json.loads((O/'watcher.json').read_text())['pid'];start=time.monotonic()
try:os.killpg(pid,signal.SIGTERM)
except ProcessLookupError:pass
def alive():
 try:return pathlib.Path('/proc/'+str(pid)+'/stat').read_text().split()[2] not in ['Z','X']
 except FileNotFoundError:return False
while alive() and time.monotonic()-start<2:time.sleep(.025)
if alive():
 os.killpg(pid,signal.SIGKILL)
 while alive() and time.monotonic()-start<5:time.sleep(.025)
assert not alive()
remaining=subprocess.check_output(['ps','-eo','pid,ppid,pgid,args'],text=True)
own=[x for x in remaining.splitlines() if 'tail -n 0 -f /home/user/wine-assembly/messageboard.txt' in x and x.split()[0]==str(pid)];assert not own
cleanup=dict(watcherPid=pid,watcherGone=True,elapsed=time.monotonic()-start,guardedChildrenReaped=True,noOwnRuntimeGroups=True,mainIntegrationLockAcquired=False,boxesAssigned=[],boxOperations=0,builds=0,instantiations=0,nativeExecutions=0,originalGuests=0,workers=0,rootDonorReadonlyVerified=True,boxStates={'bx_g84h8h98':'coordinator-reported stopped/unqueried','hostbx_69aem736':'untouched'},shutdownOwner='coordinator')
save('cleanup.json',cleanup)
obj=pathlib.Path('/usr/bin/objdump');save('standing-additional-tool.json',dict(path=str(obj),bytes=obj.stat().st_size,sha256=hashlib.sha256(obj.read_bytes()).hexdigest(),usage='Read-only narrow PE disassembly; not native execution or new tool copy'))
account('before-final-evidence')
# Correct reviewer line reference; preserve the first publication receipt too.
for n in ['publication.json','cleanup.json','readonly-final.json','standing-additional-tool.json','resource-afterpublication.json','resource-before-final-evidence.json','finish.py']:shutil.copyfile(O/n,E/n)
names=[p.name for p in E.iterdir() if p.name!='manifest.json']
(E/'manifest.json').write_text(json.dumps([dict(path=n,bytes=(E/n).stat().st_size,sha256=hashlib.sha256((E/n).read_bytes()).hexdigest()) for n in sorted(names)],indent=2)+'\n')
paths=[str(E.relative_to(R)),str(E.with_suffix('.md').relative_to(R))]
git('add','--',*paths);git('diff','--cached','--check');git('commit','-m','Record errno review publication and cleanup; correct source line reference')
commit=git('rev-parse','HEAD');tree=git('rev-parse','HEAD^{tree}')
changed=git('diff','--name-only',C,'HEAD').splitlines();assert all(x.startswith(str(E.relative_to(R))) or x==str(E.with_suffix('.md').relative_to(R)) for x in changed)
files=[]
for p in git('ls-tree','-r','--name-only','HEAD','--',*paths).splitlines():
 b=subprocess.check_output(['git','show','HEAD:'+p],cwd=R);assert b==(R/p).read_bytes();files.append(dict(path=p,bytes=len(b),sha256=hashlib.sha256(b).hexdigest()))
assert not git('status','--porcelain')
push=subprocess.run(['git','push','origin','HEAD:refs/heads/'+BR],cwd=R,env=env,capture_output=True,text=True,timeout=60);save('push-final.json',dict(returncode=push.returncode,stdout=push.stdout,stderr=push.stderr));assert push.returncode==0
p=subprocess.run(['git','ls-remote','origin','refs/heads/main','refs/heads/'+BR],cwd=R,env=env,capture_output=True,text=True,timeout=30);assert p.returncode==0
refs={l.split()[1]:l.split()[0] for l in p.stdout.splitlines()};assert refs['refs/heads/main']==BASE and refs['refs/heads/'+BR]==commit
publication=dict(verdict='REJECT',commit=commit,branch=BR,remote=refs,reviewTree=tree,testedCandidate=C,testedCandidateTree=PUB['testedCandidateTree'],candidateFilesVerified=32,committedReviewFiles=files,mainMerged=False,force=False)
save('publication-final.json',publication)
resource=account('final')
entry=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())+' maelstrom-native-errno-independent-integrate-oct25 COMPLETE REJECT STOP candidate4542e115 unchanged testedtree256fb0171c103a03f5ae4407f2cda30fce5f336f. Real enabledAPI sourcepin defect sources[p] read3times: authentic plainPASS alteredplainREJECT getter thirdread accepts unpinned CALL119->120 decoder; independent acceptance exit1 actualhash5a19b0ff vs pinnedfec7b241 CLI stableplain notdemonstratedaffected. No repair/mainmerge. Reviewcommit actualremote '+commit+' branch '+BR+' actualremote main'+BASE+';32candidatefiles+'+str(len(files))+'reviewblobs verified.13supplied+9independentgroups CLI PASS 4brokenoutputcontrols actuallyREJECT; no nativeacceptance. Evidence docs/re-notes/maelstrom-native-errno-independent-integrate-20261025.md ops pin-repro-results.json publication-final.json. Resource '+str(resource['projectedPeak'])+'/67108864 fullsessionlauncher positiveSQLite future publication reserve8MiB freeafter'+str(resource['freeAfterProjectedRemaining'])+' MemAvailable'+str(resource['memAvailable'])+' PASS. Watcher'+str(pid)+' gone guardedgroupsreaped no integrationlock. roottracked/index/refs+donor unchanged appendboardonly Claudeidle. Compiler/native/original/boxes/workers/deploy0 nativeerrno/caller/gameplay/overhead UNKNOWN; bx_g84h8h98 coordinator-reportedstopped/unqueried hostbx_69aem736untouched shutdowncoordinator. ops/result.json last then STOP.'
with open('/home/user/wine-assembly/messageboard.txt','a') as f:f.write(entry+'\n')
last=subprocess.check_output(['tail','-n','1','/home/user/wine-assembly/messageboard.txt'],text=True);assert last.rstrip()==entry
result=dict(status='REJECT-published-no-integration',verdict='REJECT',defect=json.loads((O/'pin-repro-results.json').read_text()),publication=publication,commandsAndControls=dict(supplied='supplied.json',independent='independent.json',cli='cli.json',brokenOutputControls='controls.json',failingAcceptance='pin-repro.json'),tests=dict(suppliedGroups=13,independentGroups=9,actuallyRejectingBrokenOutputs=4,sourcePinAcceptance='FAIL-reproducible',compiled=False,native=False,original=False),resource=resource,cleanup=cleanup,runtimeUnknowns=['native errno','native caller','gameplay','completion fdsets/timeval','native overhead/equivalence'],remainingRequirement='Corrected candidate independent acceptance; separately assigned canonical build/compiled-native qualification with loader-proven CRT base, then original capture.',stopping=True)
save('result.json',result) # LAST task artifact written.
print(json.dumps(dict(verdict='REJECT',commit=commit,remote=refs,evidenceFiles=len(files),projectedPeak=resource['projectedPeak'],cleanup=cleanup,result=str(O/'result.json'))))
