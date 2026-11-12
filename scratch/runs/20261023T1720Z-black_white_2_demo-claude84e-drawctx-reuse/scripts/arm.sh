#!/bin/bash
# tl;dr: one A/B arm. Same route as bw2-fifo-start.sh (FIFO stdin control,
# skip-intro, tr3 boot feed at 450 s, capture every 300 s) on REPO, plus a
# per-thread CPU sampler. PROF=1 adds V8 CPU profiles of every thread.
# Usage: arm.sh REPO RUN SECONDS
set -u
REPO=$1; RUN=$2; SECS=${3:-1800}
mkdir -p "$RUN"; cd "$REPO"
git rev-parse HEAD > "$RUN/source-head.txt" 2>/dev/null || cat SOURCE_HEAD > "$RUN/source-head.txt"
sha256sum build/wine-assembly.wasm > "$RUN/wasm.sha256"
NODE=${NODE:-node}   # the probe spawns the CLI with process.execPath, so this picks both
$NODE --version > "$RUN/node-version.txt"
mkfifo "$RUN/ctl.fifo"
setsid nohup sleep 100000 > "$RUN/ctl.fifo" 2>/dev/null &
echo $! > "$RUN/keeper.pid"
date -u +%FT%TZ > "$RUN/started-at.txt"
if [ "${PROF:-0}" = 1 ]; then
  mkdir -p "$RUN/prof"
  # NODE_OPTIONS refuses --cpu-prof; patch-probe.js passes these to the CLI child.
  export PROBE_NODE_ARGS="--cpu-prof --cpu-prof-dir=$RUN/prof --cpu-prof-interval=4000"
fi
setsid nohup $NODE tools/black-white-software-probe.js --seconds="$SECS" --skip-intro --no-build \
  --capture-every=300 --control-stdin < "$RUN/ctl.fifo" > "$RUN/probe.out" 2> "$RUN/probe.err" &
echo $! > "$RUN/probe.pid"
unset PROBE_NODE_ARGS
setsid nohup node "$HOME/ship/threadcpu.js" "$REPO" "$RUN/threadcpu.ndjson" 30 > /dev/null 2>&1 < /dev/null &
setsid nohup bash -c "
  sleep 450
  send() { printf '%s\n' \"\$1\" > '$RUN/ctl.fifo'; echo \"\$(date -u +%T) \$1\" >> '$RUN/driver.log'; }
  send '{\"id\":\"i\",\"action\":\"input\",\"cmd\":\"relmousemove:-2000:-2000\"}'; sleep 4
  send '{\"id\":\"i\",\"action\":\"input\",\"cmd\":\"relmousemove:250:277\"}'; sleep 4
  send '{\"id\":\"i\",\"action\":\"input\",\"cmd\":\"di-mousedown:1\"}'; sleep 3
  send '{\"id\":\"i\",\"action\":\"input\",\"cmd\":\"di-mouseup:1\"}'; sleep 20
  send '{\"id\":\"i\",\"action\":\"input\",\"cmd\":\"keydown:13\"}'
  echo boot-done >> '$RUN/driver.log'
  sleep $((SECS + 60)); kill \$(cat '$RUN/keeper.pid')
" > /dev/null 2>&1 < /dev/null &
echo started "$RUN"
