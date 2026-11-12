# Accepted GL launch supervisor integration

Integrates accepted candidate `dc9b0e8ee2c56f029a56fbb6dd42422ed29dd557`
onto exact main `754c97d3ff22ce0a0cd06d08ac06dc0446fbcbb2` without merging
the candidate subset history. Four new helper/test files and three fixture
wiring hunks are the entire production/test change. All five files match the
accepted SHA256 pins in integration.json. Main compiler, browser oracle and
rendering dependencies remain untouched; dependency-identity.json records them.

The fixture checks the browser executable before Git, compilation or browser
imports, then reexecutes through the Linux ownership supervisor. Git alone gets
DATA512MiB. The supervisor retains detached/adopted children, waited CPU and
reaped/waited RSS high water and rejects resource failures after child exit.
peakRSS is the lower bound max(sampled simultaneous aggregate, reaped/waited
high water), never a sum of nonconcurrent individual maxima or an exact peak.

Merged-tree supplied tests passed: exact fixture launch-control boundary and
Git-only DATA inheritance; supervisor CPU/RSS/reaped-peak/time/output/signal/
accounting/orphan/bootstrap cleanup and unrelated-process sentinel. Exact-main
CommonJS/tier compatibility, integrated JS syntax and Python syntax passed.
Node24.18.1 heap64 startup receipt records CPU90/file24MiB, DATA/AS unlimited;
heap is not RSS. Enclosing physical process tree cap256MiB, wall120, CPU90,
output2MiB/excerpt8192 applied. All owned test processes cleaned up.

Independent challenge groups are reused from published acceptance
`1e19d8c01e5d7e40f1e8ad60df5079ee9d9d4d4e` on
`task/gl-detached-rss-independent-acceptance-oct26`, directory
`docs/re-notes/gl-detached-rss-independent-acceptance-oct26`.
Historical README and closeout are copied unchanged with their original
MAIN BLOCKED qualification; exact-main object recovery and this integration
resolve that source gate. Those independent groups, compiler/framebuffer and
unrelated broad suites were not repeated. No browser/gameplay/runtime claim.

Recovery: initialize an isolated repository with trusted configured Git SSH,
fetch exact main with --depth=1 --filter=blob:none --no-tags, read its index,
mark unrelated entries skip-worktree, recover only selected exact blobs, and
apply the five pinned file intents. Do not whole-checkout or merge subset
history. Before tests obtain fresh complete disk/RAM admission and exact Node
startup receipt. Run only:

```
node --max-old-space-size=64 test/test-palette-browser-launch-controls.js
python3 test/test-palette-browser-supervisor.py
```

Run these inside the prescribed physical process-tree supervisor, with explicit
PALETTE_BROWSER_RESOURCE_CONFIG roots/WAL baseline, CPU90/wall120/file24MiB/
output2MiB. Git DATA512MiB applies only to Git children. Trusted command:
`ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes`.
No filename-bearing mount argv exists in this offline assignment.

Disk allocation192MiB includes selected source/Git/evidence/session/events,
positive WAL growth once,16MiB future client growth,4MiB local publication,
4MiB remote Git and8MiB reserve. Selected source cap64MiB; projected host free
at least2982150144B. Fresh aggregate RAM admission includes client outstanding
growth, host768MiB, three64MiB helpers, physical tests256MiB and sequential
Git512MiB; admission receipts retain exact measurements. Two harmless source
inspection assumptions were corrected in-task, recorded in dependency identity;
no behavioral rejection or relaxed oracle. Root dirty tree untouched.

Tested code tree is recorded in integration.json. The published commit adds
only this receipt directory to that tree, verified before committing. Exact
task/main remote SHA/tree and final footprint are in local ops/publication.json
and repository append-only messageboard. No Boat assigned or operated; lifecycle
ownership remains with coordinator. Browser/renderer qualification requires a
separately authorized runtime task.
