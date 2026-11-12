# Army Men gameplay evidence independent acceptance

Accepted candidate `c9d9349caa2b67a69346bb86369743914f063330`, tested source
`c740f914e27395829deb9dbc0f2a3fe5762a2bdf`. Fresh origin/main was still that
tested source before integration. This acceptance adds no runtime behavior.

Independently inspected twelve original 640×480 PNGs: corrected player-before,
move-held, move-released, aim, fire-release, fire-800, camera-before, camera-held,
camera-released; default sarge-before, move-held, move-released. Corrected
Numpad8 changes Sarge's position relative to rocks/fence while the camera follows.
Space release shows a yellow muzzle flash and red selected-weapon border;
fire-800 clears the flash and restores green. Explicit scroll moves the pointer
and viewport toward the rifle-training area, with held/released views stable at
the sampled endpoint. No visible stripe bands in these inspected frames.
The default run's extra Enter selects scrolling: it is not player movement.

Offline checks passed:

- Candidate archive SHA256 `92544b39b60825887faad8179d7ef9bce0fa287ff53d90cc08d8bc9466a6a2d3`;
  all 87 regular members byte-identical to recovered artifacts, unique safe paths,
  no links. Archive streamed from Git in memory; no duplicate archive/extraction.
- Candidate verify.py passed all 86 outer and 53 runtime seals, two bounded
  successful exits (1,030/960 batches), recorded key delivery/screenshot presence,
  before/after identities and unchanged module. Tracked report equals run report.
- Independently compared all 7,303 integrated source paths/blob IDs/sizes/SHA256
  with the exact Git tree, and all 7,299 canonical-build source identities with
  `30a2c3fb1b5c2bfa8a6b001d7394d5cf50df295d`. Before/after inventories match.
  Only existing observer/test/investigation-note files differ since that build;
  four added documentation/evidence files do not change module inputs.
- Reused accepted canonical build exit0/log and actual 1,878,508-byte module,
  SHA256 `728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`.
  No rebuild, packaging, runtime execution or prior-suite replay.
- Original manifest contains 419 originals after excluding 14 tiny system
  placeholders. Reviewed remote checker actually hashes those originals and
  resolved support DLLs; its sealed before/after attestations and support hashes
  agree. This review did not rehash remote asset bytes or contact the stopped box.
- Independently compared both default baseline/released PNGs byte-for-byte with
  the prior observer-enabled originals; both pairs match.

Local check script and machine receipt: `scratch/runs/20261021-army-gameplay-evidence-integrate/{check.py,checks.json}`.
Git whitespace checks pass. The repository-wide dashboard checker still reports
the unrelated historical Zuma outside-run reference, plus prior missing/invalid
records; no Army candidate exists and this investigation is not attached to a
different game's card. Those independent issues are retained, not repaired here.
To recover candidate evidence, use its tracked report/archive and RECOVERY.md;
run included verify.py, compare inventory entries against Git ls-tree/cat-file
at the exact revisions above, and inspect the named PNGs. Original assets remain
in the prior recovery store; this task neither copies them nor changes licences.

Acceptance is limited to original CLI startup and visible movement/fire/scroll
responses on that route. No hit/kill, mission completion, audio, FPS, browser,
native parity, full-surface correctness or historic stripe-cause claim. Stable
held/released captures do not establish scroll speed or release as stop cause.
Prior BltFast sampled matches remain sampled evidence only. Broader qualification
and historic corruption reproduction remain independent work.

Only the Army TODOS block is reconciled; unrelated status and root WIP remain
untouched. The original report's RUNNING handoff is historical. Coordinator's
`scratch/usage-watch/army-gameplay-stop-oct21.json` records completed snapshot-stop
of `bx_e8a7pw8v` at 2026-10-21T11:48:43.227Z, stop ID
`stop_3aa6397f0efae240`; previously recorded expiry 12:21:46.313Z. No lifecycle
action or live-state query was made by this reviewer. Lifecycle ownership stays
with the coordinator. Local projection 8 MiB fits the 64 MiB allocation and
2,285,895,680-byte floor plus 600 MiB reserve. No workers or replacement tasks.
