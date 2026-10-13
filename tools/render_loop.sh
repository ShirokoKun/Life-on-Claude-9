#!/usr/bin/env bash
# Keep capturing a frame range until every frame exists (survives job time limits and crashes).
#   tools/render_loop.sh OUT_DIR FIRST LAST [extra capture args...]
OUT=$1; A=$2; Z=$3; shift 3
mkdir -p "$OUT"
while :; do
  missing=0
  for ((n=A; n<=Z; n++)); do f=$(printf "%s/f_%05d.png" "$OUT" $n); [ -s "$f" ] || { missing=1; break; }; done
  [ $missing = 0 ] && { echo "range $A-$Z complete"; exit 0; }
  # drop frames that were cut off mid-write
  for f in $(ls -t "$OUT"/f_*.png 2>/dev/null | head -4); do python3 -c "from PIL import Image; Image.open('$f').load()" 2>/dev/null || rm -f "$f"; done
  timeout 6600 node tools/capture.mjs --out "$OUT" --frames $A-$Z --skip-existing "$@"
done
