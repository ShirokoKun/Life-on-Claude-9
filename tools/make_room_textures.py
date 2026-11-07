"""Printed detail for the room rebuild (all original designs): hi-res screens, keyboard legends, packaging, documents.
    python3 tools/make_room_textures.py            -> blender/assets/room/*.png
"""
import os, random, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'blender', 'assets', 'room'); os.makedirs(OUT, exist_ok=True)
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
F = lambda size, mono=False: ImageFont.truetype(MONO if mono else SANS, size)
R = random.Random(21)

# ---------------------------------------------------------------- the 3D-editor screen (a generic DCC layout, original)
def screen_dcc():
    W, H = 1920, 1080; im = Image.new('RGB', (W, H), (43, 43, 45)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 30], fill=(30, 30, 32))
    for i, t in enumerate(['File', 'Edit', 'Render', 'Window', 'Help']): d.text((14 + i * 70, 7), t, font=F(15), fill=(200, 200, 200))
    for i, t in enumerate(['Layout', 'Modeling', 'Sculpting', 'Shading', 'Animation', 'Scripting']):
        x = 520 + i * 118; d.rounded_rectangle([x, 4, x + 110, 26], 4, fill=(70, 72, 78) if i == 0 else (40, 40, 43)); d.text((x + 12, 7), t, font=F(14), fill=(220, 220, 220))
    d.rectangle([0, 31, 42, 760], fill=(36, 36, 38))
    for i in range(14): d.rounded_rectangle([7, 44 + i * 40, 35, 72 + i * 40], 4, fill=(62, 64, 70) if i != 2 else (72, 112, 170))
    # viewport: a grid floor in perspective and a grey electrical box model (the tutorial shows one on screen)
    vx0, vy0, vx1, vy1 = 44, 31, 1440, 760; d.rectangle([vx0, vy0, vx1, vy1], fill=(57, 57, 58))
    cx, cy = 742, 470
    for k in range(-14, 15):
        d.line([cx + k * 60, cy + 40, cx + k * 160, vy1], fill=(68, 68, 69));
    for j in range(1, 12): y = cy + 40 + j * j * 2.1; d.line([vx0, y, vx1, y], fill=(68, 68, 69))
    d.line([vx0, cy + 140, vx1, cy + 90], fill=(150, 64, 64), width=2); d.line([cx + 20, vy0, cx - 30, vy1], fill=(96, 140, 60), width=2)
    def box3(x, y, w, h, dep, c):
        d.polygon([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], fill=c)
        d.polygon([(x, y), (x + dep, y - dep * 0.6), (x + w + dep, y - dep * 0.6), (x + w, y)], fill=tuple(min(255, v + 30) for v in c))
        d.polygon([(x + w, y), (x + w + dep, y - dep * 0.6), (x + w + dep, y + h - dep * 0.6), (x + w, y + h)], fill=tuple(max(0, v - 30) for v in c))
    box3(640, 230, 190, 280, 70, (186, 186, 188))
    for k in range(5): d.rectangle([660, 260 + k * 46, 810, 290 + k * 46], outline=(140, 140, 142), width=2)
    d.rectangle([700, 200, 780, 230], fill=(160, 160, 162)); d.rectangle([706, 520, 756, 560], fill=(150, 150, 152))
    d.rectangle([640, 230, 900, 510], outline=(240, 160, 50), width=2)                     # the selection outline
    d.text((60, 44), 'User Perspective', font=F(14), fill=(220, 220, 220)); d.text((60, 62), '(1) Collection | Housing', font=F(14), fill=(190, 190, 190))
    # outliner + properties
    d.rectangle([1442, 31, W, 420], fill=(40, 40, 42)); d.rectangle([1442, 31, W, 54], fill=(48, 48, 50))
    for i in range(16):
        y = 62 + i * 21; ind = [0, 1, 2, 2, 2, 1, 2, 2, 1, 1, 2, 2, 2, 1, 1, 2][i]
        if i == 3: d.rectangle([1442, y - 2, W, y + 18], fill=(60, 84, 120))
        d.rectangle([1456 + ind * 16, y + 3, 1468 + ind * 16, y + 15], fill=[(230, 150, 60), (120, 170, 230), (180, 180, 180)][i % 3])
        d.text((1476 + ind * 16, y), ['Collection', 'Housing', 'Panel_A', 'Panel_B', 'Hinge', 'Lights', 'Key', 'Fill', 'Camera', 'Props', 'Bolt.001', 'Bolt.002', 'Bolt.003', 'Floor', 'World', 'Ref_Images'][i], font=F(14), fill=(215, 215, 215))
    d.rectangle([1442, 422, W, 760], fill=(44, 44, 46))
    for i in range(14):
        y = 436 + i * 23; d.text((1460, y), ['Location X', 'Location Y', 'Location Z', 'Rotation X', 'Rotation Y', 'Rotation Z', 'Scale X', 'Scale Y', 'Scale Z', 'Dimensions', 'Bevel', 'Segments', 'Subdivision', 'Smooth'][i], font=F(13), fill=(170, 170, 172))
        d.rounded_rectangle([1590, y - 2, 1900, y + 17], 4, fill=(60, 60, 64)); d.text((1700, y), f'{R.uniform(-2, 2):.3f} m' if i < 9 else str(R.randint(1, 4)), font=F(13), fill=(225, 225, 225))
    # node editor below
    d.rectangle([44, 762, 1440, H], fill=(36, 36, 38))
    for x in range(44, 1440, 28): d.line([x, 762, x, H], fill=(40, 40, 42))
    nodes = [(90, 800, 'Image Texture', (128, 56, 56)), (90, 930, 'Mapping', (90, 60, 110)), (420, 820, 'Color Ramp', (60, 90, 120)), (420, 960, 'Bump', (60, 90, 120)), (760, 840, 'Principled BSDF', (60, 110, 60)), (1100, 880, 'Material Output', (110, 50, 50))]
    for (x, y, t, c) in nodes:
        d.rounded_rectangle([x, y, x + 240, y + 110], 6, fill=(50, 50, 52), outline=(25, 25, 25)); d.rounded_rectangle([x, y, x + 240, y + 22], 6, fill=c); d.text((x + 8, y + 3), t, font=F(13), fill=(240, 240, 240))
        for k in range(3): d.text((x + 10, y + 32 + k * 22), ['Color', 'Alpha', 'Vector', 'Fac', 'Height', 'Normal'][(k + len(t)) % 6], font=F(12), fill=(190, 190, 190)); d.ellipse([x + 230, y + 36 + k * 22, x + 240, y + 46 + k * 22], fill=(200, 190, 60))
    for (a, b) in [(0, 2), (1, 0), (2, 4), (3, 4), (4, 5)]:
        (x0, y0), (x1, y1) = (nodes[a][0] + 240, nodes[a][1] + 40), (nodes[b][0], nodes[b][1] + 40)
        pts = [(x0 + (x1 - x0) * u, y0 + (y1 - y0) * (3 * u * u - 2 * u ** 3)) for u in [k / 20 for k in range(21)]]; d.line(pts, fill=(200, 190, 60), width=2)
    d.rectangle([1442, 762, W, H], fill=(40, 40, 42))
    for i in range(12): d.text((1460, 776 + i * 24), f'{["Render", "Output", "View Layer", "Scene", "World", "Object", "Modifiers", "Particles", "Physics", "Constraints", "Data", "Material"][i]}', font=F(13), fill=(190, 190, 190))
    d.rectangle([0, H - 26, W, H], fill=(30, 30, 32)); d.text((12, H - 21), 'Verts 18,402  |  Faces 17,966  |  Objects 1/38', font=F(13), fill=(170, 170, 170))
    im.save(os.path.join(OUT, 'screen_ui.png'))

