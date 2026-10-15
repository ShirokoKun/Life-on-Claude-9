"""Part 2 - one-shots: UI/digital, foley, impacts, transitions. All synthesized."""
import numpy as np
from dsp import *

def _rg(seed): return np.random.default_rng(seed)

def _add(buf, x, t0, g=1.0):
    k = n(t0)
    if k >= buf.shape[0]: return
    m = min(len(x), buf.shape[0] - k)
    if buf.ndim == 2 and x.ndim == 1: x = stereo(x)
    buf[k:k + m] += x[:m] * g

def _bell(f, sec, ratios=(1.0, 2.0, 3.0, 4.1), amps=(1.0, 0.35, 0.15, 0.06), tau=0.5):
    t = tt(sec); x = np.zeros_like(t)
    for i, (r_, a) in enumerate(zip(ratios, amps)):
        x += a * np.sin(2 * np.pi * f * r_ * t) * np.exp(-t / (tau / (1 + 0.8 * i)))
    return x * np.minimum(1, t / 0.003)

def _click(sec=0.012, lo=1500, hi=7000, tau=0.003, seed=0, g=1.0):
    r = _rg(seed)
    return bp(white(sec, r), lo, hi) * np.exp(-tt(sec) / tau) * g

def _sweep_lp(x, f0, f1, curve="exp"):
    """Time-varying one-pole low-pass (x2 cascade): cutoff glides f0 -> f1 across x."""
    N = len(x); t = np.linspace(0, 1, N)
    fc = f0 * (f1 / f0) ** t if curve == "exp" else f0 + (f1 - f0) * t
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    y = np.zeros(N); z = 0.0
    for i in range(N):
        z += a[i] * (x[i] - z); y[i] = z
    y2 = np.zeros(N); z = 0.0
    for i in range(N):
        z += a[i] * (y[i] - z); y2[i] = z
    return y2

def _finish(x, peak=-3.0, tail_trim=True):
    if x.ndim == 1: x = stereo(x)
    if tail_trim: x = trim_silence(x, -75)
    return norm_peak(x, peak)

# ================================================================ UI / DIGITAL
def ui_claude_chime_friendly():
    """Claude's identity motif: rising perfect fifth E5 -> B5, bell-soft. Bright and kind (Ch1 version)."""
    buf = np.zeros((n(2.4), 2))
    _add(buf, stereo(_bell(659.25, 1.6, tau=0.55), -0.1), 0.0)
    _add(buf, stereo(_bell(987.77, 1.8, tau=0.65), 0.1), 0.17, 0.85)
    return _finish(reverb(buf, 0.9, 0.22, 7000))

def ui_claude_chime_neutral():
    buf = np.zeros((n(1.6), 2)); _add(buf, stereo(_bell(987.77, 1.2, tau=0.45)), 0.0)
    return _finish(reverb(buf, 0.7, 0.18, 7000), -6.0)

def ui_claude_chime_hollow():
    """Same motif, but dry-ish, low-passed, drowned in a big empty room. For the chapter-out hook."""
    buf = np.zeros((n(6.0), 2))
    _add(buf, stereo(lp(_bell(659.25, 2.0, tau=0.7), 4500), -0.2), 0.0)
    _add(buf, stereo(lp(_bell(987.77, 2.4, tau=0.9), 4500), 0.2), 0.22, 0.8)
    return _finish(reverb(buf, 3.2, 0.55, 3500), -6.0)

def ui_typing_indicator():
    buf = np.zeros((n(1.0), 2))
    for i, f in enumerate((520, 620, 740)):
        _add(buf, stereo(_bell(f, 0.2, ratios=(1.0, 2.0), amps=(1.0, 0.2), tau=0.04), (i - 1) * 0.2), 0.03 + i * 0.17)
    return _finish(buf, -9.0)

def ui_msg_send_tick():
    t = tt(0.12); f = 800 + 700 * (t / 0.12) ** 0.7
    ch = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03)
    ch[:n(0.012)] += _click(seed=1)[:n(0.012)] * 0.8
    return _finish(reverb(stereo(ch), 0.3, 0.12), -6.0)

