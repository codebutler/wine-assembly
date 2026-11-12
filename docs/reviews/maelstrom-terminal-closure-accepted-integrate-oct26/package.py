from control import *
limits()
v=json.loads(read(O/'merged-results.json'));assert v['verdict']=='ACCEPT'
for p,h in v['pins'].items():assert sha(R/p)==h
assert git('prepackage-tree','write-tree')==v['testedTree']
# Standing leaves are inspected only at object-directory/fanout depth. Never recurse alternates.
a=json.loads(read(O/'flat-leaves.json'));seen=set();leaves=[]
for leaf in a['leaves']:
 n=0;allocated=0
 for d in pathlib.Path(leaf).iterdir():
  if d.name in ('info','alternates'):continue
  if d.name=='pack' or (len(d.name)==2 and all(c in '0123456789abcdef' for c in d.name)):
   if not d.is_dir():continue
   for p in d.iterdir():
    if not p.is_file():continue
    s=p.stat();key=(s.st_dev,s.st_ino)
    if key in seen:continue
    seen.add(key);n+=1;allocated+=s.st_blocks*512
 leaves.append(dict(path=leaf,uniqueNewlyCountedStandingFiles=n,standingAllocated=allocated,readOnly=True))
dump(O/'standing-leaves.json',dict(leaves=leaves,uniqueFiles=len(seen),standingAllocated=sum(l['standingAllocated'] for l in leaves),newCharge=0,method='One fanout depth; deduplicated target device/inode; no recursive alternates; used in place.'))
own=json.loads(read(O/'incidents.json'));own['current'].append('Bounded candidate-names log exceeded64KiB whole-file read gate; read stopped before output. Used scoped Git path queries instead, no read/output allowance increased.');dump(O/'incidents.json',own)
gate('before-package')
P=R/'docs/reviews'/TASK;P.mkdir(parents=True)
text='''# Accepted Maelstrom terminal closure integrated onto main

The independently accepted adapter/state chain is reconciled onto fresh remote main `9148ceb18768955f647130c2e936228429892477`. Candidate `bbcc8685a900c1714e11b2eda4b7ac99f3d6f105` was independently ACCEPTED by review `9c92dd2039b902960f3c0f6c71080bd1eb2dfc24`. Only the two necessary production modules, five tests and scoped historical/acceptance evidence are imported. The existing select hook is unchanged. Main-side scoped source has no change since the common ancestor; no unaccepted source resolution was needed. Unrelated main history is retained.

Merged-tree validation ACCEPT: unchanged26 groups/74 cases; callback regression68 cases; independent challenge174 cases; corrected scalar13 groups/3748 cases; unchanged10+19 groups; semantic7 groups/924 cases; adapter7 groups; rejection14 groups/511 combinations. All passed, zero candidate failures. Reused20 unaffected groups (model13/source6/preservation1) after exact source/fixture/input/receipt hash checks. Each completed group has an atomic durable checkpoint with tree, source/fixture hashes, command evidence, results and remaining work. No duplicate independent source audit was performed.

Tested tree: `TESTED_TREE`. Final commit adds this validation report and evidence; source/fixture pins remain identical. `merged-inputs.json` identifies necessary predecessors, reconciliation and exclusion scope; `merged-results.json`, checkpoints and commands provide exact evidence.

Fixture reconciliation: corrected scalar fixture `abfb36515543b9465fdf66f0b0975f18ec10c109c9eb55ad1ffef4bbd69f2bb4` remains byte-identical. Unchanged26 reproducer `10421b75e1ed40dae8e51368537eb76b1f9aba75460cfc3831bd840d556d02e5` remains byte-identical. The historical invalid enum-acceptance fixture/oracle and original10PASS16FAIL terminal-closure failure are preserved in the imported prior review/repair records and immutable referenced donor evidence. Status/event are finite reachable enums; unrestricted scalars retain signed/unsigned32 normalization. Historical13/3474 acceptance was invalid; corrected13/3748 passed. Old literal revision fields in unchanged fixtures are historical metadata.

Native latch `24b0e65c902cad56974a12da48251b77b3eebb018c4bd5825d7e2f5050b06095`, select hook `b7c77c20b12cd582d6fcfbe246e1f0abdcb644266fc3f161bf5d683d93b13930` and accepted adapter `28c1c3249ef488d4b2df1ccb3d0658cc1b02803ca9163f5a2bb24f945ba00551` are exact accepted pins. No native/compiler/Wasm/build/guest/runtime qualification was performed. Changed-module qualification remains required before any future guest. Authentic batch36170 cause remains UNKNOWN.

Reproduction: retained `control.py` supplies exact environment variables and per-command limits; `run-merged.py` runs the affected suites on the pinned merged source. CPU60/wall60, file24MiB, output128KiB, Node heap128MiB, read chunks64KiB/excerpts8KiB, total captured logs2MiB and TERM/KILL/reap5 apply after bootstrap. Python child address space128MiB; installed Git/Node address spaces are not capped to128MiB (Node heap is). Initial pwd/bootstrap output-control qualifications, checkout object-view failures and read-gate incident are explicitly preserved in `incidents.json`; no retrospective compliance. Prior acceptance/control incidents are retained unchanged.

Resource gates include all task lstat blocks (including symlinks), Git/checkout/evidence/publication, launcher/session, full shared WAL/SHM, conservative positive DB growth, future8MiB and reserve8MiB inside64MiB. Required RAM1275068416 and projected free disk2982150144. Installed tools and verified readonly leaves/inputs used in place are separately recorded without duplicate charges. Gates stop affected operations on failure. Short relative flat views exclude info/alternates; no full clone, recursive alternates or repack. Trusted dedicated SSH configuration was checked in this task; exact unchanged empty-mount receipt reused, no runtime/mount argv.

Normal tested taskbranch push and authorized normal FFmain push require exact remote verification; final commit/ref/resource/cleanup receipts are in owned ops, announced on messageboard. Root tracked/index/refs and donors remain readonly; root initial launcher digest reused. Only own bounded watchers are used and reaped. bx_k38z8byn is historical coordinator-reported STOPPED, unassigned, not accessed/reverified; historical expiry2026-10-26T01:39:12.069Z. Coordinator owns lifecycle. Claude idle; HeroesII laptop-owned; corpus platform denial unchanged. No workers, Boat/browser/services/deployment/trust edits or denial retries.
'''.replace('TESTED_TREE',v['testedTree'])
(P/'README.md').write_text(text)
names=['merged-inputs.json','merged-results.json','configuration.json','incidents.json','flat-leaves.json','standing-leaves.json','standing-tools.json','standing-source.json','accepted-retained-unaffected.json','retained-unaffected.json','accepted-source-acceptance.json','accepted-incidents.json','accepted-evidence-manifest.json','fresh-remote.json','control.py','run-merged.py','integrate.py','package.py','watch.py','commands.jsonl','repair-26-results.json','challenge-results.json','status-event-results.json','independent-results.json']
names += [p.name for p in O.glob('checkpoint-*.json')]
names += [p.name for p in O.glob('*.log') if p.stem in ['repair-26','regression68','independent174','scalar13','ten','nineteen','semantic7','adapter7','rejection14','no-main-side-source-conflict','scoped-history','scoped-delta','relationship','checkout','checkout-reconciled-view','root-main-object','main-object-resolved']]
names += ['independent.cjs','status-event-independent.cjs','challenge.cjs','bootstrap-gate.json','admission-exact-before-checkout-main-resolved.json','admission-merged-ready.json','admission-after-tests.json']
entries=[]
for name in names:
 q=O/name;shutil.copyfile(q,P/name);assert sha(q)==sha(P/name);entries.append(dict(path=str((P/name).relative_to(R)),sha256=sha(q),bytes=q.stat().st_size))
