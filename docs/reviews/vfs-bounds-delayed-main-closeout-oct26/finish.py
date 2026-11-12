from integrate import *
def prepare():
 tree=json.loads((OPS/'tested-tree.json').read_text())['testedTree']
 helper='/home/user/wine-assembly/scratch/usage-watch/stream-root-ref-digest.py'
 final=json.loads(run(['python3',helper]));initial=json.loads(P.Path('/home/user/wine-assembly/scratch/usage-watch/vfs-bounds-delayed-main-closeout-oct26/root-ref-digest.json').read_text());assert final['sha256']==initial['sha256']
 write('root-ref-comparison.json',dict(initial=initial,final=final,unchanged=True))
 write('incidents.json',[dict(kind='local identity comparison correction',detail='Initial guard compared resolved Node path with historical symlink spelling. Both resolve to the same installed inode; corrected comparison uses canonical paths. No test executed and no source changed.'),dict(kind='post-checkout forecast',detail='Remaining checkout/Git/evidence growth reduced from 12MiB to 4MiB after measuring completed sparse checkout. Future session/launcher/WAL 12MiB once and reserve 8MiB remain.')])
 measure('precommit')
 d=REPO/DOC;d.mkdir(parents=True,exist_ok=True)
 names=['tested-tree.json','tools.json','configuration.json','readonly-objects.json','remote-main-initial.json','accepted-payload-verification.json','closure-reuse.json','preservation.json','checkpoint.json','root-ref-comparison.json','incidents.json','resources-precheckout.json','resources-prevalidation.json','resources-precommit.json','integrate.py','finish.py']
 for name in names:shutil.copyfile(OPS/name,d/name)
 (d/'REVIEW.md').write_text(f'''# Accepted VFS restore bounds on renderer main

Base `{BASE}` retains the accepted renderer change. Apply only accepted `{ACCEPT}` relative to `{PARENT}`. The production change adds predecode bounds to VFS restore; the exact two accepted fixtures and acceptance documents accompany it. Abort repair 980edba, app-files and browser ownership repairs are excluded.

Validated merged tree `{tree}` has the identical 13-file dependency/source/test closure. Rehashed all 23 accepted manifest payloads. Reuse supplied 17 PASS, independent 14 PASS (550 bounded calls), expected baseline 9 PASS/8 FAIL, Darkstone 64MiB PASS and both existing scoped compatibility PASS receipts. No acceptance group was repeated. Node is the same installed canonical executable; path, current hash, version and inode metadata predating the acceptance runs are recorded. Historical receipts lacked a Node executable hash; no historical hash is invented.

The preservation proof compares the complete changed-path set and exact Git entries with the accepted patch; every other tracked byte and mode, including renderer c3d39414, remains as on base. Finalization adds only this review directory after the validated tree. Exact final-tree/commit and trusted remote verification are retained in sibling ops/result.json and final-tree.json to avoid self-referential hashes.

Resource receipts charge checkout/Git/evidence, launcher/session and all current positive shared WAL once, future 12MiB once, remaining Git/evidence growth and an 8MiB reserve. Readonly flat donor objects and installed tools are standing inputs. No fetch, runtime, guest, build, mount, service, deployment or monitoring changes. No workers launched. No test box assigned; lifecycle remains coordinator-owned.

Remaining gates: actual browser IndexedDB durability across reload/restart/storage failure, and application/gameplay acceptance. The separate abort repair remains excluded by assignment even though later accepted elsewhere. Publication is an ordinary task-branch push followed by normal main fast-forward; exact remote refs must match, without force.
''')
 manifest={p.name:dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(d.iterdir()) if p.is_file()}
 (d/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 git('add','--sparse','--',DOC);final=git('write-tree').decode().strip();changed=git('diff','--name-only',tree,final).decode().splitlines();assert changed and all(p.startswith(DOC+'/') for p in changed)
 write('final-tree.json',dict(testedTree=tree,finalTree=final,docsOnly=True,changedAfterValidation=changed))
 # Verify all new review whitespace; retain accepted pre-existing evidence verbatim.
 git('diff','--cached','--check','--',DOC)
 git('commit','-q','-m','Bound VFS restore before decoding; preserve renderer main and accepted evidence')
 commit=git('rev-parse','HEAD').decode().strip();assert git('rev-parse','HEAD^').decode().strip()==BASE;assert git('rev-parse','HEAD^{tree}').decode().strip()==final
 for p,e in manifest.items():
  data=git('show',commit+':'+DOC+'/'+p);assert sha(data)==e['sha256'] and len(data)==e['bytes']
 write('commit.json',dict(commit=commit,branch=BRANCH,tree=final,ownManifestPayloads=len(manifest),clean=not git('status','--porcelain').strip()))
 assert not git('status','--porcelain').strip()
 print('reviewed commit',commit,'docs-only final',final)
def publish():
 measure('prepublication');c=json.loads((OPS/'commit.json').read_text());commit=c['commit']
 # No force option: ordinary main ref update is independently protected by Git's FF check.
 branchlog=git('push','origin','HEAD:refs/heads/'+BRANCH);(OPS/'task-push.log').write_bytes(branchlog)
 observed=git('ls-remote','--refs','origin','refs/heads/'+BRANCH).decode().strip();assert observed==commit+'\trefs/heads/'+BRANCH
 write('task-publication.json',dict(commit=commit,exactRemote=observed,verified=True,ssh=SSH))
 mainlog=git('push','origin','HEAD:refs/heads/main');(OPS/'main-push.log').write_bytes(mainlog)
 exact=git('ls-remote','--refs','origin','refs/heads/main','refs/heads/'+BRANCH).decode();assert set(exact.splitlines())=={commit+'\trefs/heads/main',commit+'\trefs/heads/'+BRANCH}
 write('publication.json',dict(commit=commit,ssh=SSH,exactRemote=exact,bothVerified=True,force=False))
 measure('final')
 proof=json.loads((OPS/'final-tree.json').read_text())
 result=dict(status='COMPLETE',commit=commit,branch=BRANCH,base=BASE,accepted=ACCEPT,testedTree=proof['testedTree'],finalTree=proof['finalTree'],docsOnlyAfterValidation=True,publication=json.loads((OPS/'publication.json').read_text()),preservation=str(OPS/'preservation.json'),acceptedPayloadsRehashed=23,ownManifestPayloads=c['ownManifestPayloads'],closure=str(OPS/'closure-reuse.json'),newAcceptanceExecutions=0,reused=['supplied17PASS','independent14PASS/550calls','expected baseline9PASS8FAIL','Darkstone64MiBPASS','both scoped compatibility PASS'],manifest=str(REPO/DOC/'evidence-manifest.json'),resources=str(OPS/'resources-final.json'),remainingGates=['actual browser IndexedDB durability/reload/restart/storage failure','application/gameplay'],box=dict(id=None,state='not assigned',expiry=None,lifecycleOwner='coordinator'),rootRefsUnchanged=True,donorsReadonly=True,workers=0,ownership='RELEASED on completion messageboard append',at=time.time())
 (OPS/'final.txt').write_text(f'COMPLETE: {commit}\nPublished {BRANCH} and normal FF main; exact trusted remote refs verified.\nTested tree {proof["testedTree"]}; final tree {proof["finalTree"]}, docs-only relationship proved.\nAll unrelated production bytes/modes including renderer preserved. 23 accepted payloads and {c["ownManifestPayloads"]} own payloads verified; unchanged closure acceptance reused, no suite reruns. Browser durability and gameplay gates remain. No boxes/runtime/workers. Main ownership released; stop.\n')
 write('result.json',result)
 print('COMPLETE',commit)
if __name__=='__main__':globals()[sys.argv[1]]()
