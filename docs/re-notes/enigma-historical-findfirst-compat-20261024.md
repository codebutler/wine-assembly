# Historical Enigma FindFirst compatibility (2026-10-24)

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

`tools/enigma-findfirst-compat.cjs` applies the independently accepted main
matcher to the exact retained historical filesystem during CommonJS compilation. It reads the matcher span from the hash-verified `lib/filesystem.js` beside the
adapter. There is no second matcher implementation or source fallback. The
complete transformed filesystem must equal the accepted source hash, proving
every byte outside that replacement remains unchanged. Original files stay intact. Ordinary import without its environment variable does not install the adapter. Explicit preload without an absolute runner root fails closed.

Inputs are recovered by named read-only `git show` from immutable donor
`repo`, HEAD
`f879fd0cd81d918ea54a18b1b222fae25dd6d618`. Historical revision is
`d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e`:

The adjacent evidence includes complete compressed historical sources and exact
historical `mem-utils.js`, `region-map.generated.js`, and `byte-provider.js`. These are actual transitive VFS dependencies, not substitute implementations. `source-identities.json` binds every retained file to its Git revision and hash. No runner execution or WASM/native instantiation is needed to test the VFS.

## Validation and composition

```sh
timeout 60 node --max-old-space-size=256 test/test-enigma-findfirst-compat.js
```

The focused test decompresses the actual retained sources into a temporary tree,
loads the adapted historical exported VirtualFS through the real preload, and
runs the unchanged accepted `test-vfs-findfirst-literals.js`. This checks literal
punctuation, near misses, wildcard operators, case, slash/relative paths, roots,
dot records and metadata-only enumeration. An additional real-VFS check verifies
size123, archive attribute0x20 and creation-time metadata without reading bytes. The complete adapted source equals accepted main byte for byte.

The unchanged regression rejects the historical baseline with the leading-plus
SyntaxError and rejects a real adapted-source end-anchor deletion with an
assertion failure. Wrong runner/filesystem/accepted identities, missing/duplicate
matcher anchors and reversed anchor order are rejected. Ordinary disabled import
leaves the compiler hook unchanged. The existing filename classifier places this
test in unit; no central tier edit or global census is required.

**Supported preload order: FindFirst first, quietFS second.** The real VFS
regression passes in that order. A compiler-boundary test also captures the
entire transformed historical runner and confirms it equals quietFS's own
transformation, while the filesystem equals accepted main. It does not execute
the captured runner. quietFS first then FindFirst is explicitly rejected during
preload, before a sentinel entry script executes. quietFS validates the original
historical source before forwarding it, so it must wrap the FindFirst hook. Its source is unchanged. Third-party adapters require their own composition
qualification; this task makes no terminal captureguard composition claim.

Executable next-use **offline** command with the retained local task inputs:

```sh
TASK=scratch/runs/<run-id>/enigma-historical-findfirst-local-source-oct24
ENIGMA_FINDFIRST_RUNNER_ROOT="$TASK/historical" \
ENIGMA_RUNNER_ROOT="$TASK/historical" \
timeout 60 node --max-old-space-size=256 \
  --require="$TASK/repo/tools/enigma-findfirst-compat.cjs" \
  --require="$TASK/repo/tools/enigma-quiet-filesystem.cjs" \
  "$TASK/repo/test/test-vfs-findfirst-literals.js" \
  "$TASK/historical/lib/filesystem.js"
```

## Evidence and limits

Initial test receipts retain the missing transitive dependency diagnostic, the
incorrect expected attribute0x80 (actual existing archive attribute0x20), and the
mutation-control selection error (an earlier unrelated end-anchor occurrence). The final mutation targets the extracted matcher span and the unchanged oracle
rejects it. These are fixture/control corrections, not changes to production
semantics or the accepted oracle.
