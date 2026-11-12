#!/bin/bash
# tl;dr: gather the BW2-DRAW-CTX-REUSE evidence into ~/ship2/pack: per arm the
# probe samples/run.log, thread CPU, hashes, window summary, captures, and the
# render worker's CPU profile + summaries for profiled arms; plus the unit
# suite results, build logs, frozen-clock runs and scripts. Tar to ~/ship2/pack.tgz.
set -u
OUTROOT=~/ship2/pack; mkdir -p $OUTROOT/frames
RE='wasm-function\[(10641|10675|10686|10700|10703|7630|7659)\]'
for run in ~/ab/runs/dc-r1c-ctx ~/ab/runs/dc-r1c-fix ~/ab/runs/dc-r2-ctx-prof ~/ab/runs/dc-r2-fix-prof; do
  arm=$(basename "$run"); out=$OUTROOT/$arm; mkdir -p "$out"
  art=$(head -1 "$run/probe.out" | cut -d' ' -f2)
  gzip -c "$art/samples.ndjson" > "$out/samples.ndjson.gz"
  gzip -c "$art/run.log" > "$out/run.log.gz"
  gzip -c "$run/probe.out" > "$out/probe.out.gz"
  gzip -c "$run/threadcpu.ndjson" > "$out/threadcpu.ndjson.gz"
  cp "$run"/probe.err "$run"/driver.log "$run"/source-head.txt "$run"/wasm.sha256 \
     "$run"/node-version.txt "$run"/started-at.txt "$out"/ 2>/dev/null
  node ~/ship/abstat.js "$run" 300,600,900,1200,1500 > "$out/windows.json"
  for f in "$art"/frame-*.png; do cp "$f" "$OUTROOT/frames/$arm-$(basename $f)"; done
  if [ -d "$run/prof" ]; then
    w=$(ls "$run"/prof/*.1.002.cpuprofile)
    gzip -c "$w" > "$out/worker.cpuprofile.gz"
    STACKS='wasm-function\[(10675|10641)\]' node ~/ship/profsum.js "$w" 1190 1490 "$RE" 25 > "$out/worker-profile-1190-1490.txt"
    node ~/ship/profsum.js "$w" 900 1190 "$RE" 25 > "$out/worker-profile-900-1190.txt"
  fi
done
mkdir -p $OUTROOT/suite $OUTROOT/frozen $OUTROOT/scripts
cp ~/ship2/suite/ctx ~/ship2/suite/fix $OUTROOT/suite/
tar -C ~/ship2/suite -czf $OUTROOT/suite/logs.tgz .
for a in ctx fix; do cp ~/ship2/frozen-$a/run.log $OUTROOT/frozen/$a-run.log; cp ~/ship2/frozen-$a/frame.png $OUTROOT/frozen/$a-frame.png 2>/dev/null; done
cp ~/ship2/build-ctx.log ~/ship2/build-fix.log ~/ship2/setup.log ~/ship2/fix.patch $OUTROOT/
cp ~/ship/*.sh ~/ship/*.js ~/ship2/*.sh $OUTROOT/scripts/
tar -C ~/ship2 -czf ~/ship2/pack.tgz pack
sha256sum ~/ship2/pack.tgz; ls -la ~/ship2/pack.tgz