def ui_msg_receive_tick():
    buf = np.zeros((n(0.4), 2))
    _add(buf, stereo(_bell(880, 0.25, ratios=(1.0, 2.0), amps=(1.0, 0.25), tau=0.05)), 0.0)
    _add(buf, stereo(_bell(660, 0.3, ratios=(1.0, 2.0), amps=(1.0, 0.25), tau=0.06)), 0.07, 0.8)
    return _finish(reverb(buf, 0.3, 0.12), -6.0)

def _text_stream(dur, seed, density=1.0):
    r = _rg(seed); buf = np.zeros((n(dur + 0.2), 2)); t = 0.02
    while t < dur - 0.05:
        burst = r.random() < 0.18
        k = int(r.integers(3, 9)) if burst else 1
        for _ in range(k):
            f = r.uniform(1800, 4600); d = 0.012
            tick = _click(d, 1800, 7500, 0.0025, int(r.integers(1e9)), r.uniform(0.3, 1.0))
            tick += np.sin(2 * np.pi * f * tt(d)) * np.exp(-tt(d) / 0.004) * 0.25
            _add(buf, stereo(tick, r.uniform(-0.4, 0.4)), t, 1.0)
            t += r.uniform(0.006, 0.018) / density
        t += r.exponential(0.03) / density
    return buf

def ui_terminal_text_stream_short(): return _finish(fade(_text_stream(1.6, 11), 0.05, 0.3), -9.0)
def ui_terminal_text_stream_long():  return _finish(fade(_text_stream(4.4, 12), 0.1, 0.5), -9.0)

_PING = {"a": 587.33, "b": 698.46, "c": 880.0, "d": 1046.5}   # D5 F5 A5 C6 - D-minor arpeggio, same key as the pulse
def _ping(f):
    buf = np.zeros((n(1.6), 2))
    _add(buf, stereo(_bell(f, 1.2, ratios=(1.0, 2.0, 3.01), amps=(1.0, 0.3, 0.08), tau=0.32)), 0.0)
    _add(buf, stereo(_click(0.01, 3000, 9000, 0.002, 5, 0.5)), 0.0)
    return _finish(reverb(buf, 0.6, 0.15), -6.0)
def ui_module_ping_a(): return _ping(_PING["a"])
def ui_module_ping_b(): return _ping(_PING["b"])
def ui_module_ping_c(): return _ping(_PING["c"])
def ui_module_ping_d(): return _ping(_PING["d"])

def ui_pipeline_send_confirm():
    """SEND node going green: crisp tick, A5+E6 confirm tone, a sprinkle of sparkle."""
    r = _rg(21); buf = np.zeros((n(2.0), 2))
    _add(buf, stereo(_click(0.015, 2000, 9000, 0.003, 6, 1.0)), 0.0)
    _add(buf, stereo(_bell(880, 1.4, tau=0.4), -0.15), 0.02, 0.9)
    _add(buf, stereo(_bell(1318.5, 1.4, tau=0.4), 0.15), 0.07, 0.7)
    for i in range(6):
        _add(buf, stereo(_bell(r.choice([1760, 2093, 2637, 3136]), 0.4, ratios=(1.0, 2.0), amps=(1, .2), tau=0.08), r.uniform(-.7, .7)), 0.12 + i * 0.05, 0.25)
    return _finish(reverb(buf, 0.9, 0.2), -4.5)

def ui_compile_success():
    buf = np.zeros((n(1.4), 2))
    _add(buf, stereo(_bell(440, 0.8, ratios=(1.0, 2.0), amps=(1.0, 0.3), tau=0.18)), 0.0)
    _add(buf, stereo(_bell(659.25, 1.0, ratios=(1.0, 2.0), amps=(1.0, 0.3), tau=0.24)), 0.09, 0.9)
    th = np.sin(2 * np.pi * 90 * tt(0.12)) * np.exp(-tt(0.12) / 0.035)
    _add(buf, stereo(th), 0.0, 0.9)
    return _finish(reverb(buf, 0.5, 0.12), -4.5)

