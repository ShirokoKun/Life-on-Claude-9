# Montage chosen keyframes from a board take: python -I tools/kf_pick.py renders/kf1/r1 out.jpg K02 K04 ...
import sys
from PIL import Image, ImageDraw, ImageFont
d, out, ids = sys.argv[1], sys.argv[2], sys.argv[3:]
w, h, cols = 800, 450, 2
R = (len(ids) + cols - 1) // cols
sh = Image.new('RGB', (w * cols, h * R), (10, 10, 10)); dr = ImageDraw.Draw(sh)
try: f = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 22)
except Exception: f = ImageFont.load_default()
for i, k in enumerate(ids):
    x, y = (i % cols) * w, (i // cols) * h
    sh.paste(Image.open(f'{d}/{k}.png').convert('RGB').resize((w, h)), (x, y))
    dr.rectangle([x, y + 30, x + 70, y + 58], fill=(0, 0, 0)); dr.text((x + 6, y + 30), k, fill=(255, 220, 90), font=f)
sh.save(out, quality=88)
