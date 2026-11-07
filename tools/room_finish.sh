#!/bin/bash
# Finish the room film: grade every frame (tools/room_post.py), encode 24 fps, upscale to 1920x1080, mix real CC0 sound.
#   tools/room_finish.sh <frames_dir> <sound_dir> <out.mp4>
# Sound: distant city traffic (the window), a low-passed empty-station tone (room air), cloth whooshes on the whip pans.
set -e
F=$1; SND=$2; OUT=$3; G=${F}_graded
python3 "$(dirname "$0")/room_post.py" --dir "$F" "$G"
N=$(ls "$G"/f_*.png | wc -l); T=$(python3 -c "print($N/24)")
ffmpeg -v error -y -framerate 24 -start_number 1 -i "$G/f_%04d.png" -ss 3 -t "$T" -i "$SND/traffic.wav" -ss 4 -t "$T" -i "$SND/station.wav" -i "$SND/cloth_whoosh.wav" -i "$SND/cloth_whoosh.wav" \
  -filter_complex "[0]scale=1920:1080:flags=lanczos,unsharp=5:5:0.35,format=yuv420p[v];\
[1]aformat=channel_layouts=stereo,highpass=f=80,lowpass=f=5000,volume=0.32[a];\
[2]aformat=channel_layouts=stereo,lowpass=f=1500,volume=0.16[b];\
[3]atrim=0:1.0,asetpts=PTS-STARTPTS,aformat=channel_layouts=stereo,afade=t=out:st=0.6:d=0.4,volume=0.5,adelay=12800|12800[w1];\
[4]atrim=0:1.0,asetpts=PTS-STARTPTS,aformat=channel_layouts=stereo,afade=t=out:st=0.6:d=0.4,volume=0.55,adelay=17100|17100[w2];\
[a][b][w1][w2]amix=inputs=4:normalize=0,alimiter=limit=0.9,afade=t=in:d=0.8,afade=t=out:st=$(python3 -c "print($T-1.0)"):d=1.0[aud]" \
  -map "[v]" -map "[aud]" -t "$T" -c:v libx264 -crf 18 -preset slow -c:a aac -b:a 192k -movflags +faststart "$OUT"
echo "wrote $OUT ($T s)"
