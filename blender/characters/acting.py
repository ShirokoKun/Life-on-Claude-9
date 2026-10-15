"""Ivan's performance, solved per frame like live action (intro v2).

Every frame the upper body is rebuilt from intent, not layered noise:
  posture   hunch(t): how far he leans into the laptop (forward only; never sideways)
  gaze      look(t): the point he is looking at (screen lines he reads, the monitor, the notification)
  hands     where the wrists are (home row, resting, behind his head), solved with 2-bone IK
  fingers   real keystrokes: each press curls one finger on its anatomical flexion axis
            (measured from the rig, not guessed), in phrases with micro pauses

The script (SCENE) is written in film seconds and follows the voiceover (engine/src/shots.js).
"""
import math
import random

import bpy
from mathutils import Matrix, Quaternion, Vector

import ivan_pose as IP

P = "mixamorig:"
FPS = 24
UP = Vector((0, 0, 1))
FWD = Vector((0, 1, 0))          # Ivan faces +Y (north) at the desk

# Desk geometry (Blender metres): laptop base centre (6.95, 3.08), key tops at 0.767, home row y 3.096
HOME_L = Vector((6.872, 2.948, 0.800))     # wrists above the front edge, fingertips land on ASDF / JKL;
HOME_R = Vector((7.012, 2.948, 0.800))
SCREEN = Vector((6.95, 3.228, 0.871))       # laptop screen centre
CHAT = Vector((7.00, 3.235, 0.885))         # the Claude chat column (right half of the screen)
MONITOR = Vector((7.357, 3.315, 1.066))     # dashboard / pipeline monitor
MOUSE = Vector((7.22, 2.98, 0.77))          # the mouse, right of the laptop
AWAY = Vector((6.55, 4.60, 1.38))           # nowhere: past the screens, at the wall (an idea arriving)
BEYOND = Vector((6.82, 4.40, 1.12))         # just past the top of the screen (the private moment)

# surfaces the hands touch (props_desk.py): key tops, the laptop's palm rest, the mouse (an ellipsoid), the desk
DESK_Z = 0.75
KEY_Z = 0.7667
KEYS = (6.815, 7.090, 3.045, 3.165)         # keyboard well: x0, x1, y0, y1
LAPTOP = (6.794, 7.106, 2.970, 3.190)       # laptop base footprint
MOUSE_C, MOUSE_R = Vector((7.22, 2.98, 0.75)), Vector((0.031, 0.056, 0.019))
SKIN = 0.011                                 # bone axis to skin, fingers and the edge of the hand

FINGERS = ("Index", "Middle", "Ring", "Pinky")
BASE_CURL = {"Index": (0.16, 0.30, 0.16), "Middle": (0.15, 0.30, 0.16), "Ring": (0.14, 0.28, 0.15),
             "Pinky": (0.12, 0.26, 0.14), "Thumb": (0.05, 0.10, 0.08)}       # arched, reaching, not a fist
PRESS = (0.26, 0.14, 0.08)                  # extra flexion (rad) per joint at the bottom of a keystroke
SHARE = (0.34, 0.42, 0.24)                  # how a finger's curl splits over its three joints (on a surface)
HOVER = 0.008                               # fingertip above the key before a stroke (m)


