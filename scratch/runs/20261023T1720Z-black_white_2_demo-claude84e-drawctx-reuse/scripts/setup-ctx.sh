#!/bin/bash
# tl;dr: worktree ~/ab/ctx = f5329feb1 + fix.patch, full build, then the new
# test on ctx (fixed) and on ~/ab/fix (unfixed control, test file copied in).
set -u
exec >> ~/ship2/setup.log 2>&1
cd ~/wa-scroll
git worktree add --detach ~/ab/ctx f5329feb1 || exit 1
cd ~/ab/ctx && git apply ~/ship2/fix.patch || exit 1
ln -sfn ~/tb ~/ab/ctx/test/binaries
[ -e node_modules ] || ln -s ~/wa-scroll/node_modules node_modules
echo "== build $(date -u +%T)"
bash tools/build.sh > ~/ship2/build-ctx.log 2>&1; echo "build exit=$?"
sha256sum build/wine-assembly.wasm
T=test/test-d3d-software-ctx-arena-reuse.js
timeout 120 node $T; echo "fixed test exit=$?"
cp $T ~/ab/fix/$T
(cd ~/ab/fix && timeout 120 node $T); echo "unfixed test exit=$?"
echo EXIT=0