def ui_module_complete_rush():
    """The 'rush of pure satisfaction': fast D-minor arpeggio up, shimmer bloom, soft sub thump."""
    r = _rg(31); buf = np.zeros((n(3.2), 2))
    for i, f in enumerate([587.33, 698.46, 880, 1046.5, 1174.7, 1318.5, 1568]):
        _add(buf, stereo(_bell(f, 1.6, tau=0.5), -0.5 + i * 0.16), 0.05 + i * 0.045, 0.8)
    sh = hp(white(1.4, r), 5000) * np.sin(np.linspace(0, np.pi, n(1.4))) ** 2 * 0.16
    _add(buf, widen(sh, 0.6), 0.1)
    th = np.sin(2 * np.pi * 55 * tt(0.6)) * np.exp(-tt(0.6) / 0.15)
    _add(buf, stereo(th), 0.0, 0.8)
    return _finish(reverb(buf, 1.7, 0.3, 6500), -3.0)

def ui_screen_wake_click():
    buf = np.zeros((n(0.3), 2))
    _add(buf, stereo(_click(0.02, 2500, 8000, 0.004, 41, 1.0)), 0.0)
    _add(buf, stereo(np.sin(2 * np.pi * 1200 * tt(0.03)) * np.exp(-tt(0.03) / 0.008) * 0.3), 0.012)
    return _finish(buf, -9.0)

def ui_task_clear_pop():
    t = tt(0.16); f = 900 * (0.31 ** np.minimum(1, t / 0.07))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03)
    return _finish(reverb(stereo(x * 0.9), 0.25, 0.1), -8.0)

def ui_auto_reply_flurry():
    """Dozens of replies leaving the system at once: 12 soft send-ticks, random pitch/pan, thinning out."""
    r = _rg(51); buf = np.zeros((n(3.2), 2)); t = 0.0
    for i in range(14):
        f0 = r.uniform(700, 1500); tt_ = tt(0.1)
        s = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 0.8 * tt_ / 0.1 ** 0.8)) / SR) * np.exp(-tt_ / 0.025) * (1 - i * 0.045)
        _add(buf, stereo(s, r.uniform(-0.7, 0.7)), t, 0.8)
        t += r.uniform(0.08, 0.26)
    return _finish(reverb(buf, 0.35, 0.12), -9.0)

def trn_time_skip_tick():
    """Accelerating clock ticks, 2 Hz -> 22 Hz: hours collapsing. Ends on a soft low thud. No whoosh."""
    r = _rg(61); buf = np.zeros((n(3.2), 2)); t = 0.05; i = 0
    while t < 2.6:
        prog = t / 2.6; rate = 2 + 20 * prog ** 1.8
        f = 1200 + 1800 * prog
        tick = _click(0.012, f, f * 2.6, 0.0025, i + 700, 1.0) + np.sin(2 * np.pi * f * tt(0.012)) * np.exp(-tt(0.012) / 0.003) * 0.3
        _add(buf, stereo(tick, -0.3 + 0.6 * prog), t, 0.6 + 0.4 * prog)
        t += 1.0 / rate; i += 1
    _add(buf, stereo(np.sin(2 * np.pi * 70 * tt(0.3)) * np.exp(-tt(0.3) / 0.08)), 2.62, 0.9)
    return _finish(reverb(buf, 0.5, 0.12), -6.0)

def sfx_vibrating_frequency():
    """'Vibrating at a different frequency': a tone whose vibrato speeds from 3 Hz to 20 Hz while it swells, then is cut."""
    L = 6.0; t = tt(L); prog = t / L
    rate = 3 + 17 * prog ** 1.5
    depth_cents = 6 + 26 * prog
    lfo = np.sin(2 * np.pi * np.cumsum(rate) / SR)
    f = 196.0 * 2 ** (depth_cents * lfo / 1200)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.18 * np.sin(3 * ph)
    x *= np.minimum(1, t / 2.0) ** 1.6 * 0.8 + 0.2
    x *= np.minimum(1, (L - t) / 0.06)
    return _finish(reverb(widen(x, 0.4), 1.2, 0.2), -6.0)

