# JezzBall (Windows Entertainment Pack 4)

Source: https://archive.org/details/win3_JezzBall ; win3_JezzBall.zip SHA1 2f041c41949b39917754ef1e49667b7f8f4b578b. JEZZBALL.EXE SHA256 0450d0559fa5957d813bdd7be1f71122bf23047869b610802386320f109cb705 matches test/binaries/wep16/WEP4/JEZZBALL.EXE. Use registered wep16_jezzball so WEP4UTIL.DLL and WAV/HLP companions are available.

## 2026-10-13 first-level transition

On 6aaf65235, ordinary pointer gameplay through the real ops emulator handler
reproduced two "Well done!" dialogs. Clicking each Next Level skipped straight
to four balls/lives, with overlapping board text. A narrower ordinary-input
control reached one completion dialog, then clicked the exposed owner board at
screen (465,455): that alone opened a second dialog. Win16 DialogBox activated
the popup but never disabled its owner, so the click reactivated the game.
The modal invocation now remembers and disables an enabled owner before init,
then restores only that invocation's disable on completion. Modeless dialogs,
ownerless dialogs, and already-disabled owners retain their previous state.

Blocking that reactivation exposed a second generic bug. After EndDialog, OWL
calls DestroyWindow on a retired dialog child. Its narrow HWND widens to zero;
wnd_table_find(0) intentionally finds an empty slot, and enumerating children of
parent zero visits top-level windows. Win16 DestroyWindow therefore destroyed
the main window and its WM_DESTROY posted WM_QUIT (ExitProcess 0, not a trap).
Reject null and invalid HWNDs before starting the destruction walk. Keep the
window table's empty-slot lookup semantics unchanged.

test-win16-windowpos-defproc.js now runs with actual Win16 handle retirement and
covers null/stale destruction preserving unrelated windows, modal disable before
WM_INITDIALOG, nested dialogs, pre-disabled/destroyed/absent owners, EndDialog
during init, WM_CLOSE/IDCANCEL, failed creation, and modeless creation. Old-source
negative controls fail the owner-disable and invalid-destruction assertions.
Baseline evidence: scratch/runs/20261013T1132Z-jezzball-level-before; intermediate
exit diagnosis: scratch/runs/20261013T1211Z-jezzball-level-after. All gameplay
inputs were ordinary mouse actions, with no guest gameplay-state writes.

Final Threads browser evidence: scratch/runs/20261013T1225Z-jezzball-level-final.
The exposed-owner click leaves one completion popup; one Next Level click starts
level 2 with three balls, three lives and 0% area. A subsequent trusted click
builds a complete vertical wall, advancing score 3025 to 3105 and area to 3%.
The completion popup's pre-existing clipped geometry remains a separate visual
issue. Canonical build, Win16 modal/window-position lifecycle, destroy
notifications, handle retirement, and renderer modal-input tests pass. The
existing CLI JezzBall regression also passes wall growth, High Scores, game over,
name submission and score dismissal. No public deployment was performed.

## 2026-10-10 crash investigation

User report on 62918bb02, exe:jezzball, Chrome154/macOS, no cross-origin isolation/SAB, EIP1024ec and return1024f5. This is FCHKWEPVERS immediately before score submission; an EXE-only launch may lack its companion DLL. Exact old production build has not been replayed.

Current a0f52e591 with the complete package plays but High Scores crashes at EIP160029, invalid CS0300. JezzBall ordinal175, segment7:0093, flags1, begins Borland MOV AX,DS; NOP. The OWL instance thunk at selector009f reaches it with AX0057, but WEP4UTIL's modal callback leaves DS0077. The prologue discards the correct instance AX and dispatches through DLL data. Direct USER callback special-casing does not reach this guest-generated thunk.

Fix NE exported prologues for EXEs as well as DLLs: public-data entries bind DGROUP; MULTIPLEDATA exported entries preserve instance AX by replacing recognized placeholders with NOPs. Microsoft and Borland spellings, fixed/movable entries and negative cases covered by test-ne-loader.js. Primary reference: https://github.com/wine-mirror/wine/blob/master/dlls/krnl386.exe16/ne_segment.c (NE_FixupSegmentPrologs).

Further full-game validation found score-entry timer reentrancy: host chrome activated but guest active/focus state stayed on the owner. Each timer could reopen score entry. Nested modal pumps then sent the outer dialog's WNDPROC_DIALOG marker to native dispatch, requeuing already-narrowed WM_COMMAND handles until exhaustion. Resolve outer DLGPROC and finish WM_INITDIALOG through the far activation/focus transaction before timers.

Evidence: scratch/runs/20261010T1053Z-jezzball-browser-before (noSAB baseline crash); scratch/runs/20261010T1102Z-jezzball-prologue-only (high scores open/close, score1043 and26% area via trusted clicks, then game-over crash). No candidate manifest entry exists, so these bundles remain investigation evidence without a fabricated candidate result.json.

Validation on 443753bf6 plus this patch: canonical build PASS; test-ne-loader.js 2945 checks PASS (synthetic matrix and all five legacy fixtures); Win16 WINDOWPOS/focus/task-modal callback test PASS; JezzBall gameplay, High Scores, stable game-over name entry, score submission and dismissal PASS. CLI score1995/nameAB visibly appears in both Hall of Fame and Today. Final merged-base checks above PASS. Desktop icon opened the complete package by two trusted clicks in Chrome151 on the temporary boat with crossOriginIsolated=false and SharedArrayBuffer unavailable; High Scores opened and dismissed, game-over restart worked, and trusted pointer input built walls. Final browser bundle: scratch/runs/20261010T1114Z-jezzball-desktop-final. Test logs: scratch/runs/20261010T1113Z-jezzball-tests. Tested WASM SHA256 1fcc4189335ea74a70fe5d85323fc29add77c2492c97648459b5e304fb1b45aa. No public deployment.
