# the emblem as a vector, from points measured on the owner's logo (crop 620×640 of the 2172×724 picture)
def smooth(pts, closed=False, t=0.5):
    """Catmull-Rom through the points → cubic Béziers"""
    P = pts[:]
    n = len(P)
    seg = []
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = P[(i - 1) % n] if (closed or i > 0) else P[i]
        p1 = P[i]; p2 = P[(i + 1) % n]
        p3 = P[(i + 2) % n] if (closed or i + 2 < n) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) * t / 3, p1[1] + (p2[1] - p0[1]) * t / 3)
        c2 = (p2[0] - (p3[0] - p1[0]) * t / 3, p2[1] - (p3[1] - p1[1]) * t / 3)
        seg.append("C%.1f,%.1f %.1f,%.1f %.1f,%.1f" % (c1 + c2 + p2))
    return "M%.1f,%.1f " % P[0] + " ".join(seg) + (" Z" if closed else "")
def join(*parts):  # several open runs into one closed outline
    d = []
    for k, (pts, t) in enumerate(parts):
        s = smooth(pts, False, t)
        d.append(s if k == 0 else "L" + s[1:])
    return " ".join(d) + " Z"
top = [(20,268),(45,280),(70,289),(100,299),(130,300),(160,300),(200,311),(240,337),(270,367),(290,402),(300,440),(304,478)]
bot = [(304,503),(292,491),(272,477),(245,471),(205,474),(162,469),(130,458),(100,441),(78,418),(58,388),(40,352),(28,312),(20,268)]
leaf = join((top, 1.0), (bot, 1.0))
slit_up = [(48,312),(80,325),(110,330),(140,335),(170,342),(205,355),(240,381),(268,414),(287,452),(299,490)]
slit_dn = [(299,490),(288,478),(268,446),(240,412),(204,384),(165,366),(130,355),(100,345),(76,333),(56,322),(48,312)]
slit = join((slit_up, 1.0), (slit_dn, 1.0))
petal = smooth([(140,312),(132,270),(126,220),(123,175),(124,145)], False, 1.0)
petal_top = "L" + smooth([(124,145),(160,160),(200,177),(240,208),(270,241),(290,271),(304,300)], False, 1.0)[1:]
def mir(d):  # mirror x around 304
    import re
    out = []
    for tok in re.findall(r"[MCLZ]|-?\d+\.?\d*,-?\d+\.?\d*", d):
        if "," in tok:
            x, y = tok.split(","); out.append("%.1f,%s" % (608 - float(x), y))
        else: out.append(tok)
    return " ".join(out).replace("M ", "M").replace("C ", "C").replace("L ", "L")
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 640" width="620" height="640">
<defs>
 <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FFF4BE"/><stop offset=".16" stop-color="#EDC55A"/><stop offset=".4" stop-color="#A97A22"/>
  <stop offset=".6" stop-color="#F7DC83"/><stop offset=".8" stop-color="#C29034"/><stop offset="1" stop-color="#7A5418"/></linearGradient>
 <linearGradient id="goldS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2CF6A"/><stop offset=".5" stop-color="#E2B957"/><stop offset="1" stop-color="#B8862E"/></linearGradient>
 <radialGradient id="green" cx=".45" cy=".42" r=".75">
  <stop offset="0" stop-color="#4A8031"/><stop offset=".4" stop-color="#2F6123"/><stop offset=".78" stop-color="#1D4415"/><stop offset="1" stop-color="#10290A"/></radialGradient>
 <linearGradient id="sheen" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#E9FFD9" stop-opacity=".16"/><stop offset=".55" stop-color="#E9FFD9" stop-opacity="0"/></linearGradient>
 <radialGradient id="gdrop" cx=".36" cy=".62" r=".8">
  <stop offset="0" stop-color="#FFF7D6"/><stop offset=".22" stop-color="#F6D570"/><stop offset=".62" stop-color="#C48D2C"/><stop offset="1" stop-color="#6E4A12"/></radialGradient>
 <linearGradient id="water" x1="0" y1="0" x2=".35" y2="1">
  <stop offset="0" stop-color="#0F3A63"/><stop offset=".35" stop-color="#2D6FA3"/><stop offset=".7" stop-color="#5FAFD8"/><stop offset="1" stop-color="#A8E0F5"/></linearGradient>
 <linearGradient id="wedge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#123A5C"/><stop offset="1" stop-color="#2B6A93"/></linearGradient>
 <filter id="blur1"><feGaussianBlur stdDeviation="1.4"/></filter>
 <clipPath id="clipL"><path d="{leaf} {slit}" clip-rule="evenodd" fill-rule="evenodd"/></clipPath>
 <clipPath id="clipR"><path d="{mir(leaf)} {mir(slit)}" clip-rule="evenodd" fill-rule="evenodd"/></clipPath>
