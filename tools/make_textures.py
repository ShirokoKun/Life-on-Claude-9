"""Generate the printed/screen textures the props need (reproducible, no downloads).

    python3 tools/make_textures.py        -> blender/assets/textures/*.png

Story constants live at the top so wording changes in one place.
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parents[1] / "blender" / "assets" / "textures"
OUT.mkdir(parents=True, exist_ok=True)
F = "/usr/share/fonts/truetype"
MONO = f"{F}/dejavu/DejaVuSansMono.ttf"
MONO_B = f"{F}/dejavu/DejaVuSansMono-Bold.ttf"
SANS = f"{F}/dejavu/DejaVuSans.ttf"
SANS_B = f"{F}/dejavu/DejaVuSans-Bold.ttf"
SERIF_B = f"{F}/dejavu/DejaVuSerif-Bold.ttf"
COND = f"{F}/liberation/LiberationSans-Regular.ttf"
OBL = f"{F}/liberation/LiberationSans-Italic.ttf"

GIRLFRIEND = "Sasha"          # unnamed in the script; placeholder until the team picks a name
TIME_3AM = "3:04"
rnd = random.Random(11)


def font(path, size):
    return ImageFont.truetype(path, size)


# ---------------------------------------------------------------------------------------
def laptop_screen():
    """Desktop at 3 AM: editor (left), terminal (bottom-left), Claude chat (right)."""
    W, H = 1600, 1000
    im = Image.new("RGB", (W, H), (14, 16, 22))
    d = ImageDraw.Draw(im)
    # menu bar
    d.rectangle((0, 0, W, 26), fill=(30, 32, 40))
    d.text((14, 5), "  Code   File   Edit   Selection   View   Go   Run   Terminal", font=font(SANS, 14), fill=(210, 212, 220))
    d.text((W - 170, 5), f"Tue {TIME_3AM} AM", font=font(SANS, 14), fill=(230, 232, 240))
    # editor
    ex0, ey0, ex1, ey1 = 0, 26, 980, 640
    d.rectangle((ex0, ey0, ex1, ey1), fill=(22, 24, 32))
    tabs = ["triage.py", "drafter.py", "classify.py", "calendar_sync.py", "config.yaml"]
    x = 0
    for i, t in enumerate(tabs):
        w = 150
        d.rectangle((x, ey0, x + w, ey0 + 30), fill=(30, 33, 44) if i == 0 else (18, 20, 27))
        d.text((x + 14, ey0 + 8), t, font=font(SANS, 13), fill=(220, 222, 230) if i == 0 else (130, 134, 150))
        x += w + 1
    code = [
        ("k", "import"), ("t", " imaplib, json, time"), None,
        ("k", "from"), ("t", " claude_client "), ("k", "import"), ("t", " Claude"), None,
        ("c", "# review and approve. that's the plan."), None,
        ("k", "def"), ("f", " triage"), ("t", "(inbox, since):"), None,
        ("t", "    msgs = fetch(inbox, since=since)"), None,
        ("t", "    buckets = {"), ("s", "\"reply\""), ("t", ": [], "), ("s", "\"fyi\""), ("t", ": [], "), ("s", "\"spam\""), ("t", ": []}"), None,
        ("k", "    for"), ("t", " m "), ("k", "in"), ("t", " msgs:"), None,
        ("t", "        label = classify(m)          "), ("c", "# 0.93 acc on sample"), None,
        ("t", "        buckets[label].append(m)"), None,
        ("k", "    return"), ("t", " buckets"), None, None,
        ("k", "def"), ("f", " draft_reply"), ("t", "(msg, tone="), ("s", "\"ivan\""), ("t", "):"), None,
        ("t", "    ctx = summarize(thread_of(msg))"), None,
        ("t", "    prompt = PROMPT.format(ctx=ctx, tone=tone)"), None,
        ("k", "    return"), ("t", " Claude().complete(prompt, max_tokens=400)"), None, None,
        ("k", "def"), ("f", " review_and_approve"), ("t", "(batch):"), None,
        ("k", "    for"), ("t", " d "), ("k", "in"), ("t", " batch:"), None,
        ("t", "        show(d); "), ("k", "if"), ("t", " ask("), ("s", "\"send?\""), ("t", "): send(d)"), None,
        ("c", "    # TODO: auto-approve when confidence > 0.9 ?"), None,
    ]
    col = {"k": (198, 120, 221), "t": (209, 214, 228), "c": (106, 118, 140), "f": (97, 175, 239), "s": (152, 195, 121)}
    fm = font(MONO, 17)
    y, xx, ln = ey0 + 44, 64, 1
    d.text((16, y), f"{ln:>3}", font=fm, fill=(70, 76, 92))
    for tok in code:
        if tok is None:
            y += 24
            ln += 1
            xx = 64
            if y > ey1 - 20:
                break
            d.text((16, y), f"{ln:>3}", font=fm, fill=(70, 76, 92))
            continue
        kind, txt = tok
        d.text((xx, y), txt, font=fm, fill=col[kind])
        xx += fm.getlength(txt)
    d.rectangle((64, 44 + ey0 + 24 * 23 - 2, 66, 44 + ey0 + 24 * 23 + 20), fill=(230, 230, 240))  # caret
    # terminal
    ty0 = 640
    d.rectangle((0, ty0, 980, H), fill=(9, 10, 14))
    d.rectangle((0, ty0, 980, ty0 + 26), fill=(24, 26, 34))
    d.text((14, ty0 + 6), "TERMINAL    PROBLEMS    OUTPUT", font=font(SANS, 12), fill=(150, 154, 170))
    term = [
        ("$ python triage.py --inbox ivan@ --since 18:00", (126, 224, 163)),
        ("fetched 214 messages in 3.8s", (200, 205, 215)),
        ("classified  reply=61  fyi=118  spam=35", (200, 205, 215)),
        ("drafting 61 replies ............................ done", (200, 205, 215)),
        ("$ python review.py --batch 20", (126, 224, 163)),
        ("[20/20] approved   [0] edited   [0] rejected", (230, 200, 120)),
        ("$ python calendar_sync.py --dry-run", (126, 224, 163)),
        ("3 conflicts found -> proposing new slots", (200, 205, 215)),
        ("$ _", (126, 224, 163)),
    ]
    ft = font(MONO, 16)
    for i, (t, c) in enumerate(term):
        d.text((16, ty0 + 38 + i * 22), t, font=ft, fill=c)
    # Claude chat panel
    cx0 = 990
    d.rectangle((cx0, 26, W, H), fill=(243, 241, 236))
    d.rectangle((cx0, 26, W, 70), fill=(236, 233, 226))
    d.ellipse((cx0 + 18, 38, cx0 + 38, 58), fill=(217, 119, 87))
    d.text((cx0 + 48, 38), "Claude", font=font(SANS_B, 17), fill=(40, 38, 34))
    bubbles = [
        ("u", "the drafter works. can we do calendar next?"),
        ("a", "Yes. Here's a calendar_sync module: it reads your invites, finds conflicts, "
              "and proposes new times. You approve each change, same as the emails."),
        ("u", "and docs? and the reading summaries?"),
        ("a", "We can. One thing first: you've been at this since 6 PM. "
              "Want me to queue these for the morning?"),
        ("u", "no. keep going."),
    ]
    fb = font(SANS, 16)
    y = 92
    for who, text in bubbles:
        words, lines, cur = text.split(), [], ""
        for w_ in words:
            if fb.getlength(cur + " " + w_) > 520:
                lines.append(cur)
                cur = w_
            else:
                cur = (cur + " " + w_).strip()
        lines.append(cur)
        h = 18 + 22 * len(lines)
        if who == "u":
            bx0 = W - 30 - max(fb.getlength(l) for l in lines) - 28
            d.rounded_rectangle((bx0, y, W - 30, y + h), 14, fill=(226, 222, 212))
        else:
            bx0 = cx0 + 22
        for i, l in enumerate(lines):
            d.text((bx0 + 14, y + 9 + i * 22), l, font=fb, fill=(40, 38, 34))
        y += h + 18
    d.rounded_rectangle((cx0 + 20, H - 80, W - 20, H - 24), 12, fill=(255, 255, 255), outline=(210, 205, 196))
    d.text((cx0 + 38, H - 62), "Reply to Claude...", font=fb, fill=(150, 146, 138))
    im.save(OUT / "laptop_screen.png")


def phone_lock():
    """Lock screen: her messages trail off over the evening, then stop."""
    W, H = 590, 1280
    im = Image.new("RGB", (W, H))
    px = im.load()
    for y in range(H):
        for x in range(W):
            t = y / H
            px[x, y] = (int(18 + 30 * t), int(22 + 18 * t), int(40 + 20 * (1 - t)))
    im = im.filter(ImageFilter.GaussianBlur(2))
    d = ImageDraw.Draw(im)
    d.text((W / 2, 150), "Tuesday, 11 March", font=font(SANS, 30), fill=(230, 230, 236), anchor="mm")
    d.text((W / 2, 250), TIME_3AM, font=font(SANS_B, 150), fill=(242, 242, 246), anchor="mm")
    notes = [
        (GIRLFRIEND, "dinner still on for 8?", "7:12 PM"),
        (GIRLFRIEND, "ivan??", "9:41 PM"),
        (GIRLFRIEND, "ok. call me when you're alive", "11:58 PM"),
        ("Mail", "214 new messages", "now"),
    ]
    y = 470
    for who, msg, when in notes:
        d.rounded_rectangle((26, y, W - 26, y + 118), 26, fill=(58, 60, 74))
        d.text((56, y + 22), who, font=font(SANS_B, 26), fill=(245, 245, 248))
        d.text((W - 56, y + 24), when, font=font(SANS, 22), fill=(180, 182, 192), anchor="ra")
        d.text((56, y + 64), msg, font=font(SANS, 26), fill=(225, 226, 232))
        y += 136
    d.rounded_rectangle((W / 2 - 70, H - 30, W / 2 + 70, H - 22), 4, fill=(235, 235, 240))
    im.save(OUT / "phone_lock.png")


def clock_face():
    S = 1024
    im = Image.new("RGB", (S, S), (236, 233, 226))
    d = ImageDraw.Draw(im)
    c = S / 2
    for i in range(60):
        a = math.radians(i * 6)
        r0 = S * (0.40 if i % 5 else 0.37)
        r1 = S * 0.43
        w = 10 if i % 5 == 0 else 3
        d.line((c + r0 * math.sin(a), c - r0 * math.cos(a), c + r1 * math.sin(a), c - r1 * math.cos(a)), fill=(20, 20, 22), width=w)
    f = font(SANS, 84)
    for h in range(1, 13):
        a = math.radians(h * 30)
        r = S * 0.30
        d.text((c + r * math.sin(a), c - r * math.cos(a)), str(h), font=f, fill=(20, 20, 22), anchor="mm")
    d.text((c, c + S * 0.15), "QUARTZ", font=font(SANS, 26), fill=(110, 108, 104), anchor="mm")
    im.save(OUT / "clock_face.png")


def wobble_line(d, p0, p1, fill, width=4, amp=2.0):
    n = 12
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append((p0[0] + (p1[0] - p0[0]) * t + rnd.uniform(-amp, amp), p0[1] + (p1[1] - p0[1]) * t + rnd.uniform(-amp, amp)))
    d.line(pts, fill=fill, width=width, joint="curve")


def notebook_page():
    """Ivan's sketch of the system: parse -> classify -> draft -> review & approve."""
    W, H = 1400, 1000
    im = Image.new("RGB", (W, H), (238, 234, 222))
    d = ImageDraw.Draw(im)
    for y in range(80, H, 38):
        d.line((0, y, W, y), fill=(178, 196, 214), width=2)
    d.line((110, 0, 110, H), fill=(214, 150, 150), width=2)
    ink = (28, 40, 92)
    hand = font(OBL, 34)
    boxes = [("inbox", 150, 190), ("parse", 400, 190), ("classify", 650, 190), ("draft", 930, 190)]
    for label, x, y in boxes:
        w = hand.getlength(label) + 50
        for k in range(2):
            wobble_line(d, (x, y), (x + w, y), ink)
            wobble_line(d, (x + w, y), (x + w, y + 80), ink)
            wobble_line(d, (x + w, y + 80), (x, y + 80), ink)
            wobble_line(d, (x, y + 80), (x, y), ink)
        d.text((x + 25, y + 20), label, font=hand, fill=ink)
    for x0, x1 in ((280, 400), (535, 650), (840, 930)):
        wobble_line(d, (x0, 230), (x1 - 8, 230), ink)
        wobble_line(d, (x1 - 24, 216), (x1 - 8, 230), ink)
        wobble_line(d, (x1 - 24, 244), (x1 - 8, 230), ink)
    wobble_line(d, (1000, 270), (1000, 420), ink)
    d.text((820, 430), "REVIEW + APPROVE", font=font(OBL, 40), fill=ink)
    wobble_line(d, (815, 482), (1205, 486), (160, 30, 30), width=5)
    wobble_line(d, (815, 494), (1205, 498), (160, 30, 30), width=5)
    d.text((150, 560), "next:  calendar?   docs?   reading summaries?", font=hand, fill=ink)
    d.text((150, 640), "auto-approve if conf > 0.9", font=hand, fill=ink)
    wobble_line(d, (145, 662), (560, 662), ink, width=5)
    d.text((150, 760), "eat something", font=font(OBL, 30), fill=(120, 120, 130))
    d.text((150, 830), "3 AM - one more module", font=hand, fill=ink)
    im.save(OUT / "notebook_page.png")


