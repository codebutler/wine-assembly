#!/bin/bash
# tl;dr: third click, aimed ~12 cursor px higher (Oct 11 hit point), Oct 11 3 s hold.
set -u
R=$1; O=$R/scroll; C=~/ctl.sh
st() { $C "$R" "$1" eval "$(cat ~/state.js)"; }
$C "$R" n3 input relmousemove:3:-14 > /dev/null; sleep 12
st d0; $C "$R" pd0 png "$O/d0.png" > /dev/null
$C "$R" dn3 input di-mousedown:1 > /dev/null; sleep 3
$C "$R" up3 input di-mouseup:1 > /dev/null; sleep 20
st d1; $C "$R" pd1 png "$O/d1.png" > /dev/null; sleep 60
st d2; $C "$R" pd2 png "$O/d2.png" > /dev/null
echo CLICK3_DONE
