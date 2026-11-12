# Enigma unpacked diagnostic: explicit provider set stops at SDL_getenv

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

One diagnostic attempt on 2026-10-24 reached **`sdl.dll!SDL_getenv`** and trapped
at batch 18, before any observed Lua shared-loader request. The runner exited 1
after 0.2233 seconds. This is the first observed failure of the **configured
runner**, not original packed startup acceptance, gameplay acceptance, or proof
that SDL_getenv needs a new implementation.

The exact command explicitly set `--dlls=.../system/msvcrt.dll` only. Canonical
runner lines 5588–5602 choose that explicit list instead of the automatic import
graph. Although all SDL diagnostic files were present in the mounted tree,
`SDL.dll` was not preloaded as a native provider. The log confirms only MSVCRT
was loaded. This configuration limitation caused an imported SDL function to
reach the built-in unimplemented path. No second attempt, provider change,
dependency download, native build, or semantic patch was made.

## Terminal and native binding

The retained terminal reports `UNIMPLEMENTED API: SDL_getenv`, EIP `0x5de8e0`,
ESP `0x074ffdfc`, and caller return `0x5de2a6`. Native thunk bytes
`ff 25 bc f7 9e 00` resolve through IAT `0x9ef7bc`; the unchanged sealed parser
maps it to `sdl.dll!SDL_getenv`. Its argument points to `0x95b70a`, whose sealed
native bytes spell `SDL_STDIO_REDIRECT`. The unpacked SDL image exports that
symbol at RVA 37536. This static string is identified separately from a live
guest string read. `static-failure.json` records the exact byte-backed binding.

Two supported API trace requests were emitted: MSVCRT requested
`GetProcAddress(...,"IsProcessorFeaturePresent")`, returning `0x00b53634`, and
Enigma requested `LoadLibraryA("DDRAW.DLL")`, returning nonzero handle
`0x00b67c6c` at return `0x5de288`. A nonzero handle does not prove a native
DDRAW module was loaded. Neither event is the Lua package-loader entry.

The retained runner uses one `set_bp` address and JS block boundaries for
multiple trace addresses; its generic string reader lacks a proven valid guest
mapping check. The authorized narrower API-trace fallback was selected before
launch. No exact entry/register/NUL-string/cache record for `0x5ab8f0` or
`0x5ab957` exists. Requested block counters were armed, but the crash path did
not print their totals; counts remain unknown. No concrete Lua DLL, symbol,
caller or cache branch is established. No frame was emitted before the crash. Optional codecs and conditional `loadall.dll` remain necessity-unknown.

## Immutable inputs and exact mount

Donor HEAD `763c9f6bca47fd555b675aaa400e477307318af0` was verified with the
provided dedicated identity and trusted-known-hosts SSH configuration. The
canonical runner SHA256 is
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`. Historical module SHA256 is
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`,
source `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`, ABI 291,
layout `9a3bc9149d58209c`; it was copied from the standing manifest and rehashed,
without compilation or substitution. EXE SHA256 is
`5885e29ac9c1bdfe7f36e0d7fba76a56b74bc99558e1e6debf8425febe35fa45`. All twenty packed-input/unpacked-output pins were rehashed; ten diagnostic
outputs total 7,828,992 bytes. Original assets stayed unchanged.

## Gates, resource limits and evidence qualification

Preflight passed as ordinary UID 1000 with Node v24.22.1, pinned pngjs 7.0.0,
actual runner dependency-preamble resolution, 28 font files, pixel-preserving
PNG encode/decode and two rejecting PNG controls. The trace-only preload seals
the canonical runner and bounds API requests to 16; its changed-source rejection
and 40-request/16-record limit fixture passed. It changes diagnostic recording
only. Supervisor descendant TERM/KILL/reap and output-guard controls passed.

## Cleanup and recovery

All exact executed helpers, command, terminal, API trace, gates, static binding,
seals and compressed manifests are beside this note. Raw task evidence remains
under `enigma-diagnostic-loader-startup-oct24`; use gzip decompression to
recover manifests and their exact standing source paths. Retained setup/stage/
gate/launch scripts document the route, not authorization for another guest. Root tracked files/index/refs, donors and original assets were read-only;
coordination writes were append-only. No workers were launched and no main merge
or public deployment was performed.
