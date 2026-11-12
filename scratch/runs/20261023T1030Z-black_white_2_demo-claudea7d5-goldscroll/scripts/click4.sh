#!/bin/bash
# tl;dr: click once (3 s hold) with slot 0 on 0x64c551 and dump who reached it.
set -u
R=$1; C=~/ctl.sh
$C "$R" k1 input di-mousedown:1; sleep 3
$C "$R" k2 input di-mouseup:1; sleep 25
$C "$R" k3 eval '({c:[0,1,2].map(i=>exports.get_count(i)),first:exports.get_hit0_first_caller().toString(16),last:exports.get_hit0_last_caller().toString(16),ebp:(exports.get_hit0_last_ebp()>>>0).toString(16),regs:[0,1,2,3,4,5,6,7].map(i=>(exports.get_hit0_reg(i)>>>0).toString(16)),frames:[0,1,2,3,4,5,6,7].map(i=>(exports.get_hit0_frame(i)>>>0).toString(16))})'
$C "$R" pe png "$R/scroll/e1.png"
echo CLICK4_DONE
