#!/bin/bash
# tl;dr: last click from the aim1 position (cursor ~495,286, where the game showed its mouse hint).
set -u
R=$1; O=$R/scroll; C=~/ctl.sh
$C "$R" f0 input relmousemove:25:5 > /dev/null; sleep 10
$C "$R" fs eval "$(cat ~/state.js)"; $C "$R" pf0 png "$O/f0.png" > /dev/null
$C "$R" f1 input di-mousedown:1 > /dev/null; sleep 3
$C "$R" f2 input di-mouseup:1 > /dev/null; sleep 30
$C "$R" pf1 png "$O/f1.png" > /dev/null; sleep 40
$C "$R" pf2 png "$O/f2.png" > /dev/null
echo CLICK5_DONE
