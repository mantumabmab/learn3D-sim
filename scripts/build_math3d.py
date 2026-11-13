#!/usr/bin/env python3
"""Build one self-contained maths figure page.

    python3 build_math3d.py figure.html OUT.html

figure.html loads <script src="math3d.js"></script> while you work (copy assets/math3d/math3d.js next to it);
the engine is inlined in its place so OUT.html runs anywhere, offline included.
"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
src, out = sys.argv[1], sys.argv[2]
page = open(src, encoding='utf-8').read()
eng = open(os.path.join(HERE, '..', 'assets', 'math3d', 'math3d.js'), encoding='utf-8').read()
tag = re.search(r'<script\s+src=["\'](?:\./)?math3d\.js["\']\s*>\s*</script>', page)
if not tag:
    sys.exit('no <script src="math3d.js"></script> in ' + src)
page = page[:tag.start()] + '<script>\n' + eng.replace('</script', '<\\/script') + '\n</script>' + page[tag.end():]
KID_CSS = '<style>/* --kid: levels 1-2, tablets: big tap targets */ button,select{min-height:48px!important;min-width:48px;font-size:17px!important;padding-left:16px;padding-right:16px;border-radius:14px} input[type=range]{height:34px;min-width:160px} .zchip button{min-height:0!important;min-width:22px;font-size:11px!important;padding:0}</style>'
if '--kid' in sys.argv:
    page = page.replace('</head>', KID_CSS + '</head>', 1) if '</head>' in page else KID_CSS + page
open(out, 'w', encoding='utf-8').write(page)
print('wrote', out)
