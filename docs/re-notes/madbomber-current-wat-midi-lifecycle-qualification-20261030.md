# Current-main WAT MIDI lifecycle qualification: blocked

Historical source last updated, 2026-10-30. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

```text
Compilation failed at stage EMIT: Unknown function '$mm_callback_begin' called in $fire_audio_callback_bound: no such import, builtin, or user function (typo or missing definition?).
```

The extracted production callback function calls this helper at
`src/13-exports.wat:3475`. A second call appears at line 3407. An exact-symbol
search of all 22 pinned inputs found those two calls and no definition. The
fixture extracts callback functions from `src/13-exports.wat`, register helpers
from `src/03-registers.wat` and lookup helpers from `src/10-helpers.wat`, but
does not supply this callback dependency. This is an extracted-fixture closure
failure; it does not establish a defect in the complete canonical module.

Actual outcome: **0 lifecycle cases executed**, compiled module bytes/hash
**unavailable**, API lookup/dispatch **not reached**, callback save/restore
assertions **not reached**. The pre-compilation registration checks do pass:
`midiStreamStop` exists, has one stdcall argument, and its ID equals its table
index. The expected registration is API 4593. Compilation fails before the
first `test()` invocation.

The requested `stop-no-notes` and `wrong-handle` mutation executions were
**not attempted**, because the baseline cannot compile. Neither is claimed
killed or compatible with this revision. `replay.js` supplies environment-setting
entry points to the same unchanged oracle, validates all 22 pins, and does not
modify extraction or assertions. It is retained as a replay control, not as
evidence of mutation rejection. No prior JS-only acceptance group was replayed.