def trn_door_threshold():
    """Stepping through a door only Ivan can see: air-pressure shift + soft sub thud, room tone changes character."""
    r = _rg(71); L = 2.4; buf = np.zeros((n(L), 2))
    pr = lp(colored(1.6, "pink", r), 350) * np.sin(np.linspace(0, np.pi, n(1.6))) ** 2
    _add(buf, widen(pr, 0.5), 0.0, 1.0)
    op = bp(colored(1.2, "pink", r), 400, 3500) * (np.sin(np.linspace(0, np.pi, n(1.2))) ** 3) * 0.25
    _add(buf, widen(op, 0.6), 0.5)
    th = np.sin(2 * np.pi * 45 * tt(0.4)) * np.exp(-tt(0.4) / 0.09)
    _add(buf, stereo(th), 0.78, 1.2)
    return _finish(reverb(buf, 1.0, 0.25), -4.0)

def sfx_fraying_texture():
    """Thinness at the edge of the mind: gated filament noise + a wobbling thin tone, dropouts. For 'fraying'."""
    r = _rg(81); L = 7.0; t = tt(L)
    gate = np.zeros(n(L)); i = 0
    while i < n(L):
        on = n(r.uniform(0.04, 0.3)); off = n(r.uniform(0.02, 0.2)); gate[i:i + on] = r.uniform(0.3, 1.0); i += on + off
    gate = lp(gate, 60, 2)
    fil = hp(white(L, r), 3800) * gate
    th = np.sin(2 * np.pi * np.cumsum(3300 + 40 * slow_noise(L, 3, r)) / SR) * (0.05 + 0.04 * slow_noise(L, 1.5, r))
    x = widen(fil * 0.35 + th, 0.6)
    x = fade(x, 2.0, 2.0)
    return _finish(x, -9.0)

def sfx_take_give():
    """'Takes something from him, even as it gives something back': a pitch falls an octave, then a small chime lifts."""
    L = 3.4; buf = np.zeros((n(L), 2)); t = tt(1.5)
    f = 440 * 0.5 ** (t / 1.5)
    ph = 2 * np.pi * np.cumsum(f) / SR
    fall = (np.sin(ph) + 0.25 * np.sin(2 * ph)) * np.exp(-t / 1.0) * np.minimum(1, t / 0.05)
    _add(buf, widen(fall, 0.3), 0.0, 0.8)
    _add(buf, stereo(_bell(659.25, 1.8, tau=0.5)), 1.55, 0.55)
    return _finish(reverb(buf, 1.4, 0.25), -6.0)

def sfx_caffeine_tremor():
    r = _rg(91); L = 3.8; t = tt(L)
    am = 0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(12 + 3 * slow_noise(L, 1, r)) / SR)
    x = bp(white(L, r), 2200, 5200) * am ** 2
    ticks = np.zeros(n(L)); k = 0.0
    while k < L - 0.05:
        c = _click(0.008, 3000, 8000, 0.002, int(k * 1000) + 5, 0.7); ticks[n(k):n(k) + len(c)] += c; k += 1 / 13 + r.uniform(-0.01, 0.01)
    X = widen(x * 0.25 + ticks * 0.4, 0.5); X = fade(X, 0.8, 1.0)
    return _finish(X, -10.0)

def sfx_glass_stillness():
    """The untouched glass: very faint inharmonic ring-shimmer that swells in a held shot. 'Nothing has moved in six hours.'"""
    L = 5.0; t = tt(L); r = _rg(101); x = np.zeros_like(t)
    for f, a in [(1710, 1.0), (2934, 0.6), (4620, 0.35), (6190, 0.2)]:
        x += a * np.sin(2 * np.pi * f * t + r.uniform(0, 6)) * (0.7 + 0.3 * np.sin(2 * np.pi * r.uniform(0.2, 0.6) * t))
    x *= np.sin(np.pi * np.minimum(1, t / L)) ** 1.5
    X = widen(x, 0.6) * 0.5
    return _finish(reverb(X, 1.8, 0.35, 6000), -12.0)

