#!/bin/bash
# tl;dr: same-frame check. Headless B&W2 on the frozen (batch) clock, no real
# ticks, fixed batch count, in TREE; PNG at the end. Both arms run with the
# same flags, so equal md5 = same rendered frame. Usage: frozen.sh TREE OUTDIR BATCHES
TREE=$1; OUT=$2; N=$3
mkdir -p "$OUT"; cd "$TREE"
G="$TREE/test/binaries/win98-games-a-d/Black and White 2-DX9-D3D/installed"
timeout 1500 node test/run.js --exe="$G/BW2Demo.exe" --vfs-include='**/*' \
  --dll-seed="$G/d3dx9_25.dll,$G/binkw32.dll,$G/dbghelp.dll" \
  --d3d9-renderer=software --d3d9-programmable --memory-mb=2048 \
  --quiet-api --quiet-blocks --batch-size=200000 --max-batches=$N --no-close \
  --png="$OUT/frame.png" --no-build > "$OUT/run.log" 2>&1
echo EXIT=$? >> "$OUT/run.log"
md5sum "$OUT/frame.png" >> "$OUT/run.log" 2>&1
