from common import *
import sys
admission('prevalidation-package')
m=json.loads((H/'merge.json').read_text());inputs=json.loads((H/'inputs.json').read_text())
assert git('write-tree')[1].decode().strip()==m['testedTree']
assert git('rev-parse','HEAD')[1].decode().strip()==MAIN
assert git('rev-parse','MERGE_HEAD')[1].decode().strip()==V
assert not git('diff','--name-only')[1]
sources={p:dict(sha256=sha(R/p),mode=oct((R/p).stat().st_mode & 0o777),gitEntry=git('ls-tree',m['testedTree'],'--',p)[1].decode().strip()) for p in inputs['pins']}
for p,v in sources.items():assert v['sha256']==inputs['pins'][p] and v['sha256']==blobhash(R,V,p)[0]
fixtures={p.name:sha(p) for p in [H/'accept.py',H/'check-644.py',H/'adversarial.py',R/'test/test-enigma-staging-modes.py']}
cp=json.loads((H/'checkpoint.json').read_text())
assert {x['name'] for x in cp['completed'] if isinstance(x,dict)}.issuperset({'modes','check644','old-identity-contract','focused','adversarial-ownership','adversarial-failures','merge'})
for x in cp['completed']:
 if isinstance(x,dict) and 'helperSHA256' in x:
  assert x['helperSHA256']==sources['tools/enigma-bounded-staging.py']['sha256']
