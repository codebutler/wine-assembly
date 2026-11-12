# Maelstrom 3.0.6: original Win32 acquisition and static closure

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

The authentic historical Windows distribution is retained and its packaged dependency/data closure passes. This is a static prerequisite for a later coordinator-assigned runtime task. No PE was executed, no emulator compiled, no browser or box used, no registry entry added, and no gameplay claim made.

## Original bytes and provenance

The [author's historical binary page](https://slouken.libsdl.org/projects/Maelstrom/binary.html) explicitly lists **Maelstrom 3.0.6 for Windows 95/98/ME/NT/XP/Vista** and links the recovered archive. The [historical main page](https://slouken.libsdl.org/projects/Maelstrom/) identifies Sam Lantinga and SDL/SDL_net. Current GitHub releases and the current libsdl release directory list modern 4.x builds; none were acquired or substituted.

These are direct author-hosted HTTPS acquisitions, locally digest-pinned. No publisher signature or independently published digest was found; the recorded digests identify the bytes recovered, rather than asserting signed provenance. The source archive was inspected selectively and never compiled.

Private retained originals, **not Git-backed**:

```
scratch/runs/<run-id>/Maelstrom-3.0.6-Windows.zip
scratch/runs/<run-id>/Maelstrom-3.0.6.tar.gz
scratch/runs/<run-id>/Maelstrom-3.0.6
```

The archive expands to **2794170 bytes**, 48 files, under `Maelstrom-3.0.6/`. Compressed plus extracted overlap is **3700390 bytes**, admitted before extraction. The manifest (historical artifact: `maelstrom-original-win32-20261024/manifest.json`) records every archive entry and every extracted file's size and SHA-256. Retrieval receipts (historical artifact: `maelstrom-original-win32-20261024/retrieval-receipts.json`) retain requested/final URLs, HTTP headers, bounded sizes and hashes.

## PE and recursive packaged DLL closure

All three modules are original i386 (`0x014c`), PE32 (`0x010b`). The EXE is a GUI subsystem image linked with MSVC 6, timestamp **2002-10-21 16:24:09 UTC**, with relocation directory absent.

| Module | Bytes | Image base | Entry RVA / VA | SHA-256 |
|---|---:|---|---|---|
| Maelstrom.exe | 135168 | `0x00400000` | `0x17474` / `0x00417474` | `0eca5703e512d33c5e5a0bc1a27f14bd3aa4ecddded6e09b4d4019c2f27a15e5` |
| SDL.dll | 225280 | `0x10000000` | `0x298df` / `0x100298df` | `02433232425e68009843bd3ecec20ad67453a48487f7b5828c595b76e2f9d373` |
| SDL_net.dll | 24576 | `0x10000000` | `0x1e4f` / `0x10001e4f` | `46ccbb7e5982e2c15421af7dd4fa29b26841d9731c31a86cf9554c90be53af95` |

The shared preferred DLL base requires normal PE DLL relocation. The checker traverses imports from the EXE recursively. Its 41 SDL imports and 16 SDL_net imports, plus SDL_net's one SDL import (`SDL_SetError`), all bind to actual named exports: **58 packaged symbol bindings**. Named and ordinal export aliases are inventoried; forwarders are resolved recursively or rejected. These originals have no forwarded exports or delay imports. Hashes and complete parsed PE observations are pinned, not merely DLL filenames.

An independent installed GNU `objdump -p` check agrees on i386 format, all entry RVAs, module import ordering, and the 177 SDL / 33 SDL_net named exports; independent-pe.json (historical artifact: `maelstrom-original-win32-20261024/independent-pe.json`) records output hashes. Full bounded output remains private, including SDL's relocation inventory.

The explicit external Windows system boundary is:

| DLL | Distinct imported symbols across the closure |
|---|---:|
| KERNEL32.dll | 23 |
| USER32.dll | 57 |
| GDI32.dll | 21 |
| WINMM.dll | 16 |
| WSOCK32.dll | 21 |
| MSVCRT.dll | 64 |

All 202 names and each module's imports are in the manifest. The static check does **not** establish their emulator implementation or behavior. No non-system DLL artifact is missing. The original SDL binary also contains `DSOUND.DLL`, `DDRAW.DLL`, `DINPUT.DLL`, and `OPENGL32.DLL` loader-name strings, inventoried with exact offsets in dynamic-dll-strings.json (historical artifact: `maelstrom-original-win32-20261024/dynamic-dll-strings.json`). These are potential backend requirements, not a complete dynamic call graph. A runtime task must observe selected video/audio/input backends and any actual dynamic loads.

## Assets and exact launch/data mapping

Map the entire original directory to **`C:\maelstrom`**, preserving names and the `Images` and `Docs` subdirectories. Use:

```
executable: C:\maelstrom\Maelstrom.exe
working directory: C:\maelstrom
command line: Maelstrom.exe
environment: MAELSTROM_LIB=. ; HOME=.
DLLs: original SDL.dll and SDL_net.dll beside Maelstrom.exe
```

The default source path requests a 640x480 SDL software surface and no fullscreen flag. Do not use `-netscores`, `-player` or `-server` for the initial single-player qualification. `P` is the source-defined main-menu start action; consumption and gameplay still need runtime evidence.

`LibPath` uses `MAELSTROM_LIB`, with the Win32 default `.`. `Open_MacRes` tries literal resource names and then substitutes spaces with underscores. Therefore keep the packaged **`Maelstrom_Fonts`**, **`Maelstrom_Sounds`**, and **`Maelstrom_Sprites`** filenames unchanged; do not fabricate renamed files. Their raw Mac resource forks validate and contain:

- Fonts: 3 FOND, 2 sfnt, 12 NFNT resources.
- Sounds: 35 `snd ` and 2 vers resources.
- Sprites: 117 ics8, 116 `ics#`, 523 `ICN#`, 523 icl8, 2 vers, 1 PICT resources.

The manifest enumerates every resource ID and all **26** `Images/*.bmp`/`*.cicn` containers with validated dimensions. `icon.bmp` and `Maelstrom-Scores` are also retained. Scores write through `MAELSTROM_LIB`; controls use `HOME/.Maelstrom-data`, falling back to the current directory. The absent `.Maelstrom-data` is deliberate initial state, generated by the game. Future runtime writes need a writable guest filesystem and should be retained separately from the pristine closure used by the verifier.

Source path proof (historical artifact: `maelstrom-original-win32-20261024/source-path-proof.json`) binds exact selected source-member hashes, byte-exact line excerpts, resource opening, path selection and initialization. Source/data comparison (historical artifact: `maelstrom-original-win32-20261024/source-data-binding.json`) finds 29 of 30 comparable assets identical; the source archive's `Images/Maelstrom_Titles#999.bmp` differs. The checker pins the **Windows ZIP's** original splash bitmap and never replaces it from source. No assertion is made that the currently hosted source reproduces the original EXE.

## Reproduction and checks

```sh
ulimit -t 60
PYTHONDONTWRITEBYTECODE=1 timeout 60 python3 tools/maelstrom-recover.py scratch/runs/<run-id>/maelstrom-recovery-new
```

To inspect retained bytes without network or extraction:

```sh
PYTHONDONTWRITEBYTECODE=1 timeout 60 python3 tools/maelstrom-closure.py \
  --archive scratch/runs/<run-id>/Maelstrom-3.0.6-Windows.zip \
  --root scratch/runs/<run-id>/Maelstrom-3.0.6
```

The explicit extraction command is `python3 tools/maelstrom-closure.py --archive ARCHIVE --extract-to NEW_DIRECTORY`. It refuses an existing destination, validates all paths/symlink attributes, verifies compressed bytes and the declared expanded inventory before extraction, and then validates every extracted hash, PE binding and resource container.

```sh
PYTHONDONTWRITEBYTECODE=1 timeout 60 python3 test/test-maelstrom-original-closure.py \
  --archive scratch/runs/<run-id>/Maelstrom-3.0.6-Windows.zip \
  --root scratch/runs/<run-id>/Maelstrom-3.0.6 \
  --receipt scratch/runs/<run-id>/maelstrom-test-receipt.json
```

**24 checks PASS** in tests.json (historical artifact: `maelstrom-original-win32-20261024/tests.json`): pristine closure, fresh extraction, existing-destination rejection, missing EXE/both DLLs/all three core resources/title bitmap/license, changed EXE/both DLLs/sprite/CICN/archive bytes, wrapper rejection propagation, missing recursive DLL/export/forwarder targets, malformed PE, and final restored original hashes. Actual files are temporarily removed or changed and restored in `finally`; no replacement game bytes remain. A separate `maelstrom-recover.py --guard-only NEW_DIRECTORY` check passed for the final recovery entry point.

Remaining work belongs to a new coordinator assignment: provide the six system-DLL API surfaces and any observed SDL backend dependencies, relocate/map original DLLs, map all assets with writable score/config paths, and demonstrate menu-to-play, input, rendering and sound on an assigned runtime. No runtime box was assigned; lifecycle is **N/A** and shutdown remains coordinator-owned.
