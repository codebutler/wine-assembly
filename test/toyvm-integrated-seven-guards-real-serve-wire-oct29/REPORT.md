# Integrated seven namespace guards through Backend.serve

PASS on baseline `1d942889181b132b5535e1b09e9280d6be882fa6`, with the unchanged final backend SHA256 `75842ffafd6ebd0c29fa2889a463bfd6f5245634096f4dfef9a3fd69f703e822` (12982 bytes). All five production source pins were checked before and after execution; see input-verification.json and evidence-audit.json.

The new production run sent **99 serialized requests**, including INIT, **41 exact errno rejections**, and a successful GETATTR after every rejection. Seven independent private predicate mutants required another 65 frames: **164 total**. These counts belong to this exact final source. The historical 83-wire receipt on b8201b2c is not used as evidence for this source.

## Behavioral scope

| Guard family | Actual wire observations |
| --- | --- |
| RENAME type mismatch | Operations 12 and 45 reject file over directory with EISDIR and directory over file with ENOTDIR; RENAME2 flags zero. |
| UNLINK/RMDIR inode type | UNLINK directory gives EISDIR; RMDIR file gives ENOTDIR. |
| Directory cycle | Both rename operations reject self and descendant destinations with EINVAL. |
| Nested READDIR parent | Nested b exposes inode a as '..'; accepted RENAME2 moves b to root and READDIR exposes root; RENAME restores b and READDIR exposes a again. |
| CREATE/MKDIR parent/collision | Both operations reject missing parent (ENOENT), file parent (ENOTDIR), file/directory name collision (EEXIST), and unsafe name (EINVAL). |
| SETATTR atomicity | Size plus unsupported bits 2048 / high bit rejects with EOPNOTSUPP; size/data/accounting remain unchanged. Accepted size growth is followed by another rejected combined request. |
| Rename parent/flag precedence | Both operations reject missing or non-directory source and destination parents with ENOENT/ENOTDIR. Nonzero RENAME2 flags precede those checks and unsafe-name checks with EOPNOTSUPP. Missing source names and valid flag-zero no-op also covered. |

All fixture creation and writes go through actual frames. Backend constructor limits are live=131072, write=65536 and file=16384. Six inodes (including root), two payload blocks, two open handles and ten written bytes establish the initial 32768-byte live charge from the production accounting formula. There is no successful overwritten-file fixture in this test, so retained-open replacement charges are not requalified here.

Every rejection records the full backend state before and after: complete node/name/data maps, links, opens, inode sequence, handles, quota limits, live/peak/written counters, failure latch, root and fd. Only operations may increment by one. Exact reply length, errno, unique request identity and empty error payload are checked. The final mixed sequence repeats wrong-type, cycle and parent-identity checks after accepted movement and growth. production.json retains every request/reply as hex and the atomicity snapshots.

## Harness and distinguishing controls

accept.py compiles the verified file bytes directly and calls its unchanged Backend.serve in a bounded thread. There is no replacement handle, selector, dispatcher, or return value. A socketpair transports serialized Linux FUSE-layout frames, one request/reply at a time after INIT. A unique abstract AF_UNIX control address avoids socket pathnames. No mount or guest operation occurs.

The actual selectors.DefaultSelector is verified to be EpollSelector. After the INIT reply, /proc/self/fd witnesses the actual epoll and control socket descriptors. Shutdown drains the bounded thread (3-second join; socket receives bounded at 2 seconds), checks all owned descriptors with fstat for EBADF, and verifies the borrowed peer still supports fstat/getsockopt and observes EOF. Each of eight sessions passed cleanup. Cleanup is observed on the new acceptance sessions; generic EOF/bind/registration fixture groups were not repeated.

Each mutants/*.py is an isolated exact copy of final source with one relevant conditional predicate replaced by False. All other bytes, including serve, remain unchanged. results.json pins each transformed source, records the old/new predicate and exact failing observation; evidence-audit.json independently verifies the one-span transformation and that each mutant's distinguishing request has the same opcode, inode, payload and expected errno as the production observation. For READDIR it verifies parent inode 2 versus mutant inode 1. Six other mutants return a different errno and/or alter the state, and all fail the same primary oracle. No fixture setup failure is accepted as a mutant kill.

## Retained evidence and limits

The verified af7ed82f5e0e5eebf101a37d3e996dde3978a598 receipt and its six pinned artifacts supply inherited exact final loader/source-composition and broader epoll cleanup coverage. They were verified, not reexecuted. input-verification.json records that chain from the supplied canonical integration receipt. No loader tamper tests or historical generic fixture groups were rerun.

The initial verifier expected integration test artifact pins in a different receipt field and failed before any backend behavior. The owned verifier was corrected to use the canonical inputs.canonicalAcceptancePin chain. The original failed operation remains in task evidence. It was not a production failure or admission denial.

Reproduction from the owned born repository uses the task supervisor and /usr/bin/python3:

```
/usr/bin/python3 /tmp/toyvm-integrated-seven-guards-real-serve-wire-oct29/ops.py reproduction /usr/bin/python3 test/toyvm-integrated-seven-guards-real-serve-wire-oct29/accept.py
/usr/bin/python3 /tmp/toyvm-integrated-seven-guards-real-serve-wire-oct29/ops.py audit-reproduction /usr/bin/python3 test/toyvm-integrated-seven-guards-real-serve-wire-oct29/audit.py
```

Run only under fresh unchanged admission and within assigned ownership. The task supervisor enforces the supplied memory, CPU, wall, file, capture, disk and evidence controls. Its records are retained under the task e/ directory. No admission/platform/limit denial occurred. No Boat was used. The source-only index, main and all five production files remain unchanged.

This qualifies local socketpair dispatch and namespace guard coexistence. Mounted/kernel, CLI, browser and gameplay execution remain acceptance gates. No production repair, caller migration, main integration, public deployment or replacement task was performed. Publication SHA and trusted remote verification are in the external completion-receipt.json and bounded coordinator-note.txt.
