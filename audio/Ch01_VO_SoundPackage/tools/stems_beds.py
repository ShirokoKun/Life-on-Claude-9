"""Part 1 - ambience beds + drones/music stems (all loops are seamless)."""
import numpy as np
from dsp import *

def _rg(seed): return np.random.default_rng(seed)

# ------------------------------------------------------------------ AMBIENCE
def amb_room_tone_3am(L=44.0):
    """Warm, close, slightly oppressive room tone: brown rumble, faint mains hum (50 Hz), airy mid body."""
    ch = []
    for i in range(2):
        r = _rg(100 + i)
        b = lp(colored(L, "brown", r), 170)
        p = bp(colored(L, "pink", r), 250, 1400) * 0.10
        ch.append((b + p) * (1 + 0.10 * slow_noise(L, 0.15, r)))
    X = np.stack(ch, 1)
    hum = sine(50, L) * 0.020 + sine(100, L) * 0.012 + sine(150, L) * 0.005
    X = X + hum[:, None]
    return norm_rms(loopify(X, 2.0), -24)

def amb_laptop_fan(L=34.0):
    ch = []
    for i in range(2):
        r = _rg(200 + i)
        n1 = bp(white(L, r), 300, 2800) * (1 + 0.08 * slow_noise(L, 0.25, r))
        tone = (sine(118, L) * 0.04 + sine(236, L) * 0.015) * (1 + 0.3 * slow_noise(L, 0.3, r))
        whine = sine(2100 + 6 * i, L) * 0.004 * (1 + 0.5 * slow_noise(L, 0.2, r))
        ch.append(n1 * 0.3 + tone + whine)
    return norm_rms(loopify(np.stack(ch, 1), 2.0), -24)

def _car_pass(sec, p0, p1, seed):
    r = _rg(seed); N = n(sec); t = np.linspace(0, 1, N)
    env = np.sin(np.pi * t) ** 2.2
    fe = 92 - 22 * t                                    # engine pitch falls as it passes (doppler)
    ph = 2 * np.pi * np.cumsum(fe) / SR
    eng = sum(np.sin(ph * h) / h for h in (1, 2, 3, 4)) * 0.25
    tyre = bp(white(sec, r), 500, 2400) * 0.35
    x = lp((eng + tyre) * env, 1100)
    pan = np.linspace(p0, p1, N)
    L = x * np.cos((pan + 1) * np.pi / 4); R = x * np.sin((pan + 1) * np.pi / 4)
    return np.stack([L, R], 1)

def amb_city_night_far(L=36.0):
    r = _rg(300)
    base = np.stack([lp(colored(L, "pink", _rg(301 + i)), 420) for i in range(2)], 1) * 0.5
    X = base.copy()
    for s, dur, p0, p1, g in [(5.0, 6.5, -0.7, 0.7, 0.55), (17.0, 5.5, 0.8, -0.6, 0.4), (27.5, 6.0, -0.5, 0.8, 0.5)]:
        c = _car_pass(dur, p0, p1, int(s * 10)) * g
        i0 = n(s); X[i0:i0 + c.shape[0]] += c
    return norm_rms(loopify(X, 2.0), -24)

def amb_fridge_cycle(L=45.0):
    """One compressor cycle: hum -> relay click + spin-down -> silence (the apartment gets quieter) -> click + spin-up."""
    t = tt(L); r = _rg(400)
    on = np.ones_like(t)
    off0, off1 = 29.0, 37.6
    ramp_d, ramp_u = 1.7, 1.6
    on = np.where((t >= off0) & (t < off0 + ramp_d), np.exp(-4.0 * (t - off0) / ramp_d), on)
    on = np.where((t >= off0 + ramp_d) & (t < off1), 0.0, on)
    on = np.where((t >= off1) & (t < off1 + ramp_u), 1 - np.exp(-4.0 * (t - off1) / ramp_u), on)
    fm = np.where((t >= off0) & (t < off0 + ramp_d), 1 - 0.35 * (t - off0) / ramp_d, 1.0)
    fm = np.where((t >= off1) & (t < off1 + ramp_u), 0.65 + 0.35 * (t - off1) / ramp_u, fm)
    fm = np.where((t >= off0 + ramp_d) & (t < off1), 0.65, fm)
    ph = 2 * np.pi * np.cumsum(55.0 * fm) / SR
    hum = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.3 * np.sin(3 * ph + 0.7) + 0.12 * np.sin(5 * ph)) * on
    hum = lp(hum, 600)
    rumble = lp(colored(L, "brown", r), 120) * on * 0.5
    x = hum * 0.5 + rumble
    for tc in (off0 - 0.02, off1 - 0.03):               # relay clicks
        k = n(tc); c = bp(white(0.05, r), 700, 4200) * np.exp(-tt(0.05) / 0.006)
        x[k:k + len(c)] += c * 0.5
    X = widen(x, 0.25)
    return norm_rms(loopify(X, 1.0), -24)