# ================================================================ FOLEY
def _key(seed, f_body=185, hard=1.0, sec=0.14):
    r = _rg(seed); x = np.zeros(n(sec))
    down = bp(white(0.008, r), 2800, 9500) * np.exp(-tt(0.008) / 0.002) * hard
    body = np.sin(2 * np.pi * f_body * tt(0.04)) * np.exp(-tt(0.04) / 0.009) * 0.6
    x[:len(down)] += down; x[:len(body)] += body
    up = bp(white(0.006, r), 2500, 8000) * np.exp(-tt(0.006) / 0.0015) * 0.35 * hard
    k = n(0.07); x[k:k + len(up)] += up
    return x

def _kc(i): return _finish(stereo(_key(1000 + i, 170 + 18 * (i % 3), 0.9 + 0.1 * (i % 2)), 0.0), -6.0)
def fol_key_click_01(): return _kc(1)
def fol_key_click_02(): return _kc(2)
def fol_key_click_03(): return _kc(3)
def fol_key_click_04(): return _kc(4)
def fol_key_click_05(): return _kc(5)
def fol_key_click_06(): return _kc(6)
def fol_key_space():  return _finish(stereo(_key(1100, 120, 0.8, 0.18)), -6.0)
def fol_key_enter():
    a = _key(1200, 135, 1.0, 0.2); b = _key(1201, 95, 0.5, 0.15)
    x = a.copy(); o = n(0.012); m = min(len(b), len(x) - o); x[o:o + m] += b[:m]
    return _finish(stereo(x), -5.0)

def _typing(dur, mean_gap, seed, burstiness=0.25, enter_at_end=False):
    r = _rg(seed); buf = np.zeros((n(dur + 0.3), 2)); t = 0.05
    while t < dur:
        i = int(r.integers(1, 7)); k = _key(1000 + i + int(r.integers(0, 20)), r.uniform(150, 215), r.uniform(0.55, 1.0))
        k = np.interp(np.linspace(0, len(k) - 1, int(len(k) * r.uniform(0.96, 1.05))), np.arange(len(k)), k)
        _add(buf, stereo(k, r.uniform(-0.15, 0.15)), t, r.uniform(0.5, 1.0))
        t += r.exponential(mean_gap) * (0.5 if r.random() < burstiness else 1.0) + mean_gap * 0.25
        if r.random() < 0.05: t += r.uniform(0.3, 0.7)     # a thinking pause
    if enter_at_end: _add(buf, stereo(_key(1300, 135, 1.0, 0.2)), dur - 0.05, 1.0)
    return buf
def fol_typing_burst_slow():    return _finish(fade(reverb(_typing(4.0, 0.20, 1), 0.3, 0.1), 0.05, 0.3), -6.0)
def fol_typing_burst_fast():    return _finish(fade(reverb(_typing(4.5, 0.085, 2, 0.35), 0.3, 0.1), 0.05, 0.3), -6.0)
def fol_typing_frantic():       return _finish(fade(reverb(_typing(9.0, 0.06, 3, 0.45, True), 0.3, 0.1), 0.05, 0.4), -6.0)

def fol_phone_buzz_couch():
    """Phone vibrating on a sofa cushion: two pulses, the second weaker. Muffled. Unanswered."""
    r = _rg(1400); L = 2.6; buf = np.zeros((n(L), 2))
    for k, (t0, g) in enumerate([(0.1, 1.0), (0.95, 0.65)]):
        d = 0.62; t = tt(d)
        saw = signal.sawtooth(2 * np.pi * 172 * t)
        am = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * 22 * t))
        buzz = lp(saw * am, 480) * np.minimum(1, t / 0.03) * np.minimum(1, (d - t) / 0.05)
        rat = bp(white(d, r), 700, 2600) * (0.4 + 0.6 * am) * 0.15 * np.minimum(1, t / 0.03) * np.minimum(1, (d - t) / 0.05)
        _add(buf, stereo(buzz + rat, 0.2), t0, g)
    return _finish(reverb(buf, 0.35, 0.12), -5.0)

