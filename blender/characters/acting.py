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
HOME_L = Vector((6.872, 2.975, 0.805))     # wrists above the front edge, fingertips land on ASDF / JKL;
HOME_R = Vector((7.012, 2.975, 0.805))
SCREEN = Vector((6.95, 3.228, 0.871))       # laptop screen centre
CHAT = Vector((7.00, 3.235, 0.885))         # the Claude chat column (right half of the screen)
MONITOR = Vector((7.357, 3.315, 1.066))     # dashboard / pipeline monitor

FINGERS = ("Index", "Middle", "Ring", "Pinky")
BASE_CURL = {"Index": (0.16, 0.30, 0.16), "Middle": (0.15, 0.30, 0.16), "Ring": (0.14, 0.28, 0.15),
             "Pinky": (0.12, 0.26, 0.14), "Thumb": (0.05, 0.10, 0.08)}       # arched, reaching, not a fist
PRESS = (0.26, 0.14, 0.08)                  # extra flexion (rad) per joint at the bottom of a keystroke


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


class Actor:
    def __init__(self, rig, body):
        self.rig, self.body = rig, body
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

    def arm_to(self, side, wrist, behind=0.0):
        sg = 1 if side == "Left" else -1
        out = Vector((-1, 0, 0)) * sg
        sh = self.whead(f"{side}Arm")
        pole = sh + out * (0.35 + 0.15 * behind) - UP * (0.45 * (1 - behind)) + UP * (0.35 * behind) - FWD * 0.1
        IP.two_bone_ik(self.rig, f"{side}Arm", f"{side}ForeArm", wrist, pole)
        if behind < 0.5:                                # typing: fingers forward and down, palm down
            IP.aim(self.rig, f"{side}Hand", FWD * 1.0 - UP * 0.30 - out * 0.06)
            self.roll_palm(side, -UP + out * 0.12)
        else:                                           # cradling the back of the head
            IP.aim(self.rig, f"{side}Hand", -out * 1.0 + UP * 0.4)

    def roll_palm(self, side, want):
        hand = self.pb(f"{side}Hand")
        d = (self.rig.matrix_world.to_3x3() @ (hand.tail - hand.head)).normalized()
        n = self.palm_normal(side)
        w = (want - d * want.dot(d)).normalized()
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

    # -- typing schedule ------------------------------------------------------------------------
    def schedule(self):
        """Key events: (time, side, finger). Phrases of 6-18 keys with 0.15-0.6 s gaps; thumbs hit space."""
        ev = []
        weights = {"Index": 0.34, "Middle": 0.28, "Ring": 0.22, "Pinky": 0.16}
        for t0, t1, rate in SCENE["typing"]:
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
                t += self.rnd.uniform(0.15, 0.6)
        self.events = ev

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
            if name == "chat" and mode == "read":           # line by line, left to right, then down
                line_t = 1.1
                k = int((tt - t0) / line_t)
                u = ((tt - t0) % line_t) / line_t
                return CHAT + Vector((-0.035 + 0.07 * smooth(u * 1.15), 0.0, 0.04 - 0.012 * k))
            drift = Vector((0.025 * math.sin(tt * 0.9), 0.0, 0.01 * math.sin(tt * 0.6)))
            return SCREEN + drift
        segs = SCENE["gaze"]
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
            ex = SCENE["exhale"]
            drop = math.sin(math.pi * min(1, max(0, (t - ex[0]) / (ex[1] - ex[0])))) if ex[0] < t < ex[1] else 0.0
            self.posture(curve(SCENE["hunch"], t), breath)
            self.shoulders(drop)
            # hands
            rest = curve(SCENE["hands_rest"], t)
            behind = curve(SCENE["hands_behind"], t)
            head = self.whead("Head")
            for side, home in (("Left", HOME_L), ("Right", HOME_R)):
                sg = 1 if side == "Left" else -1
                pr = self.press_amount(t, side)
                drift = Vector((0.006 * math.sin(t * 0.7 + sg), 0.004 * math.sin(t * 0.5 + 2 * sg), 0.0))
                w = home + drift - UP * 0.003 * max(pr.values(), default=0.0) + UP * 0.025 * rest - FWD * 0.03 * rest
                if behind > 0:
                    nape = head + Vector((-0.085 * sg, -0.07, 0.07))
                    mid = (w + nape) / 2 + UP * 0.30 - Vector((0.32 * sg, 0.10, 0))   # wide and high, past the ears: relief, not head-in-hands
                    b = behind
                    w = (1 - b) ** 2 * w + 2 * (1 - b) * b * mid + b * b * nape     # an arc, not a slide
                self.arm_to(side, w, behind)
                self.fingers(side, pr if rest < 0.5 else {}, curl_extra=0.9 * behind, relax=rest * (1 - behind))
            # gaze last (the neck rides on the posture)
            nod = 0.0
            n0, n1 = SCENE["nod"]
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
