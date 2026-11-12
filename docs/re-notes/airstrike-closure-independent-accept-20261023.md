# Airstrike authentic closure — independent static acceptance, 2026-10-23

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**ACCEPT, scoped to authentic dependency identity and the unexecuted launch recipe.** No substantive dependency-closure defect was found. This precedes original-game qualification and makes no startup, rendering, gameplay, ABI-execution or runtime-readiness claim. One factual correction to the producer report is required: the exact harness accepts comma-separated `--vfs-include` values as well as repeated flags. Its proposed repeated-flag command is valid.

## Independent binary and ABI findings

Adjacent `review.py` uses a new struct-based PE32 reader, rather than importing the producer's `inspect.py`, `check.py` or cached PE inventory. It reads actual retained image bytes, DOS/COFF/optional headers, section-backed import thunks, export address/name/ordinal arrays and forwarder ranges. All nine images (EXE and eight DLLs) are i386 PE32 and have no delay-import directory. CRT data exports in zero-initialized virtual section tails are legal; the reader handles those separately from raw-backed function addresses.

Actual `libpng1.dll` import thunk order and actual recovered zlib exports agree:

| Ordinal | Function | RVA |
| ---: | --- | --- |
| 10 | deflateReset | 0x1e20 |
| 3 | crc32 | 0x19a0 |
| 7 | deflateInit2_ | 0x1b20 |
| 6 | deflateEnd | 0x22f0 |
| 4 | deflate | 0x1f70 |
| 20 | inflateEnd | 0x5ba0 |
| 22 | inflateInit_ | 0x5d10 |
| 19 | inflate | 0x5d30 |
| 23 | inflateReset | 0x5b50 |

Every required target is in executable raw-backed section bytes and is not a forwarder. The complete 61 populated export name/ordinal pairs equal the historical minizip `zlibvc.def`; its retained text also equals the corresponding member read directly from the retained official zlib 1.1.3 source tarball. The separate MSDOS DEF corroborates the required core ordinals. This proves the historical export map, without pretending a DEF encodes calling conventions, structure packing, allocator ownership or implementation behavior.

The source header defines the `z_stream` fields, allocation/free callbacks, version string and initializer `stream_size` argument. Matching binaries support those historical assumptions; this review has not executed a cdecl call, stack cleanup, structure-size/version check, callback or allocator transfer. Recovered zlib imports 18 CRTDLL names plus three KERNEL32 names. Recognition of CRTDLL as a system DLL establishes the emulator's provider classification, not correctness of its CRT behavior or FILE layout. The nine libpng imports are stream/CRC functions, not gz/minizip FILE APIs; unused extra exports still do not prove their CRT paths safe. Preserve the real bundled MSVCR70 and standing MSVCRT providers. Do not substitute another zlib or infer that three CRT families have interchangeable FILE/heap ownership.

## Recursive closure and exact harness

Independent recursive checking resolves **262 real-PE import-symbol edges** across the nine images, by exact case-sensitive name or ordinal against the actual provider export table. Every imported real-PE export in this set is nonforwarded. Missing non-system DLLs are rejected, rather than silently relabeled system APIs. Remaining system imports have no ordinal imports and fall within the harness's explicit Windows-system set.

The same five absent API-table names recur: KERNEL32.IsDBCSLeadByteEx, WINMM.waveOutGetErrorTextA, WINMM.midiStreamStop, CRTDLL._fdopen and CRTDLL.rewind. They remain possible runtime failures, not proven fatal startup paths. Table presence also proves neither handler completeness nor behavior. No speculative API repair is proposed.

The 81-file VFS manifest independently equals the actual EXE, `airstrikerc` and every original `data/**` file, with exact sizes and hashes: **2,632,138 bytes**. The DLLs are separate explicit providers. `airstrikerc` specifies `datapath "data"`, windowed 800×600, alpha 2, sound 1 and one human player. CWD `C:\` places those original relative paths correctly. This proves coverage of retained executable/assets/providers, not that every runtime filename or dynamically loaded dependency has been observed.

Adjacent `harness.js` runs only small host-side JS, never importing `test/run.js`. It extracts the exact `getArg`/`getArgs` definitions and explicit DLL parsing block from the hash-bound harness, and exercises the actual `lib/vfs-host-files.js` and `VirtualFS` implementations. It proves:

- Repeated `--vfs-include=airstrikerc --vfs-include='data/**/*'` mounts 80 files; automatic EXE seeding makes 81. **`--vfs-include='airstrikerc,data/**/*'` also works**, because `getArgs` splits commas before glob expansion. The producer report's assertion that this form is invalid is incorrect; its launch command needs no change.
- `--dlls` uses the first matching option and comma-splits its value into basename/bytes configurations. The supplied one-option recipe supplies all eight correct provider basenames and reads their real bytes. Explicit mode bypasses autodetection, so omission cannot be repaired by assuming recursive host search. Actual PE loading/DllMain remains unexecuted.
- Source inspection confirms loaded DLLs are mounted before `loadDlls`, arbitrary EXEs are seeded separately, includes are rooted at the host EXE directory, paths mount under C:, and explicit CWD is applied after mounts. Relative data path resolution under C:\ succeeds in the actual host VFS; an absent directory is rejected. Source SHA-256 values equal all four producer `launch-source-identities.json` entries, despite remote main's unrelated advance.

## Rejecting controls and resource limits

`results.json`, `independent-pe.json` and `harness-results.json` retain the checks. Offline negative controls reject missing zlib provider, omitted ordinal 22, incorrect ordinal/name mapping, a missing named JPEG export, an omitted asset, an escaping manifest path and wrong required CWD. Actual host helpers reject absolute, empty and unmatched include patterns and an absent CWD. A wrong CWD that happens to exist is additionally rejected by our Airstrike contract because it changes `data` resolution.

The authentic `recover.py main` was invoked with a mocked opener returning rejecting Content-Length metadata. Its assertion propagated, the response body's read sentinel stayed false, and no download/extraction file existed. No network was called. Its actual byte-limit fixture also rejected before its downstream sentinel. The source retrieval script was inspected: status/Content-Length checks precede body copying, and the byte-copy exception propagates before receipt generation. These establish local checked predecessor behavior, without retroactively repairing any earlier acquisition-wrapper history. No recovery command or acquisition main was run against the network.

During development the independent parser first rejected a legal CRT BSS export; it was corrected to recognize virtual data while preserving required-function executable/raw backing checks. Its first proposed full export evidence exceeded its stricter 128 KiB evidence-write guard and was rejected before writing; evidence was reduced to imports, export counts and the full zlib map, without raising the guard. A local Python ZIP-variable shadowing error was also corrected. Final Python and Node checks pass. These development failures created no downstream acquisition/runtime activity.

Reproduce offline from this evidence directory using `timeout 60s python3 run.py python3 review.py` and, with the recorded admission, `timeout 60s python3 run.py /usr/local/bin/node --max-old-space-size=256 harness.js`. Capture accounting persists; reruns need adequate remaining budget. Existing ignored DLLs/archives remain in their original donors with their existing recovery recipes, locally retained only; this commit does not back them up remotely.

## Remaining original-game qualification

Runtime still must establish actual PE relocation/import binding and DllMain initialization, ordinal calling/stack and z_stream compatibility, CRT allocation/file/callback semantics, dynamic DLL/API lookup, configuration and asset opening, PNG/JPEG decoding, sound/timing/input behavior, and whether any absent API is actually called. Original gameplay still requires observed intro-to-play transition and before/during/after evidence that the human plane responds to held movement controls and fires projectiles. No runtime evidence or result.json is invented here, and no new harness/readiness work is requested.
