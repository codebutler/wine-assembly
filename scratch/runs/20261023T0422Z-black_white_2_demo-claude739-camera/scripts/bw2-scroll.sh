#!/bin/bash
# tl;dr: idle control pair (no input, 90 s) to rule out scripted camera drift,
# then move the hand onto the Gold Scroll and click it, with pngs around each.
# Usage: bw2-scroll.sh RUN DX DY
set -u
RUN=$1; DX=$2; DY=$3; OUT=$RUN/camera
send() { printf '%s\n' "$1" > "$RUN/ctl.fifo"; echo "$(date -u +%T) $1" >> "$OUT/camera.log"; }
inp() { send "{\"id\":\"scr\",\"action\":\"input\",\"cmd\":\"$1\"}"; }
png() { send "{\"id\":\"$1\",\"action\":\"png\",\"path\":\"$OUT/$1.png\"}"; sleep 5; }
png idle0; sleep 85; png idle1
inp relmousemove:$DX:$DY; sleep 40; png s0
inp di-mousedown:1; sleep 3; inp di-mouseup:1; sleep 120; png s1
sleep 120; png s2
echo "$(date -u +%T) scroll done" >> "$OUT/camera.log"