BOOKS = [
    ("SUPERINTELLIGENCE", "BOSTROM", (18, 18, 20), (226, 214, 180)),
    ("DEEP WORK", "NEWPORT", (196, 186, 162), (30, 30, 34)),
    ("DESIGNING DATA-INTENSIVE APPLICATIONS", "KLEPPMANN", (178, 40, 36), (245, 240, 230)),
    ("THE PRAGMATIC PROGRAMMER", "THOMAS · HUNT", (40, 60, 92), (236, 230, 214)),
    ("GÖDEL, ESCHER, BACH", "HOFSTADTER", (112, 28, 30), (232, 210, 160)),
    ("THINKING, FAST AND SLOW", "KAHNEMAN", (236, 232, 222), (30, 30, 34)),
    ("STRUCTURE AND INTERPRETATION OF COMPUTER PROGRAMS", "ABELSON · SUSSMAN", (88, 46, 108), (240, 236, 226)),
    ("THE ALIGNMENT PROBLEM", "CHRISTIAN", (24, 70, 72), (236, 230, 214)),
    ("CLEAN CODE", "MARTIN", (34, 34, 38), (230, 190, 90)),
    ("NEUROMANCER", "GIBSON", (14, 40, 30), (120, 230, 170)),
]


def book_spines():
    """One atlas: each book gets a 1024x96 strip (title runs along the spine)."""
    W, Hs = 1024, 96
    im = Image.new("RGB", (W, Hs * len(BOOKS)), (0, 0, 0))
    d = ImageDraw.Draw(im)
    for i, (title, author, bg, fg) in enumerate(BOOKS):
        y0 = i * Hs
        d.rectangle((0, y0, W, y0 + Hs), fill=bg)
        f = font(SANS_B if len(title) < 30 else COND, 40 if len(title) < 24 else 30)
        d.text((40, y0 + Hs / 2), title, font=f, fill=fg, anchor="lm")
        d.text((W - 30, y0 + Hs / 2), author, font=font(SANS, 24), fill=fg, anchor="rm")
        for k in range(2):
            d.line((0, y0 + 6 + k * (Hs - 12), W, y0 + 6 + k * (Hs - 12)), fill=tuple(min(255, c + 25) for c in bg), width=2)
    im.save(OUT / "book_spines.png")


