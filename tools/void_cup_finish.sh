#!/usr/bin/env bash
# Finish the "First Light" study: frames -> 24 fps H.264 with the recorded dawn ambience under it.
#   tools/void_cup_finish.sh <frames dir> <out.mp4> [scale e.g. 1920:1080]
# Sound: room-at-dawn's ambience mix (public/audio/ambience.m4a): a public-domain dawn chorus (Silas S. Brown)
# and "Rustling leaves" by Gravity Sound (CC BY 4.0), filtered as if heard through a closed window.
# Credited in deliver/studies/SOUND_CREDITS.md.
set -euo pipefail
FR="$1"; OUT="$2"; SCALE="${3:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AMB="$ROOT/reference/external/room-at-dawn/public/audio/ambience.m4a"
N=$(ls "$FR"/f_*.png | wc -l); DUR=$(python3 -c "print($N/24)")
VF="format=yuv420p"; [ -n "$SCALE" ] && VF="scale=$SCALE:flags=lanczos,$VF"
ffmpeg -v error -y -framerate 24 -i "$FR/f_%05d.png" -ss 14 -t "$DUR" -i "$AMB" \
  -filter_complex "[1:a]volume=0.55,afade=t=in:d=1.2,afade=t=out:st=$(python3 -c "print($DUR-1.5)"):d=1.5[a]" \
  -map 0:v -map "[a]" -vf "$VF" -c:v libx264 -crf 15 -preset slow -tune film -c:a aac -b:a 192k -shortest "$OUT"
echo "wrote $OUT ($N frames, $DUR s)"