def surface_z(x, y):
    """Height of whatever is under (x, y) on the desk."""
    dx, dy = (x - MOUSE_C.x) / MOUSE_R.x, (y - MOUSE_C.y) / MOUSE_R.y
    if dx * dx + dy * dy < 1.0:
        return MOUSE_C.z + MOUSE_R.z * math.sqrt(1.0 - dx * dx - dy * dy)
    if KEYS[0] < x < KEYS[1] and KEYS[2] < y < KEYS[3]:
        return KEY_Z
    if LAPTOP[0] < x < LAPTOP[1] and LAPTOP[2] < y < LAPTOP[3]:
        return DESK_Z + 0.0155
    return DESK_Z


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def curve(keys, t):
    """Piecewise smoothstep between (time, value) keys."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1:
            return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0))
    return keys[-1][1]


# ---------------------------------------------------------------------------------------------
# The scene, beat by beat (film seconds). Voiceover starts at 6.0 s.
SCENE = {
    # posture: 0 = upright typing, 1 = deep hunch toward the screen, negative = leaning back
    "hunch": [(0, 0.55), (15.5, 0.60), (17.2, 0.95), (20.4, 1.0), (21.4, 0.85), (26.4, 0.78), (31.4, 0.72),
              (32.4, 0.62), (34.6, -0.40), (37.0, -0.42)],
    # typing windows (start, end, keys per second): phrases inside each window are generated
    "typing": [(0.4, 5.6, 4.5), (6.2, 9.4, 5.0), (10.0, 13.2, 4.5), (13.8, 15.2, 4.0), (16.4, 19.4, 7.5),
               (22.4, 25.0, 5.5), (30.2, 31.2, 6.0)],
    # gaze: (start, end, target, mode)  mode: 'type' small drift on the screen, 'read' line by line,
    # 'still' fixed; transitions ease over 0.35-0.5 s
    "gaze": [(0.0, 15.2, "screen", "type"), (15.2, 16.2, "chat", "read"), (16.2, 19.4, "screen", "type"),
             (19.4, 22.4, "chat", "read"), (22.4, 25.0, "screen", "type"), (25.0, 26.8, "chat", "read"),
             (26.8, 29.9, "monitor", "still"), (29.9, 31.6, "screen", "type"), (31.6, 32.6, "monitor", "still"),
             (32.6, 37.0, "monitor_low", "still")],
    # hands: home row while working, lifted off the keys (rest) when he stops, behind his head at the end
    "hands_rest": [(0, 0), (31.4, 0), (31.8, 1), (37, 1)],
    "hands_behind": [(0, 0), (33.0, 0), (34.9, 1), (37, 1)],
    "exhale": (32.3, 33.2),                       # shoulders drop: it works
    "nod": (35.3, 36.1),
}


# ---------------------------------------------------------------------------------------------
# Scene 2, "The cheat code" (scenes/02-cheat-code/STORYBOARD.md). Film seconds, estimated read.
# The doorway (65-74 s) is a separate standing performance (--stand).
SCENE_S02 = {
    "hunch": [(0, 0.45), (4.0, 0.50), (9.4, 0.50), (10.2, -0.30), (12.2, -0.25), (12.9, 0.55), (21.5, 0.60),
              (24.5, 0.45), (29.0, 0.40), (31.0, 0.20), (33.0, 0.45),
              # time-lapse: hours in seconds, he rocks in and out of the screen
              (38.0, 0.6), (38.8, 0.9), (39.5, 0.3), (40.2, 1.0), (41.0, 0.5), (41.5, -0.3), (42.3, -0.3),
              (43.0, 0.8), (43.7, 0.4), (44.4, 0.9), (45.0, 0.6),
              (50.0, 0.55), (50.8, 0.25), (54.0, 0.25), (54.8, 0.6), (65.0, 0.65)],
    "typing": [(0.3, 3.8, 4.0), (14.6, 15.3, 3.0), (15.5, 21.4, 5.5), (33.0, 37.8, 6.0), (38.0, 41.4, 18.0),
               (42.4, 45.0, 18.0), (45.2, 49.8, 6.0), (54.6, 58.8, 5.0), (59.0, 65.0, 5.5)],
    "gaze": [(0.0, 4.0, "screen", "type"), (4.0, 9.5, "screen", "read"), (9.5, 12.6, "screen", "still"),
             (12.6, 14.6, "chat", "read"), (14.6, 21.5, "screen", "type"), (21.5, 24.5, "screen", "read"),
             (24.5, 29.0, "monitor", "still"), (29.0, 30.6, "monitor", "still"), (30.6, 33.0, "away", "still"),
             (33.0, 38.0, "screen", "type"), (38.0, 39.4, "monitor", "still"), (39.4, 41.4, "screen", "type"),
             (41.4, 42.4, "away", "still"), (42.4, 43.6, "screen", "type"), (43.6, 44.4, "monitor", "still"),
             (44.4, 50.0, "screen", "type"), (50.0, 54.0, "beyond", "still"), (54.0, 65.0, "screen", "type")],
    "hands_rest": [(0, 0), (9.4, 0), (9.9, 1), (12.4, 1), (12.9, 0), (24.4, 0), (24.9, 1), (32.6, 1), (33.0, 0),
                   (50.0, 0), (50.4, 1), (54.2, 1), (54.6, 0)],
    "hands_behind": [(0, 0), (41.3, 0), (41.6, 1), (42.2, 1), (42.5, 0)],
    "rub": [(10.0, 12.0)],                    # right hand up under the glasses, rubbing his eyes
    "mouse": [(4.2, 9.3), (21.6, 24.3)],      # scrolling the inbox; then Approve 20
    "clicks": [5.0, 6.4, 7.9, 22.9],
    "exhale": (10.3, 11.4),
    "nod": (51.0, 51.9),
}

# ---------------------------------------------------------------------------------------------
# Scene 4, "Two days ago" (scenes/04-two-days-ago/DIRECTION.md): the flashback, V08-V11 of the Ch 1 voiceover.
# Scene seconds; 0 = chapter 36.96 s (the end of V07b). VO: V08 1.60-3.92, V09 4.92-12.92, Claude's chime 13.67,
# V10 13.82-25.42, V11 (back at 3 AM) 26.72-30.32.
SCENE_S04 = {
    # night hunch; the light runs backwards and the night drains out of him too (upright, fresh); leans in to type
    # the first sentence; shoves back, fed up; attacks the keys for "drowning"; sits back when Claude answers; leans
    # in to read; at the smash cut he is hunched at 3 AM again
    "hunch": [(0, 0.62), (1.0, 0.60), (3.6, 0.22), (4.9, 0.25), (5.4, 0.45), (8.5, 0.48), (9.1, -0.35), (9.8, -0.38),
              (10.3, 0.50), (13.4, 0.50), (13.9, 0.05), (16.0, 0.08), (18.4, 0.22), (22.0, 0.32), (24.8, 0.30),
              (25.5, 0.40), (26.70, 0.40), (26.72, 0.78), (31.4, 0.80)],
    "typing": [(0.2, 3.0, 4.5), (5.1, 8.5, 5.5), (10.4, 12.8, 6.5), (25.7, 26.15, 7.5), (26.9, 31.2, 5.5)],
    "gaze": [(0.0, 3.4, "screen", "type"), (3.4, 5.0, "screen", "read"), (5.0, 8.6, "screen", "type"),
             (8.6, 10.0, "away", "still"), (10.0, 13.6, "screen", "type"),
             (13.6, 15.4, "beyond", "still"),     # up at Claude's spark as it pops out of the laptop
             (15.4, 24.8, "chat", "read"), (24.8, 31.4, "screen", "type")],
    # the inbox scrolled with the mouse (412 unread); fed up, hands behind his head; hands off the keys while
    # Claude talks
    "mouse": [(3.3, 4.8)],
    "clicks": [3.9, 4.4, 13.0, 26.3],             # two scroll clicks; Enter on his message; Enter on 'yes'
    "hands_behind": [(0, 0), (8.6, 0), (9.2, 1), (9.7, 1), (10.2, 0), (31.4, 0)],
    "hands_rest": [(0, 0), (13.55, 0), (13.9, 1), (24.9, 1), (25.4, 0), (31.4, 0)],
    "exhale": (14.3, 15.2),                       # a short laugh breath: someone answered
    "nod": (21.4, 22.2),                          # "...drafts the replies for you": yes, that
}

# ---------------------------------------------------------------------------------------------
# Scene 3, "Ivan's room" on the Ch 1 VO package clock (scenes/03-ivan-room/DIRECTION.md): V01-V07b, chapter seconds
# 0-37.9. Real VO: V01 3.00, V02 8.06, V03 12.93 (sub drop 12.88), V04 15.84 (chair creak 16.09), V05 21.17 (Enter
# 25.20), V06 26.84 (pings 27.76 / 28.46 / 29.16), V07a 30.58 (Claude's chime 32.50), V07b 35.15 (Enter 35.70, 36.30,
# 36.85; hit 36.25).
SCENE_S03 = {
    # typing at the desk; leans in on the creak for "hunched... typing furiously"; eases out to read; sits back for
    # "Well... technically, Claude is doing the building" (his hands are off the keys); leans in again to say yes
    "hunch": [(0, 0.55), (15.6, 0.60), (16.1, 0.62), (17.6, 0.95), (20.4, 1.0), (21.4, 0.85), (26.6, 0.78),
              (30.4, 0.74), (31.4, 0.50), (34.4, 0.48), (35.0, 0.64), (37.9, 0.66)],
    # a pause under the sub drop ("It's still full."): the room stops with the water
    "typing": [(0.4, 5.6, 4.5), (6.2, 9.4, 5.0), (10.0, 12.6, 4.5), (13.8, 15.4, 4.0), (16.3, 19.7, 7.5),
               (21.3, 22.5, 3.5), (23.0, 24.9, 4.0), (29.6, 30.4, 6.0)],
    "gaze": [(0.0, 15.4, "screen", "type"), (15.4, 16.2, "chat", "read"), (16.2, 19.8, "screen", "type"),
             (19.8, 21.2, "screen", "still"), (21.2, 22.6, "screen", "read"), (22.6, 23.9, "screen", "type"),
             (23.9, 26.7, "chat", "read"), (26.7, 30.2, "monitor", "still"), (30.2, 30.6, "screen", "type"),
             (30.6, 34.6, "chat", "read"), (34.6, 37.9, "screen", "still")],
    "hands_rest": [(0, 0), (30.5, 0), (31.0, 1), (34.5, 1), (35.0, 0), (37.9, 0)],
    "hands_behind": [(0, 0), (37.9, 0)],
    "clicks": [25.20, 35.70, 36.30, 36.85],       # Enter on the prompt; then y, y, y: he keeps saying yes
    "exhale": (31.0, 31.9),                       # "Well..."
    "nod": (33.2, 33.9),                          # Claude builds; he approves of it
}

SCENES = {"intro": SCENE, "s02": SCENE_S02, "s03": SCENE_S03, "s04": SCENE_S04}


class Actor:
    def __init__(self, rig, body, scene=None):
        self.rig, self.body = rig, body
        self.sc = scene or SCENE
        self.mods = [m for m in body.modifiers if m.type == "ARMATURE"]
        self.rnd = random.Random(7)
        self.upper = [b for b in rig.pose.bones if not any(k in b.name for k in ("Leg", "Foot", "Toe", "Hips"))]
        for pb in rig.pose.bones:
            pb.rotation_mode = "QUATERNION"

    # -- helpers -----------------------------------------------------------------------------
    def pb(self, n):
        return self.rig.pose.bones[P + n]

    def upd(self):
        bpy.context.view_layer.update()

    def wrot(self, pb):
        return (self.rig.matrix_world @ pb.matrix).to_quaternion()

    def whead(self, n):
        return self.rig.matrix_world @ self.pb(n).head

    def rotate_world(self, pb, axis_w, angle):
        to_arm = self.rig.matrix_world.to_3x3().inverted()
        ax = (to_arm @ axis_w).normalized()
        h = pb.matrix.to_translation()
        pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(angle, 4, ax) @ Matrix.Translation(-h) @ pb.matrix
        self.upd()

    def fast(self, on):
        for m in self.mods:
            m.show_viewport = not on                   # pose-only updates while solving (no skinning)

    # -- calibration (rest and base pose) -------------------------------------------------------
    def calibrate(self):
        """Face-forward axis per neck/head bone (in rest), and finger flexion axes (in the typing pose)."""
        for pb in self.upper:
            pb.matrix_basis = Matrix.Identity(4)
        self.upd()
        self.fwd_local = {n: self.wrot(self.pb(n)).inverted() @ FWD for n in ("Neck", "Head")}
        self.calibrate_head()

    def calibrate_head(self):
        """An ellipsoid around the skull and face, in the Head bone's space, from the mesh (rest pose).
        The hands are kept out of it (plus SKIN), so no gesture can pass through his head."""
        names = {g.index: g.name for g in self.body.vertex_groups}
        hm = (self.rig.matrix_world @ self.pb("Head").matrix).inverted()
        mw = self.body.matrix_world
        pts = []
        for v in self.body.data.vertices:
            if v.groups and names[max(v.groups, key=lambda g: g.weight).group].replace(P, "").startswith("Head"):
                pts.append(hm @ (mw @ v.co))
        lo = Vector([min(p[i] for p in pts) for i in range(3)])
        hi = Vector([max(p[i] for p in pts) for i in range(3)])
        self.head_c = (lo + hi) / 2
        self.head_r = (hi - lo) / 2
        print("head ellipsoid (bone space): centre", tuple(round(v, 3) for v in self.head_c), "radii", tuple(round(v, 3) for v in self.head_r))

    def calibrate_fingers(self):
        self.flex_axis = {}
        for side in ("Left", "Right"):
            n = self.palm_normal(side)
            for f in FINGERS + ("Thumb",):
                for j in (1, 2, 3):
                    pb = self.rig.pose.bones.get(f"{P}{side}Hand{f}{j}")
                    if not pb:
                        continue
                    d = (self.rig.matrix_world.to_3x3() @ (pb.tail - pb.head)).normalized()
                    ax_w = d.cross(n if f != "Thumb" else (n + d.cross(n) * (0.6 if side == "Left" else -0.6))).normalized()
                    self.flex_axis[pb.name] = self.wrot(pb).inverted() @ ax_w   # bone-local: valid for any pose

    def palm_normal(self, side):
        """Anatomical palm normal from the index and pinky knuckles and the hand direction."""
        hand = self.pb(f"{side}Hand")
        mw = self.rig.matrix_world
        d = (mw.to_3x3() @ (hand.tail - hand.head)).normalized()
        across = (mw @ self.pb(f"{side}HandPinky1").head) - (mw @ self.pb(f"{side}HandIndex1").head)
        n = across.cross(d) if side == "Left" else d.cross(across)
        return n.normalized()

    # -- per-frame solve ------------------------------------------------------------------------
    def reset_upper(self):
        for pb in self.upper:
            pb.matrix_basis = Matrix.Identity(4)
        self.upd()

    def posture(self, h, breath):
        lean = max(h, 0.0)
        back = min(h, 0.0)                              # negative: leaning back into the chair
        IP.aim(self.rig, "Spine", UP + FWD * (0.14 + 0.22 * lean + 0.35 * back))
        IP.aim(self.rig, "Spine1", UP + FWD * (0.22 + 0.34 * lean + 0.45 * back - 0.010 * breath))
        IP.aim(self.rig, "Spine2", UP + FWD * (0.30 + 0.46 * lean + 0.40 * back - 0.016 * breath))

    def look(self, target, neck_share=0.4):
        eye = self.whead("Head") + UP * 0.075
        d = (target - eye).normalized()
        for n, w in (("Neck", neck_share), ("Head", 1.0)):
            pb = self.pb(n)
            cur = (self.wrot(pb) @ self.fwd_local[n]).normalized()
            q = cur.rotation_difference(d)
            q = Quaternion().slerp(q, w)
            axis, ang = q.to_axis_angle()
            if ang > 1e-5:
                self.rotate_world(pb, axis, ang)
            eye = self.whead("Head") + UP * 0.075
            d = (target - eye).normalized()

    def shoulders(self, drop):
        for s, sg in (("Left", 1), ("Right", -1)):
            side = Vector((-1, 0, 0)) * sg
            IP.aim(self.rig, f"{s}Shoulder", side * 1.0 + FWD * 0.20 - UP * (0.06 + 0.10 * drop))

    def arm_to(self, side, wrist, behind=0.0, hand_dir=None, palm=None, neutral=0.0):
        sg = 1 if side == "Left" else -1
        out = Vector((-1, 0, 0)) * sg
        sh = self.whead(f"{side}Arm")
        pole = sh + out * (0.35 + 0.15 * behind) - UP * (0.45 * (1 - behind)) + UP * (0.35 * behind) - FWD * 0.1
        IP.two_bone_ik(self.rig, f"{side}Arm", f"{side}ForeArm", wrist, pole)
        if hand_dir is not None:                        # the caller blends the hand's direction and palm
            if neutral > 0:                             # in transit the wrist rides straight with the forearm
                fa = self.pb(f"{side}ForeArm")
                fd = (self.rig.matrix_world.to_3x3() @ (fa.tail - fa.head)).normalized()
                hand_dir = hand_dir.normalized().lerp(fd, neutral)
            IP.aim(self.rig, f"{side}Hand", hand_dir)
            self.roll_palm(side, palm)
        elif behind < 0.5:                                # typing: fingers forward and down, palm down
            IP.aim(self.rig, f"{side}Hand", FWD * 1.0 - UP * 0.30 - out * 0.06)
            self.roll_palm(side, -UP + out * 0.12)
        else:                                           # cradling the back of the head
            IP.aim(self.rig, f"{side}Hand", -out * 1.0 + UP * 0.4)

    def roll_palm(self, side, want):
        hand = self.pb(f"{side}Hand")
        d = (self.rig.matrix_world.to_3x3() @ (hand.tail - hand.head)).normalized()
        n = self.palm_normal(side)
        w = want - d * want.dot(d)
        if w.length < 1e-4:
            return
        w.normalize()
        n = (n - d * n.dot(d)).normalized()
        ang = math.atan2(d.dot(n.cross(w)), n.dot(w))
        self.rotate_world(hand, d, ang)

    def fingers(self, side, presses, curl_extra=0.0, relax=0.0):
        for f in FINGERS + ("Thumb",):
            base = BASE_CURL[f]
            p = presses.get(f, 0.0)
            for j in (1, 2, 3):
                pb = self.rig.pose.bones.get(f"{P}{side}Hand{f}{j}")
                if not pb or pb.name not in self.flex_axis:
                    continue
                a = base[j - 1] * (1 - 0.5 * relax) + PRESS[j - 1] * p + curl_extra * (0.6 if j == 1 else 0.8)
                pb.rotation_quaternion = Quaternion(self.flex_axis[pb.name], a)

    # -- hands: contact, collision, twist ----------------------------------------------------
    def head_frame(self):
        m = self.rig.matrix_world @ self.pb("Head").matrix
        return m, m.inverted()

    def head_centre(self):
        return self.head_frame()[0] @ self.head_c

    def hand_points(self, side):
        """Joint positions with the flesh around each: the palm is thick, fingers are not."""
        mw, pts = self.rig.matrix_world, []
        for n in [f"{side}Hand"] + [f"{side}Hand{f}{j}" for f in FINGERS + ("Thumb",) for j in (1, 2, 3)]:
            pb = self.rig.pose.bones.get(P + n)
            if pb:
                m = 0.034 if n.endswith("Hand") else 0.026 if n.endswith("Thumb1") else SKIN
                pts += [(mw @ pb.head, m), (mw @ pb.tail, m)]
        return pts

    def inside_head(self, p, skin=SKIN):
        """Depth (m) of a hand point inside the head volume grown by SKIN, and the outward normal (world)."""
        m, mi = self.head_frame()
        q = (mi @ p) - self.head_c
        r = self.head_r + Vector((skin, skin, skin))
        e = 3.0                                          # a superellipsoid: fuller at the brow and the back corners
        s = sum(abs(q[i] / r[i]) ** e for i in range(3)) ** (1 / e)
        if s >= 1.0:
            return 0.0, None
        g = Vector([math.copysign(abs(q[i]) ** (e - 1) / r[i] ** e, q[i]) for i in range(3)])
        if g.length < 1e-9:
            g = Vector((0, 1, 0))
        n = (m.to_3x3() @ g).normalized()
        return (1.0 - s) * min(r), n

    def keep_out(self, side, w, pose):
        """Re-pose with the wrist pushed out until no hand point is inside the head."""
        for _ in range(6):
            worst, push = 0.0, Vector()
            for p, m in self.hand_points(side):
                d, n = self.inside_head(p, m)
                if d > 0:
                    worst = max(worst, d)
                    push += n * d
            if worst < 0.002:
                break
            w = w + push.normalized() * (worst + 0.003)
            pose(w)
        return w

    def tip(self, side, f):
        return self.rig.matrix_world @ self.pb(f"{side}Hand{f}3").tail

    def solve1d(self, apply, err, lo, hi, it=10):
        """Find x in [lo, hi] with err(x) = 0 (bisection), or the end with the smaller error."""
        apply(lo); el = err()
        apply(hi); eh = err()
        if el * eh > 0:
            x = lo if abs(el) < abs(eh) else hi
            apply(x)
            return x
        for _ in range(it):
            mid = (lo + hi) / 2
            apply(mid); em = err()
            if em * el > 0:
                lo, el = mid, em
            else:
                hi = mid
        apply((lo + hi) / 2)
        return (lo + hi) / 2

    def fit_knuckles(self, side, height, weight):
        """Pitch the hand about the knuckle line's axis so the knuckles sit `height` above the surface."""
        if weight < 0.01:
            return
        hand = self.pb(f"{side}Hand")
        base = hand.matrix.copy()
        mw = self.rig.matrix_world
        d = (mw.to_3x3() @ (hand.tail - hand.head)).normalized()
        axis = d.cross(UP).normalized()
        to_arm = mw.to_3x3().inverted()
        ax = (to_arm @ axis).normalized()
        h = base.to_translation()

        def knuckle():
            k = (mw @ self.pb(f"{side}HandIndex1").head + mw @ self.pb(f"{side}HandPinky1").head) / 2
            return k

        k0 = knuckle()
        want = k0.z + weight * ((surface_z(k0.x, k0.y) + height) - k0.z)

        def apply(a):
            hand.matrix = Matrix.Translation(h) @ Matrix.Rotation(a, 4, ax) @ Matrix.Translation(-h) @ base
            self.upd()
        self.solve1d(apply, lambda: knuckle().z - want, -0.7, 0.7, it=9)

    def finger_curl(self, side, f, c):
        for j in (1, 2, 3):
            pb = self.rig.pose.bones.get(f"{P}{side}Hand{f}{j}")
            if pb and pb.name in self.flex_axis:
                pb.rotation_quaternion = Quaternion(self.flex_axis[pb.name], c * SHARE[j - 1])

    def fit_fingers(self, side, presses, weight, relaxed, extra=0.0):
        """Curl each finger until its tip touches what is under it (hovering, or pressing a key)."""
        for f in FINGERS + ("Thumb",):
            free = sum(BASE_CURL[f]) * (1 - 0.5 * relaxed) + extra * (0.5 if f == "Thumb" else 1.0)
            if weight < 0.01:
                self.finger_curl(side, f, free)
                continue
            p = presses.get(f, 0.0)
            lift = (HOVER * (1 - p) - 0.0015 * p) if f != "Thumb" else 0.006 * (1 - p)

            def err():
                t = self.tip(side, f)
                return t.z - (surface_z(t.x, t.y) + SKIN * 0.6 + lift)
            if f == "Thumb":                            # the thumb lifts on its own axis, over the space bar
                self.finger_curl(side, f, free)
                self.upd()
                self.lift_thumb(side, err, weight)
                continue
            c = self.solve1d(lambda x: (self.finger_curl(side, f, x), self.upd()), err, -0.35, 2.2, it=9)
            self.finger_curl(side, f, free + weight * (c - free))
        self.upd()
        for f in FINGERS:                               # whatever the pose, never through the desk (any joint)
            if self.clearance(side, f) < SKIN * 0.5:
                self.solve1d(lambda x: (self.finger_curl(side, f, x), self.upd()),
                             lambda: self.clearance(side, f) - SKIN * 0.5, -0.35, 2.2, it=7)
        t = self.tip(side, "Thumb")
        floor = surface_z(t.x, t.y) + SKIN * 0.5
        if t.z < floor:
            self.lift_thumb(side, lambda: self.tip(side, "Thumb").z - floor, 1.0)

    def clearance(self, side, f):
        """Lowest height of a finger's joints above whatever is under them."""
        mw = self.rig.matrix_world
        pts = [mw @ self.pb(f"{side}Hand{f}{j}").head for j in (2, 3)] + [self.tip(side, f)]
        return min(p.z - surface_z(p.x, p.y) for p in pts)

    def lift_thumb(self, side, err, weight):
        """Swing the whole thumb up or down about the hand's across axis until err() = 0 (blended by weight)."""
        pb = self.pb(f"{side}HandThumb1")
        base = pb.matrix.copy()
        hand = self.pb(f"{side}Hand")
        mw = self.rig.matrix_world
        d = (mw.to_3x3() @ (hand.tail - hand.head)).normalized()
        ax = (mw.to_3x3().inverted() @ d.cross(UP).normalized()).normalized()
        h = base.to_translation()

        def apply(a):
            pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(a, 4, ax) @ Matrix.Translation(-h) @ base
            self.upd()
        a = self.solve1d(apply, err, -0.9, 0.9, it=8)
        apply(a * weight)

    def twist_rel(self, side):
        c, p = self.pb(f"{side}Hand"), self.pb(f"{side}ForeArm")
        rest = p.bone.matrix_local.inverted() @ c.bone.matrix_local
        q = (rest.inverted() @ (p.matrix.inverted() @ c.matrix)).to_quaternion()
        return 2 * math.atan2(q.y, q.w)

    def spread_twist(self, side, share=0.55):
        """A forearm turns with the hand (radius over ulna): give it part of the wrist's roll, so the wrist
        never wrings like a towel. The hand keeps its exact world pose."""
        tw = self.twist_rel(side)
        tw = (tw + math.pi) % (2 * math.pi) - math.pi
        if abs(tw) < 0.3:
            return
        hand, fa = self.pb(f"{side}Hand"), self.pb(f"{side}ForeArm")
        keep = hand.matrix.copy()
        axis = (self.rig.matrix_world.to_3x3() @ (fa.tail - fa.head)).normalized()
        for sign in (1, -1):
            self.rotate_world(fa, axis, sign * tw * share)
            hand.matrix = keep
            self.upd()
            new = (self.twist_rel(side) + math.pi) % (2 * math.pi) - math.pi
            if abs(new) < abs(tw):
                return
            self.rotate_world(fa, axis, -sign * tw * share)
            hand.matrix = keep
            self.upd()

    # -- typing schedule ------------------------------------------------------------------------
    def schedule(self):
        """Key events: (time, side, finger). Phrases of 6-18 keys with 0.15-0.6 s gaps; thumbs hit space."""
        ev = []
        weights = {"Index": 0.34, "Middle": 0.28, "Ring": 0.22, "Pinky": 0.16}
        for t0, t1, rate in self.sc["typing"]:
            t = t0 + self.rnd.uniform(0.0, 0.2)
            while t < t1 - 0.1:
                n = self.rnd.randint(6, 18)
                for k in range(n):
                    if t >= t1 - 0.1:
                        break
                    if k and k % self.rnd.randint(4, 7) == 0:
                        ev.append((t, "Right", "Thumb"))
                    else:
                        side = "Left" if self.rnd.random() < 0.48 else "Right"
                        r = self.rnd.random()
                        acc = 0.0
                        for f, w in weights.items():
                            acc += w
                            if r <= acc:
                                break
                        ev.append((t, side, f))
                    t += self.rnd.uniform(0.7, 1.3) / rate
                t += self.rnd.uniform(0.15, 0.6) * min(1.0, 8.0 / rate)   # time-lapse rates squeeze the pauses
        for t in self.sc.get("clicks", []):              # mouse clicks: the right index finger
            ev.append((t, "Right", "Index"))
        self.events = sorted(ev)

    def press_amount(self, t, side):
        out = {}
        for te, s, f in self.events:
            if s != side or te > t + 0.01 or te < t - 0.3:
                continue
            dt = t - te
            v = smooth(dt / 0.05) if dt < 0.05 else (1.0 if dt < 0.08 else 1.0 - smooth((dt - 0.08) / 0.12))
            out[f] = max(out.get(f, 0.0), v)
        return out

    # -- gaze ---------------------------------------------------------------------------------
    def gaze_point(self, t):
        def point(name, mode, tt, t0):
            if name == "monitor":
                return MONITOR + Vector((0.0, 0.0, -0.02))
            if name == "monitor_low":
                return MONITOR + Vector((-0.05, 0.0, -0.06))
            if name == "away":
                return AWAY
            if name == "beyond":                          # just past the top of the screen: chin up a little
                return BEYOND
            if mode == "read" and name in ("chat", "screen"):           # line by line, left to right, then down
                line_t = 1.1
                k = int((tt - t0) / line_t)
                u = ((tt - t0) % line_t) / line_t
                base = CHAT if name == "chat" else SCREEN + Vector((-0.06, 0.0, 0.0))
                return base + Vector((-0.035 + 0.07 * smooth(u * 1.15), 0.0, 0.04 - 0.012 * (k % 7)))
            drift = Vector((0.025 * math.sin(tt * 0.9), 0.0, 0.01 * math.sin(tt * 0.6)))
            return SCREEN + drift
        segs = self.sc["gaze"]
        i = max(k for k, s in enumerate(segs) if s[0] <= t) if t >= segs[0][0] else 0
        s0, s1, name, mode = segs[i]
        p = point(name, mode, t, s0)
        if i > 0 and t - s0 < 0.45:                       # ease from where he was looking
            q = segs[i - 1]
            prev = point(q[2], q[3], s0, q[0])
            p = prev.lerp(p, smooth((t - s0) / 0.45))
        return p

    # -- the whole performance ----------------------------------------------------------------
    def perform(self, frames):
        self.fast(True)
        self.schedule()
        sc = bpy.context.scene
        rest_keys = [pb.name for pb in self.rig.pose.bones if pb not in self.upper]
        for f in range(1, frames + 1):
            t = (f - 1) / FPS
            sc.frame_set(f) if f == 1 else None
            self.reset_upper()
            breath = math.sin(2 * math.pi * 0.26 * t)
            ex = self.sc.get("exhale", (-1, -1))
            drop = math.sin(math.pi * min(1, max(0, (t - ex[0]) / (ex[1] - ex[0])))) if ex[0] < t < ex[1] else 0.0
            self.posture(curve(self.sc["hunch"], t), breath)
            self.shoulders(drop)
            # hands
            rest = curve(self.sc["hands_rest"], t)
            behind = curve(self.sc["hands_behind"], t)
            rub = max([smooth((t - a) / 0.5) * smooth((b - t) / 0.5) for a, b in self.sc.get("rub", [])] or [0.0])
            mouse = max([smooth((t - a) / 0.4) * smooth((b - t) / 0.4) for a, b in self.sc.get("mouse", [])] or [0.0])
            C = self.head_centre()
            rf = max(self.head_r.x, self.head_r.z)          # the head's depth (bone-space x/z: across and front)
            for side, home in (("Left", HOME_L), ("Right", HOME_R)):
                sg = 1 if side == "Left" else -1
                out = Vector((-1, 0, 0)) * sg
                pr = self.press_amount(t, side)
                drift = Vector((0.006 * math.sin(t * 0.7 + sg), 0.004 * math.sin(t * 0.5 + 2 * sg), 0.0))
                w = home + drift + UP * 0.025 * rest - FWD * 0.03 * rest
                lift = smooth(behind / 0.05)                # the hands leave the keys as soon as the stretch starts
                d, palm = FWD * 1.0 - UP * 0.30 * (1 - lift) - out * 0.06, -UP + out * 0.12   # typing: fingers forward, palm down
                if behind > 0:                              # hands cradling the back of his head
                    cradle = C + out * (rf + 0.035) - FWD * 0.045 + UP * 0.012
                    mid = (w + cradle) / 2 + UP * 0.30 + out * 0.32 - FWD * 0.10    # wide and high, past the ears
                    b = behind
                    w = (1 - b) ** 2 * w + 2 * (1 - b) * b * mid + b * b * cradle      # an arc, not a slide
                    k = smooth(behind)
                    d = d.lerp(-FWD * 0.75 - out * 0.65 + UP * 0.25, k)              # fingers back around the skull
                    palm = palm.lerp((C - cradle).normalized(), k)                    # palm toward the head
                if side == "Right" and mouse > 0:           # hand on the mouse: scrolling, clicking
                    w = w.lerp(MOUSE + Vector((0.012, -0.112, 0.020)), mouse) + UP * 0.045 * math.sin(math.pi * mouse)
                    d, palm = d.lerp(FWD - UP * 0.12, mouse), palm.lerp(-UP, mouse)
                if side == "Right" and rub > 0:             # the heel of his hand pressed into his brow
                    brow = C + FWD * (rf * 0.85) + UP * (self.head_r.y * 0.08)
                    w = w.lerp(brow + FWD * 0.02 - UP * 0.04 + out * 0.05, rub)
                    d, palm = d.lerp(UP * 0.45 - out * 0.9 + FWD * 0.05, rub), palm.lerp(-FWD, rub)   # fingers across the brow

                neutral = 0.85 * math.sin(math.pi * min(1.0, max(0.0, behind)))     # mid-arc: a straight wrist
                if side == "Right":
                    neutral = max(neutral, 0.85 * math.sin(math.pi * rub))

                def pose(ww, side=side, d=d, palm=palm, neutral=neutral):
                    self.arm_to(side, ww, behind, d, palm, neutral)
                pose(w)
                # on the keys (typing, or resting there between bursts), on the mouse, or off the desk entirely
                on_keys = (1 - lift) * ((1 - rub) * (1 - mouse) if side == "Right" else 1.0)
                on_mouse = mouse * (1 - rub) if side == "Right" else 0.0
                contact = max(on_keys, on_mouse)
                m_share = on_mouse / max(1e-6, on_keys + on_mouse)
                height = (0.060 - 0.016 * rest) * (1 - m_share) + 0.016 * m_share   # a resting hand sits lower
                if side == "Right":
                    height += 0.04 * math.sin(math.pi * mouse)  # lifted while it travels to and from the mouse
                base_hand = self.pb(f"{side}Hand").matrix.copy()
                for _ in range(4):                           # if a finger can't clear the desk, the hand rises
                    self.pb(f"{side}Hand").matrix = base_hand
                    self.upd()
                    self.fit_knuckles(side, height, contact)
                    self.fit_fingers(side, pr if contact > 0.5 and rest < 0.5 else {}, contact, relaxed=rest * (1 - behind),
                                     extra=1.3 * behind + (0.35 * rub if side == "Right" else 0.0))
                    low = min(self.clearance(side, f) for f in FINGERS)
                    if low > SKIN * 0.3 or behind > 0.3:
                        break
                    height += 0.015
                    contact = max(contact, 0.6)
                self.keep_out(side, w, pose)
                self.spread_twist(side)
            # gaze last (the neck rides on the posture)
            nod = 0.0
            n0, n1 = self.sc.get("nod", (-1, -1))
            if n0 < t < n1:
                nod = math.sin(math.pi * (t - n0) / (n1 - n0))
            g = self.gaze_point(t) - UP * 0.08 * nod
            self.look(g)
            for pb in self.upper:
                pb.keyframe_insert("rotation_quaternion", frame=f)
            if f in (1, frames):
                for n in rest_keys:
                    pb = self.rig.pose.bones[n]
                    pb.keyframe_insert("rotation_quaternion", frame=f)
                    pb.keyframe_insert("location", frame=f)
        self.fast(False)

    # -- standing (scene 2, the doorway) ---------------------------------------------------------
    def perform_stand(self, frames, look_at):
        """Standing still: upright, arms hanging, breathing, looking out through the door."""
        self.fast(True)
        for f in range(1, frames + 1):
            t = (f - 1) / FPS
            self.reset_upper()
            breath = math.sin(2 * math.pi * 0.22 * t)
            IP.aim(self.rig, "Spine", UP + FWD * 0.02)
            IP.aim(self.rig, "Spine1", UP + FWD * (0.03 - 0.012 * breath))
            IP.aim(self.rig, "Spine2", UP + FWD * (0.05 - 0.018 * breath))
            self.shoulders(0.6 + 0.1 * breath)
            for side, sg in (("Left", 1), ("Right", -1)):
                out = Vector((-1, 0, 0)) * sg
                sh = self.whead(f"{side}Arm")
                wrist = sh + out * 0.09 - UP * (0.53 - 0.004 * breath) + FWD * 0.03
                IP.two_bone_ik(self.rig, f"{side}Arm", f"{side}ForeArm", wrist, sh - FWD * 0.5 - UP * 0.2)
                IP.aim(self.rig, f"{side}Hand", -UP * 1.0 + FWD * 0.08)
                self.roll_palm(side, -out)
                self.fingers(side, {}, curl_extra=0.15, relax=1.0)
            self.look(look_at + Vector((0.0, 0.0, 0.02 * math.sin(t * 0.4))))
            for pb in self.upper:
                pb.keyframe_insert("rotation_quaternion", frame=f)
        self.fast(False)

