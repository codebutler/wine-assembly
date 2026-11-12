# Selective fixture presence reconciliation

The Baldur's Gate interactive demo missing-file blocker is stale. Current
registry entry `baldurs_gate_interactive_demo` names 304 distinct paths; all
are regular files under the root checkout and total 520,592,465 bytes.
`BGDemo.exe` is 4,848,640 bytes; `Scripts/None.bs` is empty. Presence alone
does not prove integrity, successful launch or gameplay.

The integration checkout lacked this candidate directory. An ignored symlink
now connects `/tmp/wa-recovery-20261014/test/binaries/candidates/baldurs-gate-interactive-demo`
to `/home/user/wine-assembly/test/binaries/candidates/baldurs-gate-interactive-demo`.
All 304 registry paths were then verified through the integration checkout.
No payload was downloaded, copied or changed. Recreate this link only if the
destination is absent and the retained target exists. The local path receipt
is `scratch/bg-fixture-link-20261018.json`; Git does not preserve the fixture.

UT3 remains missing at
`test/binaries/candidates/unreal-tournament-3-demo-installer/setuput3demo.exe`
in both checkouts. Its manifest pins SHA-1
`86d4bad740d0c25438a65c48939ee6dcfc88bb02`. This is installer analysis only,
with no registered app; its historical first runtime blocker is UuidToStringA.
Do not describe restoring that installer as a working game route.

Historical receipts `scratch/local-owner-restore-final/report.json` and
`scratch/mig-fixture-restore-20261011/report.json` are absent locally, as are
the referenced historical per-game task JSON files. The current-main TODOS
no longer contains MIG-FIXTURE-RESTORE; the shared checkout retains stale
duplicate rows. This report records current path checks without recreating
those historical receipts or importing the obsolete queue wholesale.

The next BG step is ordinary-route qualification on the serialized test box
with exact build identity and reviewed input evidence. No runtime was performed
by this reconciliation. Saved-box resume remains externally blocked.
