#!/bin/bash
# tl;dr: send one control request to a running bw2-fifo-start.sh probe and
# print its [ctl] reply (waits up to 60 s). Logs every request in RUN/driver.log.
# Usage: ctl.sh RUN ID ACTION [k=v JSON fields...]
#   ctl.sh RUN e1 eval 'exports.guest_read32(0x1d734ac)'
#   ctl.sh RUN p1 png /abs/path.png
#   ctl.sh RUN i1 input di-mousedown:1
set -u
RUN=$1; ID=$2; ACT=$3; ARG=${4:-}
case $ACT in
  eval)  REQ=$(jq -cn --arg id "$ID" --arg c "$ARG" '{id:$id,action:"eval",code:$c}') ;;
  png)   REQ=$(jq -cn --arg id "$ID" --arg p "$ARG" '{id:$id,action:"png",path:$p}') ;;
  input) REQ=$(jq -cn --arg id "$ID" --arg c "$ARG" '{id:$id,action:"input",cmd:$c}') ;;
  *)     REQ=$(jq -cn --arg id "$ID" --arg a "$ACT" '{id:$id,action:$a}') ;;
esac
N=$(wc -l < "$RUN/probe.out")
printf '%s\n' "$REQ" > "$RUN/ctl.fifo"
echo "$(date -u +%T) $REQ" >> "$RUN/driver.log"
for i in $(seq 1 120); do
  R=$(tail -n +"$((N+1))" "$RUN/probe.out" | grep -F "[ctl] {\"id\":\"$ID\"" | head -1)
  if [ -n "$R" ]; then echo "$R"; echo "$(date -u +%T) <- $R" >> "$RUN/driver.log"; exit 0; fi
  sleep 0.5
done
echo "NO_REPLY $ID"