# ---------------------------------------------------------------- the code editor (original code)
CODE = '''import bpy
from mathutils import Vector

def build_shelf(width, depth, rows, gap=0.32):
    """A wall shelf: boards, uprights, a back panel."""
    parts = []
    for r in range(rows + 1):
        z = r * gap
        board = add_box("board_%d" % r, (width, depth, 0.018), (0, 0, z))
        parts.append(board)
    for side in (-1, 1):
        post = add_box("post", (0.018, depth, rows * gap), (side * width / 2, 0, rows * gap / 2))
        parts.append(post)
    return join(parts, name="shelf")

def scatter_books(shelf, count, seed=7):
    rng = random.Random(seed)
    x = -shelf.width / 2
    for i in range(count):
        t = rng.uniform(0.015, 0.045)
        h = rng.uniform(0.18, 0.27)
        place_book(x + t / 2, h, color=rng.choice(PALETTE))
        x += t + 0.001

if __name__ == "__main__":
    shelf = build_shelf(0.9, 0.3, rows=4)
    scatter_books(shelf, 38)
    bake_lighting(samples=128, denoise=True)'''
def screen_code():
    W, H = 1920, 1080; im = Image.new('RGB', (W, H), (30, 31, 36)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 34], fill=(37, 38, 44)); d.rectangle([0, 34, 300, H], fill=(33, 34, 40))
    for i, t in enumerate(['room_build/', '  props/', '    shelf.py', '    desk.py', '    lamp.py', '  lighting.py', '  render.py', 'README.md']):
        d.text((16, 50 + i * 26), t, font=F(16, True), fill=(200, 200, 205) if i != 2 else (255, 255, 255))
    d.rectangle([300, 34, 560, 70], fill=(30, 31, 36)); d.text((316, 42), 'shelf.py', font=F(16, True), fill=(230, 230, 230))
    kw = {'import', 'from', 'def', 'for', 'in', 'return', 'if', 'as', 'range'}
    for i, line in enumerate(CODE.split('\n')):
        y = 84 + i * 27; d.text((320, y), f'{i + 1:3d}', font=F(17, True), fill=(90, 92, 100)); x = 380
        for tok in line.replace('(', ' ( ').replace(')', ' ) ').split(' '):
            col = (198, 120, 221) if tok in kw else (152, 195, 121) if tok.startswith(('"', "'")) else (209, 154, 102) if tok.replace('.', '').isdigit() else (97, 175, 239) if tok in ('build_shelf', 'scatter_books', 'add_box', 'join', 'place_book', 'bake_lighting') else (171, 178, 191)
            d.text((x, y), tok, font=F(17, True), fill=col); x += d.textlength(tok + ' ', font=F(17, True))
    d.rectangle([0, H - 26, W, H], fill=(0, 102, 184)); d.text((12, H - 22), 'main   Ln 14, Col 32   Python 3.11   UTF-8', font=F(14, True), fill=(255, 255, 255))
    im.save(os.path.join(OUT, 'screen_code.png'))

