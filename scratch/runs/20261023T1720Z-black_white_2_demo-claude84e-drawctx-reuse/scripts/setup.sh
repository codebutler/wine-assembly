#!/bin/bash
# tl;dr: two clean worktrees off ~/wa-scroll's repo, parent (32c0b9bcf =
# f5329feb1^) and fix (f5329feb1), each with test/binaries -> ~/tb, then a
# full build of each, one after the other. Log: ~/ab/setup.log, EXIT= marker.
set -u
mkdir -p ~/ab
exec >> ~/ab/setup.log 2>&1
cd ~/wa-scroll
for arm in parent:32c0b9bcf fix:f5329feb1; do
  name=${arm%%:*}; rev=${arm##*:}
  git worktree add --detach ~/ab/$name $rev || exit 1
  ln -sfn ~/tb ~/ab/$name/test/binaries
  [ -e ~/ab/$name/node_modules ] || ln -s ~/wa-scroll/node_modules ~/ab/$name/node_modules
done
for name in parent fix; do
  echo "== build $name $(date -u +%T)"
  (cd ~/ab/$name && bash tools/build.sh > ~/ab/build-$name.log 2>&1); echo "build $name exit=$?"
  sha256sum ~/ab/$name/build/wine-assembly.wasm
done
echo EXIT=0
