"""Remove the square grass tile under tree props so trees stand directly on the world's ground.
Keeps trunk/root (brown) pixels in the base zone and drops the green tile. Writes assets/world/t_<name>.png."""
import cv2, numpy as np, sys
names = {'pines': 0.16, 'pine2': 0.16, 'oak': 0.2, 'willow': 0.17, 'willow2': 0.17}
tiles = []
for n, zf in names.items():
    im = cv2.imread(f'assets/world/{n}.png', cv2.IMREAD_UNCHANGED); h, w = im.shape[:2]
    a = im[:, :, 3].copy()
    ys = np.where(a.max(1) > 20)[0]; y1 = ys.max()
    z0 = int(y1 - (y1 - ys.min()) * zf)
    hsv = cv2.cvtColor(im[:, :, :3], cv2.COLOR_BGR2HSV).astype(int)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    brown = ((H <= 24) | (H >= 170)) & (S > 40) & (V < 190)
    dark = V < 60
    keep = brown
    if n == 'reeds': keep = keep | ((H >= 30) & (H <= 90) & (V < 150))      # reed stalks are darker green
    zone = np.zeros_like(a, bool); zone[z0:] = True
    # trunk column: only keep brown near the horizontal centre of the trunk at the zone top
    a[zone & ~keep] = 0
    m = (a > 20).astype(np.uint8)
    n_, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    ok = np.zeros(n_, bool); ok[1:] = st[1:, cv2.CC_STAT_AREA] >= 160; a = np.where(ok[lab], a, 0).astype(np.uint8)
    a[z0:] = cv2.GaussianBlur(a[z0:], (3, 3), 0)
    ys = np.where(a.max(1) > 20)[0]; xs = np.where(a.max(0) > 20)[0]
    o = im.copy(); o[:, :, 3] = a; o = o[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    cv2.imwrite(f'assets/world/t_{n}.png', o)
    al = o[:, :, 3:4] / 255; bg = np.full(o.shape[:2] + (3,), (60, 120, 70), np.uint8)
    t = (o[:, :, :3] * al + bg * (1 - al)).astype(np.uint8); s = 300 / t.shape[0]
    t = cv2.resize(t, (max(1, int(t.shape[1] * s)), 300)); pad = np.full((300, 260, 3), (60, 120, 70), np.uint8); pad[:, :min(260, t.shape[1])] = t[:, :260]
    tiles.append(pad)
if len(sys.argv) > 1: cv2.imwrite(sys.argv[1], np.hstack(tiles))
