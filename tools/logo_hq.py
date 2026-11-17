"""Makes logo-hq.png (the splash / sign-in logo) from logo.png: the white background becomes transparent with soft
edges, so the logo sits cleanly on the black and the white theme, and it is stored at full colour (no palette).
Only the background that touches the picture's border is removed; white highlights inside the drops stay.
Needs Pillow and numpy. Usage: python tools/logo_hq.py"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 4                                            # work at 4x so the edge is smooth
im = Image.open(os.path.join(root, "logo.png")).convert("RGB")
big = im.resize((im.width * S, im.height * S), Image.LANCZOS)
a = np.asarray(big).astype(np.float32)
W, H = big.size

# near-white pixels, then keep only those connected to the border (flood fill from every border pixel)
near = Image.fromarray(((a.min(axis=2) > 232) * 255).astype(np.uint8), "L")
mark = near.copy()
for x in range(0, W, 2):
    for y in (0, H - 1):
        if mark.getpixel((x, y)) == 255: ImageDraw.floodfill(mark, (x, y), 128)
for y in range(0, H, 2):
    for x in (0, W - 1):
        if mark.getpixel((x, y)) == 255: ImageDraw.floodfill(mark, (x, y), 128)
bg = np.asarray(mark) == 128

# a band around the background where white is "un-mixed" from the colour (no white fringe on black)
bgimg = Image.fromarray((bg * 255).astype(np.uint8), "L")
grown = np.asarray(bgimg.filter(ImageFilter.MaxFilter(2 * (3 * S) + 1))) > 0
band = grown & ~bg
d = (255.0 - a) / 255.0
alpha = np.ones((H, W), np.float32)
alpha[bg] = 0.0
alpha[band] = np.clip(d.max(axis=2) * 1.6, 0, 1)[band]
alpha_img = Image.fromarray((alpha * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(0.6 * S))
alpha = np.asarray(alpha_img).astype(np.float32) / 255.0
alpha[~grown] = 1.0
# deep inside the background: fully clear
fg_near = np.asarray(Image.fromarray(((~bg) * 255).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(5))) > 0
alpha[bg & ~fg_near] = 0.0

rgb = a.copy()
m = alpha > 0.02
for c in range(3):
    ch = rgb[..., c]
    ch[m] = np.clip((ch[m] - 255.0 * (1 - alpha[m])) / alpha[m], 0, 255)
res = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA")
res = res.crop(res.getbbox())
side = int(max(res.size) * 1.06)
sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
sq.paste(res, ((side - res.width) // 2, (side - res.height) // 2), res)
sq = sq.resize((384, 384), Image.LANCZOS)   # 128 px on a 3x screen
sq.save(os.path.join(root, "logo-hq.png"), optimize=True)
print("logo-hq.png", sq.size)
# P-02: the same pixels as lossless WebP (81 KB instead of 128 KB) — the splash logo is the page's largest paint,
# so its size sets LCP on a slow network; browsers without WebP take the PNG (<picture> in index.html)
sq.save(os.path.join(root, "logo-hq.webp"), "WEBP", lossless=True, quality=100, method=6, exact=False)
print("logo-hq.webp", os.path.getsize(os.path.join(root, "logo-hq.webp")), "bytes")
