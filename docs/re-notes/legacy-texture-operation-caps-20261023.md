# Legacy texture-operation capability correction — 2026-10-23

Demonstrated defect on exact input `5406777ecbcef9cf9b03b40d592d722bb0086de0`:
`d3dim_fill_device_desc7` advertised `0x003FF` at offset 180, claiming ten
texture operations. Both legacy routes implement SELECTARG1, SELECTARG2 and
MODULATE, while the other advertised operations silently modulate. Correct the
mask to `0x0000E`. This changes one production constant and its explanation;
no new combiner operations or other capability fields are implemented.

The Microsoft-owned [legacy d3dcaps.h](https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/d3dcaps.h)
defines these capability bits in operation order. Its D3DPRIMCAPS and
D3DDEVICEDESC7 declarations establish the 236-byte structure, texture-operation
DWORD at 180, and stage-limit WORDs at 184/186. Microsoft's
[operation documentation](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dtextureop)
defines the corresponding behavior; the
[legacy extended-capability documentation](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dhal/ns-d3dhal-_d3dhal_d3dextendedcaps)
confirms that each capability asserts operation support. Checked 2026-10-23.
The older sized D3DDEVICEDESC writer has no texture-operation store and is
unchanged. This is not the D3DPRIMCAPS texture-blend mask.

DISABLE was checked separately. Setting COLOROP=1 does not unbind the texture:
the actual setter stores it, `d3dim_bound_texture_entry` still resolves it,
both software outer triangle dispatches reach the textured raster sink with
operation 1 unchanged, and the actual GPU descriptor/lowering retains an active
texture and emits MODULATE. The software inner combiner also modulates. Thus
the DISABLE bit is removed on direct outer-path evidence. An alpha-only DISABLE
with color enabled is undefined in the documented API; no support claim is
inferred from that case.

The distinguishing operands are texture `0xA0C08040` and diffuse `0x8060A0E0`.
All seven removed operations produce `0x50485038` (red 72), with the GPU lowering
emitting operation 4 for both color and alpha:

| Removed operation | Bit | Required red before quantization/clamping |
| --- | ---: | ---: |
| DISABLE | 0x001 | 96 (diffuse; no stage-0 texture mapping) |
| MODULATE2X | 0x010 | 144.565 |
| MODULATE4X | 0x020 | 255 (clamped) |
| ADD | 0x040 | 255 (clamped) |
| ADDSIGNED | 0x080 | 160.5 |
| ADDSIGNED2X | 0x100 | 255 (clamped) |
| SUBTRACT | 0x200 | 96 |

The retained bits are SELECTARG1=0x2, SELECTARG2=0x4, MODULATE=0x8. Nine
independent RGB/alpha combinations execute the actual production combiner and
actual legacy GPU lowering, checking both operations and TEXTURE/DIFFUSE
arguments. Reversed operands, white identity and zero inputs also execute the
software combiner. Both software outer dispatches are exercised. The GPU draw
uses the actual WAT descriptor and JS lowering; allocation, texture upload and
submission are explicit fixture doubles. Software raster submission is an
explicit recording sink, not a substituted combiner.

Run from this checkout:

```sh
node --max-old-space-size=256 test/test-legacy-texture-operation-caps.js --negative-controls
node --max-old-space-size=256 test/test-d3dim-gpu-batching.js
node --max-old-space-size=256 test/test-d3dim-gpu-points.js
```

All three pass. The exact baseline runs the same distinguishing behavior and
fails specifically at the executed capability writer assertion. Three capability
mutations (restore DISABLE, restore MODULATE2X, drop MODULATE), a software
SELECTARG1 operand mutation and a GPU SELECTARG lowering mutation are rejected.
The complete 236-byte baseline/candidate descriptors differ only at bytes
180/181, with masks 1023/14; all 232 bytes outside that DWORD are identical.

