#!/usr/bin/env python3
"""Build one self-contained smooth-3D figure or simulator page.

    python3 build_page.py figure.html OUT.html

While you work, figure.html loads the engine files by bare name, e.g.
    <script src="three.min.js"></script><script src="OrbitControls.js"></script><script src="smooth3d.js"></script>
or  <script src="sim.js"></script>
(copy them next to it from assets/smooth3d/ or assets/simulator/). Each one is inlined in place, so OUT.html runs
anywhere, offline included. Colorfigures pages use build_figure.py and math3d pages build_math3d.py instead (this
script also inlines math3d.js, so a simulator can sit beside a math3d plot).
"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, '..', 'assets')
KNOWN = {
    'three.min.js': os.path.join(A, 'smooth3d', 'three.min.js'),
    'OrbitControls.js': os.path.join(A, 'smooth3d', 'OrbitControls.js'),
    'smooth3d.js': os.path.join(A, 'smooth3d', 'smooth3d.js'),
    'sim.js': os.path.join(A, 'simulator', 'sim.js'),
    'math3d.js': os.path.join(A, 'math3d', 'math3d.js'),
}
if len(sys.argv) < 3:
    sys.exit(__doc__)
src, out = sys.argv[1], sys.argv[2]
page = open(src, encoding='utf-8').read()
n = 0
def sub(m):
    global n
    name = os.path.basename(m.group(1))
    if name not in KNOWN:
        return m.group(0)
    n += 1
    return '<script>\n' + open(KNOWN[name], encoding='utf-8').read().replace('</script', '<\\/script') + '\n</script>'
page = re.sub(r'<script\s+src=["\']([^"\']+)["\']\s*>\s*</script>', sub, page)
if not n:
    sys.exit('no engine <script src="..."> found in ' + src + ' (expected one of: ' + ', '.join(KNOWN) + ')')
left = re.findall(r'<script\s+src=["\']([^"\']+)["\']\s*>\s*</script>', page)
if left:
    print('WARN still loads external scripts (will not work offline or in an artifact unless on an allowed CDN):', ', '.join(left))
KID_CSS = '<style>/* --kid: levels 1-2, tablets: big tap targets */ button,select{min-height:48px!important;min-width:48px;font-size:17px!important;padding-left:16px;padding-right:16px;border-radius:14px} input[type=range]{height:34px;min-width:160px} .zchip button{min-height:0!important;min-width:22px;font-size:11px!important;padding:0}</style>'
if '--kid' in sys.argv:
    page = page.replace('</head>', KID_CSS + '</head>', 1) if '</head>' in page else KID_CSS + page
open(out, 'w', encoding='utf-8').write(page)
print(f'wrote {out} ({os.path.getsize(out) // 1024} KB, {n} engine files inlined)')
