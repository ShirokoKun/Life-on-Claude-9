# Apply the animation plan's camera moves, flows and performance windows to engine/scenes/kf1/scene.js.
#   python -I tools/kf_apply_moves.py
# Source of the numbers: scenes/ch1-keyframes/ANIMATION_PLAN.md. Each shot's keyframe camera ('from', 'at0') stays the
# keyframe; this writes 'to' / 'at1' (where the move ends), 'mv' (a move window inside the shot), 'flow' (one move over
# several shots, FLOWS) and 'iv' play windows ([clip, a, b, rate]). Idempotent: it recomputes from the keyframe values.
import math, os, re

ROOT = os.path.join(os.path.dirname(__file__), '..')
P = os.path.join(ROOT, 'engine', 'scenes', 'kf1', 'scene.js')
s = open(P, encoding='utf8').read()
CONST = {'ISO_CAM': [2.45, 2.70, 2.30], 'ISO_AT': [1.18, 4.30, 1.02], 'BEHIND': [1.05, 2.55, 1.55], 'BEHIND_AT': [1.05, 4.55, 1.24],
         'PHONE': [1.50, 4.16, 0.758], 'WATER': [0.76, 4.33, 0.845]}

def block(sid):
    i = s.index("{ id: '%s'" % sid); j = s.index("\n  { id:", i + 5) if "\n  { id:" in s[i + 5:] else s.index("\n];", i)
    return i, j

def val(b, key):
    m = re.search(key + r": (\[[^\]]*\]|[A-Z_]+|'[^']*')", b)
    if not m: return None
    v = m.group(1)
    if v.startswith('['): return [float(x) for x in v[1:-1].split(',')]
    if v.startswith("'"): return v
    return CONST[v]

def fmt(v): return '[' + ', '.join(f'{x:.3f}'.rstrip('0').rstrip('.') if abs(x - round(x)) > 1e-9 else f'{x:.1f}' for x in v) + ']'

def setf(b, key, v):
    return re.sub(key + r": (\[[^\]]*\]|[A-Z_]+|'[^']*')", f'{key}: {v}', b, count=1)

def add(a, b, k=1): return [a[i] + k * b[i] for i in range(3)]
def sub(a, b): return [a[i] - b[i] for i in range(3)]
def norm(a): l = math.sqrt(sum(x * x for x in a)) or 1; return [x / l for x in a]

# move kinds: ('push', pct) toward the aim (negative = pull back); ('truck', cm) camera-right (+) / left (-);
# ('rise', cm); ('tilt', cm of aim rise); ('static',); window: (a, b) inside the shot
MOVES = {
    'K01': ('push', 3), 'K02': ('push', 3), 'K03': ('truck', 5), 'K04': ('static',), 'K05': ('push', 6), 'K06': ('push', 3),
    'K07': ('push', 2, (24.4, 26.6)), 'K08': ('push', 3), 'K09': ('push', 3), 'K10': ('truck', 8, (34.9, 36.25)), 'K11': ('push', 3), 'K12': ('static',), 'K13': ('push', 4),
    'K14': ('truck', -3), 'K15': ('truck', 6), 'K16': ('truck', 4, (60.0, 64.05)), 'K17': ('push', 3), 'K18': ('push', 3),
    'K19': ('push', 3), 'K20': ('static',), 'K22': ('static',), 'K23': ('push', 3), 'K25': ('push', 3),
    'K28': ('push', 8), 'K29': ('static',), 'K30': ('truck', -6), 'K35': ('truck', 12), 'K36': ('push', 4), 'K37': ('push', -3),
    'K38': ('static',), 'K39': ('push', 3), 'K40': ('static',), 'K41': ('truck', 3), 'K42': ('tilt', 35, (153.4, 157.6)),
    'K43': ('push', 4, (158.0, 160.2)), 'K44': ('push', -3), 'K45': ('tilt', 150), 'K46': ('push', 3, (168.6, 171.94)),
    'K47': ('static',), 'K48': ('push', -3), 'K49': ('truck', 12), 'K50': ('push', 4), 'K51': ('push', 3), 'K52': ('push', 2.5),
}
# performance windows (ANIMATION_PLAN.md: PLAY a to b; flows keep one clock); hold = leave as is
PLAY = {   # round 11: only the performance's TYPE spans (its READ spans sweep the head and snap back, which reads as a loop);
           # consecutive shots continue one clock; nothing passes the clip's end (s03 37.0, s04 31.29; the mixer loops)
    'K01': [0.6, 3.6], 'K03': [10.2, 15.1], 'K05': [16.4, 19.1], 'K06': [10.2, 12.8], 'K07': [0.4, 5.6], 'K08': [22.4, 25.0],
    'K10': [6.2, 9.2], 'K11': [5.1, 8.5], 'K15': [24.9], 'K16': [25.95, 29.8], 'K19': [8.0, 9.4], 'K20': [9.3],
    'K21a': [0.6, 2.4], 'K21b': [2.4, 4.15], 'K21c': [4.15, 6.1], 'K21d': [6.1, 8.3], 'K22': [8.3, 11.7],
    'K23': [32.0, 33.3], 'K32': [10.0, 14.9], 'K36': [0.4, 5.6, 1.25], 'K38': [10.0, 13.1], 'K39': [15.0],
    'K40': [16.4, 19.4], 'K41': [13.0], 'K42': [0.4, 5.6], 'K48': [30.75, 33.3], 'K49': [32.0, 33.3], 'K50': [33.0, 36.8],
}
FLOW_OF = {'K24': 'F3', 'K21a': 'F2', 'K21b': 'F2', 'K21c': 'F2', 'K21d': 'F2', 'K26': 'F4', 'K27': 'F4',
           'K33': 'F6', 'K34': 'F6'}

