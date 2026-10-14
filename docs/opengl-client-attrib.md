# OpenGL client attribute stack

The Neverwinter Nights demo's ordinary New → Select Premade Character →
Aluvian Darkstar → Prelude loading route stopped at `glPushClientAttrib(2)`
at batch 192852 (call `0x71afb4`, return `0x71afba`). The generic native
encoder now implements client push/pop rather than bypassing that call.

The stack is per context, initially empty, with sixteen frames. The array
group saves all implemented vertex, normal, color and both texture-coordinate
descriptors, enable bits, pointer validity and the active client texture unit.
It restores pointers, not copies of guest array contents. Current color,
normal and texture coordinates belong to server state and are not restored.
The pixel group saves the existing unpack alignment, row length, skipped rows,
skipped pixels and LSB-first modes. Native bitmap state, software texture
alignment and ordered host texture alignment are restored together.

Zero masks occupy a frame without restoring state. Each defined bit selects
its group, so `GL_CLIENT_ALL_ATTRIB_BITS` selects both; otherwise unused bits
select nothing. This follows the bitfield groups in the Khronos
[glPushClientAttrib reference](https://raw.githubusercontent.com/KhronosGroup/OpenGL-Refpages/main/gl2.1/xhtml/glPushClientAttrib.xml),
whose error list contains stack overflow/underflow rather than invalid-mask
errors. Its multitexture note requires all units and the client selector.
Overflow, underflow and calls within Begin/End leave the stack unchanged.
Allocation failure reports out-of-memory. Depth/limit and supported unpack
queries report the native values. Client pushes/pops execute immediately
during display-list compilation and are not recorded. Context deletion/reset
reclaims outstanding frames. Server attribute pop no longer restores the host
client unpack alignment.

This covers the client state already implemented by this renderer. It does
not implement index/edge-flag arrays, buffer objects, additional pack/unpack
parameters, or fix existing image/readback limitations. In particular, bitmap
unpack row/skip/LSB support is broader than texture-upload layout support.
The stack change does not claim those missing operations are implemented.

Validation: canonical full build; `test-opengl-client-attrib.js`, bitmap,
display-list, unpack-alignment, fixed-function, native-encoder and Worker
regressions. The client test compares real native packed vertex payloads after
descriptor restoration, checks pixel upload bytes/alignment, selective and
nested masks, errors, queries, context deletion, pointer validity, server/client
separation and immediate display-list behavior. Logs reside remotely in
`gl-client-work/scratch/client-attrib/`. This API regression alone establishes
neither completed NWN loading nor world rendering/gameplay.

Negative control: removing only the vertex-pointer restoration fails the
actual packed-vertex comparison; source was restored afterward. Candidate
Wasm SHA-256: `79a828167326142433105270a3cd53fe33a3ce934f71116451e8948315b44c93`.
