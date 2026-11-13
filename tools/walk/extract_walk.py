"""Cut Eric's walk cycles out of the green-screen Flow clips.

Usage:  python tools/walk/extract_walk.py [clip_dir]
        (clip_dir defaults to NewCharactersAdded/)

Each entry in CYCLES names a clip (by id suffix), a frame range that loops
seamlessly (found by matching leg silhouettes, see find_loop()), and an
optional `mirror` flag that appends a mirrored copy (used for the back view,
where the clip only has one usable step).

Frames are chroma-keyed, de-spilled, aligned on the feet (ground line and
upper-body centre are line-fitted over the cycle so camera drift is removed
but natural sway is kept), scaled to a common body height and packed into a
WebP sheet: assets/sprites/walk/<name>.webp  (COLS columns of FW x FH cells,
feet at (FW/2, AY)).  js/walk_data.js is rewritten with the frame counts.
"""
import cv2, numpy as np, glob, os, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'NewCharactersAdded')
OUT = os.path.join(ROOT, 'assets', 'sprites', 'walk')
FW, FH, AY, BODY = 280, 380, 366, 330      # cell size, feet line, ground-to-crown height
COLS = 12

# name: (clip id, first frame, frame count, mirror second half, scale tweak)
CYCLES = {
    'eric_down': ('e9b0', 0, 36, False, 1.00),
    'eric_side': ('e9b0', 113, 33, False, 1.00),
    'eric_up':   ('cd0c', 107, 12, True, 1.00),
    'eric_hall': ('f1e9', 45, 27, False, 1.00),   # eye-level side walk for the mead hall
    # townsfolk (docs/ASSET_PROMPTS.txt 1a/1b): they cross the frame, the per-frame foot alignment re-centres them
    'villager_man': ('villager_man', 26, 36, False, 1.00),     # in profile (he looks at the camera later)
    'villager_woman': ('villager_woman', 102, 45, False, 1.00),
}
IDLE = {  # single standing frames
    'eric_down_idle': ('e9b0', 188, 1.00),
    'eric_up_idle': ('cd0c', 114, 1.00),
}


def load(clip):
    path = glob.glob(os.path.join(SRC, '*' + clip + '*.mp4'))[0]
    cap = cv2.VideoCapture(path); out = []
    while True:
        ok, im = cap.read()
        if not ok: return out
        out.append(im)


SMOOTH_KEY = {'f1e9'}
STRONG_DESPILL = {'villager_man', 'villager_woman'}   # pale clothes pick up green spill; no green costume to protect   # dull-green backdrops: key against a per-frame smooth background estimate instead


