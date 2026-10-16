# The animation timing for Chapter 1 (ANIMATION_PLAN.md), written into engine/scenes/kf1/scene.js as per-shot data:
# births, ramps, keyed paths, fades and cuts on the sound hits. Run after tools/kf_apply_moves.py.
#   python -I tools/kf_apply_anim.py
# Idempotent: every field it writes is removed first, then written again.
import os, re

ROOT = os.path.join(os.path.dirname(__file__), '..')
P = os.path.join(ROOT, 'engine', 'scenes', 'kf1', 'scene.js')
s = open(P, encoding='utf8').read()
FIELDS = ['gaze', 'lookK', 'leanK', 'press', 'grade', 'ghostTicks', 'deskAway', 'fadeIn', 'cutBlack', 'zoneAt', 'dimIn', 'rise', 'breath', 'iconsBorn', 'lifeBorn', 'lifeShrink', 'weaveT0', 'evTo', 'lacedRamp', 'flick', 'tapKey']
CL_FIELDS = ['born', 'bornDur', 'exit', 'path']

def block(sid):
    i = s.index("{ id: '%s'" % sid); j = s.index("\n  { id:", i + 5) if "\n  { id:" in s[i + 5:] else s.index("\n];", i)
    return i, j

def strip_fields(b):
    for f in FIELDS: b = re.sub(r" %s: (\[\[.*?\]\]\]|\[\[.*?\]\]|\[[^\]]*\]|\{[^}]*\}|[\d.\-]+|'[^']*'|true)," % f, '', b)
    b = re.sub(r", (born|bornDur|exit): [\d.]+", '', b)
    b = re.sub(r", path: \[\[.*?\]\]\]", '', b)
    return b

ANIM = {
    'K01': {'fadeIn': '[0.0, 1.0]'},
    'K09': {'weaveT0': '31.3', 'cl': {'born': 30.35}},
    'K12': {'lookK': '[[41.9, -16, -15], [46.4, -18, -18]]', 'breath': '0.32', 'cl': {'born': 42.2, 'exit': 46.1, 'path': '[[42.2, [1.30, 4.28, 1.18]], [43.2, [1.10, 4.55, 1.32]], [44.0, [0.66, 4.12, 1.36]], [44.8, [0.98, 3.70, 1.30]], [45.6, [0.92, 4.30, 1.20]]]'}},
    'K13': {'rise': '[46.4]', 'breath': '0.4', 'lookK': '[[46.4, -20, -30], [51.0, -24, -32]]'},
    'K14': {'lookK': '[[51.0, -18, -15], [51.9, -18, -15], [53.8, 8, -22]]', 'cl': {'born': 51.01}},
    'K15': {'lookK': '[[55.3, 6, 12], [59.6, 8, -12]]', 'dimIn': '[1.0, 1.0]', 'pipe_born': '[56.2, 57.0, 58.1, 59.2]'},
    'K17': {'evTo': '[-7, 68.1, 0.4]'},
    'K18': {'dimIn': '[0.0, 0.6]', 'pipe_ticks': '[69.2, 69.55, 69.9, 70.25]'},
    'K05': {'leanK': '[[15.6, 9], [16.3, 9], [17.7, -3]]', 'lookK': '[[15.6, -4, 0], [16.4, -4, 0], [17.6, 8, 0]]'},
    'K06': {'lookK': '[[18.3, -8, 0], [19.1, -8, 0], [20.8, 8, -14]]'},
    'K21a': {'dimIn': '[1.0, 1.7]', 'iconsBorn': '[74.35, 76.09, 77.83, 79.80]', 'cl': {'born': 74.2}},
    'K21b': {'iconsBorn': '[74.35, 76.09, 77.83, 79.80]', 'cl': {'path': '[[75.85, [0.62, 4.62, 1.38]], [76.35, [1.12, 4.70, 1.56]]]'}},
    'K21c': {'iconsBorn': '[74.35, 76.09, 77.83, 79.80]', 'cl': {'path': '[[77.6, [1.12, 4.70, 1.56]], [78.1, [1.66, 4.66, 1.48]]]'}},
    'K21d': {'iconsBorn': '[74.35, 76.09, 77.83, 79.80]', 'cl': {'path': '[[79.55, [1.66, 4.66, 1.48]], [80.05, [2.10, 4.40, 1.30]]], exit: 81.5'}},
    'K22': {'ghostTicks': '[82.07, 82.62, 83.72]'},
    'K24': {'deskAway': '[93.3, 93.8]', 'zoneAt': '90.59', 'lifeBorn': '[91.3, 91.5, 91.75, 92.0, 92.25, 92.5]', 'lifeShrink': '93.4', 'cl': {'born': 90.7}},
    'K29': {'cutBlack': '105.15'},
    'K30': {'fadeIn': '[105.65, 0.5]'},
    'K42': {'cl': {'born': 156.0, 'bornDur': 1.2}},
    'K43': {'press': '160.2', 'tapKey': 'true'},
    'K44': {'flick': '[162.2, 166.0]'},   # round 12: screen light switching on his face, flare at the end
    'K46': {'cutBlack': '171.94'},
    'K47': {'fadeIn': '[172.4, 0.8]'},
    'K48': {'grade': '{ con: 0.25, sat: 1.05 }'},
    'K49': {'grade': '{ con: 0.35, sat: 1.12 }', 'iconsBorn': '[177.9, 178.6, 179.7, 181.1]', 'cl': {'born': 177.9, 'bornDur': 0.9}},
    'K50': {'grade': '{ con: 0.25, sat: 1.05 }', 'lacedRamp': '[182.9, 184.1]'},
    'K51': {'grade': '{ con: 0.25, sat: 1.05 }'},
    'K52': {'grade': '{ con: 0.25, sat: 1.05 }', 'cutBlack': '195.52'},
}

