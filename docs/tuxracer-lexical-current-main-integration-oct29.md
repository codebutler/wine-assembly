# TuxRacer lexical scanner integration

Integrated the independently accepted 17-file, 96,246-byte scanner, dependency,
test and report closure onto main `ac4fdeb31c20d5bd869f201c9c051ad5bc663ca6`.
Each path came from its exact accepted blob in
`d8435d7dae150bab64ff9f36d71c8afd13b36458`, without merging the historical task tree.
The source candidate is `fec0a4bc9af1bf10bd3c8056181573f305a1caf9`.

The production recovery script SHA-256 remains
`69257615178adda7568036fc49e2f20b4ca602c6d3b734f1238caf6143021b17`.
The closure manifest SHA-256 is
`b848ada89edec7bffc4fc221635990485543d6697cc8dd912de354cbbe23f98b`.
All other base paths remain unchanged; this report is the only additional path.

Focused integrated-artifact verification used both the Python API and actual
`literal-sources` CLI. The unchanged earliest inert-braced-data fixture produced
no checked dependency, a genuine missing literal source was rejected, and a
computed source form remained UNKNOWN. No Tcl evaluation occurred. The original
historical harness and source-hash pin are unchanged. Predecessor control/check
scripts containing fixed output paths were not executed. The small owned smoke
adapter imports the exact integrated production file, copies the pinned earliest
fixture unchanged into its owned fixture directory, and invokes the real CLI;
all outputs remain under the new owned evidence root.

Reused coordinator-verified acceptance at the exact pins: 27 API checks, 27 actual
CLI checks, two rejecting mutations, and the unchanged 23 API + 23 CLI repair
checks. These groups were not replayed. This is conservative static lexical
validation; computed forms, runtime resolution, media, builds and gameplay remain
outside its qualification.

Canonical integration receipt and smoke adapter:
`/tmp/tuxracer-lexical-integration-continued-oct29/receipt.json` and `smoke.py`.
The oversized shared messageboard is delegated to the coordinator through the
bounded `publication-note.txt` in that same evidence directory. The allocation
remains retained until coordinator closeout.
