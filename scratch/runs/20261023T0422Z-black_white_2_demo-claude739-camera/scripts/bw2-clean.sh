#!/bin/bash
# tl;dr: controlled single-input camera test, then the corrected Gold Scroll
# click. c0->c1 is a no-input settle check; c1->c2 brackets exactly one middle
# drag; c2->c3 shows whether the view keeps easing afterwards. Then the hand
# moves DY lower onto the scroll and clicks it.
# Usage: bw2-clean.sh RUN SDX SDY
set -u
RUN=$1; SDX=$2; SDY=$3; OUT=$RUN/camera
send() { printf '%s\n' "$1" > "$RUN/ctl.fifo"; echo "$(date -u +%T) $1" >> "$OUT/camera.log"; }
inp() { send "{\"id\":\"cln\",\"action\":\"input\",\"cmd\":\"$1\"}"; }
png() { send "{\"id\":\"$1\",\"action\":\"png\",\"path\":\"$OUT/$1.png\"}"; sleep 5; }
png c0; sleep 85; png c1
inp di-mousedown:3; sleep 3; inp relmousemove:200:0:5; sleep 20; inp di-mouseup:3; sleep 60; png c2
sleep 85; png c3
inp relmousemove:$SDX:$SDY; sleep 40; png t0
inp di-mousedown:1; sleep 3; inp di-mouseup:1; sleep 120; png t1
sleep 120; png t2
echo "$(date -u +%T) clean+scroll done" >> "$OUT/camera.log"
