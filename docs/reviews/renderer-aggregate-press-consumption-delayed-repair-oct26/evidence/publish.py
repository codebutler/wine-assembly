from tests import *
DOC=REPO/'docs/reviews/renderer-aggregate-press-consumption-delayed-repair-oct26'
def documents():
 DOC.mkdir(parents=True,exist_ok=True); evidence=DOC/'evidence'; evidence.mkdir(exist_ok=True)
 (OPS/'incidents.txt').write_text('Baseline unchanged reproducer: three failures retained. New regression rejects baseline. Original physical fixture explicitly required duplicate aggregate delivery; independent fixture required duplicate delivery and modifier-repeat aggregate bits. Original files/logs preserved. Updated only those expectations to enforce once-per-physical-press semantics; independent owners/high-bit/query/side assertions retained. First intermediate independent repeat-oracle mismatch retained before its precise correction. No access/resource denial occurred in this task. Prior provider-capacity attempt did not implement; not retried here. No runtime boxes assigned or accessed; lifecycle owner remains coordinator.\n')
 (DOC/'README.md').write_text('''# Aggregate async press consumption repair, 2026-10-26

Pinned parent: `c3d394149406189cf1c5dbbc434491f0130666c9`.
Branch: `task/renderer-aggregate-press-consumption-delayed-repair-oct26`.

`handleKeyDown` publishes a press before delivery. Its queued events now carry
`asyncPressPublished`, including F10's separate system-key path, so `takeInput`
advances the held-key/message snapshot without recreating a consumed press.
Raw legacy queue-only events still publish their low bit at delivery. This
event-local provenance survives rapid release/repress without a growing history
or accidental association with the newest physical press. Modifier sides use
physical ownership to distinguish a new side press from typematic. Ordinary
keys keep their existing per-keydown repeat latching. Keyboard messages and
their scan/extended/context/previous/transition bits are preserved.

The byte-unchanged supplied reproducer failed all three modifier cases on the
parent and passes all three on the repair. The new regression rejects that
parent and passes 33 cases. Affected fixtures pass 37 physical-modifier,
28 side-polling, 25 independent polling and 29 independent modifier cases.
The unchanged legacy keyboard lParam fixture passes. Each test child ran
sequentially with `node --max-old-space-size=16 --test FIXTURE`.

Two older fixtures explicitly encoded duplicate aggregate latching. Their
original bytes and failures are preserved. We tightened those expectations:
delivery and held modifier repeats must not regenerate a consumed bit; owner,
side-state, query-order, release/repress and message assertions remain. The
independent fixture's intermediate repeat-oracle mismatch is also retained.

See `evidence-manifest.json` and evidence/checkpoint.json for tested source and
fixture hashes, commands, results and original failure evidence. Unchanged
dependency/closure receipts are referenced with identity; no unrelated full
suite or heavy build was run. Resource receipts include task checkout/Git,
launcher/session, positive shared WAL once, finite future growth, remote staging
and 8MiB reserve within 64MiB. Installed tools and flat read-only donor objects
are accounted separately. Git uses a finite 256MiB data allowance inside the
512MiB client allocation; tests use a 16MiB heap. Trusted Git SSH configuration
is unchanged. No mounts or guest execution were requested, so the conditional
mount parser gate has no argv to validate.

Root/donors remained read-only except append-only root messageboard updates.
No main publication, runtime/service/Boat/build/deployment/SSH configuration
changes, workers, or gameplay claims. Box ID/state/expiry: not assigned;
coordinator retains lifecycle ownership. Remaining acceptance: coordinator
review and integration under main ownership; browser/gameplay unqualified.

Source commit and verified remote publication are recorded in the subsequent
publication receipt and final task ops/result.json. No task replacement.
''')
 for p in OPS.iterdir():
  if p.is_file() and p.suffix in ['.json','.log','.cjs','.py','.txt'] and p.name not in ['publication.json','result.json','final.txt']:
   shutil.copyfile(p,evidence/p.name)
 manifest=[{'path':str(p.relative_to(DOC)),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(evidence.iterdir())]
 (DOC/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
def publish():
 measure('prepublication');documents()
 git('diff','--check')
 paths=['lib/renderer-input.js','test/renderer-physical-modifiers.test.cjs','test/renderer-side-polling-independent-oct26.test.cjs','test/renderer-aggregate-press-consumption.test.cjs',str(DOC.relative_to(REPO))]
 git('add','--',*paths)
 git('commit','-m','Fix aggregate async press consumption across queued key delivery')
 commit=git('rev-parse','HEAD').decode().strip()
 write('source-commit.json',{'commit':commit,'branch':BRANCH,'source':sha((REPO/'lib/renderer-input.js').read_bytes())})
 measure('prepush')
 out=git('push','origin','HEAD:refs/heads/'+BRANCH)
 remote=git('ls-remote','--refs','origin','refs/heads/'+BRANCH).decode().strip()
 assert remote==commit+'\trefs/heads/'+BRANCH
 write('publication.json',{'sourceCommit':commit,'branch':BRANCH,'remote':remote,'verified':True,'trustedSsh':SSH})
 print('PUSH VERIFIED',commit,BRANCH)
if __name__=='__main__':publish()
