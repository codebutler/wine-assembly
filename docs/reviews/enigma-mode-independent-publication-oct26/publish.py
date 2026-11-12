from common import *
import sys
def publish():
 admission('prepublication')
 m=json.loads((H/'merge.json').read_text());validation=json.loads((H/'merged-validation.json').read_text())
 assert validation['acceptance']=='ACCEPT'
 assert git('rev-parse','HEAD')[1].decode().strip()==MAIN
 assert git('rev-parse','MERGE_HEAD')[1].decode().strip()==V
 assert not git('ls-files','-u')[1]
 # Add this exact publication/recovery recipe to the evidence before commit.
 out=R/E;shutil.copyfile(H/'publish.py',out/'publish.py')
 manifest=json.loads((out/'evidence-manifest.json').read_text())
 manifest[E+'/publish.py']=dict(bytes=(out/'publish.py').stat().st_size,sha256=sha(out/'publish.py'))
 (out/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 git('add','--',E)
 finaltree=git('write-tree')[1].decode().strip()
 delta=git('diff','--name-only',m['testedTree'],finaltree)[1].decode().splitlines()
 assert all(p.startswith(E+'/') for p in delta)
 assert not git('diff','--name-only')[1]
 git('diff','--cached','--check')
 remote=git('ls-remote','origin','refs/heads/main','refs/heads/'+BRANCH)[1].decode()
 refs={line.split()[1]:line.split()[0] for line in remote.splitlines()}
 assert refs['refs/heads/main']==MAIN
 assert 'refs/heads/'+BRANCH not in refs,'unexpected pre-existing task branch'
 git('commit','-qm','Accept Enigma staging source permissions and integrate bounded repair')
 commit=git('rev-parse','HEAD')[1].decode().strip()
 assert git('rev-parse','HEAD^{tree}')[1].decode().strip()==finaltree
 parents=git('show','-s','--format=%P','HEAD')[1].decode().strip().split()
 assert parents==[MAIN,V]
 for p,v in manifest.items():assert blobhash(R,commit,p)==(v['sha256'],v['bytes'])
 inherited=json.loads((D/'docs/reviews/enigma-staging-mode-preservation-repair-oct26/evidence-manifest.json').read_text())
 for p,v in inherited.items():
  assert git('rev-parse',commit+':'+p)[1]==git('rev-parse',V+':'+p)[1]
 newobjects=int(git('rev-list','--disk-usage','--objects',commit,'^'+MAIN,'^'+V)[1].decode().strip())
 assert newobjects<4194304
 save('final-tree.json',dict(candidate=V,mainBefore=MAIN,commit=commit,parents=parents,testedTree=m['testedTree'],finalTree=finaltree,docsOnlyAfterTests=True,docsOnlyDelta=delta,manifest=str(R/E/'evidence-manifest.json'),ownPayloadsVerified=len(manifest),inheritedRepairPayloadsIdentityPreserved=len(inherited),unrelatedMainBytesModesPreserved=True,newObjectsAllocated=newobjects,transportPackAllowance=16777216,noGameplayClaim=True))
 save('publication-checkpoint.json',dict(commit=commit,tree=finaltree,phase='COMMITTED_UNPUSHED',remaining=['task-push','main-FF-push','exact-remote-verify']))
 admission('pretaskpush')
 git('push','origin','HEAD:refs/heads/'+BRANCH)
 task=git('ls-remote','origin','refs/heads/'+BRANCH)[1].decode().strip()
 assert task==commit+'\trefs/heads/'+BRANCH
 save('publication-checkpoint.json',dict(commit=commit,tree=finaltree,phase='TASK_PUSH_EXACT_REMOTE_VERIFIED',remote=task,remaining=['main-FF-push','exact-remote-verify']))
 # Main moves only after branch backup succeeds and fresh main is reconciled.
 fresh=git('ls-remote','origin','refs/heads/main')[1].decode().strip()
 assert fresh==MAIN+'\trefs/heads/main','remote main changed; stop main publication'
 assert git('merge-base','--is-ancestor',MAIN,commit)[0]==0
 admission('premainpush')
 git('push','origin','HEAD:refs/heads/main')
 remote=git('ls-remote','origin','refs/heads/main','refs/heads/'+BRANCH)[1].decode().strip()
 refs={line.split()[1]:line.split()[0] for line in remote.splitlines()}
 assert refs=={'refs/heads/main':commit,'refs/heads/'+BRANCH:commit}
 assert not git('status','--porcelain')[1]
 result=dict(status='ACCEPTED_MERGED_PUBLISHED',commit=commit,branch=BRANCH,remote=refs,trustedSSH=SSH,verified=True,ordinaryFastForwardMain=True,mainBefore=MAIN,candidate=V,testedTree=m['testedTree'],finalTree=finaltree,docsOnlyAfterTests=True,ownManifestPayloadsVerified=len(manifest),inheritedRepairPayloadsPreserved=len(inherited),newObjectsAllocated=newobjects,clean=True,time=time.time())
 save('publication.json',result)
 cp=json.loads((H/'checkpoint.json').read_text());cp['completed'].append(result);cp['remaining']=[];cp['blockers']=[];cp['status']='COMPLETE';save('checkpoint.json',cp)
 print(json.dumps(result))
try:publish()
except BaseException as e:
 save('publication-failure.json',dict(type=type(e).__name__,error=str(e),time=time.time(),noRetry=True))
 raise