</defs>
<!-- petals and stem (behind the leaves) -->
<g fill="none" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="8">
 <path d="{petal} {petal_top[0:]} " stroke="#4A3209" stroke-width="22"/>
 <path d="{mir(petal)} {mir(petal_top)}" stroke="#5E4010" stroke-width="22"/>
 <path d="M304,295 L304,480" stroke="#5E4010" stroke-width="16"/>
 <path d="{petal} {petal_top}" stroke="url(#gold)" stroke-width="18"/>
 <path d="{mir(petal)} {mir(petal_top)}" stroke="url(#gold)" stroke-width="18"/>
 <path d="M304,295 L304,480" stroke="url(#goldS)" stroke-width="12"/>
 <path d="{petal} {petal_top}" stroke="#FFF6C8" stroke-opacity=".55" stroke-width="3" transform="translate(-3,-3)"/>
 <path d="{mir(petal)} {mir(petal_top)}" stroke="#FFF6C8" stroke-opacity=".4" stroke-width="3" transform="translate(-3,-3)"/>
 <path d="M301,300 L301,470" stroke="#FFF6C8" stroke-opacity=".5" stroke-width="2.5"/>
</g>
<!-- leaves: green with a soft light, a gold rim on every edge (also along the cut) -->
<g>
 <path d="{leaf} {slit}" fill-rule="evenodd" fill="url(#green)"/>
 <g clip-path="url(#clipL)"><path d="M20,268 C120,300 230,320 300,470 L300,330 Z" fill="url(#sheen)"/><path d="M60,330 C150,360 230,380 290,480 L60,480 Z" fill="url(#sheen)" opacity=".7"/></g>
 <path d="{leaf}" fill="none" stroke="#4A3209" stroke-width="7" stroke-linejoin="round"/><path d="{leaf}" fill="none" stroke="url(#gold)" stroke-width="4.5" stroke-linejoin="round"/>
 <path d="{slit}" fill="none" stroke="#4A3209" stroke-width="6" stroke-linejoin="round"/><path d="{slit}" fill="none" stroke="url(#gold)" stroke-width="3.6" stroke-linejoin="round"/>
 <path d="{mir(leaf)} {mir(slit)}" fill-rule="evenodd" fill="url(#green)"/>
 <g clip-path="url(#clipR)"><path d="M588,268 C488,300 378,320 308,470 L308,330 Z" fill="url(#sheen)"/><path d="M548,330 C458,360 378,380 318,480 L548,480 Z" fill="url(#sheen)" opacity=".7"/></g>
 <path d="{mir(leaf)}" fill="none" stroke="#4A3209" stroke-width="7" stroke-linejoin="round"/><path d="{mir(leaf)}" fill="none" stroke="url(#gold)" stroke-width="4.5" stroke-linejoin="round"/>
 <path d="{mir(slit)}" fill="none" stroke="#4A3209" stroke-width="6" stroke-linejoin="round"/><path d="{mir(slit)}" fill="none" stroke="url(#gold)" stroke-width="3.6" stroke-linejoin="round"/>
</g>
<!-- the gold drop at the root -->
<path d="M304,492 C303,522 276,544 276,570 A28,28 0 0 0 332,570 C332,544 305,522 304,492 Z" fill="url(#gdrop)" stroke="#6E4A12" stroke-width="1.6"/>
<path d="M288,562 C289,551 295,544 299,540 C297,552 296,563 297,577 C292,577 288,571 288,562 Z" fill="#FFFFFF" fill-opacity=".8" filter="url(#blur1)"/>
<!-- the water drop -->
<path d="M304,22 C296,46 252,102 252,147 A52,52 0 0 0 356,147 C356,102 312,46 304,22 Z" fill="url(#water)" stroke="url(#wedge)" stroke-width="4.5"/>
<path d="M273,142 C272,114 289,86 299,70 C294,96 287,120 288,146 C289,164 297,178 309,187 C287,184 274,166 273,142 Z" fill="#FFFFFF" fill-opacity=".92" filter="url(#blur1)"/>
<path d="M262,152 C268,182 290,195 312,195 C336,195 349,180 351,163 C342,182 324,189 306,189 C287,189 270,176 262,152 Z" fill="#EAF8FF" fill-opacity=".6"/>
<path d="M330,96 C340,112 348,128 350,142" fill="none" stroke="#FFFFFF" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
</svg>'''
import os; open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logo.svg"), "w").write(svg.replace('viewBox="0 0 620 640" width="620" height="640"', 'viewBox="12 10 584 594" width="584" height="594"'))
