from pathlib import Path
exec((Path(__file__).parent/'publish.py').read_text().split('\ntry:\n',1)[0])
launch=json.loads((H/'launch.json').read_text());SESSION=next(Path('/home/user/.codex/sessions/2026/10/26').glob('*'+launch['session']+'.jsonl'))
try:
 assert git('rev-parse','HEAD')==C
 refs=remote();assert refs=={'refs/heads/main':M,'refs/heads/'+B:C},refs
 admission('predocumentation')
 doc=R/E;doc.mkdir(parents=True,exist_ok=True)
 names=['launch.json','configuration.json','reuse.json','inputs.json','remote-initial.json','remote-accepted-backup.json','admission-precheckout.json','admission-pretaskpush.json','admission-predocumentation.json','sqlite-baseline.json','sqlite-highwater.json','incident-precheckout-cwd.json','publish.py','finish.py']
 for n in names:(doc/n).write_bytes((H/n).read_bytes())
 (doc/'README.md').write_text('''# Retained Enigma acceptance publication, 2026-10-26

Accepted tested merge commit: `3dd9dda1717b9cd6087a5050224134e8ba9a92a3`.
Tested tree: `3cf4e313888bfc697d3e9468be3dda13cdc54349`.
Accepted final tree: `6b4c08c1c132f621eadfdc1f2253a43cc1fcc85e`.
Post-test changes are confined to `docs/reviews/enigma-mode-independent-publication-oct26`.

The coordinator verified all 65 committed manifest payloads; this task reuses that exact-commit receipt once. The reusable acceptance manifest is `../enigma-mode-independent-publication-oct26/evidence-manifest.json`; its identity and exact helper/test identities are bound in `reuse.json`. Completed acceptance and merged validation were not repeated. The original readonly-write PermissionError remains a failure, with no identity-group PASS claim. No gameplay claim.

The first task push under DATA256MiB failed and was not retried there; original evidence remains in `/tmp/enigma-mode-independent-publication-oct26/ops/{result.json,publication-failure.json,push-resource-failure.stderr}`. This separately admitted DATA512MiB serial Git task preserved dedicated SSH identity, strict trusted known hosts and normal protocol. It used pack.windowMemory=16m, pack.threads=1, pack.window=0. `remote-accepted-backup.json` proves the accepted merge is remotely backed up on `refs/heads/task/enigma-accepted-retained-publication-oct26` before this documentation commit. Main was still `9b98bf52af912382d6526df90f88c73936387fc9`. The subsequent docs-only commit and ordinary FF main publication are recorded in the sibling ops result and append-only repository messageboard, avoiding a self-referential receipt.

`configuration.json` reuses and validates the unchanged canonical parser receipt, complete filename enumeration including comma-bearing names, supported tree-mount argv and trusted SSH configuration before checkout. No mount or guest command was executed. A local precheckout remote-read cwd bookkeeping error is retained in `incident-precheckout-cwd.json`; no access denial or push was involved.

The 64MiB incremental accounting includes sparse checkout/Git/temp/evidence, launcher/session, positive WAL growth once, future session/database allowance once, future Git/evidence allowance once and 8MiB reserve. Readonly donor object footprints and installed tool identities are separate standing inputs in `inputs.json`. Publication admission reserves 512MiB Git DATA + 512MiB client + 16MiB helper, leaving at least 805306368 bytes; projected disk growth 58720256 must leave 2982150144 bytes. File limit 24MiB, capture 2MiB, output 128KiB, excerpts 8192 bytes; one thread, no compilation or full-history fetch.

Remaining qualification gates: real transport and target-filesystem allocation, preservation of modes and immutable aliases, full destination rehash, guest frame/PNG acceptance and gameplay. Git publication does not qualify those runtime gates. No workers, runtime, Boat, SSH runtime, services, deployment or test boxes were used; box ID/state/expiry are N/A, lifecycle remains coordinator-owned, Claude idle. Root and donor stayed readonly except append-only messageboard updates and tail verification.
''')
 payloads={str(p.relative_to(R)):dict(sha256=sha(p),bytes=p.stat().st_size) for p in sorted(doc.iterdir())}
 (doc/'evidence-manifest.json').write_text(json.dumps(payloads,indent=2)+'\n')
 git('add','--',E)
 changed=git('diff','--cached','--name-only').splitlines();assert changed and all(p.startswith(E+'/') for p in changed)
 assert git('diff','--name-only')==''
 save('documentation-review.json',dict(paths=changed,onlyPublicationDocumentation=True,acceptanceRerun=False,unrelatedBytesModesPreserved=True))
 admission('precommit')
 git('commit','-m','docs(enigma): retain accepted publication receipts')
 final=git('rev-parse','HEAD');tree=git('rev-parse','HEAD^{tree}')
 assert git('rev-parse','HEAD^')==C
 assert all(p.startswith(E+'/') for p in git('diff','--name-only',C,final).splitlines())
 assert git('status','--porcelain')==''
 checkpoint('PUBLICATION_DOCUMENTATION_COMMITTED',commit=final,tree=tree,remoteAcceptedBackup=True)
 admission('predocpush');git('push','origin','HEAD:refs/heads/'+B)
 refs=remote();assert refs['refs/heads/'+B]==final
 save('remote-documentation-backup.json',refs);checkpoint('PUBLICATION_DOCUMENTATION_REMOTE_VERIFIED',commit=final,remote=refs)
 assert refs['refs/heads/main']==M,'main changed during publication: stop for affected integration reconciliation'
 git('merge-base','--is-ancestor',M,final)
 admission('premainpush');git('push','origin','HEAD:refs/heads/main')
 refs=remote();assert refs['refs/heads/main']==final and refs['refs/heads/'+B]==final
 save('remote-final.json',refs)
 resources=admission('final')
 result=dict(status='PUBLISHED_VERIFIED',acceptedCommit=C,publicationCommit=final,remote=refs,branch=B,testedTree=T,acceptedFinalTree=F,publishedTree=tree,testedToAccepted='only docs/reviews/enigma-mode-independent-publication-oct26',acceptedToPublished='only '+E,acceptance='REUSED_ACCEPT',mergedValidation='REUSED_PASS_EXACT_SOURCE',manifest=str(manifest) if 'manifest' in globals() else str(D/'docs/reviews/enigma-mode-independent-publication-oct26/evidence-manifest.json'),publicationManifest=str(doc/'evidence-manifest.json'),publicationPayloads=len(payloads),resources=resources,noGameplayClaim=True,noRepeatedAcceptance=True,noWorkers=True,noRuntime=True,box=dict(id=None,state='N/A: no box assigned or accessed',expiry=None,shutdownOwner='coordinator'),remainingGates=json.loads((H/'reuse.json').read_text())['remainingGates'])
 save('result.json',result);checkpoint('PUBLISHED_VERIFIED',commit=final,remote=refs)
 print(json.dumps(result),flush=True)
except Exception as e:
 save('finish-failure.json',dict(error=str(e),time=time.time(),noRetry=True));print(json.dumps(dict(status='STOP',error=str(e))),flush=True);sys.exit(1)
