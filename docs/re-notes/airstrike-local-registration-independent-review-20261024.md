# Airstrike original local registration: independent rejection — 2026-10-24

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

The generic loader behavior is inherited from accepted main
`9b263cea5801886d43b6e818f0b415645bb32a50`, rather than introduced by this
producer. Nevertheless, this new registration depends on that loader and does
not connect its strict standalone verifier to normal loading. This finding
concerns the requested integrity boundary for this route; it does not claim
an observed external attack or an executed guest load.

## Concrete reproduction

The retained filesystem-only harness prepares a genuine pinned 89-file
fixture, extracts `getAssetFiles` byte-for-byte from the producer's actual
`test/run.js`, and calls it with the real `mergeLocalManifestFiles` from
`lib/app-files.js`. It modifies only the temporary fixture's manifest.

1. Change one companion URL to `../outside-fixture.dll` with guest path
   `c:\outside.dll`. `verify(fixture)` rejects the mapping, but the ordinary
   resolver returns the URL resolved outside the fixture directory.
2. Keep a valid `game/SDL.dll` URL but change its guest mapping to
   `c:\unvalidated\replacement.dll`. The verifier rejects it; the ordinary
   resolver returns the changed guest mapping.

The resolver checks schema version and the files array, then joins each URL
to the manifest directory and merges the rows. It does not invoke the
Airstrike verifier or compare the 88 pinned mappings. The browser loader's
corresponding block similarly resolves each supplied URL with `new URL` and
merges it; this was inspected as source only, with no browser execution. The standalone test exercises the manifest writer and verifier, so its
rejection controls do not establish that normal loading enforces the pins.

No file outside the fixture was opened by the reproduction. No emulator,
browser, guest, WebAssembly compilation or instantiation was run. The harness
returns success when it reproduces the rejection-worthy behavior, not when
the implementation satisfies acceptance. Its raw result records both cases.

From this repository, reproduce against the retained immutable producer:

```sh
timeout 60s node --max-old-space-size=256 \
  docs/re-notes/airstrike-local-registration-independent-review-20261024/reproduce-manifest-gap.js \
  scratch/runs/<run-id>/repo \
  scratch/runs/<run-id>/airstrike-local-registration-independent-integrate-oct24 \
  scratch/runs/<run-id>/airstrike-pre6a \
  scratch/runs/<run-id>/zlib.dll \
  /home/user/wine-assembly/test/binaries/dlls/msvcrt.dll
```

## Passing checks retained separately

An independent comparison against the Git blob on immutable main `9b263cea`
confirmed the producer's game pins exactly match the `game/` subset of the
accepted 261-file / 17,345,286-byte runtime manifest. Every one of the 89 real
source inputs was independently hashed: 4,072,418 bytes total, 81 original
non-DLL files plus eight authentic DLLs (six bundled, standing MSVCRT and
legacy zlib). No circular dependency on the producer's expected hashes was
used for the reference comparison. All 14 producer evidence seals passed.

The passing tests cover selector membership, absence from desktop/debug
lists, `localOnly: true`, empty acquisition packages, original executable
`C:\airstrike-pre6a.exe`, cwd `C:\`, empty arguments, eight DLL seeds,
the real CLI VFS closure and 88 exact generated companion mappings. These
checks do not override the ordinary-loader failure above. Further preparation
failure controls and acceptance/integration stopped at this substantive gap.
