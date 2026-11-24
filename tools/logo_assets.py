# every logo file from the vector emblem (logo.svg), rendered at its own size (no up-scaling, no halo)
import subprocess, glob, io, os
from PIL import Image, ImageDraw, ImageFont
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SVG = R + "/logo.svg"
SAND = (0xCE, 0xBB, 0xA0, 255); NIGHT = (0x30, 0x31, 0x47, 255)
def emb(size):
    """the emblem fitted into a size×size square, transparent around it"""
    h = int(size * 2.2)   # render big enough, then trim to the drawing and scale down once
    png = subprocess.run(["rsvg-convert", "-h", str(h), SVG], check=True, capture_output=True).stdout
    im = Image.open(io.BytesIO(png)).convert("RGBA"); im = im.crop(im.getbbox())
    k = size / max(im.size); im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    sq = Image.new("RGBA", (size, size), (0, 0, 0, 0)); sq.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2)); return sq
def onbg(size, frac, bg):
    b = Image.new("RGBA", (size, size), bg); e = emb(int(size * frac)); o = (size - e.width) // 2; b.alpha_composite(e, (o, o)); return b.convert("RGB")
e512 = emb(512); e512.save(R + "/logo-hq.png", optimize=True); e512.save(R + "/logo-hq.webp", quality=92, method=6)   # 3× the 160 px opening; the page shows this picture, not the SVG (24.11: live SVG upset the Android 13 emulator)
emb(600).save(R + "/logo.png", optimize=True); emb(192).save(R + "/logo-192.png", optimize=True)
onbg(192, .80, SAND).save(R + "/icon-192.png"); onbg(512, .80, SAND).save(R + "/icon-512.png"); onbg(180, .80, SAND).save(R + "/apple-touch-icon.png"); onbg(64, .9, SAND).save(R + "/favicon.png")
# iPhone start screens: night (the default look), the emblem, «Mərkəz» under it, a soft warm light above
fp = None
for c in glob.glob(R + "/vendor/fonts/*"):
    if c.endswith((".ttf", ".otf")) and "nest" in c.lower(): fp = c
for f in glob.glob(R + "/launch/l-*.png"):
    w, h = Image.open(f).size; im = Image.new("RGBA", (w, h), NIGHT)
    g = Image.new("RGBA", (w, h), (0, 0, 0, 0)); dg = ImageDraw.Draw(g)
    for i in range(40, 0, -1):
        a = int(34 * (1 - i / 40) ** 1.6); r = int(w * 0.9 * i / 40); dg.ellipse((w / 2 - r, -r * 0.55, w / 2 + r, r * 0.55), fill=(255, 206, 150, a))
    im.alpha_composite(g)
    s = int(w * 0.41); e = emb(s); im.alpha_composite(e, ((w - s) // 2, int(h * 0.40) - s // 2))
    d = ImageDraw.Draw(im); fs = int(w * 0.072)
    try: font = ImageFont.truetype(fp, fs) if fp else ImageFont.truetype("DejaVuSans-Bold.ttf", fs)
    except Exception: font = ImageFont.load_default()
    t = "Mərkəz"; tw = d.textlength(t, font=font); d.text(((w - tw) / 2, int(h * 0.40) + s // 2 + int(w * 0.05)), t, fill=(0xC9, 0xCD, 0xEA, 255), font=font)
    im.convert("RGB").save(f, optimize=True)
# Android launcher: adaptive foreground (108 dp; the emblem inside the safe 66%) and the full icon for old phones
A = R + "/android/app/src/main/res"
for d, fg, leg in [("mdpi", 108, 48), ("hdpi", 162, 72), ("xhdpi", 216, 96), ("xxhdpi", 324, 144), ("xxxhdpi", 432, 192)]:
    f = Image.new("RGBA", (fg, fg), (0, 0, 0, 0)); e = emb(int(fg * 0.60)); o = (fg - e.width) // 2; f.alpha_composite(e, (o, o)); f.save(A + "/mipmap-" + d + "/ic_launcher_foreground.png", optimize=True)
    m = Image.new("L", (leg, leg), 0); ImageDraw.Draw(m).ellipse((0, 0, leg - 1, leg - 1), fill=255)
    b = Image.new("RGBA", (leg, leg), SAND); e = emb(int(leg * 0.74)); o = (leg - e.width) // 2; b.alpha_composite(e, (o, o))
    l = Image.new("RGBA", (leg, leg), (0, 0, 0, 0)); l.paste(b, (0, 0), m); l.save(A + "/mipmap-" + d + "/ic_launcher.png", optimize=True)
print("done", fp)
