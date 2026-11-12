# Enigma non-font permission preservation repair

Candidate `f1aac7b9ba83e2bbc763cb58d38646653d626468` had preserved bytes but
created non-font copies with permissions selected by umask. This repair keeps
ordinary source permissions on independent non-font copies: standing regular
files use `st_mode & 0777`; Git blobs use the pinned tree's `0644` or `0755`.
It rejects non-regular non-font inputs and strips setuid/setgid/sticky bits.
Ownership, ACLs, timestamps and directory modes are outside this file-mode
contract. Sources and their metadata must remain stable during staging.

The helper applies chmod after successful streaming and closing, before atomic
publication, only on new independent copies. Fonts still share only newly
owned immutable `0444` copies. No donor links, writable sharing, deduplication,
rehash, allocation, namespace or cleanup policy was relaxed. The replacement
recipe documents that later transport must preserve/verify ordinary modes as
well as bytes and owned aliases; its executable AST is unchanged.

The unchanged independent `accept.py` (SHA-256
`5fc9ef217c961ac0303801fa7f479e1b86ed3fba1a8e87caee4cde91f1cd40a8`)
reproduced `0600/0755 -> 0664` under umask `0002` on the baseline helper.
The unchanged `check-644.py` reproduced `0644 -> 0664`. Both now pass on
the repaired helper. Original assertion diagnostics and all before/after
fixture/helper hashes are preserved; neither independent fixture was edited.

Five focused regression tests pass with serial Python DATA=16 MiB, CPU=60 s,
FSIZE=24 MiB, timeout=65 s. The mode matrix includes `0644`, `0600`, `0755`,
`0664`, `0444`, `07644` and `07755` under umasks `0000`, `0002` and `0077`.
It checks exact bytes and modes, unchanged donor inode/mode/bytes/link count/
mtime, independent non-font inodes, readonly font alias sharing and an
independent allocation oracle including directories. It covers pinned Git
executable/non-executable modes with conflicting worktree modes, comma/glob/
newline filenames, rejection of links/directories/FIFOs/missing sources,
chmod-failure cleanup preserving foreign evidence, and changed duplicate
source rejection. The tiny exact recipe group also passes.

The old independent identity group has one contract conflict: it writes a
non-font output copied from a `0444` donor. We executed it unchanged and retain
its PermissionError, rather than weakening the oracle or claiming a pass. The
new regression checks independent writes from writable sources and preserves
readonly permissions from readonly sources. This is an intentional consequence
of source-mode preservation. The prior identity/accounting and two rejecting
mutant receipts remain useful for unchanged alias/consume/inventory logic;
they are not represented as fresh full-group passes. Prior cleanup is reused;
the new failure path has its own chmod cleanup test.

All six unchanged helper functions (`font`, `validate`, `source`, `consume`,
`inventory`, `main`) were compared by AST. The original seven-test fixture,
manifest/pins, 2659-source rehash receipt and all other original evidence are
byte-exact and inherited from the candidate commit. Those tests/full-source
reads were not repeated, and no full-media tree was staged. All 51 payloads
in independent review `00bdb5504bc28e1ef17e15c15dbbc81773dbb5f8` were rehashed
against committed Git blobs using 8192-byte streaming. `prior-evidence.json`,
`checkout.json`, `checkpoint.json` and the evidence manifests bind the chain.

Reproduction: restore unchanged `accept.py`, `check-644.py`, and `run-group.py`
as sibling `ops` files beside a checkout of this repair. Run, serially:

```
python3 -B ops/run-group.py mode-check accept.py modes 0
python3 -B ops/run-group.py check-644 check-644.py - 0
TMPDIR="$PWD/ops" python3 -B ops/run-group.py regression ../repo/test/test-enigma-staging-modes.py - 0
```

Use new output names because the runner refuses overwrite. `checkpoint.json`
records final identities, completed groups and remaining integration/transport/
runtime gates; original logs remain alongside it. Earlier local bookkeeping
errors (session lookup bound, closure value type) were corrected in place.
Initial combined evidence reads were truncated and one buffered blob read hit
the capture-size guard; subsequent blob verification streams 8192-byte chunks.
The first four-test run passed; the final five-test run adds explicit changed
duplicate coverage and records its actual exit status. No access denial was
encountered or bypassed.
The first Git add could not create its default lstat threads under the 16 MiB
data limit; committed `publication-failure.json` preserves that diagnostic.
Disabling preload and using one index/pack thread allowed the commit. Pushes
under Git DATA limits of 16 and 64 MiB then failed with local malloc errors;
both diagnostics are preserved separately. Git push with DATA=256 MiB, CPU=60 s,
FSIZE=24 MiB and timeout=65 s succeeded within the separately admitted 512 MiB
client envelope. Python tests retain DATA=16 MiB. The trusted SSH configuration
and access controls were unchanged; no access denial was retried.

`admission-*.json` charges owned checkout/Git/ops/evidence, external launcher
and actual session, positive shared SQLite allocation highwater once, future
session/database and Git/evidence allowance once, and an 8 MiB reserve inside
64 MiB. Flat readonly donor objects and installed tools are standing inputs.
Fresh RAM admission uses 512 MiB client plus 16 MiB heap and the required
805306368-byte remaining floor; disk growth is 58720256 bytes with a
2982150144-byte remaining floor. `launch.json` is the actual PID/argv receipt
for GPT-6.1-Sol medium, 200000 total-context compaction. Trusted SSH and the
unchanged canonical mount argv/enumeration receipt were checked before checkout;
no mount or runtime command was executed.

Publication is only `task/enigma-staging-mode-preservation-repair-oct26` using
the supplied trusted SSH configuration, followed by exact remote-ref verification.
The tested source repair is `8752981b212e416250a5655e65c98d3697cb60d5`, with
its successful exact remote receipt preserved in `source-publication.json`.
This subsequent evidence closeout changes only this review directory; all
tested source/fixture/recipe bytes and modes remain identical. Ops
`publication.json` records the final commit. No main integration, workers,
Boat, guest, SSH runtime, heavy compile, services or deployment occurred.
No test box was assigned (ID/state/expiry N/A); user reports all prior boxes
STOPPED. Shutdown ownership remains with the coordinator. Remaining gates are
coordinator review/integration, fresh transport/filesystem/resource qualification
preserving modes and aliases, and actual guest frame/PNG/gameplay acceptance.
This source repair makes no PNG, guest-startup or gameplay claim.
