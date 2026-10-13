"""Storyboard sheet for a scene: one engine frame per shot, with its timing, lens, line and intent, as one
self-contained HTML page (frames embedded as JPEG).

    node tools/capture.mjs --out renders/board_s02 --w 1280 --h 720 --extra scene=s02 --at $(python3 tools/board.py engine/scenes/s02/scene.js --times)
    python3 tools/board.py engine/scenes/s02/scene.js renders/board_s02 deliver/scene02_storyboard.html

The frame for a shot is taken at its KEY time (the moment that tells the shot), else 60% through it.
"""
import base64
import html
import io
import re
import sys
from pathlib import Path

from PIL import Image

KEY = {'2.1': 3.6, '2.2': 8.5, '2.3': 11.0, '2.4': 14.8, '2.5a': 16.8, '2.5b': 18.8, '2.5c': 21.0, '2.6': 23.6,
       '2.7': 25.8, '2.8': 31.5, '2.9a': 33.9, '2.9b': 35.2, '2.9c': 36.4, '2.9d': 37.7, '2.10': 41.0, '2.11': 49.0,
       '2.12': 52.5, '2.13': 57.8, '2.14': 61.5, '2.15': 70.5}

# the colour script (STORYBOARD.md): part, start, end, feeling, swatch
PARTS = [('A', 'Two days ago', 0, 24, 'ordinary, overloaded', '#8f9aa6'),
         ('B', 'The plan', 24, 29, 'a promise', '#d9b44a'),
         ('C', 'The montage', 29, 50, 'momentum, days blurring', '#c7774a'),
         ('D', 'The cheat code', 50, 62, 'wonder, a quiet high', '#4f7fa8'),
         ('E', 'The door', 62, 74, 'euphoric, alone', '#f2e6cf')]


def parse(src):
    shots = []
    for m in re.finditer(r"\{ id: '([^']+)', name: '((?:[^'\\]|\\.)*)', t0: ([\d.]+), t1: ([\d.]+), mm: \[([\d.]+), ([\d.]+)\], f: ([\d.]+)"
                         r".*?why: '((?:[^'\\]|\\.)*)' \}", src, re.S):
        sid, name, t0, t1, mm0, mm1, f, why = m.groups()
        shots.append(dict(id=sid, name=name.replace("\\'", "'"), t0=float(t0), t1=float(t1), mm=(float(mm0), float(mm1)),
                          f=float(f), why=why.replace("\\'", "'")))
    caps = [(float(a), float(b), t.replace("\\'", "'")) for a, b, q, t in
            re.findall(r"\[([\d.]+), ([\d.]+), (['\"])(.*?)\3\]", src.split('CAPTIONS', 1)[1].split('];', 1)[0])]
    caps = [(a, b, t) for a, b, t in caps]
    return shots, caps


def key_time(s):
    return KEY.get(s['id'], s['t0'] + 0.6 * (s['t1'] - s['t0']))


def clock(t):
    return f"{int(t // 60)}:{t % 60:04.1f}"


def jpeg(path, w=1100):
    im = Image.open(path).convert('RGB')
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=84, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()


CSS = """
:root { --bg:#0e0f11; --panel:#16181b; --line:#2a2d32; --fg:#e8e4dc; --dim:#9a968e; --faint:#6c6962; --accent:#e0b552; color-scheme:dark }
* { box-sizing:border-box }
body { background:var(--bg); color:var(--fg); margin:0; font:15px/1.55 'Inter', system-ui, sans-serif }
.wrap { max-width:1240px; margin:0 auto; padding-inline:20px; padding-block:40px 64px }
header { display:grid; gap:10px; border-bottom:1px solid var(--line); padding-bottom:24px }
.eyebrow { font:500 12px/1 'IBM Plex Mono', ui-monospace, monospace; letter-spacing:.14em; text-transform:uppercase; color:var(--accent) }
h1 { font:600 clamp(28px, 4.4vw, 46px)/1.1 'Newsreader', Georgia, serif; margin:0; text-wrap:balance }
.lede { color:var(--dim); max-width:68ch; margin:0 }
.meta { display:flex; flex-wrap:wrap; gap:8px 22px; font:13px 'IBM Plex Mono', ui-monospace, monospace; color:var(--dim); font-variant-numeric:tabular-nums }
.script { margin-top:26px; display:grid; gap:8px }
.bar { display:flex; height:30px; border-radius:3px; overflow:hidden; border:1px solid var(--line) }
.bar span { display:flex; align-items:center; padding-inline:8px; font:600 11px 'IBM Plex Mono', monospace; color:#111; white-space:nowrap; overflow:hidden }
.legend { display:flex; flex-wrap:wrap; gap:6px 20px; font-size:13px; color:var(--dim) }
.legend b { color:var(--fg); font-weight:600 }
.grid { margin-top:34px; display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap:34px 24px }
.shot { display:grid; gap:8px; align-content:start; min-width:0 }
.shot img { width:100%; aspect-ratio:16/9; object-fit:cover; display:block; background:#000; border-radius:2px }
.slate { display:flex; justify-content:space-between; gap:10px; font:12px 'IBM Plex Mono', ui-monospace, monospace; color:var(--dim); font-variant-numeric:tabular-nums }
.slate .id { color:var(--accent); font-weight:600 }
.shot h2 { font:600 19px/1.25 'Newsreader', Georgia, serif; margin:0 }
.vo { margin:0; font:italic 15px/1.45 'Newsreader', Georgia, serif; color:var(--fg); border-left:2px solid var(--accent); padding-left:10px }
.why { margin:0; color:var(--dim); font-size:14px }
.part { width:8px; height:8px; border-radius:50%; display:inline-block; margin-right:6px; vertical-align:middle }
footer { margin-top:48px; border-top:1px solid var(--line); padding-top:18px; color:var(--faint); font-size:13px; max-width:80ch }
"""


