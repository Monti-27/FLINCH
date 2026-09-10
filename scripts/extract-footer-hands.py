import argparse
import hashlib
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser()
parser.add_argument('video', type=Path)
args = parser.parse_args()
if hashlib.sha256(args.video.read_bytes()).hexdigest() != '2138f645ed06b1d0a89293f0639271ed0e3e8a8f64f3e937930dc9571722a19f':
    raise ValueError('The source must be the user-supplied reference video')
capture = cv2.VideoCapture(str(args.video))
capture.set(cv2.CAP_PROP_POS_FRAMES, 600)
ok, frame = capture.read()
capture.release()
if not ok or frame.shape[:2] != (1080, 1720):
    raise ValueError('Expected frame 600 of the supplied 1720 × 1080 reference')

output = Path(__file__).resolve().parents[1] / 'apps/web/public/art/footer'
output.mkdir(parents=True, exist_ok=True)
regions = {
    'left': ((0, 340, 700, 740), [(0, 0), (700, 0), (700, 400), (0, 400)]),
    'right': ((1020, 450, 1720, 850), [(0, 0), (700, 0), (700, 300), (355, 300), (355, 398), (155, 398), (155, 300), (0, 300)]),
}
for name, (bounds, polygon) in regions.items():
    x0, y0, x1, y1 = bounds
    pixels = frame[y0:y1, x0:x1].max(axis=2).astype(float)
    alpha = np.clip((pixels - 26) / 112, 0, 1) ** 0.7 * 255
    clipping = Image.new('L', (700, 400))
    ImageDraw.Draw(clipping).polygon(polygon, fill=255)
    alpha = (alpha * np.asarray(clipping) / 255).astype('uint8')
    asset = Image.new('RGBA', (700, 400), 'white')
    asset.putalpha(Image.fromarray(alpha))
    asset.save(output / f'hand-{name}.png', optimize=True)
    print(f'{name}: {np.count_nonzero(alpha)} visible pixels')
