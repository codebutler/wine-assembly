# Final MIDI native observations: canonical build blocked

Historical source last updated, 2026-10-20. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

Candidate `a33fc31f0e8b5ed46b48bfa435bf4629e36a1bf3` on
`origin/task/midi-stream-lifecycle-oct20` did not pass the mandatory canonical
build on 2026-10-20. Native public API/ABI qualification is **unexecuted**. No original MadBomber launch occurred. No source acceptance, merge, audio,
callback-runtime, or gameplay success is implied.

## Exact failure

On the assigned Linux x86-64 runtime `bx_6czhvg6m`, the command was:

```sh
cd /home/user/midi-native-fullvm
timeout --kill-after=10s 600s bash tools/build.sh
```

The command exited **1**, without a timeout, on the mandatory
`node tools/callback-ownership-census.js` gate (`tools/build.sh:24`). CLAUDE size, WAT manifest, and all 127 fragment balance checks passed first. The complete diagnostic was:

```text
changed producer host.js:host-file (sha256); review its lifetime
changed producer lib/host-audio.js:host-file (sha256); review its lifetime
unknown producer src/13-exports.wat:$fire_audio_callback_bound
unknown producer src/13-exports.wat:$fire_midi_out_callback_bound
changed producer src/13-exports.wat:$fire_wave_out_callback_bound (sha256); review its lifetime
changed producer src/13-exports.wat:$fire_wave_out_callback_bound (writes); review its lifetime
changed producer src/13-exports.wat:$fire_wave_out_callback_bound (boundaryCalls); review its lifetime
changed producer src/13-exports.wat:$fire_wave_out_callback_bound (targets); review its lifetime
```

This is a build prerequisite failure, not a demonstrated runtime MIDI failure. The build stopped before compilation; there is no candidate module hash. The task explicitly forbids bypassing failed gates or production repairs. Consequently no native fixture was created or executed and the original
closure/launch condition was never reached. Two-handle lifecycle/stop/callback
ABI, sibling reset/note isolation, window queue backpressure, and invalid/closed
handle behavior remain unqualified in the full VM. Existing candidate isolated
compiled-handler/host tests do not substitute for those observations.

## Identity and preservation

The candidate branch tip was checked against `git ls-remote`. The isolated
remote source directory contains 6,443 files verified against candidate Git
blob IDs before building and again afterward. This is the prior qualification's
source selection plus candidate changes, not a claim that every repository
asset was staged. Dependencies were reused through a symlink to
`/home/user/winhelp-qualified-fullvm/node_modules`; existing sources and build
outputs were never overwritten. The older `/home/user/callback-native-fullvm`
was read only. The first staging attempt stopped on an unavailable old-tree
note; completing the new task directory from matching newer-tree blobs and
12 exact candidate blobs produced a fully verified source selection before
any build. Both transport receipts are preserved.