def smooth_alpha(im):
    """Backdrop is smooth: estimate it from the clearly-green pixels (normalised blur), key on Lab distance."""
    f = im.astype(np.float32); b, g, r = f[..., 0], f[..., 1], f[..., 2]
    k = g - np.maximum(r, b); s = k / (g + 8)
    M = cv2.erode(((s > 0.16) & (k > 18)).astype(np.float32), np.ones((9, 9), np.uint8))
    B = cv2.GaussianBlur(f * M[..., None], (0, 0), 30) / (cv2.GaussianBlur(M, (0, 0), 30)[..., None] + 1e-4)
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    bl = cv2.cvtColor(B.clip(0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    d = np.sqrt(((lab - bl) ** 2 * np.array([0.6, 1.5, 1.5])).sum(2))
    return np.clip((d - 9) / 14, 0, 1)


def key(im, smooth=False, strong=False):
    f = im.astype(np.float32); b, g, r = f[..., 0], f[..., 1], f[..., 2]
    k = g - np.maximum(r, b); s = k / (g + 8)
    a = smooth_alpha(im) if smooth else 1 - np.clip((s - 0.22) / 0.14, 0, 1) * np.clip((k - 18) / 22, 0, 1)
    m = (a > 0.5).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    main = 1 + np.argmax(st[1:, 4]); x, y, w, h = st[main, :4]
    keep = np.zeros(n, bool); keep[main] = True
    for i in range(1, n):   # keep detached bits (axe heads) that sit inside the body box
        if st[i, 4] > 150 and x - 20 < st[i, 0] + st[i, 2] / 2 < x + w + 20 and y - 40 < st[i, 1] + st[i, 3] / 2 < y + h:
            keep[i] = True
    a *= cv2.dilate(keep[lab].astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32)
    # solid interior: fill holes in the body mask and force full opacity a few px inside the outline,
    # so dark costume areas that sit close to the backdrop colour never turn see-through
    body = keep[lab].astype(np.uint8)
    ff = body.copy(); cv2.floodFill(ff, np.zeros((ff.shape[0] + 2, ff.shape[1] + 2), np.uint8), (0, 0), 1)
    body = body | (1 - ff)
    a = np.maximum(a, cv2.erode(body, np.ones((7, 7), np.uint8)).astype(np.float32))
    a = cv2.GaussianBlur(a, (3, 3), 0)
    # de-spill: green fringe on edges, and a gentle pass on bright surfaces
    edge = cv2.dilate((a < 0.5).astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
    rb = np.maximum(r, b)
    g2 = np.where(edge, np.minimum(g, (r + b) / 2 + 4), np.minimum(g, rb + (3 if strong else 26)))
    out = np.dstack([b, g2, r, a * 255]).clip(0, 255).astype(np.uint8)
    return out, keep[lab]


def measure(mask):
    ys, xs = np.nonzero(mask); top, bot = ys.min(), ys.max()
    up = ys < top + (bot - top) * 0.45
    return top, bot, xs[up].mean()


def place(rgba, cx, bot, h, scale):
    s = BODY / h * scale
    img = cv2.resize(rgba, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    M = np.float32([[1, 0, FW / 2 - cx * s], [0, 1, AY - bot * s]])
    return cv2.warpAffine(img, M, (FW, FH), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))


def fit(v):
    t = np.arange(len(v)); p = np.polyfit(t, v, 1); return np.polyval(p, t)


def cycle(clip, a0, n, mirror, tweak, frames):
    keyed = [key(frames[i], clip in SMOOTH_KEY, clip in STRONG_DESPILL) for i in range(a0, a0 + n)]
    m = np.array([measure(k[1]) for k in keyed])
    top, bot, cx = m[:, 0], m[:, 1], m[:, 2]
    # the planted foot defines the ground: use the lower envelope trend of the feet
    bf, cf = fit(bot), fit(cx)
    hf = fit(bot - top)
    cells = [place(k[0], cf[i], bf[i], hf[i], tweak) for i, k in enumerate(keyed)]
    if mirror: cells += [c[:, ::-1].copy() for c in cells]
    return cells


def sheet(cells):
    rows = (len(cells) + COLS - 1) // COLS
    S = np.zeros((rows * FH, COLS * FW, 4), np.uint8)
    for i, c in enumerate(cells): S[(i // COLS) * FH:(i // COLS + 1) * FH, (i % COLS) * FW:(i % COLS + 1) * FW] = c
    return S


def main():
    os.makedirs(OUT, exist_ok=True)
    clips, meta, stand = {}, {}, {}
    get = lambda c: clips.setdefault(c, load(c))
    for name, (clip, a0, n, mirror, tweak) in CYCLES.items():
        cells = cycle(clip, a0, n, mirror, tweak, get(clip))
        cv2.imwrite(os.path.join(OUT, name + '.webp'), sheet(cells), [cv2.IMWRITE_WEBP_QUALITY, 92])
        meta[name] = len(cells)
        # standing pose = the frame whose feet are closest together
        spread = [np.ptp(np.nonzero(c[AY - 40:AY + 2, :, 3].max(0) > 60)[0]) if (c[AY - 40:AY + 2, :, 3] > 60).any() else 999 for c in cells]
        stand[name] = int(np.argmin(spread))
        print(name, len(cells), 'frames, stand', stand[name])
    for name, (clip, i, tweak) in IDLE.items():
        k = key(get(clip)[i]); top, bot, cx = measure(k[1])
        cv2.imwrite(os.path.join(OUT, name + '.webp'), place(k[0], cx, bot, bot - top, tweak), [cv2.IMWRITE_WEBP_QUALITY, 92])
        meta[name] = 1
    with open(os.path.join(ROOT, 'js', 'walk_data.js'), 'w') as f:
        f.write('// Generated by tools/walk/extract_walk.py: walk-cycle sheets cut from the green-screen clips.\n')
        f.write('const WALK_SHEETS = ' + json.dumps({'fw': FW, 'fh': FH, 'ay': AY, 'body': BODY, 'cols': COLS, 'fps': 24, 'frames': meta, 'stand': stand}) + ';\n')
        f.write("for (const k in WALK_SHEETS.frames) IMAGES['walk_' + k] = 'assets/sprites/walk/' + k + '.webp';\n")


if __name__ == '__main__':
    main()