# where his eyes look (aimEyes in scene.js): 'screen' 'monitor' 'phone' 'claude' 'cam', a point, or keyed
GAZE = {'K06': "[[18.3, 'screen'], [19.6, 'screen'], [20.6, 'monitor']]", 'K12': "'phone'", 'K13': "'phone'", 'K14': "[[51.0, 'phone'], [52.0, 'phone'], [52.7, 'claude']]", 'K15': '[[55.3, [0.70, 4.50, 1.30]], [59.5, [1.40, 4.50, 1.30]]]', 'K19': "[[71.2, 'screen'], [71.9, [1.06, 5.6, 1.25]]]", 'K20': '[1.06, 5.6, 1.25]', 'K24': "[[89.9, 'screen'], [91.1, [1.0, 6.5, 3.2]]]", 'K46': "'cam'", 'K50': '[1.06, 6.0, 1.3]', 'K51': '[1.06, 6.0, 1.3]', 'K52': '[1.06, 6.0, 1.3]'}
for sid, g in GAZE.items():
    ANIM.setdefault(sid, {})['gaze'] = g
# cuts moved onto the sound hits (the plan's section 3.4): [shot ending, shot starting, time]
CUTS = [('K27', 'K28', 102.3), ('K13', 'K14', 51.01), ('K16', 'K17', 64.11), ('K44', 'K45', 166.0), ('K45', 'K46', 168.85)]

for sid, A in ANIM.items():
    i, j = block(sid); b = strip_fields(s[i:j])
    adds = ' '.join(f'{k}: {v},' for k, v in A.items() if k not in ('cl', 'pipe_born', 'pipe_ticks'))
    if adds: b = b.replace("light: '", adds + " light: '", 1) if "light: '" in b else b
    if 'pipe_born' in A: b = re.sub(r"pipe: \{ state: 'offer'", f"pipe: {{ born: {A['pipe_born']}, state: 'offer'", re.sub(r"born: \[[^\]]*\], ", '', b), count=1)
    if 'pipe_ticks' in A: b = re.sub(r"pipe: \{ state: 'done'", f"pipe: {{ ticks: {A['pipe_ticks']}, state: 'done'", re.sub(r"ticks: \[[^\]]*\], ", '', b), count=1)
    if 'cl' in A:
        m = re.search(r"cl: \{([^}]*)\}", b); assert m, sid
        inner = m.group(1).rstrip()
        extra = ''.join(f", {k}: {v}" for k, v in A['cl'].items())
        b = b[:m.start()] + 'cl: {' + inner + extra + ' }' + b[m.end():]
    s = s[:i] + b + s[j:]