def build(scene_js, frames_dir, out):
    src = Path(scene_js).read_text()
    shots, caps = parse(src)
    dur = float(re.search(r'DURATION = ([\d.]+)', src).group(1))
    cards = []
    for s in shots:
        k = key_time(s)
        f = Path(frames_dir) / f"f_{round(k * 24):05d}.png"
        vo = ' '.join(t for a, b, t in caps if a < s['t1'] - 0.05 and b > s['t0'] + 0.05)
        part = next(p for p in PARTS if p[2] <= s['t0'] < p[3])
        mm = f"{s['mm'][0]:.0f}" + (f"→{s['mm'][1]:.0f}" if abs(s['mm'][1] - s['mm'][0]) >= 1 else '')
        img = f'<img src="{jpeg(f)}" alt="Shot {s["id"]}" loading="lazy">' if f.exists() else '<img alt="">'
        cards.append(f"""<article class="shot">{img}
  <div class="slate"><span><span class="part" style="background:{part[5]}"></span><span class="id">{s['id']}</span> · {clock(s['t0'])}–{clock(s['t1'])}</span><span>{mm} mm · f/{s['f']:g}</span></div>
  <h2>{html.escape(s['name'])}</h2>
  {f'<p class="vo">{html.escape(vo)}</p>' if vo else ''}
  <p class="why">{html.escape(s['why'])}</p>
</article>""")
    bar = ''.join(f'<span style="width:{(p[3] - p[2]) / dur * 100:.2f}%;background:{p[5]}">{p[0]}</span>' for p in PARTS)
    legend = ''.join(f'<span><b>{p[0]}. {p[1]}</b> {clock(p[2])}–{clock(p[3])}, {p[4]}</span>' for p in PARTS)
    page = f"""<title>The Cheat Code Storyboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,500;0,6..72,600;1,6..72,400&display=swap">
<style>{CSS}</style>
<div class="wrap">
<header>
  <div class="eyebrow">Life on Claude Nine · Scene 2 · draft board</div>
  <h1>The cheat code</h1>
  <p class="lede">Script paragraphs 3–6, from "It started two days ago" to "a door that others can't even see". One frame per shot, taken from the engine at the moment that tells the shot. The timings follow an estimated read and will move to the voiceover's pauses when it arrives.</p>
  <div class="meta"><span>{len(shots)} shots</span><span>{clock(dur)} runtime</span><span>24 fps · 2.39:1 letterbox</span><span>same set, same Ivan, same look as the intro</span></div>
  <div class="script"><div class="bar">{bar}</div><div class="legend">{legend}</div></div>
</header>
<section class="grid">
{chr(10).join(cards)}
</section>
<footer>Light tells the passing days: the same flat at day, evening, sunrise and 3 AM, baked in Cycles and blended in the engine. Times are estimates; every shot is retimed to the voiceover.</footer>
</div>
"""
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(page)
    print('wrote', out, f'{len(page) / 1e6:.1f} MB')


if __name__ == '__main__':
    if '--times' in sys.argv:
        shots, _ = parse(Path(sys.argv[1]).read_text())
        print(','.join(f'{key_time(s):g}' for s in shots))
    else:
        build(*sys.argv[1:4])
