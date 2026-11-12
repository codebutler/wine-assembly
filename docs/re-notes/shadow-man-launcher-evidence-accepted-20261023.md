# Shadow Man: installed launcher and Configuration response accepted

Offline independent review on 2026-10-23 accepts the original launcher and one
ordinary Configuration response. Gameplay remains pending: **Spielen is disabled**.
The old original-media/resume403 hold is superseded by verified installation,
restoration and captured UI evidence. No runtime was accessed for this review.

## Exact evidence and acceptance

Remote main reconciled to `58e90870a40a541a4083cae5e987ca8de31889e6`.
The candidate branch's actual remote ref matched
`340803e35428c88f1946e52112e322b1733fb346`. Its production source is unchanged;
canonical Wasm is 1,879,387 bytes, SHA256
`ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553`.
The retained consumption trace records that exact canonical input. See the
[previous DSETUP qualification](shadow-man-dsetup-qualified-20261022.md) for its
separate source/native scope; its historical whole qualifications were not replayed.

The [bounded review report](../../scratch/runs/20261023-shadow-man-launcher-evidence-status-integrate/REPORT.md)
and its `verify.py` retain the independent hash, receipt, fixture and status checks.
Original candidate evidence is under
`scratch/runs/20261023-shadow-man-live-capture-helper-retest/` at the exact
candidate commit, retained locally in
`/home/user/wine-assembly-shadow-man-live-capture-helper-retest-oct23`.
Only selected evidence and the observation helper's offline fixture are imported;
experimental runtime launchers, observers, recovery tools and history are excluded.

Exactly one original D3DConfigUtility session reached the ShadowMan Launcher.
Endpoint readiness was 0.606838 seconds; the genuine launcher PNG was captured
at 0.830569 seconds. Independent visual inspection confirms Konfiguration,
disabled Spielen and Beenden. One ordinary `cmd dlg-cmd:1024` targeted original
HWND `0x10001` at batch 652881, returning host command exit 0. The response state
and genuine PNG within 0.657326 seconds show original Configuration HWND
`0x10006`: Primary Display Driver, 640 x 480 x 16, Gamma/Helligkeit sliders,
OK and Für Fortgeschrittene controls. There were two live PNG commands.
The [launcher image](../../scratch/runs/20261023-shadow-man-launcher-evidence-status-integrate/launcher-before.png)
and [Configuration image](../../scratch/runs/20261023-shadow-man-launcher-evidence-status-integrate/output-config-after.png)
were both visually inspected in this review, independently of the coordinator.

The actual retained top-level snapshot passes the corrected capture predicate.
Eight rejecting fixtures (unrelated, unready, malformed, hidden, child, wrong
HWND, quit, control failure) issue no PNG. Importing the retained helper for this
fixture does not run its runtime entry point or dispatch input.

Restoration commit `d6c7a71cad22bc37ebc73e586c92fd5497901689` preserves complete
2,083-original/186,399,681-byte verification and 217 runtime/receipt hashes;
the one 2,045-file VFS clone was reused. Relevant reports and receipts were
rechecked offline; originals were not recovered or rehashed on a runtime here.
The restored registry seal is
`d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3`.
The unchanged imported clone and separately exported registry are distinct
artifacts; export existence does not establish settings acceptance or persistence.

## Licence and installation are observed

`acceptedInGuest=true` follows exact original installation evidence at commit
`ba485e8a27ad8a0cc25a14d40427e8cbfd38eec3` on
`task/shadow-man-original-install-continue-oct22` (actual remote SHA matched).
Its retained directory is `scratch/runs/20261022-shadow-man-original-install-continue/`.
The acceptance receipt blob is `72cfabebdecbb3c228b44f0977f156230de86c5c`;
the installed-payload receipt blob is `d87cae5a33136cacce013df7e17bc11c6962ad2b`.
Both exact retained files were checked against those Git identities.

The licence screen `03-after-welcome-next.png`, post-Ja destination screen
`04-after-license-yes.png`, and completion screen `10-install-progress.png`
were independently visually inspected. The installer-only control receipt
records ordinary `click:413:394` at 2026-10-22T20:01:25.326828Z, batch 1191279,
and the destination response. The child-prefixed raw log corroborates that
input and subsequent installer guest ExitProcess(0); Beenden was batch 3531087.
The completion screen shows both optional readme/game-launch boxes unchecked.
The installation receipt maps all 1,959 originals, 100,354,053 bytes, with equal
installed sizes/SHA256 and zero mismatches. These are retained installation
receipts, not a fresh binary rehash. The historical authorization JSON remains
unchanged, including its historical `acceptedInGuest:false`; it is not current
acceptance state. The original installation used historical Wasm
`f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`,
not the later canonical module used for the launcher capture.

## Unqualified boundaries and proposed next test

The trace explicitly logs `ABANDONED wndproc` after 64 rounds, yield reason 15,
for the Configuration command. A visible response does not prove normal
synchronous callback completion. Known COMCTL32/OLE32 warnings remain visible;
no exercised unresolved ordinal or trap is established by this capture.
No settings were changed or accepted; no settings-save, game launch/gameplay,
normal configuration/game guest exit, Windows parity, browser, audio or FPS
claim follows. The external watchdog ended at 13.211825 seconds within 90;
parent OS exit was -9, guest ExitProcess unobserved, remaining group members
empty, final Node check empty. Process reaping is separate from normal guest exit.

**Proposal only; no execution authorization:** in a separately assigned bounded
test, inspect the original Configuration dialog and use ordinary OK with existing
defaults. Trace callback completion, actual file/registry writes and reopen
persistence before claiming settings acceptance. Then inspect Spielen's actual
enabled state. Only if enabled and explicitly included in the new assignment,
launch the original installed ShadowMan.exe and capture its first actual response
and ordinary gameplay input. Stop at the first precise blocker; retain disabled
Play or callback failure as evidence, without forced enablement or spoofed
prerequisites. Preserve original files, registry and canonical module identity.

## Preservation

Coordinator receipt `shadow-man-launcher-runtime-closeout-oct23.json` is copied
into the bounded review directory. Box `bx_vufrds5w` was snapshot-verified
2026-10-23T01:26:26.454Z and stop-completed 01:26:26.642Z; actual state STOPPED,
stop ID `stop_52cdf98aa62e9720`, owned groups empty. Its historical running
expiry was 01:36:17.590Z. The candidate's RUNNING handback and replay verifier's
`boxRunning=true` refer to the earlier capture, not current state. This task
did not query, stop, delete or resume it; lifecycle ownership remains coordinator's.
Git preserves these receipts and selected images, not ignored game/media/Wasm
binaries. Existing recovery recipes and coordinator snapshots remain the backup;
this note authorizes no recovery, deployment or laptop change.
