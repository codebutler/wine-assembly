# Demand-driven native font preparation

Historical source last updated, 2026-09-10. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

Status: stock-font and metadata-catalog startup are installed automatically on
the executing owner before DLL initialization. Demand-driven face preparation
and generation-aware invalidation are not enabled; later face reads still use
the synchronous paths. Lazy installed-tree defaults remain off.

## Required boundary

```text
+---------------------------+------------------------------+-------------------------------+
| PLAN (no guest mutation)  | PREPARE (guest remains parked)| COMMIT + EXECUTE ONCE         |
+---------------------------+------------------------------+-------------------------------+
| identify operation inputs | prepare bounded source lease | validate source + operation   |
| resolve catalog snapshot  | parse candidate privately    | publish immutable generation  |
| retain selected generation| retain old usable generation | enter original native action  |
+---------------------------+------------------------------+-------------------------------+
| NO DRAWING / STACK POPS   | stale/cancel/fault => discard | no replay of entered drawing  |
+---------------------------+------------------------------+-------------------------------+
```

The existing `tt_subst_path` is not a planner: it calls `tt_scan_font_dir`,
which allocates scratch, opens/registers files, and marks the directory scanned
before completing its reads. That flag is not asynchronous readiness. The
read-only `tt_subst_resolve` separates lookup against the currently published
registration/substitution tables. Its answer is provisional until the caller
has prepared a catalog snapshot: an undiscovered installed family may override
even a familiar bundled substitute. Neither a returned path nor a cache hit
proves source freshness.

## Operations that must be covered

| Entry or consumer | Why a late retry is unsafe | Required preparation |
| --- | --- | --- |
| `GetFontData` | Currently adjusts ESP/EAX before face lookup | Resolve the selected font and retain its generation before stack cleanup or output writes |
| Text, metrics, kerning and glyph outlines | `gdi_bitmap_font_selected` can open a face and synthesize a mapped-size strike | Prepare the resolved face/style/size before any enclosing layout, drawing or output mutation |
| Enumeration | Discovery registers files; callbacks can execute more guest operations | Stable catalog snapshot and resumable candidate preparation before callback delivery |
| Controls and native Help | Native code creates/selects fonts outside CreateFont API calls | Prepare dependencies before the enclosing native operation; do not replay control or Help state changes |
| Metafile playback | Earlier records may already draw before a later font dependency appears | Explicit record/operation continuation, preserving prior records without replay |
| Direct host exports and `send_message` | Bypass ordinary API dispatch; rich-edit bookkeeping can precede dispatch | The same ownership boundary must cover exports, not just guest API thunks |

CreateFont-only or scheduler-turn-only preparation is insufficient. A new
selection/style/size can first appear later in the same slice, inside a callback
or native composite operation. Do not return fallback metrics after scheduling
an asynchronous read and describe that as successful preparation.

### Native staging contract

The native catalog transaction is separate from explicit `AddFontResource`
registration and is owned by one executing instance. Its bounded metadata
table contains at most 32 records of 208 bytes each; it does not own parsed
faces, glyphs, or complete font files. Current and pending tables can coexist
so an incomplete refresh does not replace the old catalog.

- `font_catalog_begin()` returns a nonzero transaction nonce, or zero on
  failure/busy. Nonces are not allocation addresses and must not be reused. Initial preparation must precede legacy directory scanning: begin rejects
  a legacy-scanned instance, and commit also rejects a scan that intervened
  during staging. Legacy-discovered registrations cannot safely be mistaken
  for explicit registrations or migrated without separate ownership records.
- `font_catalog_add(token, path, bytes, size)` copies family/style/path
  metadata into the unpublished table. Input spans and the 4 MiB file limit
  are checked first. An invalid add for the active token poisons that
  transaction; a foreign/stale token must not affect it. Paths must be nonempty, NUL-terminated within 132 bytes, and unique in the
  staged table. Metadata acceptance checks the existing TrueType signature
  and bounded family/style tables, not full glyph validity. Heap extent
  validation follows the allocator convention; it is not a live-allocation
  capability check against forged or freed headers.
- `font_catalog_commit(token)` publishes only a healthy transaction, advances
  the catalog generation and then frees the old metadata table. Empty is a
  valid completed catalog, distinct from never prepared.
- `font_catalog_abort(token)` releases a matching pending transaction and
  preserves the current catalog; stale aborts are harmless.
- `font_catalog_ready()` and `font_catalog_generation()` describe catalog
  publication only. They do not certify current VFS sources or give parsed
  faces/glyphs/strikes a generation identity.

Explicit registration wins over discovered metadata; catalog entries win over
substitutes. Enumeration merges these sources without duplicate family names. Returned path/name pointers are borrowed from their table: copy them before an
await or later catalog commit. Native calls alone cannot certify VFS freshness;
the host must validate the entire candidate snapshot before committing.

