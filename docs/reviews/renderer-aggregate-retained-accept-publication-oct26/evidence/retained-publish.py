from retained import *

def main():
 mainrev='ef10196a82eaad6d374617fc4a08f108487d264a'
 merged=json.loads((OPS/'merged-tree.json').read_text());tested=merged['tree']
 assert git('rev-parse','HEAD^{tree}').decode().strip()==tested
 assert not git('status','--porcelain')
 for label in ['retained-unchanged-reproducer','retained-independent-adversarial','merged-focused','merged-independent-adversarial']:
  assert json.loads((OPS/(label+'.json')).read_text())['exitCode']==0
 for name in ['relatch-all','suppress-all']:
  assert json.loads((OPS/('mutation-'+name+'.json')).read_text())['result']=='REJECTED by semantic assertions'
 tools=json.loads((OLD/'standing-tools.json').read_text())
 for row in tools.values():assert sha(P.Path(row['path']).read_bytes())==row['sha256']
 write('standing-tools-reverified.json',tools)
 remote=git('ls-remote','--refs','origin','refs/heads/main','refs/heads/'+BRANCH).decode().strip()
 assert remote==mainrev+'\trefs/heads/main'
 write('remote-prepublication.json',{'exactRefs':remote,'main':mainrev,'trustedSSH':SSH,'publicationGate':'29 independent passes + two rejecting semantic controls; 59 merged passes; exact source/dependencies; preserved other main bytes/modes'})
 measure('publication-admission',True)
 review=REPO/'docs/reviews'/NAME;ev=review/'evidence';ev.mkdir(parents=True,exist_ok=True)
 selected=['launch.json','configuration.json','pinned-reuse.json','resources-fresh-admission.json','resources-acceptance-complete.json','resources-premerge.json','resources-publication-admission.json','remote-before-merge.json','remote-prepublication.json','merged-tree.json','merged-preservation.json','checkpoint.json','receipt-parser-correction.json','whitespace-review.json','standing-tools-reverified.json','main-readonly-objects.json']
 selected += [label+suffix for label in ['retained-unchanged-reproducer','retained-independent-adversarial','reject-relatch-all','reject-suppress-all','merged-focused','merged-independent-adversarial'] for suffix in ['.json','.log']]
 selected += ['mutation-relatch-all.json','mutation-suppress-all.json']
 for name in selected:(ev/name).write_bytes((OPS/name).read_bytes())
 for name in ['aggregate-latch-repro.cjs','independent-adversarial.cjs','retained.py','retained-publish.py']:(ev/name).write_bytes((OLD/name).read_bytes())
 report=f'''# Renderer aggregate press consumption — ACCEPT

Physical keydown publishes the GetAsyncKeyState press bit once. Later takeInput delivery preserves a consumed aggregate bit, while raw queue-only keydowns still publish it. Ordinary repeat behavior and independent modifier-side polling remain intact.

Independent acceptance: unchanged three-case reproducer 3/3 PASS; retained independent adversarial fixture 26/26 PASS. The 26 cases cover Shift/Control/Alt left/right read order, old delivery versus new press, polling before/between/after delivery, filtered delivery, typematic, rapid release/repress, synchronous DirectInput and delivery callbacks, numeric focus release, worker/main ordinary keys and raw legacy queue provenance. Two isolated mutants were rejected by real assertions: unconditional re-latching and blanket suppression. Production source was never mutated during acceptance.

Candidate {REV}; source commit 0ebb852e339fe755f3c18a19f32f1dfe4da427b4. The supplied 155 passing cases plus legacy lParam receipt are reused with exact production, fixture and transitive dependency hashes. Their original baseline/intermediate failures and provider-capacity history remain unchanged. The predecessor evidence-only commit {PREV} remains in ancestry. Its original V8 CodeRange startup failure executed zero assertions and remains a startup failure, with testedTree NONE. The coordinator authorized separating Git DATA512MiB from Node; new Node runs used heap16MiB, CPU60/wall65, file24MiB, unlimited inherited DATA/AS and the required combined physical-memory admission. Git retained DATA512MiB, one pack thread and bounded windows.

Fresh remote main {mainrev} merged cleanly in {merged['commit']}. Tested merged tree **{tested}** passed focused 33/33 and independent 26/26. Renderer SHA256 e7b59c046f63b504a0aba256b644a42c01f820fde9a0f9e5fee3961dae397f78 and both require dependencies are byte-identical to accepted candidate inputs. Existing 155+legacy receipts remain applicable; no blanket rerun was performed. The complete raw diff confirms only renderer-input.js and three related test files change outside the renderer review directories. All other current-main production bytes and modes, including Enigma/helper/VFS/browser/ownership work, are preserved. The final evidence commit differs from this tested merged tree only in this review directory; ops/result.json records the exact final commit/tree and verified remote refs after publication.

New evidence names preserve the original failure files. A post-test receipt parser initially expected TAP although Node selected spec output; the three passing assertions were retained and not repeated. The parser now recognizes either exact summary format. Main was absent from the older donor-object list; accepted retained Enigma objects were added as flat readonly alternates, without fetching or copying history. Whole-diff whitespace warnings occur in unchanged historical failure logs; production/test diff checks pass. No semantic repair was made in this task.

Resource receipts include all retained repo/ops paths, old and new launcher/session bytes, positive shared WAL once, combined future allowance once, staging allowance and 8MiB reserve inside 64MiB. Installed executables and readonly donor objects are standing inputs. Actual session {SESSION}, PID {PID}, gpt-6.1-sol medium with 200000 total compaction are verified from live argv. The trusted SSH and unchanged empty canonical mount receipt were checked in this same task; this task has no guest mount argv or intended guest files.

Browser, runtime, gameplay, full build and deployment gates remain UNQUALIFIED. No Boat, services, restart, heavy execution, test-box access or other workers were used. No test box was assigned; ID/state/expiry N/A. The independent Enigma box was untouched, and lifecycle ownership remains with the coordinator. Claude stayed idle.
'''
 (review/'README.md').write_text(report)
 manifest=[{'path':str(p.relative_to(review)),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(review.rglob('*')) if p.is_file() and p.name!='evidence-manifest.json']
 (review/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 git('add','--','docs/reviews/'+NAME)
 changed=git('diff','--cached','--name-only').decode().splitlines();assert changed and all(p.startswith('docs/reviews/'+NAME+'/') for p in changed)
 # Evidence logs are preserved byte-exact, including any historical formatting.
 git('diff','--cached','--check','--','docs/reviews/'+NAME+'/README.md')
 git('commit','-q','-m','fix: accept renderer aggregate press consumption on current main')
 commit=git('rev-parse','HEAD').decode().strip();tree=git('rev-parse','HEAD^{tree}').decode().strip()
 delta=git('diff','--name-only',merged['commit'],'HEAD').decode().splitlines();assert all(p.startswith('docs/reviews/'+NAME+'/') for p in delta)
 for row in manifest:assert sha(git('show','HEAD:docs/reviews/'+NAME+'/'+row['path']))==row['sha256']
 git('merge-base','--is-ancestor',mainrev,'HEAD')
 write('local-publication.json',{'commit':commit,'branch':BRANCH,'finalTree':tree,'testedTree':tested,'testedCommit':merged['commit'],'docsOnlyFinalDelta':delta,'manifestPayloads':len(manifest),'allCommittedPayloadHashesVerified':True})
 measure('pre-task-push',True)
 taskpush=git('push','--porcelain','origin','HEAD:refs/heads/'+BRANCH).decode()
 aftertask=git('ls-remote','--refs','origin','refs/heads/main','refs/heads/'+BRANCH).decode().strip()
 assert commit+'\trefs/heads/'+BRANCH in aftertask
 assert mainrev+'\trefs/heads/main' in aftertask
 write('task-publication.json',{'push':taskpush,'exactRefs':aftertask,'verifiedTaskCommit':commit,'mainUnchanged':True})
 measure('pre-main-push',True)
 # Ordinary non-force push; the server also enforces the final fast-forward gate.
 mainpush=git('push','--porcelain','origin','HEAD:refs/heads/main').decode()
 final=git('ls-remote','--refs','origin','refs/heads/main','refs/heads/'+BRANCH).decode().strip()
 assert commit+'\trefs/heads/main' in final and commit+'\trefs/heads/'+BRANCH in final
 write('publication.json',{'commit':commit,'branch':BRANCH,'mainBefore':mainrev,'mainPush':mainpush,'remoteRefs':final,'bothExactVerified':True,'ordinaryFastForward':True})
 checkpoint(remaining=[])
 result={'status':'ACCEPT_PUBLISHED','candidate':REV,'sourceCommit':'0ebb852e339fe755f3c18a19f32f1dfe4da427b4','predecessorEvidenceOnly':PREV,'commit':commit,'branch':BRANCH,'main':commit,'testedCommit':merged['commit'],'testedTree':tested,'finalTree':tree,'finalRelationship':'docs-only added review directory after tested merged tree; all production bytes/modes identical','acceptance':{'unchangedReproducer':3,'independentAdversarial':26,'semanticMutantsRejected':2,'reusedDonor':155,'reusedLegacyLparam':'PASS exact inputs'},'mergedValidation':{'focused':33,'independentAdversarial':26},'manifest':str(review/'evidence-manifest.json'),'manifestPayloads':len(manifest),'bothExactRemoteRefs':final,'browserRuntimeGameplayBuildDeployment':'UNQUALIFIED; no execution attempted','box':{'id':None,'state':'not assigned/accessed','expiry':None,'lifecycleOwner':'coordinator'},'session':SESSION,'pid':PID}
 write('result.json',result);measure('final',True)
 print(json.dumps({k:result[k] for k in ['status','commit','branch','testedTree','finalTree','manifestPayloads','bothExactRemoteRefs']}))
if __name__=='__main__':main()
