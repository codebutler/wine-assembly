# Kingpin: Life of Crime Demo (Xatrix / Interplay, 1999)

App `kingpin_demo` (candidate `kingpin-demo`, localOnly), alpha demo v0.22n.
Quake II engine: `kingpin.exe` imports only system DLLs; `ref_gl.dll` (or
`3dfxgl.dll` as the GL driver) and `main/gamex86.dll` load at runtime; the
data is `main/Pak0.pak` plus loose `main/` files. Registered 8373af6cd.

**The readme licence forbids decompiling or disassembly**: debug it from
traces and runtime behaviour only.

## Source and licence

The archive.org item `win-98-games-k-o.-7z` is one 5.9 GB 7z, but the
download service serves single members of it:
`.../Win98_Games-K-O.7z/Kingpin-DEMO-OpenGL.EXE` (110023168 bytes, SHA-1
`551cd726…`), a collector's WinZip self-extractor of the demo tree that
`7z x` opens. `readme.txt`: personal noncommercial home use only; no
copying, distribution, decompiling or disassembly. Hence localOnly.

## Running

- Args `+set vid_ref gl +set gl_driver opengl32`: ref_gl through opengl32.
  On the CLI GL needs `--headless-gl` (or `--gl-renderer=software`).
- **Slow first-level load and the loopback timeouts.** After GAME → EASY
  the LOADING plaque stays up from about b500 to b3000 at the 200 ms/batch
  headless clock, with almost no API calls (CPU in ref_gl/gamex86). That is
  more than Quake II's 120 s `cl_timeout`/`timeout`: the console shows
  "Loading plaque timed out", "Can't find pic: net" (the lag icon) and then
  "Server connection timed out", and Escape lands in the main menu. Either
  `--tick-ms-per-batch=20` or `+set cl_timeout 100000 +set timeout 100000`
  gets into the level; the registry uses the cvars, since they also apply in
  the browser. The real fix is a faster load: worth a profile.
- The intro cut-scene runs to about b6000, then first person in the alley.

## Route (headless, `--batch-size=50000`)

Enter at 300/400/500 (GAME → EASY), space at 5000, Up from 6200 walks into
the wall ahead, Right at 6550 turns toward a corrugated-metal shed. Evidence:
`scratch/runs/20261011T0800Z-kingpin_demo-gameplay-claude1863`.

Not looked at: the browser, combat, sound, why the level load is so slow.
