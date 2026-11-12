# Original-game review, October 19

## Army Men

Run `20261019-army-men-scroll-entry-remote-v1` preserves the original executable
and historical module `7fd02a77ec01e5e18065d112b1da434886a0dba3fcadd7ff043d1e2ddca41f33`.
The exact-module control first established that debugger breakpoints observe
block entries, not arbitrary interior instructions. The original capture then
observed eight entries at `0x4074f1`, batches 674–681.

The raw log places the first observation after keydown was queued but before
WM_KEYDOWN was delivered to the guest. Observations two through eight follow
delivery and precede keyup at batch 706. They must not all be described as
caused by the key press. The verified original instruction sequence supplies
the same surface pointer for source and destination. Captured source rectangles
start at (3,1), (4,1), (5,1), (4,2), (3,2), (2,2), (1,3), and (0,3);
destinations are (0,0), except the final (1,0).

Root reviewed `turn-after.png`: severe diagonal terrain repetitions remain;
the central soldier tile and lower HUD/minimap are visible. Its SHA-256 is
`9446720a4b6a0a2183757eddeb5aad0af514b553d5cdba80919382ad968b5362`.
This is not clean gameplay qualification. No returned HRESULT or pitch was
captured. Upward source movement means a downward-copy row-order defect alone
would not explain these observations; a public API regression must establish
the actual defect before changing rendering behavior.

The bounded run exited 0 without a guard failure, changed pins or surviving
child groups. The recovered evidence archive SHA-256 is
`99b95d6fa3218387cc37a53f4b494975a5f6d67741a0affbef9ae1f308c05732`.

## Mad Bomber

Run `20261019-madbomber-setlocaltime-2` passes complete startup-asset checks.
The original CRT initializer returns 1; its SetLocalTime lookup now returns
`0x00db9a34`. This proves startup progression, not invocation of that API.
SDL initialization subsequently returns 0 after waveOutGetErrorTextA resolves
to zero. Root checked the lookup records in the recovered raw log; the worker
records the original caller dependency in its SetLocalTime compatibility note.
Real WinMM error-text implementation and conformance are the next task.

There is no screenshot or gameplay claim. The recovered postflight records
3,408 unchanged pins and absence of the child process group. Archive SHA-256:
`940bdd1ed69f02d489944c97a56afc3a59831d3a40cac235e0f055d9d71c2785`.

## Remaining independent restrictions

Dungeon Siege's follow-up source/dataflow diagnostic was rejected by automatic
review for possible cybersecurity risk; the tool did not identify a narrower
operation. Do not retry, rephrase or delegate that diagnostic around rejection.
Its existing captured evidence is preserved. Conan replaces that active lane;
normal licence acceptance is authorized, but has not been observed. Resuming
its historical box was refused with `api_key_action_forbidden` for
`sandbox.resume`; public original-package acquisition remains separate work.