def fol_wall_clock_tick(L=30.0):
    """1 Hz wall-clock tick / tock (alternating), a little room around it."""
    r = _rg(500); out = np.zeros(n(L + 1.5))
    for k in range(int(L)):
        tock = k % 2
        t0 = n(k + r.uniform(-0.003, 0.003) + 0.02)
        dur = 0.09; c = np.zeros(n(dur))
        burst = bp(white(0.012, r), 1500, 5500) * np.exp(-tt(0.012) / 0.003)
        body = np.sin(2 * np.pi * (950 if tock else 1250) * tt(dur)) * np.exp(-tt(dur) / 0.018) * 0.45
        wood = np.sin(2 * np.pi * 310 * tt(dur)) * np.exp(-tt(dur) / 0.012) * 0.35
        c += body + wood; c[:len(burst)] += burst * 1.2
        out[t0:t0 + len(c)] += c * (0.8 if tock else 1.0)
    X = stereo(out, -0.5)
    X = reverb(X, rt60=0.45, wet=0.22, damp=4500)
    X = pad_to(X, L + 1.5)
    # wrap tail into head for a perfect loop
    m = n(1.5); body = X[:n(L)].copy(); body[:m] += X[n(L):n(L) + m]
    return norm_peak(body, -6.0)

def amb_daylight_room(L=40.0):
    """Flashback room tone: same desk, but daylight: brighter, airier, distant traffic, no hum."""
    ch = []
    for i in range(2):
        r = _rg(600 + i)
        air = bp(colored(L, "pink", r), 500, 7000) * 0.22
        traffic = lp(colored(L, "pink", r), 700) * 0.75 * (1 + 0.4 * slow_noise(L, 0.1, r))
        shimmer = hp(white(L, r), 6000) * 0.012 * (1 + 0.5 * slow_noise(L, 0.2, r))
        ch.append(air + traffic + shimmer)
    return norm_rms(loopify(np.stack(ch, 1), 2.0), -24)

def amb_dawn_hollow(L=40.0):
    """The post-binge hollow: tinnitus-thin 6.2 kHz tone, airy hiss, a slow sub breath. 'Exhausted and wired'."""
    r = _rg(700)
    tin = sine(6200, L) * 0.02 + sine(6212, L) * 0.012
    tin = tin * (0.7 + 0.3 * (0.5 + 0.5 * np.sin(2 * np.pi * tt(L) / 20.0)))
    air = np.stack([hp(colored(L, "pink", _rg(701 + i)), 2000) * 0.22 for i in range(2)], 1)
    breath = lp(colored(L, "brown", r), 90) * (0.5 + 0.5 * np.sin(2 * np.pi * tt(L) / 10.0)) * 0.8
    X = air + tin[:, None] + breath[:, None] * 0.6
    return norm_rms(X, -24)

# ------------------------------------------------------------------ MUSIC / DRONES
def _grid(f, loop):  # force integer cycles over the loop length so the sines loop perfectly
    return round(f * loop) / loop

