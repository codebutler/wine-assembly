# Trespasser (demo)

DreamWorks Interactive, 1998. First-person physics adventure, Direct3D
(DirectX 6) or software. Candidate `trespasser-demo`, app `trespasser_demo`,
local only.

## Source and layout

- archive.org `trespasser_201401`, `trespasser.zip` (31,214,964 bytes,
  sha1 5d847447cf84041d35c849757fa2e9ee30b086eb). A ready-to-run tree:
  `demo/trespass.exe`, `demo/SMACKW32.DLL`, `demo/data/` (`Menu.tpa`,
  `Stream.tpa`, `pv.wtd`, menu `.ddf`/`.tga`). Guest `c:\demo`.
- The readme carries no redistribution grant, so `localOnly`, never deployed.
- Imports `MSVCIRT.dll` (old iostreams) besides `MSVCRT.dll`; the real
  `msvcirt.dll` comes from the VC6 redistributable (test/binaries/dlls,
  `SOURCES.md`).

## What it needed

- 6d1aa2e27: `msvcirt.dll` loadable; `LoadLibrary("A3d.dll")` fails as on a
  stock Win98 box (it got image_base, found no `A3dCreate`, freed it and
  called through NULL; with NULL it uses DirectSound); `DDCAPS2_CERTIFIED`
  (else a "Direct Draw NOT certified" box).
- `reservedPageFaults: true` (registry): its memory manager reserves pools
  (16-32 MB each, a 128 MB page pool at 0x0f530000) and commits pages from its
  access-violation handler on first touch. Without the fault, untouched
  reserved pages read as the NULL sentinel: the level's object list (reserved
  at 0x0e350000, 0x186a0 bytes) read zeros and the loop at 0x5deb05 called
  through NULL at batch 4238. Diagnosis: `--dump-vmap` showed 0x0e350000 NOT
  MAPPED; a `--watch-js-only` on it showed unrelated writers, which were all
  writes to other unmapped pages landing on the shared sentinel.
- 17db3fe35: its AV filter commits at the faulting address less 16
  (`VirtualAlloc(0x17530ff0, 0x1000, MEM_COMMIT)`); VirtualAlloc now commits
  every page of an unaligned range (it rounded only the size: 4532 faults,
  then 0xC0000005). And x87 `DC D8` (`fcomp st(0)` alias) at 0x539172.

## Route (headless, `--batch-size=100000`)

Guest 640x480.

| batch | input | result |
|---|---|---|
| ~3800 | - | main menu (Play Demo / Load / Options / Exit) |
| 3810-3835 | move to 310,100 then 310,107; click | level load ("World Initialization", "Level File Copy") |
| ~5000 | - | first level, "Press 'Q' to jump" |
| 6010-6105 | mouse right in 8 px steps | Anne turns |
| 6130-6530 | hold S | walks forward |
| 6600-6700 | hold A | sidesteps |

Holding W (run) straight at the crates in front of the spawn tipped the
camera 90 degrees and left it there -- consistent with Anne falling over in
the game's own physics, not confirmed. Options (310,285) > Controls
(318,236) shows the default keys:

| Move | Key | Hand | Input |
|---|---|---|---|
| Walk forward | S | Rotate arm | Ctrl |
| Run forward | W | Throw | F |
| Walk backwards | X | Use/Fire | Space |
| Sidestep left / right | A / D | Rotate wrist | Shift |
| Jump | Q | Move hand | Left mouse |
| Crouch | Z | Grab/Drop | Right mouse |
| | | Stow/Retrieve | E |

## Open

- The W tip-over (game physics or emulation?) is unconfirmed.
- Not tried on a phone; the touch layout follows the table above.

Evidence: scratch/runs/20261011T2210Z-trespasser-demo-claude1863.

## Browser: the level opens through LZ32

The game opens `data\DEMO.SCN` with `LZOpenFileA` and checks a 0x30-byte
header with `LZRead`. In the browser the file is streamed (lazy), and LZ32's
reads used to fail on a chunk that was not resident yet: `LZRead` returned -1
and the page said "Scene File Invalid." while the CLI (eager files) loaded the
level. 196ea863c makes LZRead/LZOpenFile/LZInit park like ReadFile; the level
now loads in the page (Threads, WebGL). Reproduce the browser's file policy
headless with `--lazy-ranges=5`; diffing the eager and lazy runs' file
accesses (`tres-lazydiff.sh` in the evidence folder) is what found it.
