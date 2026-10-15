"""Small numpy/scipy DSP toolkit used to synthesize every stem in the package.
Everything is procedural (no samples), 48 kHz, float64 internally, 24-bit stereo WAV out."""
import numpy as np
from scipy import signal
import struct

SR = 48000
RNG = np.random.default_rng(20261014)

def n(sec): return int(round(sec * SR))
def tt(sec): return np.arange(n(sec)) / SR
def db(x): return 10 ** (x / 20.0)

# ---------- sources ----------
def sine(f, sec, phase=0.0):
    return np.sin(2 * np.pi * f * tt(sec) + phase)

def white(sec, rng=None):
    return (rng or RNG).standard_normal(n(sec))

def colored(sec, color="pink", rng=None):
    x = white(sec, rng)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR); f[0] = f[1]
    X *= {"white": f ** 0, "pink": f ** -0.5, "brown": f ** -1.0, "blue": f ** 0.5}[color]
    y = np.fft.irfft(X, len(x))
    return y / (np.max(np.abs(y)) + 1e-12)

def lp(x, fc, order=4):
    sos = signal.butter(order, min(fc, SR * 0.49) / (SR / 2), "low", output="sos")
    return signal.sosfiltfilt(sos, x)
def hp(x, fc, order=4):
    sos = signal.butter(order, fc / (SR / 2), "high", output="sos")
    return signal.sosfiltfilt(sos, x)
def bp(x, lo, hi, order=3):
    sos = signal.butter(order, [lo / (SR / 2), min(hi, SR * 0.49) / (SR / 2)], "band", output="sos")
    return signal.sosfiltfilt(sos, x)
def resonator(x, fc, q):
    """2nd-order peaking resonance (band-pass) for creaks / body tones."""
    b, a = signal.iirpeak(fc / (SR / 2), q)
    return signal.lfilter(b, a, x)

# ---------- envelopes ----------
def adsr(sec, a=0.005, d=0.1, s=0.0, r=0.1, curve=3.0):
    N = n(sec); e = np.zeros(N)
    na, nd, nr = n(a), n(d), n(r)
    ns = max(N - na - nd - nr, 0)
    e[:na] = np.linspace(0, 1, na, endpoint=False) ** 1.0
    if nd: e[na:na + nd] = s + (1 - s) * np.exp(-curve * np.linspace(0, 1, nd))
    e[na + nd:na + nd + ns] = s
    if nr and N - nr >= 0:
        start = e[N - nr - 1] if N - nr - 1 >= 0 else s
        e[N - nr:] = start * np.linspace(1, 0, nr)
    return e

def expdecay(sec, tau):
    return np.exp(-tt(sec) / tau)

def fade(x, fi=0.0, fo=0.0):
    x = x.copy(); N = x.shape[0]
    if fi > 0:
        m = min(n(fi), N); w = np.sin(np.linspace(0, np.pi / 2, m)) ** 2
        x[:m] = x[:m] * (w[:, None] if x.ndim == 2 else w)
    if fo > 0:
        m = min(n(fo), N); w = np.cos(np.linspace(0, np.pi / 2, m)) ** 2
        x[N - m:] = x[N - m:] * (w[:, None] if x.ndim == 2 else w)
    return x

def slow_noise(sec, rate_hz, rng=None, depth=1.0):
    """Smooth random control signal in [-depth, depth] (for organic drift)."""
    pts = max(int(sec * rate_hz) + 3, 4)
    ctrl = (rng or RNG).uniform(-1, 1, pts)
    xs = np.linspace(0, pts - 1, n(sec))
    from scipy.interpolate import CubicSpline
    return CubicSpline(np.arange(pts), ctrl)(xs) * depth

# ---------- stereo / space ----------
def stereo(mono, pan=0.0):
    p = (pan + 1) * np.pi / 4
    return np.stack([mono * np.cos(p), mono * np.sin(p)], axis=1)

def widen(mono, width=0.4, rng=None):
    """Decorrelated stereo from a mono signal: tiny haas delay + opposite all-pass phase."""
    d = n(0.0113)
    L = mono.copy()
    R = np.concatenate([np.zeros(d), mono[:-d]])
    b, a = signal.butter(1, 0.15)
    R2 = signal.lfilter(b, a, R)
    R = (1 - width) * R + width * R2
    return np.stack([L, R], axis=1)

def ir(rt60, damp=6000, pre=0.01, sec=None, rng=None, early=True):
    sec = sec or rt60 * 1.1
    N = n(sec)
    r = rng or RNG
    outs = []
    for ch in range(2):
        x = r.standard_normal(N) * np.exp(-6.91 * np.arange(N) / SR / rt60)
        x = lp(x, damp, 2)
        x[:n(pre)] = 0
        if early:
            for tms in (7, 13, 19, 29, 41):
                k = n(pre) + n(tms / 1000 * (1 + 0.17 * ch))
                if k < N: x[k] += r.uniform(0.4, 1.0) * (1 if r.random() > .5 else -1)
        outs.append(x)
    I = np.stack(outs, axis=1)
    return I / (np.sqrt(np.sum(I ** 2, axis=0)).mean() + 1e-9)

