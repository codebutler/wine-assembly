Accepted c26252c4:docs/re-notes/beyond-good-evil-demo.md

12:
13: Both demos now reach the visible InstallShield error `-5003:0x7e`. Native setup.dll initially reports missing comctl32.dll/shell32.dll. Staging those exact existing fixtures removes those missing-import warnings but does not resolve the error. A trace then shows many missing WinINet dynamic exports. Native WININET.DLL from the existing Delphi6 Win95 Support fixture loads successfully, but the error persists: missing WinINet exports alone are not proven as its cause. Next trace the first failing module/export or error-construction path with this complete recorded dependency set, or decode the original appended multi-volume installer payload. Do not declare a complete game tree from data1.cab alone.
14:
15: Dependency SHA256: shell32 `533c5809a9b6bdb236cce17a14c03ff251c4ca4d00790ea8e8034ee5d14d7f61`; comctl32 `28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`; wininet `6e0d08e5a31a4b96a3951b7bc8ced1b3c6e1db7d78c3e71a2694f9dce4fa2448`. All runtime/extraction occurred on bx_hx8msa33; no approvals accepted. Evidence: scratch/runs/20261010T0439Z-installshield-child and scratch/runs/20261010T0442Z-installshield-native-deps. This is installer progress, not gameplay.
16:
17: ## Payload extracted; settings failure decoded (2026-10-10 05:02Z)
18:
