from work import *
from capture import account
O=H/'ops';R=H/'repo';E=R/'docs/re-notes/maelstrom-event-qualified-original-capture-20261024';E.mkdir(parents=True,exist_ok=True)
events=json.load(open(O/'events.json'));raw=(O/'collected/guest/output.log').read_bytes();actual=json.load(open(O/'collected/guest/command.json'));planned=json.load(open(H/'guest-args.json'));terminal=json.load(open(O/'collected/guest/terminal.json'))
assert actual['argv']==planned and terminal['returncode']==0 and terminal['reason']=='natural' and not terminal['remainingGroup']
assert len(events)<=16 and sum(len(x)+1 for x in raw.splitlines() if x.startswith(b'[MAELSTROM-EVENT] '))<=8192
assert events[0]['events']==['select-net-wait'] and events[0]['detail']['thunkWords']==[2147483666,934]
assert sha((R/'tools/maelstrom-event-boundary-observer.cjs').read_bytes())=='52909f8dc9e39c9c294602c952d9bbbf4e91c52d5c56ddbba45fb3cb30d9e226'
save('ops/evidence-review.json',dict(actualArgvMatches=True,unchangedObserver=True,eventCapPass=True,rawEventLines=2,rawEventBytes=sum(len(x)+1 for x in raw.splitlines() if x.startswith(b'[MAELSTROM-EVENT] ')),terminalNaturalReaped=True,headInteriorBoundaryAbsent=True,finalCounts=[972,972],countsProveExecution=False,selectCompletion='unobserved',selectResult='unattributed',intraInvocationVisits='unobserved',gameplayAcceptance=False))
report='''# Original Maelstrom event-boundary observation, 2026-10-24

OBSERVATION COMPLETE: exactly one original guest, natural exit 0 after 11.124 seconds,
42,000 batches. This is a runtime observation, not gameplay acceptance. No build,
native-suite rerun, acquisition, repair, deployment, extra guest or main merge.

The unchanged independently native-qualified observer emitted one boundary event
and its summary (1,208 raw bytes total). At invocation 104910, batch 36164,
`run(1000)` changed the recorded state as follows:

| Field | Before | After |
|---|---|---|
| EIP | 0x00679753 | 0x075040f8 |
| EDI | 0x074fff4f | 0x0052e430 |
| EAX | 0x00000102 | 0x53000001 |
| EBP | 0x00000005 | 0x00000005 |
| ESP | 0x074ffc28 | 0x074ffb18 |
| yield reason / flag | 0 / 0 | 8 / 0 |
| last run halt / breakpoint | 3 / 0 | 3 / 0 |
| head / interior entry counts | 0 / 0 | 0 / 0 |
| cache stores / clears / invalidations | 5417 / 2 / 4552 | 5451 / 2 / 4552 |

Tick count is 7,232,801 on both sides. This is `boundary-only`, not the
pre-dispatch pending-reason guard case (the captured after halt is 3).
Real thunk words `[0x80000012,934]` identify select at the captured reason-8
EIP. Bounded current stack words are return `0x007a3362`, nfds `0x53000001`,
read-set pointer `0x074ffb50`, write/exception NULL, timeval pointer `0x074ffb48`.
Read fdset count is 1, prefix `[0x53000000]`, untruncated; timeval words `[1,0]`.
These are captured words; do not normalize the unusual nfds word or treat EAX
as an attributed select result. The observer's exported select deadline is unavailable.

Summary seen set is exactly `select-net-wait`. No invocation boundary exposed
EIP head `0x7a3362` or interior `0x7a3366`; the return address on the stack is
not execution evidence. Final counts 972/972 do not establish MOV/CALL execution
or intra-invocation visits. Select completion/result, internal visits and head
registers remain unknown/unobserved. The observer deduplicates event kinds;
the single arrival record does not expose subsequent select returns/guards.
Final printed EIP remains `0x075040f8`; no yield clear, extra run, clock change,
optional capture or trace was added. Existing trace-from 30000 was preserved.

## Identity and recovery

Base main `8fe3b51b94f59a17e3af58e08e0cb87cdbb4165a`, tree
`c38bf5d49191ebf829c2eb3b14c48b9da5721c43`. `identities.json` binds the full
effective runner SHA, unchanged observer SHA, head dependency, exports/runner
pins, installed scheduler and unchanged native module. Source module b41a7c5f,
ABI291, layout9a3bc9149d58209c. Actual `guest/command.json`, terminal and raw
output are committed here; manifest binds all 247 closure files, including
48 original files/2,794,170 bytes. Original EXE/SDL/SDL_net hashes were checked
before staging and again after the guest. Readonly donor/root refs/index remain untouched.

Recover via committed prepare.py, stage.py and ready.py using the pinned standing
inputs, exact command and dependency-first flattened readonly alternate stores.
The observer CLI uses `--enable RUN_JS EXPORTS_WAT THREAD_MANAGER_JS NEW_ADJACENT_RUN_JS`;
the pinned scheduler is installed in the staged runner. No old head/audit/watch/break
transform is layered. Explicit --no-build/--wasm, 512MiB arena/heap, 200ms tick,
42,000 batches and original P/input schedule were retained. The canonical startup
parser confirms size1000; changed actual tree argv enumerates/hashes all48 files,
including comma-bearing names. Installed preamble, renderer, font/PNG providers
and ordinary-user writes passed. Exact-revision native/codec/watchdog receipts
were reused; no native acceptance attempt was repeated.

## Resource and lifecycle qualifications

Initial projected allocation 52,718,359/67,108,864 bytes; preguest conservative
projection 63,601,568 includes full current SQLite WAL plus positive growth,
full external launcher/session logs, local/remote allocations, transfer overlap,
future publication/evidence/external growth and 8MiB reserve. Remote owned allocated
bytes after run 18,423,808; fresh guest UID1000 and MemAvailable7,251,521,536.
Host floor after projected growth exceeded2,982,150,144; local cheap memory passed.
Separate local/remote heavy locks admitted and were subsequently free. Guest
CPU90/wall60, output131072, TERM/KILL<=5s and reap were enforced. Supervisor
artifact limit24MiB supports planned files; guest output5943 bytes.

Initial reads exceeded requested bounds, initial preparation/transport orchestration
lacked complete outer CPU/wall wrappers, and correcting an accidental manifest
SHA literal reran setup after its first SQLite baseline. Full WAL is therefore
conservatively charged; no retroactive full-compliance claim. Historical producer
oversized fetch/history and prior deficiencies remain charged in their original
receipts, not reset here. There was no donor fetch, broad clone, pack or full tree.

Guest process22113/PGID22113 naturally returned0, TERM/KILL unnecessary, group
absent and wait reaped. Remote postguest process scan empty, local watcher absent,
locks free. Box `bx_qa9ex5bu` remains RUNNING (API state idle), expiry
2026-10-24T19:28:30.484Z; coordinator owns shutdown19:23UTC. No other box touched.
'''
# Derive raw byte count rather than hand-enter an estimate.
report=report.replace('1,208 raw bytes',str(json.load(open(O/'evidence-review.json'))['rawEventBytes'])+' raw bytes')
(R/'docs/re-notes/maelstrom-event-qualified-original-capture-20261024.md').write_text(report)
names=['admission-local.json','remote-admission.json','remote-base.json','pins.json','startup-pacing.json','alternates.json','setup.json','setup-correction.json','prepare.py','stage.py','ready.py','work.py','capture.py','collect.py','close.py','supervise-source.json','validate-tree.cjs','identities.json','reused-readiness.json','actual-tree-api.json','provider-api.json','ready.json','resource-preguest.json','resource-postguest.json','guest-attempt.json','guest-api.json','events.json','observed-summary.json','collection-inventory-api.json','cleanup-api.json','cleanup.json','box-handoff.json','evidence-review.json','sqlite-baseline.json']
for n in names:shutil.copyfile(O/n,E/n)
for n in ['guest-args.json','manifest.json','transfer-receipts.json','remote-rehash.json','api-history.jsonl']:shutil.copyfile(H/n,E/n)
for p in (O/'collected').rglob('*'):
 if p.is_file():
  d=E/p.relative_to(O/'collected');d.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,d)