def fol_chair_creak_lean():
    r = _rg(1500); L = 1.9; t = tt(L)
    env = np.sin(np.pi * np.minimum(1, t / 1.4)) ** 1.3 * (t < 1.4)
    fc = 520 + 240 * (t / 1.4)
    src = white(L, r) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 21 * t + 6 * slow_noise(L, 3, r))))
    cr = np.zeros(n(L)); blocks = 512
    for i in range(0, n(L), blocks):
        seg = src[i:i + blocks] * env[i:i + blocks]
        cr[i:i + blocks] = resonator(seg, float(fc[min(i, n(L) - 1)]), 14.0) if len(seg) else seg
    ru = bp(white(L, r), 900, 4000) * env * 0.12
    th = np.sin(2 * np.pi * 85 * tt(0.15)) * np.exp(-tt(0.15) / 0.05) * 0.9
    X = stereo(cr * 0.7 + ru, -0.1); _add(X, stereo(th), 0.0)
    return _finish(reverb(X, 0.4, 0.12), -8.0)

def fol_breath_exhale():
    """Stylized exhale (air + a little throat resonance). Meant to sit under VO."""
    r = _rg(1600); L = 2.0; t = tt(L)
    env = np.where(t < 0.28, (t / 0.28) ** 1.5, np.exp(-(t - 0.28) / 0.5)) * np.minimum(1, (L - t) / 0.3)
    x = bp(white(L, r), 650, 3600) * env + resonator(white(L, r), 900, 3.0) * env * 0.4
    return _finish(widen(x, 0.3), -12.0)

def _beat_hit(bpm_gap=0.28):
    lub = np.sin(2 * np.pi * 58 * tt(0.2)) * np.exp(-tt(0.2) / 0.055)
    th = lp(white(0.04, _rg(5)), 160) * np.exp(-tt(0.04) / 0.01) * 0.6
    lub[:len(th)] += th
    lub *= np.minimum(1.0, tt(0.2) / 0.004); 
    dub = np.sin(2 * np.pi * 66 * tt(0.2)) * np.exp(-tt(0.2) / 0.045) * 0.7 * np.minimum(1.0, tt(0.2) / 0.004)
    return lub, dub

def fol_heartbeat_62bpm_loop(beats=8):
    per = 60 / 62; L = beats * per; buf = np.zeros((n(L + 1.0), 2)); lub, dub = _beat_hit()
    for i in range(beats):
        _add(buf, stereo(lub), i * per, 1.0); _add(buf, stereo(dub), i * per + 0.27, 1.0)
    m = n(1.0); body = buf[:n(L)].copy(); body[:m] += buf[n(L):n(L) + m]
    return norm_peak(body, -4.0)

def fol_heartbeat_ramp():
    """62 -> 100 bpm over ~13 s: the 4 AM creeping dread."""
    lub, dub = _beat_hit(); buf = np.zeros((n(14.0), 2)); t = 0.0
    while t < 13.0:
        bpm = 62 + 38 * (t / 13.0) ** 1.3; per = 60 / bpm
        _add(buf, stereo(lub), t, 1.0); _add(buf, stereo(dub), t + 0.27 * (62 / bpm) ** 0.5, 0.9); t += per
    return _finish(fade(buf, 0.0, 1.0), -4.0)

# ================================================================ IMPACTS / TRANSITIONS
def imp_sub_drop_soft():
    """'It's still full.' - a soft, controlled low-end drop: sine glide down, tiny felt click, no boom."""
    L = 3.4; t = tt(L); f = 33 + 41 * np.exp(-t / 0.55)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)) * np.exp(-t / 0.9) * np.minimum(1, t / 0.008)
    x[:n(0.01)] += lp(white(0.01, _rg(7)), 900) * np.linspace(1, 0, n(0.01)) * 0.5
    return _finish(reverb(stereo(x), 1.0, 0.15, 2500), -3.0)

