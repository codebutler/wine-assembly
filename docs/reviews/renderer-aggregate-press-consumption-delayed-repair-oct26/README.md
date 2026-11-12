# Aggregate async press consumption repair, 2026-10-26

Pinned parent: `c3d394149406189cf1c5dbbc434491f0130666c9`.
Branch: `task/renderer-aggregate-press-consumption-delayed-repair-oct26`.

`handleKeyDown` publishes a press before delivery. Its queued events now carry
`asyncPressPublished`, including F10's separate system-key path, so `takeInput`
advances the held-key/message snapshot without recreating a consumed press.
Raw legacy queue-only events still publish their low bit at delivery. This
event-local provenance survives rapid release/repress without a growing history
or accidental association with the newest physical press. Modifier sides use
physical ownership to distinguish a new side press from typematic. Ordinary
keys keep their existing per-keydown repeat latching. Keyboard messages and
their scan/extended/context/previous/transition bits are preserved.

The byte-unchanged supplied reproducer failed all three modifier cases on the
parent and passes all three on the repair. The new regression rejects that
parent and passes 33 cases. Affected fixtures pass 37 physical-modifier,
28 side-polling, 25 independent polling and 29 independent modifier cases.
The unchanged legacy keyboard lParam fixture passes. Each test child ran
sequentially with `node --max-old-space-size=16 --test FIXTURE`.

Two older fixtures explicitly encoded duplicate aggregate latching. Their
original bytes and failures are preserved. We tightened those expectations:
delivery and held modifier repeats must not regenerate a consumed bit; owner,
side-state, query-order, release/repress and message assertions remain. The
independent fixture's intermediate repeat-oracle mismatch is also retained.

See `evidence-manifest.json` and evidence/checkpoint.json for tested source and
fixture hashes, commands, results and original failure evidence. Unchanged
dependency/closure receipts are referenced with identity; no unrelated full
suite or heavy build was run. Resource receipts include task checkout/Git,
launcher/session, positive shared WAL once, finite future growth, remote staging
and 8MiB reserve within 64MiB. Installed tools and flat read-only donor objects
are accounted separately. Git uses a finite 256MiB data allowance inside the
512MiB client allocation; tests use a 16MiB heap. Trusted Git SSH configuration
is unchanged. No mounts or guest execution were requested, so the conditional
mount parser gate has no argv to validate.

Root/donors remained read-only except append-only root messageboard updates.
No main publication, runtime/service/Boat/build/deployment/SSH configuration
changes, workers, or gameplay claims. Box ID/state/expiry: not assigned;
coordinator retains lifecycle ownership. Remaining acceptance: coordinator
review and integration under main ownership; browser/gameplay unqualified.

Source repair commit: `0ebb852e339fe755f3c18a19f32f1dfe4da427b4`, pushed with trusted SSH and exact remote
branch equality verified. See evidence/publication.json and final task
ops/result.json. The final closeout commit changes documentation/evidence only.
No task replacement.
