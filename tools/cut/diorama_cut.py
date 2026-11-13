"""Cut a diorama map prop (object on a square grass tile with a soil underside, plain light background)
into a world prop:  background keyed out, the soil underside removed, cropped and resized.

Usage:  python tools/cut/diorama_cut.py <image> <name> [height] [lx ly fx fy rx ry]
  Writes assets/world/<name>.png (height px tall, default 600).
  The soil underside is found automatically: the left, front and right corners of the TOP (grass) face
  are the leftmost, lowest and rightmost grass pixels. Pass the six numbers to set them by hand instead.
  Then add the name to NAMES in tools/rig/blend_bases.py and run it to dissolve the grass tile into the
  world's ground.
"""
import cv2, numpy as np, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def corners(im, body):
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(np.float32)
    Hh, S, V = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255
    grass = ((Hh > 50) & (Hh < 140) & (S > 0.35) & (V > 0.2) & (body > 0)).astype(np.uint8)
    grass = cv2.morphologyEx(grass, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    h, w = grass.shape
    grass[: int(h * 0.3)] = 0                      # roofs can be grassy too: the tile is in the lower part
    ys, xs = np.nonzero(grass)
    i = np.argmin(xs); l = (xs[i], ys[i])
    i = np.argmax(xs); r = (xs[i], ys[i])
    i = np.argmax(ys); f = (xs[i], ys[i])
    return l, f, r


def main():
    src, name = sys.argv[1], sys.argv[2]
    out_h = int(sys.argv[3]) if len(sys.argv) > 3 else 600
    im = cv2.imdecode(np.fromfile(src, np.uint8), 1)
    h, w = im.shape[:2]
    # background: smooth light gray (with a soft cast shadow). Key on colour mostly, brightness only when large.
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    border = np.concatenate([lab[:8].reshape(-1, 3), lab[-8:].reshape(-1, 3), lab[:, :8].reshape(-1, 3), lab[:, -8:].reshape(-1, 3)])
    bg = np.median(border, 0)
    dc = np.sqrt(((lab[..., 1:] - bg[1:]) ** 2).sum(2)) * 1.4
    dl = np.abs(lab[..., 0] - bg[0])
    d = np.maximum(dc, (dl - 30) * 0.8)
    a = np.clip((d - 5) / 8, 0, 1)
    m = (a > 0.5).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lbl, st, _ = cv2.connectedComponentsWithStats(m)
    main_ = 1 + np.argmax(st[1:, 4]); body = (lbl == main_).astype(np.uint8)
    keep = np.zeros(n, bool); keep[main_] = True
    x, y, bw, bh = st[main_, :4]
    for i in range(1, n):   # detached bits inside the object's box (carved heads, sign boards)
        if st[i, 4] > 200 and x < st[i, 0] + st[i, 2] / 2 < x + bw and y < st[i, 1] + st[i, 3] / 2 < y + bh: keep[i] = True
    body = keep[lbl].astype(np.uint8)
    ff = body.copy(); cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 1)
    body |= (1 - ff)
    a = np.maximum(a * cv2.dilate(body, np.ones((5, 5), np.uint8)), cv2.erode(body, np.ones((5, 5), np.uint8)).astype(np.float32))
    if len(sys.argv) > 9:
        lx, ly, fx, fy, rx, ry = map(float, sys.argv[4:10])
    else:
        (lx, ly), (fx, fy), (rx, ry) = corners(im, body)
        ly -= 8; fy -= 12; ry -= 8                    # sit just inside the grass edge
        print('corners', (lx, ly), (fx, fy), (rx, ry))
    xs = np.arange(w)
    edge = np.where(xs < fx, ly + (fy - ly) * (xs - lx) / max(1, fx - lx), fy + (ry - fy) * (xs - fx) / max(1, rx - fx))
    yy = np.arange(h)[:, None]
    a = a * np.clip((edge[None, :] + 4 - yy) / 6, 0, 1)
    a = cv2.GaussianBlur(a, (3, 3), 0)
    ys, xs2 = np.nonzero(a > 0.04)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs2.min(), xs2.max() + 1
    rgba = np.dstack([im, a * 255]).clip(0, 255).astype(np.uint8)[y0:y1, x0:x1]
    s = out_h / (y1 - y0)
    rgba = cv2.resize(rgba, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(ROOT, 'assets', 'world', name + '.png'), rgba)
    print(name, rgba.shape)


if __name__ == '__main__':
    main()
