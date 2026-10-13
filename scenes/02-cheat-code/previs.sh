#!/usr/bin/env bash
# Scene 2 previs stills (Cycles). Usage: scenes/02-cheat-code/previs.sh OUT_DIR IVAN_BLEND [PYTHON]
# IVAN_BLEND: the performance blend from prep_tripo.py --blend. PYTHON: a Python with bpy (default: python3).
set -e
OUT=$1; IVAN=$2; PY=${3:-python3}
R="--res 960x480 --samples 32"
run() { "$PY" -I blender/scenes/previs.py "$OUT" --ivan "$IVAN" $R "$@"; }
run --preset day \
  --shot "2.1|100|seat|9.6,4.3,1.9|7.0,3.0,1.0|24|0|7,3,1" \
  --shot "2.2|100|seat|7.32,2.22,1.36|6.95,3.25,0.86|35|2.8|6.95,3.20,0.90" \
  --shot "2.3|790|seat|7.05,3.70,1.24|6.95,2.72,1.18|45|2.4|6.95,2.74,1.18" \
  --shot "2.10|100|seat|4.55,4.95,1.55|6.95,2.95,0.95|20|0|7,3,1"
run --preset evening \
  --shot "2.7|480|seat|6.90,3.58,0.93|6.90,3.00,1.00|85|2.0|6.88,3.25,0.89" \
  --shot "2.12|480|seat|6.97,3.75,1.06|6.94,2.76,1.10|85|1.6|6.94,2.78,1.12"
run --preset sunrise \
  --shot "2.9|100|seat|8.95,2.85,1.30|9.74,2.85,1.20|40|2.8|9.72,2.85,1.22" \
  --shot "2.15|0|stand@4.75,5.05|4.75,2.30,1.45|4.75,5.43,1.25|28|0|4.75,5.0,1.2"
