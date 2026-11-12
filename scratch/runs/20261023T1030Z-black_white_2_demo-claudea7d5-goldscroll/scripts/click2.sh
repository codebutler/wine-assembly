#!/bin/bash
# tl;dr: second click on the scroll with finer counters inside the binding runner 0x611830.
set -u
R=$1; O=$R/scroll; C=~/ctl.sh
st() { $C "$R" "$1" eval "$(cat ~/state.js)"; }
$C "$R" b0 png "$O/b0.png" > /dev/null
$C "$R" arm2 eval '[0x60ed90,0x60edad,0x60edc3,0x611897,0x6118c4,0x6118f1,0x611aa7,0x611efd,0x64c55a,0x611884,0x9b0880,0x611fa0].forEach((a,i)=>exports.set_count(i,a)),"armed"'
sleep 5; st b1
$C "$R" dn2 input di-mousedown:1 > /dev/null; sleep 15
st b2; $C "$R" up2 input di-mouseup:1 > /dev/null; sleep 5
st b3; $C "$R" pb1 png "$O/b1.png" > /dev/null; sleep 60
st b4; $C "$R" pb2 png "$O/b2.png" > /dev/null
echo CLICK2_DONE
