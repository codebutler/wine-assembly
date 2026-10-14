# Soldier of Fortune demo (`sof_demo`)

Raven Software / Activision, January 2000. Quake II engine, OpenGL through
`ref_gl.dll`. Candidate `soldier-of-fortune-demo` (archive.org
`SoldierOfFortuneDemo`, `sof.exe`, SHA-1 `ebb946d7…2395`).

**Licence:** the setup's `License.txt` (inside `_user1.cab`) is Activision's
software licence: personal use, no copying or distribution, **no reverse
engineering, decompiling or disassembly**. Local only, never deployed, and
investigated with runtime traces only -- nothing below comes from reading the
game's code.

## Install layout

`sof.exe` is a WinZip SFX holding an InstallShield 5 set. `data1.cab` is a
ready install tree (`SoF.exe`, `ref_gl.dll`, `base\gamex86.dll`,
`base\player.dll`, `base\pak0.pak` 140 MB); the manifest unpacks it with
`tools/is5-extract.js`. `tools/is-cab.js` also reads it since it learned the
version-5 descriptor layout (data offset at 0x26, MD5 at 0x2a).

## Runtime facts

- `defsnd.dll` (the sound driver, LoadLibrary'd at boot) **imports 20
  functions from `SoF.exe`**. The LoadLibrary dependency walk now counts the
  EXE as loaded (`loadedModuleNames()` includes its export name); before, it
  mapped a second copy of the EXE as a DLL and the game crashed at batch 60.
- `ref_gl` calls `glIsTexture` during the level load and draws its lightmap
  pass with `glMultiTexCoord2fvARB` (asked for by `wglGetProcAddress`, after
  `glClientActiveTextureARB`, `glActiveTextureARB`); both are GPU ops 116/117.
- Default keys (`base\pak0.pak` `default_keys.cfg`): arrows forward/back,
  left/right TURN, `,`/`.` strafe, MOUSE1 attack, `d` or `/` jump, `c` crouch,
  SPACE use, `o` next weapon. The touch layout uses exactly these.

## Route

`+map tsr1` (appended to the registry args) loads the first demo map. The
level opens with an in-engine intro (an alley seen from above, then the subway
hostage scene with subtitles); control starts in a tiled subway corridor.

- CLI: `node test/run.js --app=sof_demo --gl-renderer=software
  --batch-size=50000 --args="+set vid_ref gl +set gl_driver opengl32 +set
  cl_timeout 100000 +set timeout 100000 +map tsr1"` -- intro from ~batch
  7500, first person by ~batch 21000; holding Up (vk 38) walks forward.
- Browser (phone emulation, `--gpu --touch`): first person ~5 minutes after
  launch.

Demo maps in `pak0.pak`: `tsr1`, `tsr2` (the mission), `tut1`, `trn1`,
`dm/nycdm1`, `dm/nycdm2`.
