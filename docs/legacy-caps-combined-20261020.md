# Combined legacy D3D advertised capability corrections

Reviewed against fetched main `7ddcd0572b132759c9122c80492e9f9c161a047a`.
Combines cube `f856627b8d6ff022c4713aabb60ea7083ed9f0fc`,
BORDER `0a63482c363082c95e825b34161f42134831a3a4`, and FILTER
`b7306d49f3b68ff2fb33da978bd03e91888c1d6b` plus its test cleanup
`0c20d05b6b2c81a25e2660a2e40190792bf90722`.

Only three production values in `fill_primcaps` change:

| Field offset | Before | Combined | Removed capability |
| --- | --- | --- | --- |
| 32 | `0xFFDF` | `0xF7DF` | CUBEMAP `0x0800` |
| 36 | `0xFF` | `0xFB` | MIPNEAREST `0x04` |
| 44 | `0xFF` | `0xF7` | BORDER `0x08` |

Independent review checked the
[SDK constants](https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/d3dcaps.h)
and [D3DPRIMCAPS semantics](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dcaps/ns-d3dcaps-_d3dprimcaps)
against the current source paths. CUBEMAP promises cube texture resources;
Surface4/7 CreateSurface rejects extended storage caps before allocation.
PROJECTED is a separate bit and stays unchanged. BORDER requires border-color
sampling; `d3dim_address_texel` handles modes 2/3 explicitly and falls through
to wrap for mode 4, while `lib/d3dim-gpu.js` maps mode 4 to clamp. MIPNEAREST
requires selecting an appropriate mip level; the software filter paths choose
point/linear sampling of one image and GPU sampler lowering sets `mip: 0`.
The filter enumeration value 3 is distinct from capability bit 4.

All legacy HAL/HEL descriptor builders and GetCaps 1/2/3 share the primitive
caps. D3D7 also uses that helper, then adds `0x03000300` filter flags, so its
combined filter mask is `0x030003FB`. Enumeration builder wiring is checked.
No renderer code or resource admission behavior changes.

The three dedicated extracted-source suites now require the combined exact
primitive masks; permissive pre/post-integration alternatives and no-op
"pending composition" checks were removed. The cube and BORDER suites'
D3D7 filter expectations were corrected. The existing
`test-d3d-device-enumeration-lifetime.js` callback filter expectations were
also updated to `0xFB` / `0x030003FB`; its full-VM execution remains pending.

Validation:

- `node test/test-legacy-cube-caps-contract.js`: 115 checks, four mutation controls.
- `node test/test-legacy-texture-remaining-caps.js`: 90 address fields,
  72 software address cases, GPU lowering, six negative controls.
- `node test/test-legacy-texture-filter-caps.js`: 90 filter fields,
  36 software/GPU lowering cases, point/bilinear footprints, six negative controls.
- Each suite against the fetched-main `09a8` source fails specifically on its
  unsupported capability advertisement. All four changed JS tests pass syntax
  checks. Production diff is limited to the three advertised masks and comments.

Self-contained evidence and replay:
`scratch/runs/20261020-legacy-caps-combined/` contains source/compiler snapshots,
baseline, logs, patch, hashes, receipt, and `replay.py`.

These are extracted-source tests with synthetic memory/registers and explicit
fixtures, not full-VM, public COM, callback lifetime, allocation, GPU rendering
or game qualification. Full-VM/render qualification remains pending.
Other mip, reserved and operation bits remain unchanged and unqualified.
The original single-fix documents describe their historical branch states;
this document supersedes their pending-composition instructions.
No runtime/build/browser/box actions, shared ledger changes or laptop work
changes belong to this integration.
