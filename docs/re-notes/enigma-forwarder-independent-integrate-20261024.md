# Enigma forwarder repair: independent acceptance and source integration

**PASS** for the bounded malformed-export-forwarder repair at immutable candidate
`34a6d1b31d0e3280ca363a3c25200ee07f56afc8`. Independent review found no substantive
defect in the changed parser/resolver. This accepts static diagnostic tooling;
dynamic closure, emulator implementation, startup and gameplay remain unproven.

The executed parser SHA256 is
`f949185c282300ac3463b5524420464f87883b5ab5cb6e833fdf564cf6d83bbf`.
Forwarder reads stop at the export directory's exclusive end and the 4096-byte
string bound. Empty strings cannot become direct exports: only `None` denotes
a direct export. Both PE decoding and caller-supplied resolver graphs validate
forwarder syntax. Provider matching normalizes case and optional `.dll` once;
decimal ordinals normalize before lookup, and recursive binding rejects cycles.
System-provider matches remain recorded requirements rather than evidence that
the emulator implements those functions. The existing final-dot convention and
bounded ASCII/module-name policy remain the diagnostic tool's supported scope.

The unchanged baseline diagnostic is deliberately preserved with SHA256
`41050c56ffe274f87f38fc3020efbd06eec29f3e7bd77f188495dd0a99691d20`.
Its hardcoded parser SHA256 is
`9cb012199d5307b63e369f140aea0875aee0b519b136c0033dd3ef735a8a298a`.
This review reuses the retained matching baseline execution (exit zero,
`REJECT_PARSER_CORRECTNESS`), independently matching the exact source and oracle
to Git revision `17cb4edae7d5a20874c7afc560dede1978c92ee4` and rehashing its
receipt/log. It was not weakened or run as an acceptance oracle on repaired
source. Its historical reproduction requires that exact baseline checkout.

Fresh candidate regression executes exact source bytes and rejects the original
four-byte SDL_Init EAT mutation semantically, before immutable seals. File offset
299908 changes RVA `0x1340` to `0x53000`; mutant SHA256 remains
`04448e081b6a27c4cf02989d5c763cd2cc9f1d1f0cb7e0e3934964fa5a6791c0`.
The full verifier separately rejects the mutant's hash. No hash bypass is claimed.
All 33 rejecting controls and eight valid forwarders pass, as do the unchanged
producer's fourteen semantic controls and two guard/sentinel controls.

The new independent test targets gaps in those controls, rather than repeating
their syntax matrix. A multihop named/ordinal chain must choose `b.dll` rather
than `b.dll.dll`, normalize `#00012`, traverse the terminal provider's imports,
and allow repeated consumers. Removing the exact provider rejects; a cycle
through an already visited module rejects. Actual owned SDL copies verify a
non-unit export ordinal base, reject named EAT holes and out-of-range name
ordinal indexes, and distinguish a malformed forwarder on the last directory
byte from a legitimate direct mapped data export at the exclusive end.
These are three positive groups and five rejecting controls, all passing.

Authentic normal-import counts remain 849 entries, 40 edges and 192 packaged
bindings. Six fixed codec initializers request 74 symbols: 50 packaged and 24
from missing providers. No inference of codec startup necessity follows.
Generic/register-derived loads, including Enigma VA `0x5ab960`, remain unknown.
The original helper SHA256 remains
`e29aa3fb9f182a1a6ca48e8f932dc7e6857b3404c0d945be685f8ad2e47225fe`;
its original verifier/test and their recorded 2460-file
`BLOCKED_PACKED_IMPORTS` outcome are unchanged. Full original mutation tests were
not rerun against read-only standing originals. Only their safe guard tests run.

Source integration uses the exclusive shared integration lock, reconciles actual
remote main, and copies only the reviewed Enigma tools, tests and historical
notes/evidence absent there, plus this review and its independent test/evidence.
It creates a source-only commit on fresh main without importing unrelated donor
history. Root tracked files, index and refs, all donors, and standing assets stay
read-only. Publication receipts record actual task/main refs after nonforce push.

Reproduce using fresh owned destinations (the producer test mutates fixtures):

```sh
python3 -B test/enigma-forwarder-repair.test.py \
  /tmp/enigma-authentic-static-unpack-oct24 /tmp/enigma-final-repair
python3 -B test/enigma-unpacked-closure.test.py /tmp/enigma-final-repair
python3 -B test/enigma-forwarder-independent.test.py \
  /tmp/enigma-authentic-static-unpack-oct24 /tmp/enigma-final-independent
python3 -B test/enigma-original-closure.test.py
```

Exact final-tree checks and execution provenance are in the evidence JSON beside
this note. Raw logs, mutation fixtures, full final diff, resource/admission,
publication and cleanup receipts are retained under
`/tmp/enigma-forwarder-independent-integrate-oct24/`; external launcher output
and the full session are charged by its one-owner `ledger.py`. Initial projection
was 56,197,120 / 67,108,864 bytes including all ten copied input/output modules,
temporary overlap, external history/SQLite future growth and 8 MiB reserve.
No installed tool was copied or acquired. All executed Python commands have fresh
805306368-byte MemAvailable admission and 60-second CPU/wall bounds. No Node,
compiler, build, unpacking, acquisition, guest, browser, box or deployment runs.
Mount argv and box ID/state/expiry are N/A; coordinator owns runtime lifecycle.
Receipt log hashes bind retained bytes but do not prove arbitrary supplied logs
were produced by their claimed commands. No dynamic closure or runtime claim.
