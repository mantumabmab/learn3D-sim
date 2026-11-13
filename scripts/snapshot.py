#!/usr/bin/env python3
"""snapshot: look at built figures and study pages with headless Chromium (Playwright).

    python3 snapshot.py figures DIR [--views] [--press "Label@300,Other@1500"]
        For every DIR/<id>.html: writes DIR/<id>.png (the closed object at the default view, used in the doc and
        for print) and DIR/<id>-xr.png (See-through + Labels). --views adds the colorfigures verification set
        (yaw 45/110/170/230/300, two high pitches, a phone shot) into DIR/shots/. Prints page errors and NaN.
    python3 snapshot.py page study.html [--out DIR]
        Desktop and phone screenshots in light and dark, focus mode, the Expert view, and a report of console
        errors and horizontal overflow.

Needs `pip install playwright` + a Chromium (preinstalled in many sandboxes). Without Playwright, use the
headless-Chrome commands in modules/colorfigures-engine.md (Verify).
"""
import argparse, glob, os, sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit('playwright is not installed: pip install playwright (or use headless Chrome, see modules/colorfigures-engine.md)')


def _errors(page):
    try:
        return page.evaluate('document.documentElement.dataset.errors || ""')
    except Exception:
        return ''


def figures(d, views=False, press=''):
    files = sorted(f for f in glob.glob(os.path.join(d, '*.html')))
    bad = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        for f in files:
            fid = os.path.splitext(os.path.basename(f))[0]
            url = 'file://' + os.path.abspath(f)
            logs = []
            ctx = b.new_context(viewport={'width': 900, 'height': 760}, device_scale_factor=2)
            pg = ctx.new_page(); pg.on('pageerror', lambda e: logs.append(str(e)))
            shots = [('', ''), ('-xr', '?xr=1&labels=1')]
            if press:
                shots.append(('-press', '?press=' + __import__('urllib.parse').parse.quote(press, safe='@,')))
            for suf, q in shots:
                pg.goto(url + q); pg.wait_for_timeout((max([int(x.split('@')[1]) for x in press.split(',') if '@' in x and x.split('@')[1].isdigit()] or [0]) + 2600) if suf == '-press' else 1200)
                el = pg.query_selector('#fig') or pg
                el.screenshot(path=os.path.join(d, f'{fid}{suf}.png'))
            errs = _errors(pg) + ' '.join(logs)
            nan = pg.evaluate("""(() => { const s = document.getElementById('fig') || document.querySelector('svg,canvas'); if (!s) return false;
                // look only at drawing attributes (not image data in href/src, which can contain the letters NaN by chance)
                for (const el of [s, ...s.querySelectorAll('*')]) for (const a of el.attributes) {
                  if (/^(xlink:)?href$|^src$/.test(a.name) || a.value.startsWith('data:')) continue;
                  if (/(^|[^A-Za-z])(NaN|Infinity)([^A-Za-z]|$)/.test(a.value)) return true; }
                return false; })()""")
            if views:
                sd = os.path.join(d, 'shots'); os.makedirs(sd, exist_ok=True)
                for v in ['yaw=45', 'yaw=110', 'yaw=170', 'yaw=230', 'yaw=300', 'yaw=20&pitch=62', 'yaw=200&pitch=70']:
                    for mode in ['', '&xr=1&labels=1']:
                        pg.goto(f'{url}?free=1&{v}{mode}'); pg.wait_for_timeout(700)
                        pg.screenshot(path=os.path.join(sd, f'{fid}-{v.replace("&", "_").replace("=", "")}{"-xr" if mode else ""}.png'))
                ph = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2).new_page()
                ph.goto(url + '?xr=1&labels=1'); ph.wait_for_timeout(900); ph.screenshot(path=os.path.join(sd, f'{fid}-phone.png'), full_page=True)
            ctx.close()
            status = 'OK' if not errs.strip() and not nan else 'PROBLEM'
            bad += status != 'OK'
            print(f'{status:8} {fid}: {os.path.join(d, fid + ".png")}' + (f'  errors: {errs.strip()}' if errs.strip() else '') + ('  NaN in the drawing' if nan else ''))
        b.close()
    return bad == 0


def page(f, out):
    os.makedirs(out, exist_ok=True)
    url = 'file://' + os.path.abspath(f)
    problems = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, vp, scheme in [('desktop-light', (1280, 900), 'light'), ('desktop-dark', (1280, 900), 'dark'), ('phone-light', (390, 844), 'light'), ('phone-dark', (390, 844), 'dark')]:
            ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, color_scheme=scheme, device_scale_factor=1)
            pg = ctx.new_page(); logs = []
            pg.on('pageerror', lambda e: logs.append('pageerror: ' + str(e)))
            pg.on('console', lambda m: logs.append('console: ' + m.text) if m.type == 'error' and 'fonts.g' not in m.text and 'net::' not in m.text else None)
            pg.goto(url); pg.wait_for_timeout(1500)
            pg.screenshot(path=os.path.join(out, f'{name}-top.png'))
            ov = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            if ov > 1: problems.append(f'{name}: page scrolls sideways by {ov}px')
            # scroll to the first figure so it loads, then shoot it
            if pg.query_selector('.plate'):
                pg.evaluate('document.querySelector(".plate").scrollIntoView({block:"start"})'); pg.wait_for_timeout(2500)
                pg.screenshot(path=os.path.join(out, f'{name}-figure.png'))
                fr = pg.query_selector('.plate iframe')
                if not fr: problems.append(f'{name}: first figure did not load')
            if name == 'desktop-light':
                vis = lambda sel: pg.evaluate(f'(() => {{ const e = document.querySelector("{sel}"); return !!(e && e.offsetParent); }})()')
                if vis('#modeExpert'):   # hidden on pages without two depths (and on children's pages)
                    pg.click('#modeExpert'); pg.wait_for_timeout(200)
                    pg.evaluate('document.querySelector(".sec").scrollIntoView({block:"start"})'); pg.wait_for_timeout(300)
                    pg.screenshot(path=os.path.join(out, 'desktop-expert.png'))
                if vis('#focusBtn'):     # only when the focus-aids module is on
                    pg.click('#focusBtn'); pg.wait_for_timeout(400); pg.click('#nextBtn'); pg.wait_for_timeout(400)
                    pg.screenshot(path=os.path.join(out, 'desktop-focus.png'))
                q = pg.query_selector('.sec.current .q.mcq .opt') or pg.query_selector('.sec .q.mcq .opt')
                if q: q.click(); pg.wait_for_timeout(200)
                pg.evaluate('document.querySelector(".sec.current .check")?.scrollIntoView({block:"center"})'); pg.wait_for_timeout(200)
                pg.screenshot(path=os.path.join(out, 'desktop-check.png'))
            for l in logs: problems.append(f'{name}: {l}')
            ctx.close()
        b.close()
    for pr in problems: print('PROBLEM', pr)
    print(f'screenshots in {out}' + ('' if problems else '; no errors, no sideways scroll'))
    return not problems


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cmd', choices=['figures', 'page'])
    ap.add_argument('path')
    ap.add_argument('--views', action='store_true')
    ap.add_argument('--press', default='')
    ap.add_argument('--out', default='shots')
    a = ap.parse_args()
    ok = figures(a.path, a.views, a.press) if a.cmd == 'figures' else page(a.path, a.out)
    sys.exit(0 if ok else 1)
