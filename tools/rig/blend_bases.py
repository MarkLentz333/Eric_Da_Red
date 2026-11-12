"""Dissolve the little grass 'islands' under the diorama map props so they sit on the world's ground.

Usage: python tools/rig/blend_bases.py
Reads assets/world/<name>.png and writes assets/world/b_<name>.png.

Grass pixels (green hue, reasonably saturated) in the lower part of a prop fade to transparent with
distance from the prop's non-grass pixels: a thin grassy fringe stays hugging the building, the rest
of the island disappears, and the world's own terrain shows through.
"""
import cv2, numpy as np, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
W = os.path.join(ROOT, 'assets', 'world')
NAMES = ['barn', 'cottage', 'stilt_house', 'workshop', 'fish_shed', 'well', 'hearth', 'crates', 'crate_barrel',
         'handcart', 'fish_rack', 'nets', 'ladder_wood', 'stone_wall', 'canoe_sand', 'canoe_sand2', 'bonsai', 'shrub', 'oak2']


def blend(name):
    im = cv2.imread(os.path.join(W, name + '.png'), -1)
    if im is None or im.shape[2] < 4: return False
    h, w = im.shape[:2]
    hsv = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2HSV).astype(np.float32)
    H, S, V = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255
    a = im[..., 3].astype(np.float32) / 255
    grass = (H > 38) & (H < 150) & (S > 0.3) & (V > 0.12) & (a > 0.05) & ~((V > 0.8) & (H < 62))   # not fire/highlights
    # only treat the lower part as ground (leaves on trees / roofs stay)
    yy = np.arange(h)[:, None] / h
    grass &= yy > 0.45
    grass = cv2.morphologyEx(grass.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    solid = (a > 0.5) & ~grass
    # distance from the real object (building / sand / water / wood)
    d = cv2.distanceTransform((~solid).astype(np.uint8), cv2.DIST_L2, 5)
    k = max(6.0, min(h, w) * 0.025)            # fringe kept right at the object
    fade = np.clip(1 - (d - k) / (k * 2.2), 0, 1)
    na = np.where(grass, a * fade, a)
    # soften the remaining fringe colour toward the world grass tone so it doesn't read lime
    tone = np.array([52, 128, 92], np.float32)   # BGR, matches the terrain grass
    col = im[..., :3].astype(np.float32)
    mix = (grass * 0.45)[..., None]
    col = col * (1 - mix) + tone * mix
    # feather the lower outline so sand/dirt rims melt into the terrain instead of ending in a cliff edge
    lower = yy > 0.55
    edge_d = cv2.distanceTransform((a > 0.5).astype(np.uint8), cv2.DIST_L2, 5)
    fe = max(5.0, min(h, w) * 0.03)
    na = np.where(lower, na * np.clip(edge_d / fe, 0, 1), na)
    out = np.dstack([col, na * 255]).clip(0, 255).astype(np.uint8)
    cv2.imwrite(os.path.join(W, 'b_' + name + '.png'), out)   # same size as the source: placement is unchanged
    return True


if __name__ == '__main__':
    for n in NAMES:
        r = blend(n)
        print(n, r)