entries.append(dict(path=str((P/'README.md').relative_to(R)),sha256=sha(P/'README.md'),bytes=(P/'README.md').stat().st_size))
dump(P/'evidence-manifest.json',dict(testedTree=v['testedTree'],candidate=v['candidate'],files=entries))
dump(O/'evidence-manifest.json',dict(testedTree=v['testedTree'],files=entries,manifest=dict(path=str((P/'evidence-manifest.json').relative_to(R)),sha256=sha(P/'evidence-manifest.json'))))
git('stage-report','add','--sparse',str(P.relative_to(R)))
git('final-staged-whitespace','diff','--cached','--check')
git('final-staged-stat','diff','--cached','--stat')
changed=git('final-changed-paths','diff','--cached','--name-only').splitlines()
allowed=set(json.loads(read(O/'merged-inputs.json'))['production']+json.loads(read(O/'merged-inputs.json'))['tests'])
prefixes=['docs/reviews/'+n+'/' for n in ['maelstrom-state-acceptance-retained-closeout-oct26','maelstrom-terminal-callback-closure-repair-oct26','maelstrom-terminal-closure-independent-accept-oct26',TASK]]
assert all(p in allowed or any(p.startswith(pre) for pre in prefixes) for p in changed), 'unexpected import'
for p,h in v['pins'].items():assert sha(R/p)==h
dump(O/'prepublication.json',dict(testedTree=v['testedTree'],finalTree=git('publication-tree','write-tree'),evidenceFiles=len(entries)+1,scopedChangedPaths=len(changed),sourceFixturePinsVerified=True,resource=gate('prepublication')))
print('PACKAGED',len(entries)+1,'evidence artifacts; source pins unchanged; scoped paths',len(changed))
