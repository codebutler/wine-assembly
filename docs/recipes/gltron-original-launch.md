# Original GLTron 0.70 Win32 local registration

`APPS.gltron` resolves the genuine `gltron.exe`, all original bundled DLLs,
and the complete 92-file installed payload (4,968,893 bytes). It uses
`binaries/gltron-0.70/` for host URLs and preserves directories under guest
`c:\games\gltron`; both hosts use that directory as the initial working
directory and `c:\games\gltron\gltron.exe` as the executable guest path.
Every companion is required and eager. This is a local candidate; it is not
added to the public desktop. Registration is not gameplay acceptance.

The file sizes and SHA-256 digests in `lib/apps.js` come from the accepted
original inventory, SHA-256
`0f5c45647ac8d26104d01d4e052913382aaa9d73a3c6bc31339529a60508b341`.
Original installer `gltron-0.70-win32.exe`: 3,658,814 bytes, SHA-256
`8956abae4e4fe6ebc45b97d58c9254789e0a1457d11c58e4dbb90aead45a3eb3`.
Original-media static acceptance is reused from commit
`8bc6438387926c771333d9f17996783eea3bce78`; no installer or recovery wrapper
is executed by this recipe.

Use an isolated local checkout with an absent destination and an already
extracted original `app/` directory. The retained host source for this task is
`/home/user/wine-assembly/scratch/usage-watch/gltron-original-win32-recovery-oct28/payload/extracted/app`.
Run from that isolated checkout:

```sh
node tools/stage-gltron-original.js /absolute/path/to/extracted/app "$PWD/binaries/gltron-0.70"
```

The command verifies every source file before creating the destination, copies
only the installed inventory, and verifies each output. It refuses existing
destinations, overlapping trees, source escapes and destination symlinks.
Missing or corrupt input fails; it never invents substitute files. Original
media stays read-only. Do not stage into a shared checkout or commit binaries.
The destination URL layout is the same one consumed by `--app=gltron` and by
the local browser's registered-app picker. Runtime execution requires a
separate authorized acceptance task; no browser, game, native executable or
WASM runtime is started here.

The default source test is media-independent:

```sh
node test/test-gltron-original-registration.js
```

For retained-media acceptance, pass the original extracted app directory, an
absent task-owned destination and accepted `inventory.json`:

```sh
node test/test-gltron-original-registration.js /absolute/path/to/extracted/app /absolute/task-owned/stage /absolute/path/to/inventory.json
```

This evaluates the full pinned production `host.js` unchanged in a Node VM
context and calls its actual `WineAssembly.loadFiles` method with the actual
`VirtualFS` and shared lazy-file policy. Only the asset-byte transport reads
local staged files. It first requires missing-payload rejection, then checks
all mounted sizes/hashes and the working directory. It rejects missing and
corrupt executable, DLL and Lua assets before destination creation, plus
existing/overlapping destinations. It never constructs a WineAssembly runtime.
The headless runner's registry fields were inspected; guest execution was not
tested. Independent acceptance is required before main integration.