for a, c, tt in CUTS:
    i, j = block(a); s = s[:i] + re.sub(r"t1: [\d.]+,", f't1: {tt},', s[i:j], count=1) + s[j:]
    i, j = block(c); s = s[:i] + re.sub(r"t0: [\d.]+,", f't0: {tt},', s[i:j], count=1) + s[j:]

# camera overrides (round 11): replace the keyframe camera of these shots with the move written here
CAMS = {
    'K02': dict(mm='[85, 85]', f='5.6', frm='[1.165, 4.534, 1.049]', to='[1.162, 4.524, 1.051]', at0='[1.074, 4.194, 1.124]', at1='[1.074, 4.194, 1.124]', focus='[1.080, 4.205, 1.122]'),   # into his right eye (eye bone measured), low 3/4
    'K07': dict(mm='[24, 24]', f='5.6', frm='[1.40, 4.02, 1.10]', to='[1.31, 4.15, 1.05]', at0='[1.05, 4.40, 0.86]', at1='[1.04, 4.45, 0.90]', focus='[1.05, 4.42, 0.88]', mv='[20.9, 26.6]'),
    'K12': dict(frm='[2.10, 3.92, 1.16]', to='[2.042, 4.391, 1.16]', at0='[1.00, 3.98, 1.20]', at1='[1.00, 3.98, 1.20]', mv='[45.6, 46.4]', ease="'in'", arc='[1.05, 4.03]'),
    'K13': dict(frm='[1.923, 5.472, 1.08]', to='[0.82, 5.70, 1.08]', at0='[1.06, 4.05, 1.02]', at1='[1.06, 4.05, 1.02]', mv='[46.4, 47.6]', ease="'out'", arc='[1.05, 4.03]'),
    'K31': dict(frm='[1.80, 3.98, 1.02]', to='[1.849, 4.184, 1.16]', at0='[1.45, 4.20, 0.78]', at1='[1.45, 4.20, 0.78]', mv='[109.9, 112.8]', arc='[1.50, 4.16]'),
    'K32': dict(frm='[1.86, 3.90, 1.16]', to='[1.83, 3.95, 1.15]', at0='[1.18, 4.38, 1.02]', at1='[1.18, 4.38, 1.02]', mm='[32, 32]'),
    'K37': dict(mm='[28, 28]', f='4.0', frm='[2.40, 2.60, 1.30]', to='[2.40, 2.60, 1.30]', at0='[1.05, 4.10, 1.00]', at1='[1.10, 1.00, 0.45]', mv='[133.6, 136.6]',
                focus='[[133.2, [1.05, 4.10, 1.00]], [134.2, [1.05, 4.10, 1.00]], [136.4, [1.10, 1.00, 0.45]]]'),
    'K38': dict(mm='[38, 38]', f='4.0', frm='[2.05, 3.10, 1.75]', to='[2.02, 3.14, 1.73]', at0='[1.15, 4.32, 0.98]', at1='[1.15, 4.32, 0.98]'),
    # round 12: K40 from high front-left (the top-down hid how he holds the mug); a slow push. K41 / K43 focus on his real eyes / fingertip
    'K40': dict(mm='[32, 32]', f='2.8', frm='[0.80, 4.90, 1.30]', to='[0.806, 4.854, 1.281]', at0='[0.90, 4.15, 0.93]', at1='[0.90, 4.15, 0.93]', focus='[0.92, 4.34, 0.90]'),
    'K41': dict(focus="'iris'"),
    # round 13: K35 a 3/4 from behind his left shoulder (cheek, ear, glasses arm, mug at the lips, the rail and the city);
    # straight from behind, the hand and mug stuck out beside his head and the neck read as a flat tube
    'K35': dict(mm='[35, 35]', f='2.4', frm='[0.95, 4.55, 1.38]', to='[0.91, 4.50, 1.38]', at0='[1.88, 3.30, 1.31]', at1='[1.88, 3.30, 1.31]', focus="'iris'"),
    'K43': dict(mm='[70, 70]', f='8', frm='[1.36, 4.46, 0.86]', to='[1.352, 4.455, 0.857]', at0='[1.163, 4.326, 0.78]', at1='[1.163, 4.326, 0.78]', focus="'bone:mixamorigRightHandIndex4'"),   # front-right, low, onto the Enter key
    'K46': dict(frm='[1.04, 5.10, 3.50]', to='[1.04, 4.62, 2.55]', at0='[1.04, 3.88, 0.90]', at1='[1.04, 3.88, 0.90]', mv='[168.85, 171.94]', dolly='13.37'),
}
def setkv(b, key, val):
    pat = re.compile(r"(?<![\w])" + key + r": (\[\[.*?\]\]\]|\[[^\]]*\]|[A-Z_]+|'[^']*'|[\d.]+)")
    if pat.search(b): return pat.sub(lambda m: f'{key}: {val}', b, count=1)
    return b.replace('roll:', f'{key}: {val}, roll:', 1)