save('merged-validation.json',dict(candidate=V,main=MAIN,testedTree=m['testedTree'],sources=sources,fixtures=fixtures,allCandidateSourceDependencyBytesAndModesExact=True,allUnrelatedMainBytesAndModesExact=True,validation='Candidate acceptance reused on exact merged source/dependencies; zero duplicate test runs',acceptance='ACCEPT',oldIdentityGroup='Unchanged expected PermissionError retained, not PASS',remaining=['transport/filesystem allocation and mode/alias preservation','guest frame/PNG qualification','gameplay'],box=dict(id=None,state='N/A: no box assigned or accessed',expiry=None,shutdownOwner='coordinator')))
cp['completed'].append(dict(name='affected-merged-validation',tree=m['testedTree'],receipt='merged-validation.json',result='PASS_EXACT_SOURCE_REUSE'));cp['remaining']=['publication'];cp['acceptance']='ACCEPT';save('checkpoint.json',cp)
out=R/E;out.mkdir(parents=True,exist_ok=True)
report='''# Enigma staging permission repair: independent acceptance and main integration

ACCEPT candidate `34a398198467052f8dc3633c94b08234199eedd6`.
The unchanged affected mode and 0644 reproducers pass. The unchanged historical
identity group still raises PermissionError when writing a nonfont copied from
a 0444 source. Its original oracle and failure are retained; this is not a
fresh identity-group PASS. Preserving that readonly mode is the source contract.
The write-independence control uses a writable source.

The helper preserves regular standing source ordinary bits (0777 mask), and
pinned Git regular modes 0644/0755, independent of umask. It strips special
bits, rejects nonregular nonfont sources, and never applies nonfont chmod to
donors or font aliases. Stable source metadata and exclusive destination-parent
ownership remain required. Ownership, ACLs, timestamps and directory modes are
outside this file contract. Immutable font sharing, duplicate source rehash,
bounded streaming, namespace checks and atomic cleanup retain their semantics.

Five focused tests pass. Additional independent controls pass for 0644, 0600,
0755 and 0444 under 0000/0002/0022/0027/0077 umasks; exact content/modes,
nonfont inode ownership including namespace near misses, readonly font alias
sharing distinct from all donors/nonfonts, and independent writes from writable
sources. Actual r+b opens of readonly outputs reject with PermissionError.
An os.walk/stat oracle independently counts all directory and unique-inode
allocation. Failure controls cover nonfont/font chmod, alias-link errors,
interruption and bad duplicate content pins; each preserves donor signatures
and foreign evidence and removes only its invocation-owned temporary tree.
Each group has its own logs and atomically updated checkpoint.

Reuse is selective: six unchanged helper functions match AST exactly; removing
exactly the reviewed mode query and chmod from stage yields the baseline AST.
The recipe differs only in documentation. Test, manifest, pins, font consumer
and other closure dependencies retain their Git blob identities. Original seven
tests, 2659-source verification, recipe, cleanup and alias/accounting mutant
receipts remain valid for unchanged logic. No full-media staging, repeated
completed audit or repeated source rehash was performed. All 60 repaired
manifest payloads were independently checked against the committed blobs before
checkout. Baseline failures and repaired passes remain inherited unchanged.

Fresh trusted Git SSH ls-remote pinned main
`9b98bf52af912382d6526df90f88c73936387fc9` and the candidate. The merge is
conflict-free, with main first parent and the exact candidate second parent.
Every change from main belongs to the candidate's Enigma helper/tests/evidence;
each changed entry has the exact candidate Git mode and blob. All other main
bytes/modes, including browser, app-files, VFS, renderer and ownership code, are
preserved. Inherited Enigma startup capture documentation travels with candidate
ancestry; it adds no runtime qualification claim. merged-validation.json binds
the tested tree and exact merged source/fixture identities. Tests are reused on
identical merged sources/dependencies rather than run again. The final tree adds
only this review directory after that tested tree; ops/final-tree.json records
the exact final commit/tree and docs-only relationship after publication.

Resource receipts account for owned sparse checkout/index/Git/ops/evidence,
external launcher/session, positive shared DB/WAL growth highwater once, 12 MiB
future session/DB, 16 MiB future Git/evidence/transport-pack allowance and 8 MiB
reserve inside 64 MiB. Donor object stores are flat and readonly; no history
fetch or full checkout. Installed git/Python identities are recorded separately.
RAM admission reserves 512 MiB client + 16 MiB Python with 805306368 bytes left;
disk projects 58720256 bytes growth with 2982150144 left. Tests use DATA=16 MiB,
CPU=60 s, wall=65 s, FSIZE=24 MiB. Git separately uses admitted DATA=256 MiB,
one pack/index thread and disabled index preload; failed prior 16/64 MiB Git
attempts are inherited evidence, never repeated. Commands are logged before
bounded execution, captures limited to 2 MiB and output to 128 KiB. Fixtures
are small; no guest media or new runtime transport exists in this task.

The actual live argv receipt confirms GPT-6.1-Sol medium with 200000 total
auto-compaction. Exact trusted SSH and canonical filename-bearing tree-mount
argv/enumeration receipt are reused unchanged and validated before checkout.
There was no mount or runtime execution. Internal inventory-path mistakes and
readonly recovery of main's missing object are recorded in incident receipts;
no access denial, semantic repair or semantic merge conflict was bypassed.

Publication uses a tested coherent task branch, verified exact trusted remote,
then an ordinary fast-forward push to main with another exact remote check.
No force push. Local ops publication.json/final-tree.json/result.json retain
the final refs and commit without a circular self-embedding evidence commit.
The evidence-manifest hashes all review payloads except itself plus relevant
production/test sources. Existing prior manifests remain byte-exact.

Remaining gates: fresh real transport and target-filesystem allocation,
ordinary mode and owned immutable-alias preservation, full destination rehash,
guest frame/PNG and gameplay. No gameplay, guest startup or PNG acceptance is
claimed. No Boat, runtime, SSH runtime, compile, service, restart, deployment,
worker launch or refill. No test box assigned/accessed: ID/state/expiry N/A;
coordinator retains all lifecycle/shutdown ownership. Claude remains idle.

Reproduce small groups with fresh output names: restore common.py, run-group.py,
acceptance.py, accept.py, check-644.py and adversarial.py as sibling ops beside
a focused repo checkout. acceptance.py invokes the unchanged run-group.py;
use groups modes, check644, old-identity-contract (expected 1), focused,
adversarial-ownership and adversarial-failures as recorded in commands.jsonl.
The runner's historical baseCandidate field is unchanged; checkpoint.json binds
each execution to the actual candidate/tree/hash. Original fixtures are unedited.
'''
(out/'README.md').write_text(report)
files=[p for p in H.iterdir() if p.is_file() and (p.suffix in ['.py','.json','.jsonl','.stdout','.stderr']) and not p.name.startswith('capture.')]
for p in files:shutil.copyfile(p,out/p.name)
manifest={}
for p in [*sorted(out.iterdir()),*(R/p for p in ['tools/enigma-bounded-staging.py','test/test-enigma-staging-modes.py','test/test-enigma-bounded-staging.py','docs/re-notes/enigma-staging-footprint-repair-20261026/verify-and-stage.py'])]:
 if p.is_file() and p.name!='evidence-manifest.json':manifest[str(p.relative_to(R))]=dict(bytes=p.stat().st_size,sha256=sha(p))
(out/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
git('add','--',E)
finaltree=git('write-tree')[1].decode().strip()
docs=git('diff','--name-only',m['testedTree'],finaltree)[1].decode().splitlines()
assert docs and all(p.startswith(E+'/') for p in docs)
git('diff','--cached','--check')
save('precommit.json',dict(candidate=V,main=MAIN,testedTree=m['testedTree'],finalTree=finaltree,docsOnlyPaths=docs,manifestPayloads=len(manifest),mergedValidation='PASS_EXACT_SOURCE_REUSE'))
print(json.dumps(dict(status='ACCEPT_AND_MERGED_VALIDATED',testedTree=m['testedTree'],finalTree=finaltree,manifestPayloads=len(manifest),resourcePeak=admission('precommit')['peak'])))