`GuestThreadHost.getFontCatalogExclusions()` obtains one copied snapshot on
the executing Worker in one message. No borrowed pointers cross asynchronous
calls. `installFontCatalog(entries, expectedExcludedPaths)` now provides the
dedicated synchronous owner-side transaction, with independent host and Worker
validation of 32 entries, 4 MiB per file, 16 MiB aggregate payload and direct-child
ASCII TTF paths. Host-owned copies, structured-clone bytes and Worker-owned
copies each consume bounded payload in addition to retained VFS leases and
one native staging allocation; the message cap is not a total-process cap. The Worker validates actual exclusion policy through publication. The host
validates reply count/generation; uncertain replies require process discard. `installRemote()` now holds source ownership through the reply and revalidates
VFS membership, every retained lease, cancellation and reply shape before
returning. An internal preparation-only abort controller permits cancellation
of pending reads without prematurely releasing ready leases after a Worker
request has been sent. All leases release when that request settles; stale or
uncertain publication reports that the unstarted process must be discarded.

Browser `loadExe()` now waits for stock fonts and this catalog before becoming
ready; its existing failure path marks startup failed, aborts and initiates
stop. The stop barrier joins boot completion and Worker teardown. The helper
does not await `stop()` internally, which would deadlock against that same
boot barrier. CLI startup publishes locally after final mounts/overlay restore
and stock fonts, before DLL entry calls. The local installer must not be passed
a shadow instance or asynchronous Worker proxy. This establishes the startup
catalog with a fail-closed policy: malformed custom metadata or exceeding
32 non-excluded files, 4 MiB per file or 16 MiB aggregate rejects launch. It does not support arbitrary installed-font trees or automatic refresh after
later filesystem changes.

The Worker now owns a monotonic NEW -> OPEN -> SEALED eligibility state. Only a first successful main-image load can open it; invalid image return
codes, repeated initialization/loading and secondary-thread setup cannot
reopen it. PE returns must match actual EIP. NE returns are selector:offset,
so the gate checks the native entry CS/IP, actual CS and segment-table
translation to actual EIP instead of comparing the packed value to linear EIP. DLL entry calls, synchronous message dispatch, ordinary slices
and non-allowlisted generic exports seal before invocation. Arbitrary
`readExports` requests are subject to a separate metadata allowlist. Generic
native catalog mutation exports are denied, so only the dedicated message
can publish and only while OPEN. Normal non-catalog operations still execute
after sealing; this state guards publication, not ordinary guest scheduling.

The current image-load sequence uses generic `set_process_id`, `get_staging`,
`get_staging_size`, `set_exe_name`, `set_exe_drive`, `set_extra_cmdline`,
`load_pe` (also handles NE) and `init_dx_com_thunks`. Treat the first successful
image load specially; later loads cannot reopen a sealed startup window. Shell configuration also sets HWND base, process environment, Windows version
and loop-copy options. The allowlists are explicit, not prefix rules. Unlisted
diagnostic exports also conservatively seal startup; future bootstrap callers
must audit any needed additions rather than assume every `get_` function is
safe. Win16 DLL mapping remains permitted as a separate pre-font phase: the
current native `load_ne_dll` path was audited as callback-free.

Separate directory discovery from face registration/loading. Catalog work may
read bounded metadata incrementally, but must not fill the 32-face parsed cache
merely to discover names. Publish catalog changes only after source validation;
an incomplete scan must remain distinguishable from a completed empty catalog.

Generation identity must reach every derived cache: instance-local TTF faces,
glyphs, and the shared synthetic-strike registry. Synthetic strikes currently
key only family/style/size, so clearing a face cache alone can still return old
pixels. Slot reuse must never make an old selected handle refer to a new face. Registration refcounts are a separate compatibility issue; do not silently
change repeated Add/Remove behavior as part of cache invalidation.

### Generation implementation constraints from the consumer audit

Publishing a new face alone cannot enable revision-aware lookup. Realized
HFONTs need retained source identity, distinct from discovery/registration
membership. Synthetic strikes must compare the complete source identity and
rendering parameters, not merely their logical-name/style/size hash. Their
shared publication, references and retirement must be synchronized: checking
a generation does not protect bytes freed concurrently by a sibling instance. Selection, charset queries and `GetFontData` must all use the retained identity. HFONT deletion must release it through `gdi_object_delete_full`; old selected
fonts must remain usable after registration removal or VFS deletion.

The bitmap-font audit also found that `gdi_bitmap_font_add_buffer` currently
removes old path-matching records before validating a replacement. Removal
unbinds matching HFONTs and frees their payloads. Replacement therefore needs
private staged records and complete validation before publication, followed
by retirement of the old generation until selected/in-flight owners release
it. A header-only precheck, clearing all bindings, or path-cache invalidation
would not establish that contract. Failed replacement must leave registration,
selected bindings, metrics and pixels unchanged.