def reverb(x, rt60=1.5, wet=0.3, damp=5000, pre=0.012, rng=None):
    """Convolution reverb with a synthetic stereo IR. x: mono or stereo."""
    if x.ndim == 1: x = stereo(x)
    I = ir(rt60, damp, pre, rng=rng)
    out = np.zeros((x.shape[0] + I.shape[0] - 1, 2))
    for c in range(2):
        out[:, c] = signal.fftconvolve(x[:, c], I[:, c])
        out[:, c] = out[:, c] * 0.5 + signal.fftconvolve(x[:, 1 - c], I[:, c]) * 0.5
    dry = np.zeros_like(out); dry[:x.shape[0]] = x
    rms_d = np.sqrt(np.mean(dry ** 2) + 1e-12); rms_w = np.sqrt(np.mean(out ** 2) + 1e-12)
    out = out / rms_w * rms_d
    return dry * (1 - wet) + out * wet

def pad_to(x, sec):
    N = n(sec)
    if x.shape[0] >= N: return x[:N]
    z = np.zeros((N - x.shape[0],) + x.shape[1:]); return np.concatenate([x, z])

def trim_silence(x, thresh_db=-70):
    m = np.max(np.abs(x), axis=1) if x.ndim == 2 else np.abs(x)
    idx = np.where(m > db(thresh_db))[0]
    return x[:idx[-1] + 1] if len(idx) else x

# ---------- looping / level ----------
def loopify(x, xf=2.0):
    """Make x loop seamlessly by cross-fading its tail into its head (equal power)."""
    m = n(xf)
    body = x[:-m].copy()
    t = np.linspace(0, np.pi / 2, m)
    fi, fo = np.sin(t), np.cos(t)
    if x.ndim == 2: fi, fo = fi[:, None], fo[:, None]
    body[:m] = body[:m] * fi + x[-m:] * fo
    return body

def rms_db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
def peak_db(x): return 20 * np.log10(np.max(np.abs(x)) + 1e-12)

def norm_peak(x, target_db=-3.0):
    return x * (db(target_db) / (np.max(np.abs(x)) + 1e-12))

def norm_rms(x, target_db=-24.0, peak_cap=-3.0):
    y = x * db(target_db - rms_db(x))
    if peak_db(y) > peak_cap: y = y * db(peak_cap - peak_db(y))
    return y

def softclip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)

# ---------- file I/O ----------
def write_wav24(path, x, sr=SR):
    x = np.asarray(x)
    if x.ndim == 1: x = np.stack([x, x], axis=1)
    x = np.clip(x, -1.0, 1.0)
    ints = np.round(x * 8388607).astype(np.int32)
    b = ints.astype("<i4").tobytes()
    # pack 24-bit little endian
    arr = np.frombuffer(b, dtype=np.uint8).reshape(-1, 4)[:, :3]
    data = arr.tobytes()
    ch = x.shape[1]
    hdr = b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVEfmt " + struct.pack(
        "<IHHIIHH", 16, 1, ch, sr, sr * ch * 3, ch * 3, 24) + b"data" + struct.pack("<I", len(data))
    with open(path, "wb") as f:
        f.write(hdr + data)

def read_wav(path):
    """Minimal reader for 16/24/32-bit PCM and float32 WAV -> float64 array (N, ch)."""
    from scipy.io import wavfile
    try:
        sr, d = wavfile.read(path)
        if d.dtype == np.int16: d = d / 32768.0
        elif d.dtype == np.int32: d = d / 2147483648.0
        elif d.dtype == np.uint8: d = (d - 128) / 128.0
        d = d.astype(np.float64)
    except Exception:
        with open(path, "rb") as f: raw = f.read()
        ch = struct.unpack("<H", raw[22:24])[0]; sr = struct.unpack("<I", raw[24:28])[0]
        i = raw.find(b"data"); size = struct.unpack("<I", raw[i + 4:i + 8])[0]
        body = np.frombuffer(raw[i + 8:i + 8 + size], dtype=np.uint8)
        body = body[: len(body) // 3 * 3].reshape(-1, 3)
        v = (body[:, 0].astype(np.int32) | (body[:, 1].astype(np.int32) << 8) | (body[:, 2].astype(np.int32) << 16))
        v = np.where(v >= 1 << 23, v - (1 << 24), v)
        d = (v / 8388608.0).reshape(-1, ch)
    if d.ndim == 1: d = d[:, None]
    return d, sr
