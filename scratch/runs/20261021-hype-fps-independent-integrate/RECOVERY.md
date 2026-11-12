# Bounded Hype acceptance recovery

Accepted12e43047471843e8ae49a85844fae53c4184881f plus prior
56c92dc2abad4c2cbf1ca26ab0b85a5dfbde388f on exact testedb88c818ba.
Review report: docs/reviews/hype-fps-independent-integration-20261021.md.

Offline reproduction on this host:

    python3 scratch/runs/20261021-hype-fps-independent-integrate/offline.py
    node scratch/runs/20261021-hype-fps-independent-integrate/controls.js
    node scratch/runs/20261021-hype-counter-owner-measure/verify.js

Scripts use retained root candidate/prior evidence and read original assets
in place. No extraction, rebuild, runtime or asset duplication is required.
For disaster recovery the prior original-free evidence archive is the existing
Git blob at docs/reviews/hype-browser-fps-authorized-20261021-evidence.tgz;
129 outer files contain66 nested recovered files. Original game assets are
not in Git: recover their exact59 entries from the prior assets.json manifest,
not a substitute distribution. Full source is base Git b88c818ba; production
module hash728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c.
This recipe does not authorize another build or runtime session.

offline.json records seals, source/asset identity checks, callback PE mapping,
108sample arithmetic and overhead. controls.json regenerates ten rejections
and demonstrates two validator authenticity limits. Original source and
validator are unchanged; exact prior canonical build/66tests are reused.
Four actual primary gameplay PNGs reviewed; no continuous-video claim.

Box bx_2ghgsv9d was snapshot-stopped by coordinator: preserved receipt
coordinator-stop-status.json says completed12:36:32.756Z,errornull. Former
expiry14:01:16.889Z. No runtime/lifecycle/SSH/resume/newbox action by reviewer.
Local64MiB cap and2285895680+600MiB reserve preserved. Only sparse task
worktree/review files owned; rootWIP/laptop/HeroesII/WarcraftIII/fleet untouched.

publication.json (written after push) records exact task/main remote refs.
Stop: no workers, replacement tasks or broader repairs authorized.