# ---------------------------------------------------------------- keyboard legends (one top-view image of the key field)
def keyboard():
    W, H = 1760, 560; im = Image.new('RGB', (W, H), (18, 18, 20)); d = ImageDraw.Draw(im)
    rows = ['` 1 2 3 4 5 6 7 8 9 0 - =', 'Q W E R T Y U I O P [ ] \\', 'A S D F G H J K L ; \'', 'Z X C V B N M , . /']
    u = 76; f = F(26)
    for r_, row in enumerate(rows):
        for k, ch in enumerate(row.split(' ')):
            x = 40 + r_ * 24 + k * u + 60 * (r_ > 0); y = 30 + r_ * u
            d.rounded_rectangle([x, y, x + u - 8, y + u - 8], 8, fill=(30, 30, 33)); d.text((x + 12, y + 8), ch, font=f, fill=(205, 205, 205))
    d.rounded_rectangle([340, 30 + 4 * u, 340 + 6 * u, 30 + 5 * u - 8], 8, fill=(30, 30, 33))
    for k in range(4):   # numpad
        for j in range(3): x = 1450 + j * u; y = 30 + k * u; d.rounded_rectangle([x, y, x + u - 8, y + u - 8], 8, fill=(30, 30, 33)); d.text((x + 24, y + 14), str(7 - 3 * k + j) if k < 3 else '0', font=f, fill=(205, 205, 205))
    im.save(os.path.join(OUT, 'keyboard.png'))