account('publication')
def git(*args):
 p=subprocess.run(['git','-C',str(R),*args],capture_output=True,text=True,timeout=60,env=dict(os.environ,GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'));assert p.returncode==0,(args,p.stderr);return p.stdout.strip()
git('add','--sparse','docs/re-notes/maelstrom-event-qualified-original-capture-20261024.md','docs/re-notes/maelstrom-event-qualified-original-capture-20261024');git('diff','--cached','--check');git('commit','-m','Record single original Maelstrom select event boundary capture')
commit=git('rev-parse','HEAD');branch='task/maelstrom-event-qualified-original-capture-oct24';out=git('push','-u','origin',branch);remoteSHA=git('ls-remote','origin','refs/heads/'+branch).split()[0];assert remoteSHA==commit
seals=[]
for p in E.rglob('*'):
 if p.is_file():
  rel=str(p.relative_to(R));b=subprocess.check_output(['git','-C',str(R),'show',commit+':'+rel]);assert b==p.read_bytes();seals.append(dict(path=rel,sha256=sha(b),bytes=len(b)))
save('ops/publication.json',dict(commit=commit,branch=branch,remoteSHA=remoteSHA,verified=True,evidenceBlobs=len(seals),seals=seals,report='docs/re-notes/maelstrom-event-qualified-original-capture-20261024.md'))
print(json.dumps(dict(commit=commit,branch=branch,remoteSHA=remoteSHA,evidenceBlobs=len(seals))))