def mus_drone_isolation(L=60.0):
    """E-minor open drone: E1/E2/B2/E3 saw-ish additive voices, detuned, slow timbre breathing. Sits under the 3 AM section."""
    outs = []
    for ch in range(2):
        r = _rg(800 + ch); t = tt(L); x = np.zeros_like(t)
        for f0, g in [(41.2, 1.0), (82.4, 0.65), (123.5, 0.4), (164.8, 0.25)]:
            for det in (-0.09, 0.0, 0.11):
                f = _grid(f0 + det, L)
                for h in range(1, 9):
                    k = int(r.integers(1, 5)); ph = r.uniform(0, 2 * np.pi)
                    lfo = 0.65 + 0.35 * np.sin(2 * np.pi * k * t / L + ph)
                    x += g * lfo * np.sin(2 * np.pi * _grid(f * h, L) * t + r.uniform(0, 2 * np.pi)) / h ** 1.35
        outs.append(lp(x, 1100, 2))
    X = np.stack(outs, 1)
    return norm_rms(X, -24)

def _pluck(f, sec, bright=1.0):
    t = tt(sec); x = np.zeros_like(t)
    for h, a in enumerate([1.0, 0.55, 0.32, 0.20, 0.12, 0.08], 1):
        x += a * np.sin(2 * np.pi * f * h * t) * np.exp(-t / (0.32 / h ** (0.55 + 0.4 * (1 - bright))))
    x *= np.minimum(1, t / 0.003)
    return x

_SCALE = [293.66, 349.23, 440.0, 523.25, 587.33, 698.46, 880.0, 1046.5]   # D minor pentatonic-ish: D F A C D F A C
_PAT = [0, 2, 4, 2, 3, 2, 4, 6, 5, 4, 2, 3, 4, 2, 0, 1]                   # 16-step arp contour

def _pulse(times, bpms, L, seed, loop=False):
    r = _rg(seed); N = n(L); tail = n(3.0)
    ch = np.zeros((N + tail, 2))
    pl = np.zeros(N + tail); thumps = np.zeros(N + tail); hats = np.zeros(N + tail)
    for i, (tm, bpm) in enumerate(zip(times, bpms)):
        step = i % 16
        k = n(tm)
        if k >= N: break
        dens = 0.55 + 0.4 * min(1, (bpm - 80) / 60)
        if r.random() < dens or step % 4 == 0:
            f = _SCALE[_PAT[step]] * (0.5 if step % 8 == 0 else 1.0)
            vel = 1.0 if step % 4 == 0 else r.uniform(0.35, 0.7)
            p = _pluck(f, 1.2) * vel
            pl[k:k + len(p)] += p
        if step % 8 == 0:
            th = np.sin(2 * np.pi * 73.4 * tt(0.28) * (1 - 0.25 * np.linspace(0, 1, n(0.28)))) * np.exp(-tt(0.28) / 0.07)
            thumps[k:k + len(th)] += th * 1.1
        if step % 4 == 2:
            h = hp(white(0.03, r), 8000) * np.exp(-tt(0.03) / 0.007)
            hats[k:k + len(h)] += h * 0.5
    pl = lp(pl, 6500)
    d1 = n(60.0 / np.mean(bpms) * 0.75)                    # dotted-8th ping-pong
    L_ = pl.copy(); R_ = np.zeros_like(pl)
    for rep in range(1, 5):
        g = 0.38 ** rep; kk = d1 * rep
        if rep % 2: R_[kk:] += pl[:-kk] * g
        else:       L_[kk:] += pl[:-kk] * g
    ch[:, 0] = L_ * 0.85 + thumps + hats * 0.7
    ch[:, 1] = R_ * 0.85 + L_ * 0.25 + thumps + hats * 0.7
    ch = reverb(ch, rt60=1.1, wet=0.18, damp=5500)
    ch = pad_to(ch, L + 3.0)
    if loop:
        m = n(3.0); body = ch[:N].copy(); body[:m] += ch[N:N + m]; return body
    return ch[:N]

def mus_pulse_ramp(L=16.0):
    """Accelerating tonal pulse (84 -> 132 bpm) for the four-item module list. Not a beat: a nervous system warming up."""
    t, times, bpms = 0.0, [], []
    for i in range(1000):
        prog = min(1.0, t / L); bpm = 84 + 48 * prog ** 1.2
        times.append(t); bpms.append(bpm); t += 60.0 / bpm / 4
        if t > L: break
    x = _pulse(times, bpms, L, 810)
    x = fade(x, 1.5, 0.3)
    return norm_rms(x, -24)

