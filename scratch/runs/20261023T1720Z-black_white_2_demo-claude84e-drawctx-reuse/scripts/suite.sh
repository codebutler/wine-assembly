#!/bin/bash
# tl;dr: run heap / d3d / render-worker unit tests (no -web) in TREE, 120 s each,
# one line per test "PASS|FAIL name" into OUT; EXIT= marker at the end.
TREE=$1; OUT=$2
cd "$TREE"
: > "$OUT"
for t in $(ls test/test-heap*.js test/test-d3d*.js test/test-render-worker*.js test/test-guest-alloc*.js test/test-virtual*.js 2>/dev/null | grep -v -- '-web\.js$' | sort -u); do
  timeout 120 node "$t" > "$OUT.d.$(basename $t).log" 2>&1
  s=$?; [ $s = 0 ] && echo "PASS $t" >> "$OUT" || echo "FAIL($s) $t" >> "$OUT"
done
echo EXIT=0 >> "$OUT"