# ---------------------------------------------------------------- packaging: a red tea box, a white medicine box (original brands)
def box_tea():
    W, H = 512, 512; im = Image.new('RGB', (W, H), (176, 52, 34)); d = ImageDraw.Draw(im)
    d.rectangle([30, 300, 482, 470], fill=(238, 232, 218)); d.text((50, 312), 'MORI', font=F(64), fill=(150, 36, 24)); d.text((52, 392), 'green tea  20 bags', font=F(28), fill=(70, 60, 50))
    d.ellipse([360, 60, 470, 170], outline=(238, 232, 218), width=6); d.line([380, 115, 450, 115], fill=(238, 232, 218), width=6)
    im.filter(ImageFilter.GaussianBlur(0.6)).save(os.path.join(OUT, 'box_tea.png'))
def box_med():
    W, H = 512, 512; im = Image.new('RGB', (W, H), (236, 238, 236)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 70], fill=(36, 104, 168)); d.text((24, 12), 'LENSA', font=F(40), fill=(255, 255, 255))
    d.text((24, 110), 'lens cleaning tissues', font=F(30), fill=(40, 40, 40)); d.text((24, 160), '100', font=F(60), fill=(36, 104, 168))
    for k in range(6): d.line([24, 270 + k * 26, 24 + R.randint(260, 460), 270 + k * 26], fill=(150, 150, 150), width=8)
    im.save(os.path.join(OUT, 'box_med.png'))
# ---------------------------------------------------------------- documents and receipts
def document(name, title, lines=28, w=850, h=1100):
    im = Image.new('RGB', (w, h), (240, 238, 232)); d = ImageDraw.Draw(im)
    d.text((70, 70), title, font=F(34), fill=(30, 30, 30))
    y = 140
    for k in range(lines):
        if k % 7 == 6: y += 22; continue
        d.line([70, y, 70 + R.randint(450, 710), y], fill=(110, 110, 110), width=9); y += 30
    if 'drawing' in name:
        d.rectangle([420, 520, 760, 980], outline=(40, 40, 40), width=3); d.rectangle([470, 580, 710, 900], outline=(40, 40, 40), width=2)
        for k in range(4): d.line([470, 640 + k * 60, 710, 640 + k * 60], fill=(60, 60, 60), width=2)
    im.save(os.path.join(OUT, name + '.png'))
def receipt():
    im = Image.new('RGB', (300, 700), (246, 245, 240)); d = ImageDraw.Draw(im)
    d.text((80, 30), 'KOMBINI 24', font=F(26, True), fill=(40, 40, 40))
    for k in range(14): d.text((24, 100 + k * 34), f'item {k + 1:02d}', font=F(20, True), fill=(60, 60, 60)); d.text((200, 100 + k * 34), f'{R.randint(98, 680)}', font=F(20, True), fill=(60, 60, 60))
    im.save(os.path.join(OUT, 'receipt.png'))

screen_dcc(); screen_code(); keyboard(); box_tea(); box_med(); receipt()
document('doc_drawing', 'HOUSING  rev.C'); document('doc_notes', 'Weekly notes'); document('doc_invoice', 'INVOICE  0047')
print('made', sorted(os.listdir(OUT)))
