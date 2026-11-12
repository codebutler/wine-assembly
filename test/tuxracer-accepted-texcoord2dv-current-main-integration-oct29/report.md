Accepted glTexCoord2dv integration — blocked before main publication

Baseline: dcbe956bb403509f531b059c6822a1dcacd9fa59.
Repair: f356bcac0727ed3aa5e0fde2f9cc829061fe6a59; independent acceptance publication: d6495cfe5a59f23dd7e87b630690d8de15f7acdb.

Applied only the five-path accepted semantic delta. Current main has different handler insertion context and lacks the accepted parent's glVertex2dv implementation; its existing glVertex2dv route and every API ID remain unchanged. The generator availability condition adds only glTexCoord2dv. The behavioral test is byte-identical to the accepted source (SHA256 43a95e5f9ba938f7cb4888370207bd1b7d27857cb82a1ebe4036bcf71494d3df).

First behavioral check: /usr/bin/node --max-old-space-size=128 test/test-gl-texcoord2dv-dispatch.js — PASS, 8 cases; packed doubles, stack cleanup, pointer translation, non-affine page crossings, allocation failure and wrong-route mutation rejection. No independent 20-case or 2-mutation acceptance replay; unchanged published evidence reused.

Next required check: /usr/bin/node --max-old-space-size=128 tools/gen_dispatch.js --check — BLOCKED, exit 1, MODULE_NOT_FOUND for ./d3dim-methods at tools/gen_dispatch.js:451. tools/d3dim-methods.js is absent from the supplied closure. Stopped at this concrete blocker without fetching or materializing additional sources. No regeneration occurred. Main publication is prohibited until merged-tree generator freshness passes in a newly assigned task with the missing prerequisite.

git diff --check passed. The existing glVertex2dv focused test is absent, so it was not run. Full-module build, mounted startup, browser/runtime and gameplay remain unqualified. No Boat or public deployment; no box ownership was assigned or changed.

Raw bounded evidence and completion receipt: /tmp/tuxracer-accepted-texcoord2dv-current-main-integration-oct29/{e,completion-receipt.json,coordinator-note.txt}. This branch preserves reviewable WIP; it is not a passing main integration.
