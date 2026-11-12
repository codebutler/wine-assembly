# Enigma: complete explicit providers pass SDL; startup hits output guard

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

One authentic-unpacked diagnostic on 2026-10-24 progressed beyond the earlier
`SDL_getenv` trap, initialized eight native DLLs, created an `SDL_app` window,
and read Lua/configuration and graphics assets. Its first terminal condition
was the required **131,072-byte output guard**, while filesystem logging read
`data/gfx32/fl-concrete.png` (last complete record batch 11689). This is a
harness limit, not an established guest API failure, menu, or gameplay result. There was exactly one guest attempt, no second attempt and no semantic fix.

## Provider correction and readiness

Immutable donor `4285b2bc213da24003a574af45e9d4622d1cfb7c` was verified with
the supplied dedicated identity and strict trusted-known-hosts SSH configuration. The canonical runner's `--dlls` branch replaces automatic `resolveDllGraph`. Automatic discovery also uses the registry's loadability filter; merely
removing `--dlls` would not establish this authentic provider set. We retained
explicit providers and derived a dependency-first list from the sealed normal
import directories, plus required system MSVCRT:

```
msvcrt.dll, zlib1.dll, libpng12-0.dll, SDL.dll,
SDL_image.dll, SDL_mixer.dll, libfreetype-6.dll, SDL_ttf.dll
```

`provider-gate.py` validates the actual filename-bearing `--dlls` paths against
the complete manifest, rehashes their standing source bytes, checks each native
normal-import provider and its position before its consumer, and checks all
527 native import/export bindings. The unchanged accepted PE parser SHA256 is
`f949185c282300ac3463b5524420464f87883b5ab5cb6e833fdf564cf6d83bbf`. Authentic SDL SHA256 is
`66136f9cc7091b7fa59514afe88792e45476926f8415f0080a6401f5f1b6366b`;
`SDL_getenv` resolves to RVA **37536**. A local synthetic full manifest with
SDL's row removed rejects with exit 2 before launch. Its exact compressed
fixture and receipt are retained. The full normal-import graph does not require
preloading `jpeg.dll` or `mikmod.dll`; they were left available in the mount. No optional missing codec was fabricated, downloaded or declared necessary.

The runtime reports all eight DLLs loaded, patches EXE SDL imports to native
DLL #3 at `0x00e8e000`, patches the native dependency edges, and returns EAX=1
from each initial DllMain. Base plus sealed SDL export RVA gives expected native
address `0x00e972a0`; this arithmetic is separate from a live memory observation. The prior `SDL_getenv` unimplemented trap is absent and startup advances to
configuration and image loading. Native SDL was not replaced with a stub.

## Observation and first terminal condition

The accepted narrower API-only trace fallback was selected: retained runner
multi-address tracing uses JS block boundaries, one native breakpoint, and a
string reader without a proven guest-readable mapping predicate. Therefore no
exact EAX/EDX/ECX/[ESP] entry record, bounded validated Lua strings, `[EDI]`
cache observation or exact branch record is claimed for `0x5ab8f0/0x5ab957`. Four supported counters were armed, but the forced stop did not print their
totals; totals remain unknown. The 16-record API cap was reached, so later API
requests are outside the capture. No observed Lua shared-loader request or cache
branch is established; absence from these traces is not proof of no entry hit.

The supported trace includes DDRAW and shfolder requests, SHGetFolderPathA,
TrackMouseEvent, JPEG loading and native JPEG symbol resolutions, then a request
for the already loaded libpng provider. SDL_image's JPEG loader return site is
`0x00ecc8dd`. Native JPEG DllMain returns 1 and later GetProcAddress records
identify module `0x015d3000` and real symbol addresses. The trace's `=> 0` on
the LoadLibraryA line is not classified as terminal failure in the presence of
that continuation. No optional Lua/codec search miss is promoted to fatality.

The raw output ends partway through an FS record at exactly 131072 bytes. The supervisor detected the output guard, sent group TERM, then KILL after its
five-second grace, reaped return -9, and verified no remaining group. Elapsed
supervised wall time was 7.395 seconds. No UNIMPLEMENTED API, runtime crash,
terminal guest message or ExitProcess is established in the retained prefix. The SDL window title and reads of `menu_bg.jpg` do not establish menu rendering. No frame was produced before the batch-30000 capture action; no PNG is claimed.

## Exact inputs, gates and bounds

Canonical runner SHA256:
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`. Historical module SHA256:
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`,
source `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`, ABI291,
layout `9a3bc9149d58209c`. No build or current-module substitution occurred. Authentic unpacked EXE SHA256:
`5885e29ac9c1bdfe7f36e0d7fba76a56b74bc99558e1e6debf8425febe35fa45`,
6287872 bytes. All twenty packed-input/unpacked-output pins were rehashed;
ten outputs total 7828992 bytes. Originals remained unchanged.

The actual canonical parser and VFS helper enumerate/hash all 2460 exact guest
mappings, including the intended comma-bearing names if any. `--vfs-tree` is
used; no per-file comma mount is substituted. Full manifest and mappings were
transported as gzip; only bounded receipts/counts/hashes went through model
output. `tree-validation.json.gz` and `manifest.json.gz` retain exact mappings. An inherited one-provider assertion in the validator rejected the eight parsed
providers before any guest. Only that assertion was corrected to compare all
eight exact canonical-parsed paths. The first rejection is retained; the
configuration itself was unchanged and no guest had been consumed.
