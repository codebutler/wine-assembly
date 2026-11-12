# Exact bounded file reader integration

Integrates accepted repair 45b0448b97a325afafa5afc6c9aebf79a9946c03 and
independent acceptance 57cdb8a47ce27a635c7b6a0214ed3ad96812d3c0 onto actual
trusted remote main e745cc29a1a3b859625aa0cd335abee0b185da71 (tree
91d64287af3a34904f68588e703a039d4ed348ef). Ancestor 9148ceb18768955f647130c2e936228429892477
was used only to derive the exact accepted delta; it was not a main reset.

Current-main lib/file-bundle.js matched the accepted pre-repair blob exactly.
Applied only accepted reader, supplied/independent tests and review evidence;
all 21 accepted paths retain exact accepted Git blobs. Every unrelated main
entry, including host.js and Maelstrom source/evidence, retains its main blob.
No parser own-descriptor or save-bundle repair is integrated.

Review: opened-handle regular-file check and early metadata rejection precede
bounded 64 KiB chunk reads; short reads fill chunks, total remaining budget is
enforced by a one-byte overflow probe, finally closes all opened handles.
Wire order/framing/error outcomes stay accepted behavior. Production dependency
closure is Node fs/promises only; test dependencies are Node builtins plus the
exact pinned source and independent suite. No package installation required.

Merged production source and all test blobs match accepted pins. Supplied 8,
independent 8 and rejecting controls 5 passed, using finite 30/30/45-second
limits and Node --max-old-space-size=192; controls have 15-second child limits.
Logs, closure pins and per-group checksums accompany this review. Initial
successful supplied output used Node spec format; capture-parser correction
is retained in incidents.json. No behavior oracle was changed.

Preserved original failed baseline source/log and passing repair receipts with
the original resource incident qualification. Prior 201434854-byte duplicated
object setup was corrected by its owner before testing; integration does not
retroactively qualify it. Accepted nested-test and publication incidents remain
in the byte-exact independent evidence directory.

Only cheap server-module behavior was tested. This is not parser acceptance,
browser/guest/runtime/gameplay, full build, RSS stress, or public deployment
qualification. Blocking filesystem open/read/close operations are not given
timeouts by this source change. Current-main parser remains unchanged.
