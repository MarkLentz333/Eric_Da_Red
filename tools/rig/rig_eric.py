"""Cut Eric's front / back / 3-4 sprites into paper-doll parts for the overworld walk cycle.
Parts keep the full sprite canvas size, so the game draws each at the same origin and rotates
arms about the shoulder pivot / lifts boots. Run from the repo root:  python tools/rig/rig_eric.py [preview.png]
Pivots and polygons are in sprite pixels; mirrored in js/scenes/world.js as RIG."""
import cv2, numpy as np, sys, json, os

def mirror(poly, w): return [(w - x, y) for x, y in poly]

RIGS = {
  # name: sprite, arm polys (L = viewer-left), arm cut y, leg cut y, leg top y, leg split x
  'front': dict(src='eric_front', armL=[(30,200),(100,200),(98,240),(82,290),(68,340),(62,405),(0,405),(0,290),(10,240)],
                mirrorR=True, armCut=226, legCut=472, legTop=452, split=182),
  'back':  dict(src='eric_back', armL=[(38,200),(104,200),(100,245),(86,300),(72,372),(0,372),(2,290),(22,240)],
                mirrorR=True, armCut=228, legCut=446, legTop=428, split=178),
  'q34':   dict(src='eric_q34', armL=[(28,198),(98,198),(92,235),(72,262),(64,300),(62,420),(8,420),(12,300),(22,240)],
                armR=[(262,208),(306,208),(318,280),(318,378),(276,378),(270,300),(262,250)],
                armCut=230, legCut=480, legTop=462, split=150),
}
out = 'assets/sprites/rig'; os.makedirs(out, exist_ok=True)
prev = []
for name, r in RIGS.items():
    for src in [r['src']] + (['sven'] if name == 'front' else []) + (['smuggler'] if name == 'q34' else []):
        im = cv2.imread(f'assets/sprites/{src}.png', cv2.IMREAD_UNCHANGED); h, w = im.shape[:2]
        if src == 'smuggler' and w != 318: continue
        a = im[:, :, 3]
        polys = {'armL': r['armL'], 'armR': r.get('armR') or mirror(r['armL'], w)}
        parts = {}
        body = a.copy()
        for k, poly in polys.items():
            m = np.zeros((h, w), np.uint8); cv2.fillPoly(m, [np.array(poly, np.int32)], 255)
            arm = np.minimum(a, m); parts[k] = arm
            cut = m.copy(); cut[:r['armCut']] = 0
            body = np.where(cut > 0, 0, body)
        legs = a.copy(); legs[:r['legTop']] = 0
        L = legs.copy(); L[:, r['split']:] = 0
        R = legs.copy(); R[:, :r['split']] = 0
        # remove arm pixels (hands hang near the legs in some views)
        for k in ('armL', 'armR'): L = np.where(parts[k] > 0, 0, L); R = np.where(parts[k] > 0, 0, R)
        parts['legL'] = L; parts['legR'] = R
        body[r['legCut']:] = 0
        parts['body'] = body
        tag = name if src.startswith('eric') else f'{src}_{name}'
        for k, al in parts.items():
            o = im.copy(); o[:, :, 3] = al
            cv2.imwrite(f'{out}/{tag}_{k}.png', o)
        if src.startswith('eric'):
            cols = {'body': (200, 200, 200), 'armL': (60, 60, 255), 'armR': (255, 80, 80), 'legL': (60, 220, 60), 'legR': (0, 220, 255)}
            v = np.full((h, w, 3), 40, np.uint8)
            for k, col in cols.items():
                mk = parts[k] > 40
                v[mk] = (im[:, :, :3][mk] * 0.5 + np.array(col) * 0.5).astype(np.uint8)
            prev.append(cv2.resize(v, (w * 3 // 4 * 2 // 2, h * 3 // 4 * 2 // 2)))
if len(sys.argv) > 1:
    H = max(p.shape[0] for p in prev)
    cv2.imwrite(sys.argv[1], np.hstack([np.pad(p, ((0, H - p.shape[0]), (0, 8), (0, 0))) for p in prev]))
print(json.dumps({k: {kk: v[kk] for kk in ('armCut', 'legCut', 'split')} for k, v in RIGS.items()}))
