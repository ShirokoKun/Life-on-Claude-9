"""Paint Noor v2's small textures (run with system python before the Blender build; PIL lives here, not in Blender)."""
import os, sys, math
QD = sys.argv[1]
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
TEXOUT = os.path.join(ROOT, 'engine', 'studies', 'ps1-subway-v3', 'assets'); os.makedirs(TEXOUT, exist_ok=True)
from PIL import Image, ImageDraw, ImageFilter
import random
R = random.Random(4)
def save(im, name): p = os.path.join(TEXOUT, name); im.save(p); return p
def jacket_tex(base, line):
    im = Image.new('RGB', (64, 64), base); d = ImageDraw.Draw(im)
    # v3: flat colour; the colour blocks come from body regions, not the UV layout
    for y in range(0, 64, 16): d.line([0, y, 64, y], fill=tuple(int(c * 0.82) for c in base))
    return im
def _old_jacket_tex(base, line):
    im = Image.new('RGB', (64, 64), base); d = ImageDraw.Draw(im)
    for y in range(0, 64, 8):
        for x in range(64):
            k = 0.86 + 0.14 * math.sin((y % 8) / 8 * math.pi)
        d.line([0, y, 64, y], fill=line)
        for yy in range(1, 8):
            k = 0.82 + 0.18 * math.sin(yy / 8 * math.pi)
            d.line([0, y + yy, 64, y + yy], fill=tuple(int(c * k) for c in base))
    for _ in range(90):
        x, y = R.randrange(64), R.randrange(64); v = R.randint(-14, 14)
        c = im.getpixel((x, y)); im.putpixel((x, y), tuple(max(0, min(255, a + v)) for a in c))
    return im
def denim_tex():
    im = Image.new('RGB', (64, 64), (44, 56, 84)); px = im.load()
    for y in range(64):
        for x in range(64):
            tw = 9 if (x + y) % 3 == 0 else 0; n = R.randint(-8, 8)
            px[x, y] = (44 + tw + n, 56 + tw + n, 84 + int(tw * 1.3) + n)
    return im
def shoe_tex():
    im = Image.new('RGB', (32, 32), (228, 224, 214)); d = ImageDraw.Draw(im)
    d.rectangle([0, 24, 32, 32], fill=(150, 146, 136)); d.rectangle([0, 23, 32, 23], fill=(110, 108, 100))
    d.rectangle([4, 8, 9, 12], fill=(181, 36, 27)); return im
def top_tex():
    im = Image.new('RGB', (16, 16), (22, 22, 24)); return im
def skin_tex():
    src = Image.open(os.path.join(QD, 'Base Characters', 'Textures', 'T_Superhero_Female_Light_BaseColor.png')).convert('RGB')
    im = src.resize((256, 256), Image.BOX)
    # paint the face a little: a warmer lip and a soft blush, PS1-style (the base has none). Original painting.
    return im
def hair_tex():
    src = Image.open(os.path.join(QD, 'Hairstyles', 'Textures', 'T_Hair_1_BaseColor.png')).convert('L').resize((64, 64), Image.BOX)
    return Image.merge('RGB', [src.point(lambda v: int(30 + v * 0.42)), src.point(lambda v: int(16 + v * 0.26)), src.point(lambda v: int(9 + v * 0.16))])
    im = Image.new('RGB', (32, 64), (62, 36, 22)); d = ImageDraw.Draw(im)
    for x in range(32):
        v = R.randint(-18, 18)
        d.line([x, 0, x, 64], fill=(62 + v, 36 + int(v * 0.8), 22 + int(v * 0.6)))
    for y in range(14, 20): d.line([0, y, 32, y], fill=(104, 72, 50))   # the PS1 'angel ring' highlight
    return im
T = {
    'jacket_red': save(jacket_tex((178, 30, 26), (28, 22, 24)), 'noor_jacket_red.png'),
    'jacket_black': save(jacket_tex((26, 26, 28), (10, 10, 10)), 'noor_jacket_black.png'),
    'denim': save(denim_tex(), 'noor_denim.png'), 'shoe': save(shoe_tex(), 'noor_shoe.png'),
    'top': save(top_tex(), 'noor_top.png'), 'skin': save(skin_tex(), 'noor_skin.png'), 'hair': save(hair_tex(), 'noor_hair.png'),
}
print('painted', sorted(T))
