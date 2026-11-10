"""Compose the Eric Da Red trailer: game captures + cutscenes + title cards, cut to the music."""
import cv2, numpy as np, subprocess, os, sys, math, imageio_ffmpeg

ROOT = r'C:\Users\ronin\Documents\Technical_Projects\Eric_Da_Red'
PT = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'Trailer', 'Eric_Da_Red_Trailer.mp4')
FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS = 1920, 1080, 30
MUSIC = os.path.join(ROOT, 'Music_Tracks', 'Viking Hip-Hop Rap Cover.mp3')
TOTAL = 62.0

# (t0, dur, source, source_start, crossfade_in, (zoom_from, zoom_to))
#   source: 'g:<capture>' (30fps frames), 'v:<cutscene>' (assets/video/cut_*.mp4), 'black'
SEGS = [
    (0.0, 3.2, 'g:splash', 0.3, 0.0, (1.00, 1.03)),
    (3.2, 3.0, 'v:intro', 0.2, 0.6, (1.00, 1.07)),
    (6.2, 3.3, 'v:intro', 4.0, 0.5, (1.04, 1.00)),
    (9.5, 2.5, 'v:docks', 0.0, 0.4, (1.00, 1.05)),
    (12.0, 1.8, 'v:docks', 5.6, 0.25, (1.02, 1.07)),
    (13.8, 0.2, 'black', 0, 0.15, (1, 1)),
    # ---- DROP 14.0
    (14.0, 2.0, 'v:kraken', 0.2, 0.0, (1.12, 1.00)),
    (16.0, 2.6, 'g:docks', 2.5, 0.0, (1.00, 1.03)),
    (18.6, 1.8, 'v:warehouse', 2.4, 0.15, (1.02, 1.08)),
    (20.4, 2.6, 'g:paper', 2.3, 0.0, (1.00, 1.03)),
    (23.0, 1.4, 'v:warehouse', 5.5, 0.2, (1.05, 1.00)),
    (24.4, 1.2, 'g:fury', 0.2, 0.15, (1.00, 1.02)),
    (25.6, 2.4, 'g:fury', 1.6, 0.0, (1.00, 1.04)),
    # ---- dip
    (28.0, 3.0, 'v:bridge', 4.0, 0.6, (1.00, 1.06)),
    (31.0, 3.6, 'v:kraken', 1.0, 0.6, (1.00, 1.08)),
    (34.6, 1.4, 'black', 0, 0.3, (1, 1)),
    # ---- DROP 36.0
    (36.0, 3.5, 'g:kraken', 2.2, 0.0, (1.00, 1.04)),
    (39.5, 1.5, 'v:kraken', 4.5, 0.15, (1.06, 1.00)),
    (41.0, 2.0, 'v:ending', 4.2, 0.3, (1.00, 1.05)),
    (43.0, 1.6, 'v:tavern_1', 0.4, 0.3, (1.00, 1.04)),
    (44.6, 2.4, 'v:tavern_1', 5.0, 0.25, (1.00, 1.05)),
    (47.0, 2.6, 'v:tavern_2', 1.3, 0.2, (1.00, 1.06)),
    (49.6, 4.6, 'v:tavern_3', 1.4, 0.2, (1.00, 1.04)),
    (54.2, 3.0, 'v:tavern_4', 3.6, 0.3, (1.00, 1.05)),
    (57.2, 4.8, 'v:intro', 0.0, 0.7, (1.00, 1.08)),
]
# (t0, t1, card, fade, dim_under, slam)
CARDS = [
    (3.9, 5.9, 'quarter', 0.35, 0.35, False),
    (6.8, 9.0, 'days', 0.35, 0.35, False),
    (9.9, 12.3, 'cargo', 0.35, 0.45, False),
    (14.0, 16.0, 'title', 0.12, 0.55, True),
    (23.0, 24.4, 'form', 0.15, 0.5, True),
    (24.4, 25.6, 'axe', 0.12, 0.55, True),
    (32.2, 34.5, 'some', 0.3, 0.35, False),
    (34.7, 36.0, 'bigger', 0.2, 0.0, True),
    (43.1, 44.6, 'nobody', 0.25, 0.4, False),
    (45.4, 46.9, 'apples', 0.2, 0.4, True),
    (57.6, 62.0, 'end', 0.8, 0.62, False),
]
FLASH = [(11.1, 0.5), (14.0, 1.0), (16.1, 0.35), (25.6, 0.6), (36.0, 1.0), (48.7, 0.8), (53.5, 0.7)]
SHAKE = [(11.1, 14), (14.0, 22), (25.7, 16), (36.0, 22), (48.7, 26), (53.5, 30)]


class GameSrc:
    def __init__(self, name):
        self.dir = os.path.join(PT, 'frames', name)
        self.n = len([f for f in os.listdir(self.dir) if f.endswith('.jpg')])
    def frame(self, t):
        i = min(self.n - 1, max(0, int(round(t * FPS))))
        return cv2.imread(os.path.join(self.dir, '%05d.jpg' % i))


