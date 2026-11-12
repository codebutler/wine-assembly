# Mad Bomber independent gameplay acceptance

Accepted candidate `045a6e6f0b496a41dc273da1f5ad9a8f6a78cbe8` on tested
main `72e7a30d6e36df896eb25007b6139d750e715720`. Fresh remote main matched
that base before integration. This is documentation/evidence integration only.

Independent visual inspection of run1/8s and run2/8.2s, 8.5s, 9s confirms
falling bombs, bucket movement and a catch with score increment. Run 1 has
score 0 and does not establish scoring. Run 2 at 8.2s shows score 0 and a
bomb directly above the right-hand bucket; at 8.5s the blue splash and score
**1 are already visible**. At 9s score 1 persists with buckets moved to x408.
Thus the producer's “by 9s” claim holds; the transition is visible by 8.5s.
The 8.5s move/capture commands are adjacent asynchronous requests, so that
image still showing the preceding x532 bucket position is expected. Receipts
alone do not prove guest consumption; the ordered log acknowledgements plus
changed rendered bucket positions support the ordinary mouse-input claim.

Reused and replayed producer verification: 63 internal seals, exact module
`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`,
7,451 source files, 168 asset pins, 50 inputs, two normal 60-second exits.
Reused sealed canonical build success and cheap gates/registration/capture
checks; no new build or runtime. New `review.py` checks both complete source
manifests against actual Git object IDs/sizes, 38 candidate publication paths,
36 outer publication seals, ordered acknowledgements (30 run1 / 20 run2),
balanced Enter/Space pairs, safe archive member paths, and all 168 recovery
hashes from the original archive and local boot files. Its initial overly
broad inner/outer seal equality assumption failed: these intentionally cover
different inventories (63 internal, 36 external). Separate inventory validation
passes; no candidate evidence was changed to make a check pass.

The preserved canonical build source is
`30a2c3fb1b5c2bfa8a6b001d7394d5cf50df295d`. Complete manifest differences
are documentation/evidence/status and two Army Men observer/test scripts.
Production/build inputs are identical at the tested revision; the Mad Bomber
launch has no observer/preload injection and the controller filters NODE_OPTIONS,
NODE_PATH, WA_* and WINE_* environment overrides. This equivalence is limited
to that revision and module, not a general promise about future main.

Recovery archive `22121970add638c66203d278b55ee734f668abf36a389cdec2c9c901298d673c`
remains byte-for-byte intact. The existing Git blob is integrated without a
second local archive copy or repackaging. The separate durable original
`b5353b73674a1af6109cb9bf3af5f7d0383308b7ef0b47d52139813ba3ee98ef`
was read and verified untouched: 140 original files plus MSVCRT, with 27
locally retained boot assets, satisfy the complete 168-pin restore recipe.
No full extraction, dependency reinstall or executable recovery run was done;
the dependency inventory is historical evidence, not a fresh reinstall test.
The historical producer report/RECOVERY handoff saying RUNNING is superseded
by the copied coordinator receipt: bx_jh469zy9 snapshot-stop completed
2026-10-21T16:38:49.912Z. Previous expiry was 18:26:26.518Z. This worker
owns no box and took no lifecycle action; ownership remains with coordinator.

Acceptance is CLI headless, cooperative no-threads, registered original app:
One Player, bomb drops, mouse bucket movement, at least one catch and score
0→1. Run 2 later reaches Game Over. Browser, FPS, audio quality/synchronization,
sustained play and full completion remain unqualified. No substantive blocker.

Focused status is `docs/re-notes/madbomber-status-20261021.md`. New checks and
capacity/lifecycle receipts are in this directory and
`scratch/runs/20261021-madbomber-gameplay-independent-integrate/`. Root ledgers
and unrelated WIP are untouched. Sparse materialization projected 5,391,715
bytes before small review additions; archive stays excluded from checkout.
64 MiB allocation and 2,982,150,144-byte prewrite admission are enforced.

Replay offline: `python3 -B review.py /home/user/wine-assembly` using the
retained shared evidence/boot files. Producer replay is `python3 -B
scratch/runs/20261021-madbomber-current-main-gameplay/verify.py` in that root.