def book_cover_deep_work():
    W, H = 640, 960
    im = Image.new("RGB", (W, H), (196, 186, 162))
    d = ImageDraw.Draw(im)
    d.text((W / 2, 260), "DEEP", font=font(SANS_B, 140), fill=(28, 28, 32), anchor="mm")
    d.text((W / 2, 400), "WORK", font=font(SANS_B, 140), fill=(28, 28, 32), anchor="mm")
    d.text((W / 2, 520), "Rules for Focused Success", font=font(SANS, 30), fill=(60, 58, 54), anchor="mm")
    d.text((W / 2, 860), "CAL NEWPORT", font=font(SANS_B, 40), fill=(28, 28, 32), anchor="mm")
    im.save(OUT / "book_deep_work.png")


def photo_couple():
    """Framed photo: Ivan and her on a beach, soft and out of focus (no faces to get wrong)."""
    W, H = 900, 640
    im = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H
        sky = (int(250 - 60 * t), int(200 - 40 * t), int(150 + 40 * t)) if t < 0.55 else (int(70 + 60 * t), int(110 + 40 * t), int(140 + 30 * t))
        d.line((0, y, W, y), fill=sky)
    d.ellipse((560, 210, 700, 350), fill=(255, 226, 170))
    for cx, h, col in ((380, 330, (40, 32, 30)), (470, 300, (60, 40, 44))):
        d.ellipse((cx - 32, H - h - 70, cx + 32, H - h - 6), fill=col)
        d.rounded_rectangle((cx - 52, H - h - 10, cx + 52, H), 30, fill=col)
    im = im.filter(ImageFilter.GaussianBlur(6))
    im.save(OUT / "photo_couple.png")


