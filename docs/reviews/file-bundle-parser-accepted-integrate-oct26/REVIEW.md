# Accepted parser integration

Parent main: `d6168240d93f2a92d401a6264efab0c3985e1ba0`.
Accepted candidate: `3f5956fffd23ed03cdd22975b474e348c8b966ca`.
Independent acceptance: `33d8b0b73c76dc62a6f16e88928c7fd67620ed1e`.

Applied only the ancestor-to-candidate host.js parser hunks. The complete parser
method equals the accepted candidate; all bytes outside the method equal current
main. Own filename checks precede filename access; fatal UTF-8, exact descriptors,
duplicate-name reservation, bounds, status handling and exact framing are retained.
The current bounded server reader and every save-sync/save-bundle path are byte
identical to main (preservation.json). All unrelated tree paths are preserved,
including Maelstrom integration. Sparse absence is never staged as deletion.

Merged validation: unchanged reproducer9, framing8, own4, independent8; bounded
reader supplied8, independent8 and rejecting controls5. All50 pass, all Node
processes including nested children use16MiB old-space. No baseline acceptance or
unaffected23save groups repeated. Retained review19payloads rehashed against
immutable committed blobs; prior baseline receipts retained unchanged.

Resource-only test adjustments: controls child heap192->16. The short-read mutant
initially exhausted16MiB before the final assertion. Its one-byte fixture now
enforces the existing exact three-allocation expectation immediately, so the
mutant fails behaviorally before OOM. The first overbroad guard was corrected to
that fixture only. Final assertions, mutation anchors and production algorithm
are unchanged. Original failures and affected retests are retained; unaffected
group receipts are reused with unchanged input hashes. Final tested tree and
source/test hashes are in tested-tree.json and tested-inputs.json; only evidence
and documentation were added after the final passing tests.

No canonical compile, service, deployment, guest/native/Boat runtime, game network
or gameplay qualification. No box assigned: state/expiry N/A; lifecycle owner is
coordinator. No workers spawned; root checkout/index/refs and donors read only.
Publication result, final commit/tree and exact trusted remote refs are retained
in the task ops/result.json and append-only root messageboard.