def imp_tonal_hit_minor2():
    """'Ivan keeps saying yes.' - a hollow felt-piano minor second (A3 + Bb3) with a soft sub. Uneasy, controlled."""
    L = 4.0; buf = np.zeros((n(L), 2))
    for f, g, pan in [(220.0, 1.0, -0.2), (233.08, 0.9, 0.2), (440.0, 0.25, 0.0), (110.0, 0.5, 0.0)]:
        t = tt(L); x = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.4)) * np.exp(-t / 1.4) * np.minimum(1, t / 0.006)
        _add(buf, stereo(x * g, pan), 0.0)
    sub = np.sin(2 * np.pi * 55 * tt(1.0)) * np.exp(-tt(1.0) / 0.25)
    _add(buf, stereo(sub), 0.0, 0.8)
    _add(buf, stereo(lp(white(0.02, _rg(8)), 1500) * np.exp(-tt(0.02) / 0.004)), 0.0, 0.8)
    return _finish(reverb(buf, 2.2, 0.35, 3500), -3.0)

def trn_vacuum_dropout():
    """The world suddenly empties: filtered air collapses downward, then a beat of dead room. Use to cut the 'high' off."""
    r = _rg(111); L = 2.4; buf = np.zeros((n(L), 2))
    x = colored(0.95, "pink", r)
    x = _sweep_lp(x, 9000, 90) * np.minimum(1, tt(0.95) / 0.02) * np.exp(-tt(0.95) / 0.35)
    _add(buf, widen(x, 0.4), 0.0)
    sub = np.sin(2 * np.pi * 50 * tt(0.4)) * np.exp(-tt(0.4) / 0.1)
    _add(buf, stereo(sub), 0.0, 0.7)
    return _finish(buf, -4.0, tail_trim=False)

def trn_flashback_timeshift():
    """Present -> two days ago: reversed bell swell into a pitch-falling pad (tape-stop on time). No whoosh."""
    r = _rg(121); L = 4.4; buf = np.zeros((n(L), 2))
    ch = reverb(_bell(659.25, 1.5, tau=0.5) + 0.7 * _bell(987.77, 1.5, tau=0.55), 1.6, 0.5, 5000)
    rev = ch[::-1][: n(1.9)] if ch.ndim == 1 else ch[::-1][: n(1.9)]
    _add(buf, rev * 0.8, 0.0)
    t = tt(2.5); f = np.exp(np.log(1.0) + np.log(0.35) * (t / 2.5) ** 1.4)
    x = 0.0
    for base in (220.0, 329.63, 440.0):
        ph = 2 * np.pi * np.cumsum(base * f) / SR
        x = x + np.sin(ph) + 0.3 * np.sin(2 * ph)
    x = x * np.exp(-t / 1.1) * np.minimum(1, t / 0.15) * 0.35
    _add(buf, widen(x, 0.5), 1.8)
    return _finish(buf, -6.0)

def trn_dawn_rise():
    """Sunrise: four sines (D4 A4 F#5 D5) rise a major-ish 3rd over 12 s with a widening vibrato. Tonal, not a whoosh."""
    L = 12.0; t = tt(L); prog = t / L; outs = []
    for ch in range(2):
        r = _rg(130 + ch); x = np.zeros_like(t)
        for f0, g in [(293.66, 1.0), (440.0, 0.7), (739.99, 0.45), (587.33, 0.5)]:
            for det in (-0.25, 0.3):
                f = (f0 + det) * (1 + 0.06 * prog ** 1.4)
                vib = 1 + 0.004 * prog * np.sin(2 * np.pi * (3 + 3 * prog) * t + r.uniform(0, 6))
                ph = 2 * np.pi * np.cumsum(f * vib) / SR
                x += g * (np.sin(ph) + 0.2 * np.sin(2 * ph))
        outs.append(x)
    X = np.stack(outs, 1) * (np.sin(np.pi * np.minimum(1, t / L) ** 0.9) ** 1.2)[:, None]
    X = fade(X, 4.0, 3.0)
    return _finish(reverb(X, 2.5, 0.35), -6.0, tail_trim=False)
