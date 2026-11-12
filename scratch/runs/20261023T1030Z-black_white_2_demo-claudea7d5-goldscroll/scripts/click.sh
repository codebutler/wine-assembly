#!/bin/bash
# tl;dr: final aim nudge, arm EIP hit counters on the click path (slots 0..11),
# hold the left DI button 15 s, release, then capture/read state at +5/+60/+150 s.
# Usage: click.sh RUN DX DY
set -u
R=$1; DX=$2; DY=$3; O=$R/scroll; C=~/ctl.sh
st() { $C "$R" "$1" eval "$(cat ~/state.js)"; }
$C "$R" n1 input relmousemove:$DX:$DY > /dev/null; sleep 12
st a0; $C "$R" pa png "$O/aim2.png" > /dev/null
# 0 consumer entry (control) 1 left bit seen 2 left accepted 3 dispatcher
# 4 dispatcher refused 5 binding run 6 binding refused 7 widget took left
# 8 per-bit took left 9 gesture read 10 poll entry (control) 11 consumer gated return
$C "$R" arm eval '[0x60ed90,0x60edad,0x60edc3,0x611fa0,0x612032,0x611830,0x611efd,0x70c81d,0x64c55a,0x56d51e,0x9b0880,0x60ef3c].forEach((a,i)=>exports.set_count(i,a)),"armed"'
sleep 8; st a1
$C "$R" dn input di-mousedown:1 > /dev/null; sleep 15
st a2; $C "$R" up input di-mouseup:1 > /dev/null; sleep 5
st a3; $C "$R" pc1 png "$O/c1.png" > /dev/null; sleep 55
st a4; $C "$R" pc2 png "$O/c2.png" > /dev/null; sleep 90
st a5; $C "$R" pc3 png "$O/c3.png" > /dev/null
echo CLICK_DONE