out = []
for sid in re.findall(r"\{ id: '(K\w+)'", s):
    i, j = block(sid); b = s[i:j]
    frm, at = val(b, 'from'), val(b, 'at0')
    m = MOVES.get(sid)
    b = re.sub(r" mv: \[[^\]]*\],", '', b); b = re.sub(r" flow: '[^']*',", '', b)
    if m and isinstance(frm, list) and isinstance(at, list):
        k = m[0]; to, at1 = frm, at
        if k == 'push': to = add(frm, sub(at, frm), m[1] / 100)
        elif k == 'truck':
            d = norm([at[1] - frm[1], -(at[0] - frm[0]), 0]); to = add(frm, d, m[1] / 100); at1 = add(at, d, m[1] / 100)
        elif k == 'tilt': at1 = add(at, [0, 0, m[1] / 100])
        b = setf(b, 'to', fmt(to)); b = setf(b, 'at1', fmt(at1))
        if len(m) > 2: b = b.replace("roll:", f"mv: [{m[2][0]}, {m[2][1]}], roll:", 1)
        out.append(f'{sid}: {k} {m[1:] if len(m) > 1 else ""}')
    if sid in FLOW_OF: b = b.replace("roll:", f"flow: '{FLOW_OF[sid]}', roll:", 1)
    if sid in PLAY:
        iv = re.search(r"iv: \['(s0\d)', [^\]]*\]", b)
        if iv:
            w = PLAY[sid]; b = b.replace(iv.group(0), f"iv: ['{iv.group(1)}', {', '.join(str(x) for x in w)}]", 1)
    s = s[:i] + b + s[j:]

# the flows: one eased move across their shots (the camera of the first shot to the end framing given)
FLOWS = """export const FLOWS = {
  // (no F1: K07's camera sits between his face and the laptop and K08's is behind him, and a move between them would pass
  // through his head, so K07 -> K08 is a cut)
  F2: { t0: 74.1, t1: 81.8, cam: { from: [2.45, 2.70, 2.30], to: [2.367, 2.796, 2.215], at0: [1.18, 4.30, 1.02], at1: [1.18, 4.30, 1.02], mm: [28, 28] } },   // K21a-d: push 6% at the island
  F3: { t0: 92.6, t1: 93.8, cam: { from: [0.92, 5.55, 1.12], to: [1.04, 4.95, 2.85], at0: [0.98, 3.95, 1.32], at1: [1.04, 3.90, 0.95], mm: [24, 24] } },   // K24 to K25: the crane up over his head as the desk breaks away
  F4: { t0: 97.4, t1: 102.3, cam: { from: [1.04, 2.85, 1.05], to: [1.78, 4.12, 1.02], arc: [1.04, 3.95], at0: [1.04, 5.4, 2.1], at1: [1.02, 4.00, 1.45], mm: [28, 28] } },   // K26 to K27: orbit round him (radius 1.1 to 0.76 m) to his profile, the aim coming down from the rings to his face
  F6: { t0: 117.7, t1: 126.3, cam: { from: [1.54, 3.11, 1.36], to: [1.574, 3.135, 1.358], at0: [1.20, 3.84, 1.32], at1: [1.20, 3.84, 1.32], mm: [50, 50] } },   // K33 to K34: one slow push, ending past the K34 keyframe
};"""
s, nsub = re.subn(r"export const FLOWS = \{.*?\n\};", lambda m: FLOWS, s, count=1, flags=re.S)
assert nsub == 1, "FLOWS table not found"
open(P, 'w', encoding='utf8', newline='').write(s)
print('\n'.join(out)); print(len(out), 'moves')
