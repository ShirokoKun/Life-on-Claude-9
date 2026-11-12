#!/usr/bin/env bash
# Finish the "One Cup" match-cut film: frames -> 24 fps H.264 with a recorded soundtrack that cuts with the picture.
#   tools/one_cup_finish.sh <frames dir> <sound dir> <out.mp4> [scale e.g. 1920:1080]
# <sound dir> holds the CC0 Red Library recordings (archive.org; see deliver/studies/SOUND_CREDITS.md):
#   rain_inside.flac (R23-33), birds.flac (R04-34), roomtone.flac (R10-03), cup_down.flac (R19-11), traffic.wav (R19-52)
# Dawn uses room-at-dawn's ambience (public-domain dawn chorus + CC BY leaves), from reference/external.
# Each world gets its own ambience, hard-cut on the picture cut (20 ms fades so nothing clicks), and every cut
# lands on a real cup being set down: tuck, tuck, tuck.
set -euo pipefail
FR="$1"; SD="$2"; OUT="$3"; SCALE="${4:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AMB="$ROOT/reference/external/room-at-dawn/public/audio/ambience.m4a"
N=$(ls "$FR"/f_*.png | wc -l); DUR=$(python3 -c "print($N/24)")
VF="format=yuv420p"; [ -n "$SCALE" ] && VF="scale=$SCALE:flags=lanczos,$VF"
# world cuts (s): dawn 0-3.0, rain 3.0-5.0, room 5.0-6.4, golden 6.4-7.5, night 7.5-end
seg() { # input, source start, cut in, cut out, gain
  echo "[$1:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=start=$2:duration=$(python3 -c "print($4-$3+0.05)"),asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=$(python3 -c "print($4-$3-0.02)"):d=0.02,volume=$5,adelay=$(python3 -c "print(int($3*1000))")|$(python3 -c "print(int($3*1000))")"
}
hit() { # source onset, at, gain
  echo "[4:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=start=$(python3 -c "print($1-0.03)"):duration=0.7,asetpts=PTS-STARTPTS,afade=t=out:st=0.35:d=0.35,volume=$3,adelay=$(python3 -c "print(int(($2-0.02)*1000))")|$(python3 -c "print(int(($2-0.02)*1000))")"
}
FC="$(seg 1 14 0 3.0 0.6)[a0];$(seg 2 1 3.0 5.0 0.55)[a1];$(seg 3 2 5.0 6.4 0.5)[a2];$(seg 5 4 5.0 6.4 0.12)[a2b];$(seg 6 6 6.4 7.5 0.35)[a3];$(seg 5 8 7.5 $DUR 0.45)[a4];$(seg 3 6 7.5 $DUR 0.25)[a4b];"
FC+="$(hit 5.59 3.0 0.9)[h1];$(hit 10.13 5.0 0.9)[h2];$(hit 11.50 6.4 0.9)[h3];$(hit 12.79 7.5 0.9)[h4];"
FC+="[a0][a1][a2][a2b][a3][a4][a4b][h1][h2][h3][h4]amix=inputs=11:normalize=0,afade=t=in:d=0.6,afade=t=out:st=$(python3 -c "print($DUR-1.0)"):d=1.0,volume=2.0,alimiter=limit=0.9[a]"
ffmpeg -v error -y -framerate 24 -i "$FR/f_%05d.png" -i "$AMB" -i "$SD/rain_inside.flac" -i "$SD/roomtone.flac" -i "$SD/cup_down.flac" -i "$SD/traffic.wav" -i "$SD/birds.flac" \
  -filter_complex "$FC" -map 0:v -map "[a]" -vf "$VF" -c:v libx264 -crf 15 -preset slow -tune film -c:a aac -b:a 192k -t "$DUR" "$OUT"
echo "wrote $OUT ($N frames, $DUR s)"
