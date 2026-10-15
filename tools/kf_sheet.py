# Compose a keyframe board from a take's PNGs, in shot order, labelled (id + name), without re-rendering.
#   python -I tools/kf_sheet.py renders/kf1/r8b out.jpg [cols] [width]
import re, sys, os
from PIL import Image, ImageDraw, ImageFont
take, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
W = int(sys.argv[4]) if len(sys.argv) > 4 else 640
src = open(os.path.join(os.path.dirname(__file__), '..', 'engine', 'scenes', 'kf1', 'scene.js'), encoding='utf8').read()
shots = re.findall(r"\{ id: '(K\w+)', name: '([^']*)', t0: ([\d.]+), t1: ([\d.]+)", src)
H = W * 9 // 16; LH = 34
rows = (len(shots) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * (H + LH)), (14, 14, 16))
try: font = ImageFont.truetype('segoeui.ttf', 15); small = ImageFont.truetype('segoeui.ttf', 11)
except Exception: font = small = ImageFont.load_default()
d = ImageDraw.Draw(sheet)
for i, (sid, name, t0, t1) in enumerate(shots):
    x, y = (i % cols) * W, (i // cols) * (H + LH)
    p = os.path.join(take, sid + '.png')
    if os.path.exists(p): sheet.paste(Image.open(p).convert('RGB').resize((W, H)), (x, y))
    d.text((x + 6, y + H + 2), f'{sid}  {name}', fill=(230, 230, 230), font=font)
    d.text((x + 6, y + H + 19), f'{float(t0):.2f}-{float(t1):.2f} s', fill=(140, 140, 140), font=small)
sheet.save(out, quality=88); print(out, sheet.size)