class VidSrc:
    def __init__(self, name):
        self.cap = cv2.VideoCapture(os.path.join(ROOT, 'assets', 'video', 'cut_%s.mp4' % name))
        self.fps = self.cap.get(cv2.CAP_PROP_FPS); self.n = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.pos = -1; self.last = None
    def frame(self, t):
        i = min(self.n - 1, max(0, int(t * self.fps)))
        if self.last is None or i < self.pos or i > self.pos + 48:
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, i); self.pos = i - 1
        while self.pos < i:
            ok, im = self.cap.read()
            if not ok: break
            self.pos += 1; self.last = im
        im = self.last
        if im.shape[1] != W: im = cv2.resize(im, (W, H), interpolation=cv2.INTER_AREA)
        return im


def zoom(img, z, ox=0, oy=0):
    if abs(z - 1) < 1e-3 and not ox and not oy: return img
    M = np.float32([[z, 0, (1 - z) * W / 2 + ox], [0, z, (1 - z) * H / 2 + oy]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def smooth(k): return k * k * (3 - 2 * k)


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    cards = {}
    for c in CARDS:
        a = cv2.imread(os.path.join(PT, 'cards', c[2] + '.png'), cv2.IMREAD_UNCHANGED)
        cards[c[2]] = (a[..., :3].astype(np.float32), a[..., 3:].astype(np.float32) / 255)
    srcs = {}
    def src(s):
        if s not in srcs: srcs[s] = GameSrc(s[2:]) if s.startswith('g:') else VidSrc(s[2:])
        return srcs[s]
    ends = [SEGS[i][0] + SEGS[i][1] + (SEGS[i + 1][4] if i + 1 < len(SEGS) else 0) for i in range(len(SEGS))]
    vid_tmp = OUT.replace('.mp4', '_video.mp4')
    enc = subprocess.Popen([FF, '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                            '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', vid_tmp],
                           stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
    nframes = int(TOTAL * FPS)
    rng = np.random.default_rng(7)
    for f in range(nframes):
        T = f / FPS
        canvas = np.zeros((H, W, 3), np.float32)
        # camera shake from impacts
        sx = sy = 0.0
        for st, amp in SHAKE:
            if 0 <= T - st < 0.4:
                d = amp * (1 - (T - st) / 0.4); sx += rng.uniform(-d, d); sy += rng.uniform(-d, d)
        for i, (t0, dur, s, s0, xin, kb) in enumerate(SEGS):
            if not (t0 <= T < ends[i]): continue
            lt = T - t0
            if s == 'black': img = np.zeros((H, W, 3), np.uint8)
            else:
                img = src(s).frame(s0 + lt)
                k = min(1.0, lt / max(dur, 1e-3))
                img = zoom(img, kb[0] + (kb[1] - kb[0]) * smooth(k), sx, sy)
            a = 1.0 if xin <= 0 else min(1.0, lt / xin)
            canvas = canvas * (1 - a) + img.astype(np.float32) * a
        # title cards
        for t0, t1, name, fd, dim, slam in CARDS:
            if not (t0 <= T < t1): continue
            a = min(1.0, (T - t0) / fd, (t1 - T) / fd) if t1 < TOTAL else min(1.0, (T - t0) / fd)
            a = smooth(max(0.0, a))
            if dim: canvas *= (1 - dim * a)
            rgb, al = cards[name]
            if slam:
                z = 1 + 0.18 * max(0.0, 1 - (T - t0) / 0.22) ** 2
                rgb_z = zoom(rgb, z); al_z = zoom(al[..., 0], z)[..., None]
            else:
                z = 1 + 0.03 * (T - t0) / (t1 - t0)
                rgb_z = zoom(rgb, z); al_z = zoom(al[..., 0], z)[..., None]
            canvas = canvas * (1 - al_z * a) + rgb_z * al_z * a
        # flashes
        for ft, amp in FLASH:
            d = T - ft
            if 0 <= d < 0.3: canvas += 255 * amp * (1 - d / 0.3) ** 2 * 0.8
        # global fades + cinematic vignette
        g = min(1.0, T / 0.8, (TOTAL - T) / 1.2)
        canvas *= max(0.0, g)
        out = np.clip(canvas, 0, 255).astype(np.uint8)
        enc.stdin.write(out.tobytes())
        if f % 150 == 0: print('frame', f, '/', nframes, flush=True)
    enc.stdin.close(); enc.wait()
    # music: from the top of the song, fade out with the picture
    subprocess.run([FF, '-y', '-i', vid_tmp, '-i', MUSIC, '-filter_complex',
                    f'[1:a]atrim=0:{TOTAL},afade=t=in:st=0:d=0.5,afade=t=out:st={TOTAL - 3.0}:d=3.0,volume=0.95[a]',
                    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', OUT],
                   check=True, stderr=subprocess.DEVNULL)
    os.remove(vid_tmp)
    print('wrote', OUT)


if __name__ == '__main__':
    main()