for sid, C in CAMS.items():
    i, j = block(sid); b = s[i:j]
    for k in ('ease', 'arc', 'dolly'): b = re.sub(r" %s: (\[[^\]]*\]|'[^']*'|[\d.]+)," % k, '', b)
    for k, v in C.items(): b = setkv(b, 'from' if k == 'frm' else k, v)
    s = s[:i] + b + s[j:]

# hands: the sips keyed (k = 1 at the lips), no ghost mugs
SIPS = {'K30': '[[105.35, 0.0], [107.0, 0.0], [107.9, 1.0], [108.5, 1.0], [109.3, 0.25]]',
        # round 12: K33 cuts in mid-sip (a 0.7 s lift from below the frame read as a glitch), then lowers slowly into K34
        'K33': '[[117.7, 1.0], [119.2, 1.0], [121.6, 0.45]]',
        'K34': '[[121.6, 0.45], [123.4, 0.25], [126.3, 0.25]]',
        'K35': '[[126.3, 0.3], [127.4, 1.0], [128.4, 1.0], [129.4, 0.6]]',
        # round 13: K40 held in front of his chest above the desk and lifted slowly (never reaching his lips); the mug
        # used to sit beside his shoulder, which folded the arm back on itself (the reversed wrist)
        'K40': '[[143.4, 0.5], [145.8, 0.6], [147.4, 0.64]]'}
for sid, k in SIPS.items():
    i, j = block(sid); b = s[i:j]
    b = re.sub(r", sip: \[\[[^\]]*\](?:, \[[^\]]*\])*\]", '', b)   # every earlier sip
    b = re.sub(r"(hand: \{ side: '[LR]', to: (?:'[a-z]+'|\[[^\]]*\]),(?: lat: [\d.]+,)? prop: 'mug')", lambda m: m.group(1) + ', sip: ' + k, b, count=1)
    s = s[:i] + b + s[j:]
# the time-skip ghosts act (their own clips play)
i, j = block('K22'); b = s[i:j]
b = re.sub(r"ghosts: \[\[.*?\]\]", "ghosts: [['s04', 5.1, 8.5], ['s04', 10.4, 12.8]]", b, count=1)
s = s[:i] + b + s[j:]

open(P, 'w', encoding='utf8', newline='').write(s)
print('ok', len(ANIM), 'shots,', len(CUTS), 'cuts,', len(CAMS), 'cameras')