def mus_pulse_hold(bars=16):
    """132 bpm pulse, loops perfectly (16 bars)."""
    bpm = 132.0; step = 60.0 / bpm / 4; L = bars * 16 * step
    times = [i * step for i in range(bars * 16)]
    x = _pulse(times, [bpm] * len(times), L, 811, loop=True)
    return norm_rms(x, -24)

def _pad(freqs, L, seed, attack=5.0, release=6.0, lpf=3500, wet=0.35):
    outs = []
    for ch in range(2):
        r = _rg(seed + ch); t = tt(L); x = np.zeros_like(t)
        for f0, g in freqs:
            for det in (-0.18, 0.0, 0.21):
                for h in range(1, 7):
                    x += g * np.sin(2 * np.pi * (f0 + det) * h * t + r.uniform(0, 6.28)) / h ** 1.2 * (0.8 + 0.2 * np.sin(2 * np.pi * r.uniform(0.05, 0.2) * t + r.uniform(0, 6.28)))
        outs.append(lp(x, lpf, 2))
    X = np.stack(outs, 1)
    env = np.minimum(1, tt(L) / attack) ** 1.5 * np.minimum(1, (L - tt(L)) / release) ** 1.5
    X = X * np.clip(env, 0, 1)[:, None]
    return reverb(X, rt60=2.6, wet=wet, damp=4500)

def mus_wonder_pad(L=24.0):
    """D major 9 (open): the 'it's working' glow. Warm, slightly too bright, like caffeine."""
    ch = [(146.83, 1.0), (185.0, 0.7), (220.0, 0.8), (277.18, 0.55), (329.63, 0.4), (587.33, 0.16)]
    return norm_rms(_pad(ch, L, 820), -24)

def mus_dread_cluster(L=28.0):
    """Semitone cluster (A2/A#2/B2) crawling up, tremolo accelerating, sub throb, thin noise bloom. The 4 AM dread."""
    t = tt(L); prog = t / L; outs = []
    for ch in range(2):
        r = _rg(830 + ch); x = np.zeros_like(t)
        glide = 1 + 0.09 * prog ** 1.3
        rate = 0.4 + 5.6 * prog ** 1.6
        trem_ph = 2 * np.pi * np.cumsum(rate) / SR
        trem = 1 - (0.55 * prog) * (0.5 + 0.5 * np.sin(trem_ph + ch * 1.3))
        for f0 in (110.0, 116.54, 123.47):
            ph = 2 * np.pi * np.cumsum(f0 * glide + r.uniform(-0.2, 0.2)) / SR
            for h, a in ((1, 1.0), (2, 0.45), (3, 0.22)):
                x += a * np.sin(ph * h + r.uniform(0, 6.28))
        x *= trem
        sub = np.sin(2 * np.pi * 36.7 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.9 * t)) * 0.9
        noise = hp(white(L, r), 3000) * 0.05 * prog ** 2
        outs.append(lp(x, 1800) + sub + noise)
    X = np.stack(outs, 1)
    X = fade(X, 3.0, 3.0)
    return norm_rms(reverb(X, rt60=1.6, wet=0.2), -24)

def _bell(f, sec, decays=(8.0, 5.0, 3.0, 1.5), ratios=(1.0, 2.01, 2.76, 5.4), amps=(1.0, 0.4, 0.25, 0.1)):
    t = tt(sec); x = np.zeros_like(t)
    for r_, a, d in zip(ratios, amps, decays):
        x += a * np.sin(2 * np.pi * f * r_ * t) * np.exp(-t / d)
    return x * np.minimum(1, t / 0.01)

def mus_hollow_dawn(L=36.0):
    """Sparse open-fifth bells in a big empty room, fading out: the hollow after the high."""
    X = np.zeros((n(L), 2))
    for t0, f, g, pan in [(0.0, 146.83, 1.0, -0.2), (6.0, 220.0, 0.7, 0.3), (13.0, 369.99, 0.45, -0.4), (22.0, 146.83, 0.8, 0.1)]:
        b = _bell(f, 12.0) * g; k = n(t0)
        s = stereo(b, pan); m = min(len(b), X.shape[0] - k); X[k:k + m] += s[:m]
    X = reverb(X, rt60=4.0, wet=0.55, damp=3500)
    X = pad_to(X, L); X = fade(X, 0.5, 8.0)
    return norm_rms(X, -26)
