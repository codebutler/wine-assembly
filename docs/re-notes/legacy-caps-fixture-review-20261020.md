# Independent legacy capability fixture review — 2026-10-20

Accepted for integration, with one documentation qualification. Native status
remains **UNEXECUTED**. No production module, runtime, browser, renderer, game,
full build, or additional worker was run.

Reviewed source: `b7500149f3c5ea9e2322a12928e9c79807670c4d`,
`origin/task/legacy-caps-native-fixture-oct20`. Fresh sparse task branch
`task/legacy-caps-fixture-review-oct20` starts from fetched main
`1262cbfcf8b5881543f2fb18c0f80b4bd9429306`. The executable test is byte-for-byte
unchanged from the source branch. Only the companion note's cancellation claim
is qualified, plus this review note. No source production changes.

Public ABI review used Wine's public
[d3d.h](https://raw.githubusercontent.com/wine-mirror/wine/master/include/d3d.h),
[d3dcaps.h](https://raw.githubusercontent.com/wine-mirror/wine/master/include/d3dcaps.h),
and [ddraw.h](https://raw.githubusercontent.com/wine-mirror/wine/master/include/ddraw.h).
Downloaded header bytes and hashes are retained in the evidence; replay does
not depend on future contents of those URLs.

- Parsed public interface order independently: CreateSurface 6,
  SetCooperativeLevel 20, D3D2 CreateDevice 8; Device1 GetCaps 4,
  Device2/3/7 GetCaps 3; D3D1 EnumDevices 4 and D3D2/3/7 EnumDevices 3.
  QueryInterface/Release use 0/2. All eight embedded requested GUIDs match.
- Parsed x86 layouts from header declarations: D3DPRIMCAPS 56 bytes;
  legacy descriptor 252 with historical boundaries 172/204; fixed descriptor7
  236. Primitive offsets are 44/100 versus 4/60; texture/filter/address
  fields are primitive offsets 32/36/44; descriptor7 texture ops is 180.
  DDSURFACEDESC108 uses pixel format at 72 and caps at 104.
- Decoded every mainline call instruction independently: right-to-left pushes,
  this pointer, actual indirect slot, immediate EAX/ESP recording, failure
  branch to RET. Decoded all four callbacks, including live-buffer REP MOVSB,
  argument offsets after saved EBP, CONTINUE/CANCEL branches, saved ESI/EDI/EBP
  and ret24/ret16. EBX is untouched. No synthetic API result is executed.
- Checked pinned main's enumeration dispatch and descriptor builders:
  legacy lists Ramp/RGB/HAL or RGB/HAL, with 252-byte HW and HEL storage;
  D3D7 lists HAL then RGB. The fixture copies the HAL callback's HW and HEL
  descriptors. Legacy CANCEL occurs at the final element and does not
  independently prove early cancellation; D3D7 does. The companion note now
  states this limitation.
- Independently enumerated all 45 captures: 36 legacy GetCaps descriptors
  (three interfaces × three sizes × two sides × two alignments), two fixed
  GetCaps descriptors, six legacy enumeration copies, one fixed enumeration
  copy. Forty-seven actual CALL sites and four callback bodies were decoded.

The offline oracle is strict about this project's existing masks, including
retained historical/reserved bits; those exact masks are regression contracts,
not universal Windows capability requirements. Public definitions confirm
CUBEMAP 0x800 versus PROJECTED 0x400, legacy mip bits 0x3c, DX7 mip bits
0x30000, and address BORDER 8. The review's byte-addressed synthetic vector
uses independently parsed field offsets and bit-mask construction, not the
fixture's synthetic Map. Every bit in both primitives' size/texture/filter/
address words is independently flipped and rejected, including DX7 high mip
bits and required high point/linear bits. Texture-op words, call ESP/results,
null public outputs, canaries, callback count/context and completion are also
mutated. Untouched PE data is rejected. These remain oracle tests only.

Evidence: `scratch/runs/20261020-legacy-caps-fixture-review/`.
`review.js` is the independent decoder/layout/oracle check; `review.json`
contains its exact counts and coverage matrix. Original offline tests,
deterministic PE regeneration, original snapshot recovery, syntax and scoped
diff checks pass. `snapshot/` and `SHA256SUMS.json` retain the reviewed test,
PE generator, header identities and offline evidence. Replay:

```sh
node scratch/runs/20261020-legacy-caps-fixture-review/review.js
node scratch/runs/20261020-legacy-caps-fixture-review/snapshot/test/test-legacy-texture-caps-native.js --offline
```

The result receipt records integration commits, exact remote refs, disk reserve
and artifact hashes. Source branch/evidence are preserved. Actual public COM
execution, production callback behavior and native ABI qualification still need
the coordinator's separately assigned serialized runtime task. This review
makes no renderer, sampling, gameplay or backend-parity claim.