def sticky(name, lines, col=(250, 226, 92)):
    S = 400
    im = Image.new("RGB", (S, S), col)
    d = ImageDraw.Draw(im)
    for i, l in enumerate(lines):
        d.text((30, 60 + i * 70), l, font=font(OBL, 52), fill=(30, 30, 60))
    im.save(OUT / f"{name}.png")


def thermostat_display():
    im = Image.new("RGB", (256, 128), (8, 14, 10))
    d = ImageDraw.Draw(im)
    d.text((128, 60), "70°", font=font(SANS_B, 84), fill=(120, 230, 160), anchor="mm")
    im.save(OUT / "thermostat.png")


def wall_print():
    """A framed print over the bean bag: Bauhaus-style circles (Ivan's one design choice)."""
    W, H = 700, 1000
    im = Image.new("RGB", (W, H), (226, 220, 206))
    d = ImageDraw.Draw(im)
    d.ellipse((120, 160, 580, 620), fill=(206, 84, 50))
    d.rectangle((120, 600, 580, 640), fill=(28, 28, 32))
    d.ellipse((260, 520, 440, 700), fill=(40, 70, 120))
    d.text((W / 2, 860), "FORM / FUNCTION", font=font(SANS_B, 40), fill=(28, 28, 32), anchor="mm")
    im.save(OUT / "wall_print.png")


if __name__ == "__main__":
    laptop_screen()
    phone_lock()
    clock_face()
    notebook_page()
    book_spines()
    book_cover_deep_work()
    photo_couple()
    sticky("sticky_review", ["REVIEW +", "APPROVE"])
    sticky("sticky_ship", ["ship it", "  -> sleep"], (140, 220, 240))
    thermostat_display()
    wall_print()
    print("textures ->", OUT)