Evidence is adjacent in [legacy-texture-operation-caps-20261023/](legacy-texture-operation-caps-20261023/):
`baseline-results.json`, `candidate-results.json`, `descriptor-comparison.json`,
both `*-excerpt-manifest.json` files and `seals.json`. The manifests bind every
compiler path to exact Git blob, full-file SHA-256 and size, and each production
form to byte offsets, line ranges, byte count and hash. The extraction recipe
keeps forms verbatim and wraps them with explicit fixture imports/globals and
exports. WATX consumes top-level forms. The final assembled source is 32,939
bytes, SHA-256 `f05616f67b30f52efec42aeeeb17f66278af5a59790d9e3045cada42d3c4d48a`;
each compiled variant is 4,380 bytes with one 64 KiB memory page. No full-source
compilation or 512 MiB native guest occurs. Compiler identity and byte-exact
excerpt checks pass before acceptance compilation.

The first focused manifest measured 16 files/1,330,408 bytes. Adding the actual
`fill_primcaps` dependency required a revised measured selection of 17 files/
2,388,036 bytes before that additional checkout. The complete closure includes
the GPU's transitive local imports and all four authentic compiler stages.
The shared clone was `--no-checkout`, with explicit non-cone file patterns
installed before checkout. The donor and installed tools remain standing,
read-only inputs. Installed Node is v24.18.1 at
`/home/user/.nvm/versions/node/v24.18.1/bin/node`, 123,656,816 bytes, SHA-256
`f3432a45b03b2da0d270095fdd8813dc34cbea73f5fc8b18c7a384b7cf9b333a`.

Resource evidence includes `first-admission.json`, `complete-admission.json`,
`expanded-admission.json`, `resource-before-publication.json`,
`prelaunch-baseline.json`, `direct-capture-allowance.json`, and the executable
guard/recovery recipes. The pre-publication projection is 36,334,951 of
67,108,864 NEW bytes, including an 8 MiB private peak, at least 16 MiB future
external growth and 8 MiB reserve; projected host free is 4,479,762,246 bytes.
Standing SQLite is excluded, while every sampled positive SQLite/WAL/SHM growth
is charged cumulatively without shrink credit. Task outputs/session events,
Git/index, copied evidence, guard, and an 8 KiB conservative baseline/board
allowance are charged. The final live receipt remains in
`/tmp/legacy-texture-operation-caps-oct23/final-resource.json` after publication.

All substantive commands retain streaming capture, per-file 24 MiB, process
ownership and cleanup checks. Node uses a 256 MiB heap, 60-second CPU/wall and
fresh MemAvailable >=805,306,368; Python uses a 60-second wall. The actual
32-byte capture rejection control terminated its child, left the sentinel
absent and verified owned-group cleanup. Direct instruction/source/web reads
and receipt reprints have a conservative cumulative 327,680-byte charge, in
addition to actual guarded child output; the combined limit is 524,288 bytes.
No substantive resource-denial retry occurred. The explicit 2 MB selection
estimate failed before the extra checkout; its replacement was an exact
measured closure within unchanged resource limits. Routine fixture corrections
included missing import signatures, WATX API/result shape, a baseline excerpt
path and mutation-receipt preservation. `execution.jsonl` records all actual
guarded argv/exits and bounded output; `unguarded-bootstrap-attempts.json`
records the initial missing Python alias and inspection-helper name collision.
The evidence snapshot has 64 guarded commands, 12 nonzero exits (including
intentional rejection controls/baselines and corrected fixture failures), all
with verified cleanup. Later validation/publication commands are retained in
the live execution log rather than recursively copying that log into itself.

Qualification is limited to source and small fixtures: actual capability writer,
combiner, selected outer dispatch, descriptor and legacy GPU lowering. This is
not full COM, native guest, real WebGL pixel, gameplay, or full-build acceptance.
No runtime access, package installation/download, public deployment, shared
integration, main merge, worker launch or donor/root tracked-file/index/ref
mutation was performed. Original native qualification checkout, fixture09dc,
memory watcher, Shadow Man approval hold and runtime403 holds remain preserved.
No box is assigned (ID/state/expiry N/A); coordinator retains lifecycle ownership.

Publication is only `task/legacy-texture-operation-caps-oct23`, using strict
trusted SSH and no force. Final commit/actual remote SHA are recorded in
`/tmp/legacy-texture-operation-caps-oct23/publication.json` and the root append-only
messageboard. No integration is requested by this worker; coordinator decides
independent acceptance and integration.
