"""Cut a person out of a busy photo with the ISNet (isnet-general-use) ONNX model.

Usage: python tools/cut/isnet_cut.py <model.onnx> <image> <out.png> x0 y0 x1 y1 [cx cy]
  (x0..y1) crop box in source pixels; the model runs on that crop.
  (cx, cy) optional point on the person: only the matte component touching it is kept.
The model file is rembg's isnet-general-use.onnx (github.com/danielgatis/rembg releases).
"""
import cv2, numpy as np, onnxruntime as ort, sys

def matte(sess, crop):
    h, w = crop.shape[:2]
    x = cv2.resize(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB), (1024, 1024), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    x = (x - 0.5) / 1.0
    out = sess.run(None, {sess.get_inputs()[0].name: x.transpose(2, 0, 1)[None]})[0][0, 0]
    out = (out - out.min()) / (out.max() - out.min() + 1e-6)
    return cv2.resize(out, (w, h), interpolation=cv2.INTER_LINEAR)

def main():
    model, src, dst = sys.argv[1:4]
    x0, y0, x1, y1 = map(int, sys.argv[4:8])
    im = cv2.imread(src); crop = im[y0:y1, x0:x1]
    sess = ort.InferenceSession(model, providers=['CPUExecutionProvider'])
    a = matte(sess, crop)
    if len(sys.argv) > 9:
        cx, cy = int(sys.argv[8]) - x0, int(sys.argv[9]) - y0
        n, lab, st, _ = cv2.connectedComponentsWithStats((a > 0.5).astype(np.uint8))
        keep = (lab == lab[cy, cx]) if lab[cy, cx] else (lab == 1 + np.argmax(st[1:, 4]))
        keep = cv2.dilate(keep.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(np.float32)
        a = a * keep
    a = np.clip((a - 0.08) / 0.84, 0, 1)
    out = np.dstack([crop, (a * 255).astype(np.uint8)])
    ys, xs = np.nonzero(out[..., 3] > 10)
    out = out[ys.min():ys.max() + 1, max(0, xs.min() - 2):xs.max() + 3]
    cv2.imwrite(dst, out)
    print(dst, out.shape)

if __name__ == '__main__':
    main()
