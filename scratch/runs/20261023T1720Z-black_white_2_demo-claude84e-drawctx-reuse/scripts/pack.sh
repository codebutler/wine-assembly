#!/bin/bash
# tl;dr: gather each ~/ab/runs/<arm> folder into ~/ab/pack/<arm>: the probe's
# samples.ndjson (from its Artifacts dir) and run.log, probe.out, driver log,
# thread CPU series, hashes and a window summary (abstat), plus the render
# worker's CPU profile and its summary for profiled arms. Everything big is
# gzipped. Then tar the lot to ~/ab/pack.tgz.
set -u
mkdir -p ~/ab/pack
for run in ~/ab/runs/*; do
  arm=$(basename "$run"); out=~/ab/pack/$arm; mkdir -p "$out"
  art=$(head -1 "$run/probe.out" | cut -d' ' -f2)
  gzip -c "$art/samples.ndjson" > "$out/samples.ndjson.gz"
  gzip -c "$art/run.log" > "$out/run.log.gz"
  gzip -c "$run/probe.out" > "$out/probe.out.gz"
  gzip -c "$run/threadcpu.ndjson" > "$out/threadcpu.ndjson.gz"
  cp "$run"/probe.err "$run"/driver.log "$run"/source-head.txt "$run"/wasm.sha256 \
     "$run"/node-version.txt "$run"/started-at.txt "$out"/ 2>/dev/null
  [ -f "$run/cli.pid" ] && cp "$run/cli.pid" "$out/"
  node ~/ship/abstat.js "$run" 600,900,1200,1500,1800 > "$out/windows.json"
  if [ -d "$run/prof" ]; then
    w=$(ls "$run"/prof/*.1.002.cpuprofile)
    gzip -c "$w" > "$out/worker.cpuprofile.gz"
    STACKS='wasm-function\[(10675|10641|10625)\]' node ~/ship/profsum.js "$w" 1190 1490 \
      'wasm-function\[(10625|10628|10675|10641|327|328|10700|10701|10702|10703)\]' 25 > "$out/worker-profile-1190-1490.txt"
    node ~/ship/profsum.js "$w" 600 900 \
      'wasm-function\[(10625|10628|10675|10641|327|328|10700|10701|10702|10703)\]' 25 > "$out/worker-profile-600-900.txt"
  fi
done
mkdir -p ~/ab/pack/scripts; cp ~/ship/*.sh ~/ship/*.js ~/ab/pack/scripts/
cp ~/ab/build-parent.log ~/ab/build-fix.log ~/ab/pack/
tar -C ~/ab -czf ~/ab/pack.tgz pack
sha256sum ~/ab/pack.tgz; ls -la ~/ab/pack.tgz
