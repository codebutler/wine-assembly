#!/bin/bash
# tl;dr: aim the hand by DX,DY, capture where it landed, click, then capture
# twice to see whether the Gold Scroll objective was consumed.
# Usage: bw2-click.sh RUN DX DY TAG
set -u
RUN=$1; DX=$2; DY=$3; TAG=$4; OUT=$RUN/camera
send() { printf '%s\n' "$1" > "$RUN/ctl.fifo"; echo "$(date -u +%T) $1" >> "$OUT/camera.log"; }
inp() { send "{\"id\":\"clk\",\"action\":\"input\",\"cmd\":\"$1\"}"; }
png() { send "{\"id\":\"$1\",\"action\":\"png\",\"path\":\"$OUT/$1.png\"}"; sleep 5; }
inp relmousemove:$DX:$DY; sleep 12; png ${TAG}0
inp di-mousedown:1; sleep 3; inp di-mouseup:1; sleep 90; png ${TAG}1
sleep 120; png ${TAG}2
echo "$(date -u +%T) click $TAG done" >> "$OUT/camera.log"
