#!/bin/bash
# tl;dr: B&W2 camera-control test through the probe's stdin FIFO. Each step
# saves a png before and after one input, with waits of 60-90 s because the
# wide world view renders ~0.15 frames/s on software D3D9.
# Usage: bw2-camera.sh RUN  (RUN holds ctl.fifo; pngs + camera.log land in RUN/camera)
set -u
RUN=$1; OUT=$RUN/camera; mkdir -p "$OUT"
send() { printf '%s\n' "$1" > "$RUN/ctl.fifo"; echo "$(date -u +%T) $1" >> "$OUT/camera.log"; }
inp() { send "{\"id\":\"cam\",\"action\":\"input\",\"cmd\":\"$1\"}"; }
png() { send "{\"id\":\"$1\",\"action\":\"png\",\"path\":\"$OUT/$1.png\"}"; sleep 5; }
echo "$(date -u +%T) camera test start" >> "$OUT/camera.log"
png w0; inp di-wheel:-360; sleep 90; png w1
inp di-wheel:480; sleep 90; png w2
png m0; inp di-mousedown:3; sleep 3; inp relmousemove:150:0:5; sleep 20; inp di-mouseup:3; sleep 75; png m1
png l0; inp di-mousedown:1; sleep 3; inp relmousemove:0:-120:5; sleep 20; inp di-mouseup:1; sleep 75; png l1
echo "$(date -u +%T) camera test done" >> "$OUT/camera.log"
