#!/bin/bash
# tl;dr: tr3's bw-fix4.sh route (stdin JSON control, capture-every=300, same
# boot timings) on REPO, but stdin is a FIFO held open by a sleeper so later
# commands can be sent by hand:  echo '{"id":"x","action":"input","cmd":"..."}' > RUN/ctl.fifo
# Usage: bw2-fifo-start.sh REPO RUN SECONDS
set -u
REPO=$1; RUN=$2; SECS=${3:-8000}
mkdir -p "$RUN"; cd "$REPO"
git rev-parse HEAD > "$RUN/source-head.txt"; sha256sum build/wine-assembly.wasm > "$RUN/wasm.sha256"
rm -f "$RUN/ctl.fifo"; mkfifo "$RUN/ctl.fifo"
setsid nohup sleep 100000 > "$RUN/ctl.fifo" 2>/dev/null &
echo $! > "$RUN/keeper.pid"
date -u +%FT%TZ > "$RUN/started-at.txt"
setsid nohup node tools/black-white-software-probe.js --seconds="$SECS" --skip-intro --no-build \
  --capture-every=300 --control-stdin < "$RUN/ctl.fifo" > "$RUN/probe.out" 2> "$RUN/probe.err" &
echo $! > "$RUN/probe.pid"
# tr3 boot feed, same gaps.
setsid nohup bash -c "
  sleep 450
  send() { printf '%s\n' \"\$1\" > '$RUN/ctl.fifo'; echo \"\$(date -u +%T) \$1\" >> '$RUN/driver.log'; }
  send '{\"id\":\"i\",\"action\":\"input\",\"cmd\":\"relmousemove:-2000:-2000\"}'; sleep 4
  send '{\"id\":\"i\",\"action\":\"input\",\"cmd\":\"relmousemove:250:277\"}'; sleep 4
  send '{\"id\":\"i\",\"action\":\"input\",\"cmd\":\"di-mousedown:1\"}'; sleep 3
  send '{\"id\":\"i\",\"action\":\"input\",\"cmd\":\"di-mouseup:1\"}'; sleep 20
  send '{\"id\":\"i\",\"action\":\"input\",\"cmd\":\"keydown:13\"}'
  echo boot-done >> '$RUN/driver.log'
" > /dev/null 2>&1 < /dev/null &
echo started
