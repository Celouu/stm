import base64, json, math, pathlib, re, struct, zlib
root = pathlib.Path(__file__).parent
src, dist = root/'src', root/'dist'
dist.mkdir(exist_ok=True); (dist/'icons').mkdir(exist_ok=True)


# ---------- icônes (PNG générés sans dépendance) ----------
# Fond en dégradé cobalt-violet (celui de la carte « Reste à vivre ») et trois barres blanches.
def _mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def _rrect_sdf(px, py, cx, cy, hw, hh, r):
    qx, qy = abs(px - cx) - (hw - r), abs(py - cy) - (hh - r)
    return math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - r

def icon_png(size, glyph_scale):
    c0, c1 = (0x21, 0x34, 0xe0), (0x2a, 0x11, 0x92)
    hi1, hi2 = (0x54, 0x68, 0xff), (0x8b, 0x3d, 0xff)
    g = size * glyph_scale                      # côté du carré qui contient les barres
    ox, oy = (size - g) / 2, (size - g) / 2
    bw, gap = g * 0.22, g * 0.17
    heights = (0.48, 0.74, 1.0)
    bars = []
    for i, h in enumerate(heights):
        x0 = ox + (g - (3 * bw + 2 * gap)) / 2 + i * (bw + gap)
        hh = g * h / 2
        bars.append((x0 + bw / 2, oy + g - hh, bw / 2, hh, bw / 2))
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            u, v = (x + .5) / size, (y + .5) / size
            col = _mix(c0, c1, min(1, max(0, (u * .64 + v * .77) / 1.41)))
            col = _mix(col, hi1, max(0, 1 - math.hypot(u, v) / .75) * .9)
            col = _mix(col, hi2, max(0, 1 - math.hypot(1 - u, 1 - v) / .7) * .75)
            cov = 0.0
            for (cx, cy, hw, hh, r) in bars:
                if abs(x + .5 - cx) <= hw + 1 and abs(y + .5 - cy) <= hh + 1:
                    cov = max(cov, min(1, max(0, .5 - _rrect_sdf(x + .5, y + .5, cx, cy, hw, hh, r))))
            col = _mix(col, (255, 255, 255), cov)
            rows += bytes(int(round(c)) for c in col)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(bytes(rows), 9)) + chunk(b'IEND', b''))

ICONS = {'icon-180.png': (180, .5), 'icon-192.png': (192, .5), 'icon-512.png': (512, .5), 'icon-maskable-512.png': (512, .4)}
for name, (size, scale) in ICONS.items():
    out = dist/'icons'/name
    if not out.exists():
        out.write_bytes(icon_png(size, scale))


# ---------- page ----------
font = base64.b64encode((src/'bricolage.woff2').read_bytes()).decode()
css = (src/'style.css').read_text().replace('{{FONT}}', font)
js = "(() => {\n'use strict';\n" + "\n".join((src/f).read_text() for f in sorted(p.name for p in src.glob('[0-9]-*.js'))) + "\n})();"
version = re.search(r"APP_VERSION = '([^']+)'", js).group(1)
html = (src/'index.html').read_text().replace('{{CSS}}', css).replace('{{JS}}', js)
(dist/'index.html').write_text(html)
(dist/'manifest.webmanifest').write_text(json.dumps({
  "name": "Save the Moula", "short_name": "STM", "lang": "fr", "start_url": "./", "scope": "./",
  "display": "standalone", "orientation": "portrait", "background_color": "#000000", "theme_color": "#000000",
  "icons": [
    {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
    {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]
}, ensure_ascii=False, indent=2))

# ---------- service worker ----------
# La page est indispensable ; les icônes et le manifeste sont mis en cache au mieux,
# pour qu'un fichier manquant n'empêche plus toute l'installation hors ligne.
(dist/'sw.js').write_text(f"""const CACHE = 'stm-{version}';
const CORE = ['./', './index.html'];
const EXTRA = ['./manifest.webmanifest', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => {{
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(CORE).then(() => Promise.all(EXTRA.map(a => c.add(a).catch(() => {{}})))))
    .then(() => self.skipWaiting()));
}});
self.addEventListener('activate', e => {{ e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener('fetch', e => {{
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {{
    const cached = await c.match(e.request, {{ ignoreSearch: true }});
    const fresh = fetch(e.request).then(r => {{ if (r.ok) c.put(e.request, r.clone()); return r; }}).catch(() => cached);
    return cached || fresh;
  }}));
}});
""")
missing = [n for n in ICONS if not (dist/'icons'/n).exists()]
assert not missing, f'icônes manquantes : {missing}'
print('built', version, len(html)//1024, 'KB')
