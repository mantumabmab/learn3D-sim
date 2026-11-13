#!/usr/bin/env python3
"""notes_kit: turn one notes.md source into every Focus 3D Notes output.

    python3 notes_kit.py check notes.md [--figures DIR]
    python3 notes_kit.py study notes.md --figures DIR --out study.html [--figure-urls figures.json]
    python3 notes_kit.py doc   notes.md --out-dir DIR [--figures DIR] [--figure-urls figures.json] [--study-url URL]
    python3 notes_kit.py print notes.md --out-dir DIR --figures DIR [--figure-urls figures.json] [--study-url URL]
    python3 notes_kit.py cheatsheet notes.md --out-dir DIR [--figures DIR]

check  validates the source (chunk sizes, big ideas, checkpoints, citations, figures) and prints a summary.
study  writes ONE self-contained study page: focus mode, progress, timer, Simple/Expert switch, recall
       checkpoints, read-aloud, display options, and every built figure embedded (lazy-loaded iframes).
doc    writes doc.json (title, lead, one markdown block per section, answer key, glossary, references) for
       filling an editable doc one section at a time, plus doc.md (the same, joined) for pandoc / .docx.
print  writes notes.pdf (full notes, both depths, figure pictures with links, answer key, glossary, sources) and
       the one-page cheat sheet (cheatsheet.html/.pdf/.png: each section's big idea + key points + key words).
cheatsheet  writes only cheatsheet.html.

The source format is described in references/notes-format.md.
"""
import argparse, base64, hashlib, html, json, os, re, sys

try:
    import markdown as _md
except ImportError:  # pragma: no cover
    os.system(f'"{sys.executable}" -m pip install -q markdown --break-system-packages >/dev/null 2>&1 || "{sys.executable}" -m pip install -q markdown >/dev/null 2>&1')
    import markdown as _md
try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None
try:
    import latex2mathml.converter as _l2m
except ImportError:
    os.system(f'"{sys.executable}" -m pip install -q latex2mathml --break-system-packages >/dev/null 2>&1 || "{sys.executable}" -m pip install -q latex2mathml >/dev/null 2>&1')
    try:
        import latex2mathml.converter as _l2m
    except ImportError:
        _l2m = None

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, '..', 'assets', 'templates', 'study-page.html')
LEVEL_NAMES = {1: 'Primary school', 2: 'Secondary school', 3: 'Undergraduate', 4: 'Postgraduate / professional', 5: 'Doctoral / research'}
GRADE_LABEL = {'textbook': 'Textbook', 'guideline': 'Guideline', 'review': 'Review', 'primary': 'Research study',
               'emerging': 'Emerging', 'preprint': 'Preprint', 'database': 'Database'}
BOX_LABEL = {'analogy': 'Picture it', 'pitfall': 'Common mix-up', 'note': 'Note'}
KNOWN = {'bigidea', 'simple', 'expert', 'figure', 'check', 'example', 'analogy', 'pitfall', 'keypoints', 'goals',
         'references', 'note'}


# ----------------------------------------------------------------------------------------------- parsing
def split_front(text):
    meta, body = {}, text
    if text.lstrip().startswith('---'):
        t = text.lstrip()
        end = t.find('\n---', 3)
        if end > 0:
            fm, body = t[3:end], t[end + 4:]
            if yaml:
                meta = yaml.safe_load(fm) or {}
            else:
                cur = None
                for ln in fm.splitlines():
                    if re.match(r'^\s+-\s+', ln) and cur:
                        meta.setdefault(cur, []).append(ln.split('-', 1)[1].strip())
                    elif ':' in ln:
                        k, v = ln.split(':', 1); cur = k.strip(); v = v.strip()
                        meta[cur] = v if v else []
    return meta, body


def parse_attrs(s):
    out = {}
    for m in re.finditer(r'([A-Za-z_][\w-]*)\s*=\s*("([^"]*)"|\'([^\']*)\'|(\S+))', s or ''):
        out[m.group(1)] = next(g for g in (m.group(3), m.group(4), m.group(5)) if g is not None)
    return out


def parse_blocks(lines):
    """Lines -> [('md', text) | ('dir', name, attrs, body)]; directives do not nest."""
    blocks, buf, i, fence = [], [], 0, None
    def flush():
        if buf and ''.join(buf).strip():
            blocks.append(('md', '\n'.join(buf)))
        buf.clear()
    while i < len(lines):
        ln = lines[i]
        fm = re.match(r'^\s*(```+|~~~+)', ln)
        if fence:
            buf.append(ln)
            if fm and fm.group(1)[0] == fence[0] and len(fm.group(1)) >= len(fence):
                fence = None
            i += 1; continue
        if fm:
            fence = fm.group(1); buf.append(ln); i += 1; continue
        m = re.match(r'^:::\s*([A-Za-z][\w-]*)\s*(.*)$', ln)
        if m:
            flush()
            name, attrs, body, j = m.group(1).lower(), parse_attrs(m.group(2)), [], i + 1
            while j < len(lines) and not re.match(r'^:::\s*$', lines[j]):
                body.append(lines[j]); j += 1
            blocks.append(('dir', name, attrs, '\n'.join(body)))
            i = j + 1; continue
        buf.append(ln); i += 1
    flush()
    return blocks


def load(path):
    text = open(path, encoding='utf-8').read().replace('\r\n', '\n')
    meta, body = split_front(text)
    lines = body.split('\n')
    pre, secs, cur, fence, in_dir = [], [], None, None, False
    for ln in lines:
        fm = re.match(r'^\s*(```+|~~~+)', ln)
        if fm and not in_dir:
            fence = None if fence else fm.group(1)
        if not fence:
            if re.match(r'^:::\s*[A-Za-z]', ln): in_dir = True
            elif re.match(r'^:::\s*$', ln): in_dir = False
        if not fence and not in_dir and re.match(r'^##\s+\S', ln) and not ln.startswith('###'):
            cur = {'heading': ln[2:].strip(), 'lines': []}; secs.append(cur); continue
        if not fence and not in_dir and re.match(r'^#\s+\S', ln):
            meta.setdefault('title', ln[1:].strip()); continue
        (cur['lines'] if cur else pre).append(ln)
    notes = {'meta': meta, 'pre': parse_blocks(pre), 'sections': [], 'refs': {}, 'ref_order': []}
    for k, s in enumerate(secs, 1):
        s['blocks'] = parse_blocks(s.pop('lines')); s['n'] = k
        s['id'] = 's%d-' % k + (re.sub(r'[^a-z0-9]+', '-', s['heading'].lower()).strip('-')[:40] or 'section')
        notes['sections'].append(s)
    # references may sit anywhere; pull them out
    for holder in [notes['pre']] + [s['blocks'] for s in notes['sections']]:
        for b in list(holder):
            if b[0] == 'dir' and b[1] == 'references':
                for key, txt, grade in parse_refs(b[3]):
                    notes['refs'][key] = {'text': txt, 'grade': grade, 'url': first_url(txt)}; notes['ref_order'].append(key)
                holder.remove(b)
    m = notes['meta']
    m['level'] = int(m.get('level') or 3)
    m.setdefault('title', 'Study notes')
    m.setdefault('language', 'en')
    lv = m['level']
    m.setdefault('simple_label', 'Easy' if lv <= 2 else 'Plain words')
    m.setdefault('expert_label', 'More detail' if lv <= 2 else 'Full detail')
    m.setdefault('default_mode', 'simple')
    # focus aids (focus mode, study timer, read-aloud, short-chunk rules) are a module: on only when asked for
    fv = m.get('focus', False)
    m['focus'] = fv if isinstance(fv, bool) else str(fv).strip().lower() in ('yes', 'true', 'on', '1')
    m.setdefault('summary_label', 'Big idea' if (m['focus'] or lv <= 2) else 'In short')
    return notes


def parse_refs(body):
    out, cur = [], None
    for ln in body.split('\n'):
        m = re.match(r'^\s*(?:[-*]\s*)?\[@([\w:.\-]+)\]:?\s*(.*)$', ln)
        if m:
            cur = [m.group(1), m.group(2)]; out.append(cur)
        elif cur and ln.strip():
            cur[1] += ' ' + ln.strip()
    res = []
    for key, txt in out:
        g = re.search(r'\{\s*grade\s*=\s*([\w-]+)\s*\}\s*$', txt)
        grade = g.group(1).lower() if g else ''
        txt = txt[:g.start()].rstrip() if g else txt
        res.append((key, txt.strip(), grade))
    return res


def first_url(t):
    m = re.search(r'https?://[^\s)>\]]+', t)
    return m.group(0).rstrip('.,;') if m else ''


# ----------------------------------------------------------------------------------------------- maths text
GREEK = 'alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi rho sigma tau upsilon phi varphi chi psi omega'.split()
GREEK_CH = 'α β γ δ ε ε ζ η θ ϑ ι κ λ μ ν ξ π ρ σ τ υ φ φ χ ψ ω'.split()
SYM = {r'\mid': '|', r'\cap': '∩', r'\cup': '∪', r'\times': '×', r'\cdot': '·', r'\leq': '≤', r'\le': '≤', r'\geq': '≥',
       r'\ge': '≥', r'\neq': '≠', r'\approx': '≈', r'\sim': '~', r'\infty': '∞', r'\sum': 'Σ', r'\prod': 'Π', r'\int': '∫',
       r'\to': '→', r'\rightarrow': '→', r'\Rightarrow': '⇒', r'\leftarrow': '←', r'\rightleftharpoons': '⇌',
       r'\leftrightarrow': '↔', r'\pm': '±', r'\in': '∈', r'\notin': '∉', r'\subset': '⊂', r'\subseteq': '⊆',
       r'\emptyset': '∅', r'\varnothing': '∅', r'\partial': '∂', r'\nabla': '∇', r'\Delta': 'Δ', r'\Sigma': 'Σ',
       r'\Omega': 'Ω', r'\Phi': 'Φ', r'\Gamma': 'Γ', r'\Lambda': 'Λ', r'\Pi': 'Π', r'\Theta': 'Θ', r'\circ': '°',
       r'\degree': '°', r'\ldots': '…', r'\dots': '…', r'\cdots': '⋯', r'\perp': '⊥', r'\propto': '∝', r'\forall': '∀',
       r'\exists': '∃', r'\neg': '¬', r'\land': '∧', r'\lor': '∨', r'\quad': ' ', r'\qquad': '  ', r'\,': ' ',
       r'\;': ' ', r'\!': '', r'\%': '%', r'\{': '{', r'\}': '}', r'\mathbb{R}': 'ℝ', r'\mathbb{N}': 'ℕ',
       r'\mathbb{Z}': 'ℤ', r'\mathbb{E}': 'E', r'\mathbb{P}': 'P', r'\Pr': 'Pr', r'\log': 'log', r'\ln': 'ln',
       r'\exp': 'exp', r'\lim': 'lim', r'\max': 'max', r'\min': 'min', r'\sin': 'sin', r'\cos': 'cos', r'\tan': 'tan',
       r'\Var': 'Var', r'\left': '', r'\right': '', r'\big': '', r'\Big': '', r'\bigl': '', r'\bigr': ''}
SUP = str.maketrans('0123456789+-=()n', '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ')
SUB = str.maketrans('0123456789+-=()', '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎')


def tex2text(t):
    s = t.strip()
    for _ in range(6):
        s = re.sub(r'\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}', lambda m: f'({m.group(1)})/({m.group(2)})', s)
        s = re.sub(r'\\binom\s*\{([^{}]*)\}\s*\{([^{}]*)\}', lambda m: f'C({m.group(1)}, {m.group(2)})', s)
        s = re.sub(r'\\sqrt\s*\{([^{}]*)\}', lambda m: f'√({m.group(1)})', s)
        s = re.sub(r'\\(?:text|mathrm|mathit|mathbf|operatorname|textbf|textit|mathsf|boldsymbol|hat|bar|overline|vec|tilde)\s*\{([^{}]*)\}', r'\1', s)
    for k in sorted(SYM, key=len, reverse=True):
        if re.fullmatch(r'\\[A-Za-z]+', k):   # a control word swallows one following space, as in TeX
            s = re.sub(re.escape(k) + r'(?![A-Za-z]) ?', lambda m, v=SYM[k]: v, s)
        else:
            s = s.replace(k, SYM[k])
    for g, c in zip(GREEK, GREEK_CH):
        s = re.sub(r'\\' + g + r'(?![A-Za-z]) ?', c, s)
    s = re.sub(r'\^\{([^{}]*)\}', lambda m: m.group(1).translate(SUP) if re.fullmatch(r'[0-9+\-=()n]+', m.group(1)) else '^(' + m.group(1) + ')', s)
    s = re.sub(r'\^([0-9n])', lambda m: m.group(1).translate(SUP), s)
    s = re.sub(r'_\{([^{}]*)\}', lambda m: m.group(1).translate(SUB) if re.fullmatch(r'[0-9+\-=()]+', m.group(1)) else '_' + m.group(1), s)
    s = re.sub(r'_([0-9])', lambda m: m.group(1).translate(SUB), s)
    s = re.sub(r'\\([A-Za-z]+)', r'\1', s)
    s = s.replace('{', '').replace('}', '').replace('&', '').replace('\\\\', '; ')
    return re.sub(r'\s+', ' ', s).strip()


def mathml(tex, display):
    label = html.escape(tex2text(tex), quote=True)
    if _l2m:
        try:
            m = _l2m.convert(tex.strip(), display='block' if display else 'inline')
            return m.replace('<math ', f'<math aria-label="{label}" ', 1)
        except Exception:
            pass
    tag = 'div' if display else 'span'
    return f'<{tag} class="tex" data-tex="{html.escape(tex, quote=True)}" data-display="{int(display)}" aria-label="{label}">{html.escape(tex)}</{tag}>'


# ----------------------------------------------------------------------------------------------- inline layer
class Ctx:
    def __init__(self, notes, target):
        self.notes, self.target = notes, target  # target: 'html' | 'doc'
        self.cite_num, self.terms, self.ph, self.missing_refs, self.used_tex_fallback = {}, {}, [], set(), False

    def num(self, key):
        if key not in self.cite_num:
            self.cite_num[key] = len(self.cite_num) + 1
        return self.cite_num[key]

    def hold(self, s):
        self.ph.append(s); return f'ZZPH{len(self.ph) - 1}ZZ'

    def protect(self, text):
        def fence(m):
            lang, code = (m.group(2) or '').strip(), m.group(3)
            if self.target == 'doc':
                return '\n\n' + self.hold(f'```{lang}\n{code}\n```') + '\n\n'
            if lang == 'mermaid':
                return '\n\n' + self.hold(f'<pre class="mermaid">{html.escape(code)}</pre>') + '\n\n'
            return '\n\n' + self.hold(f'<pre><code>{html.escape(code)}</code></pre>') + '\n\n'
        text = re.sub(r'(^|\n)\s*```+\s*([\w-]*)[^\n]*\n(.*?)\n\s*```+[ \t]*(?=\n|$)', fence, text, flags=re.S)
        text = re.sub(r'`([^`\n]+)`', lambda m: self.hold(f'`{m.group(1)}`' if self.target == 'doc' else f'<code>{html.escape(m.group(1))}</code>'), text)

        def dmath(m):
            tex = m.group(1)
            if self.target == 'doc':
                return '\n\n' + self.hold('```latex\n' + tex.strip() + '\n```') + '\n\n'
            h = mathml(tex, True); self.used_tex_fallback |= 'class="tex"' in h
            return '\n\n' + self.hold(f'<div class="mathblock">{h}</div>') + '\n\n'
        text = re.sub(r'\$\$(.+?)\$\$', dmath, text, flags=re.S)

        def imath(m):
            tex = m.group(1)
            if self.target == 'doc':
                return self.hold(tex2text(tex))
            h = mathml(tex, False); self.used_tex_fallback |= 'class="tex"' in h
            return self.hold(h)
        text = re.sub(r'(?<![\\$\w])\$(?![\s$])([^$\n]+?)(?<![\s\\])\$(?![\w$])', imath, text)

        def term(m):
            t, d = m.group(1).strip(), m.group(2).strip()
            self.terms.setdefault(t, d)
            if self.target == 'doc':
                return self.hold(t)
            return self.hold(f'<button type="button" class="term" data-term="{html.escape(t, True)}" data-def="{html.escape(d, True)}">{html.escape(t)}</button>')
        text = re.sub(r'\{\{([^|{}]+)\|([^{}]+)\}\}', term, text)

        def cite(m):
            keys = [k.strip().lstrip('@') for k in m.group(1).split(';')]
            parts = []
            for k in keys:
                if k not in self.notes['refs']:
                    self.missing_refs.add(k)
                n = self.num(k)
                url = self.notes['refs'].get(k, {}).get('url', '')
                if self.target == 'doc':
                    parts.append(f'[[{n}]]({url})' if url else f'[{n}]')
                else:
                    parts.append(f'<a href="#ref-{html.escape(k, True)}" aria-label="Source {n}">{n}</a>')
            if self.target == 'doc':
                return self.hold(''.join(parts))
            return self.hold('<sup class="cite">' + ','.join(parts) + '</sup>')
        text = re.sub(r'\[(@[\w:.\-]+(?:\s*;\s*@[\w:.\-]+)*)\]', cite, text)
        return text

    def restore(self, s):
        for _ in range(3):
            s = re.sub(r'<p>\s*ZZPH(\d+)ZZ\s*</p>', lambda m: self.ph[int(m.group(1))] if self.ph[int(m.group(1))].lstrip().startswith(('<div', '<pre')) else m.group(0), s)
            s = re.sub(r'ZZPH(\d+)ZZ', lambda m: self.ph[int(m.group(1))], s)
        return s

    def md(self, text, inline=False):
        """markdown -> html (target html) or cleaned markdown (target doc)."""
        t = self.protect(text)
        if self.target == 'doc':
            return self.restore(t).strip()
        h = _md.markdown(t, extensions=['tables', 'sane_lists'], output_format='html')
        h = re.sub(r'<table>', '<div class="tablewrap"><table>', h).replace('</table>', '</table></div>')
        if inline:
            h = re.sub(r'^\s*<p>(.*)</p>\s*$', r'\1', h, flags=re.S)
        return self.restore(h)


def words(s):
    s = re.sub(r'<[^>]+>', ' ', s)
    s = re.sub(r'\$\$.*?\$\$|\$[^$\n]+\$', ' formula ', s, flags=re.S)
    return len(re.findall(r'[\w\u00C0-\u024F\u0400-\u04FF\u0900-\u0DFF\u3040-\u9FFF]+', s))


# ----------------------------------------------------------------------------------------------- checkpoints
def parse_check(body):
    qs, cur, mode = [], None, None
    for ln in body.split('\n'):
        if re.match(r'^\s*Q\s*[:.]', ln):
            cur = {'q': re.sub(r'^\s*Q\s*[:.]\s*', '', ln), 'opts': [], 'a': ''}; qs.append(cur); mode = 'q'; continue
        if cur is None:
            continue
        mo = re.match(r'^\s*[-*]\s*\[( |x|X)\]\s*(.*)$', ln)
        if mo:
            cur['opts'].append({'t': mo.group(2), 'ok': mo.group(1).lower() == 'x'}); mode = 'o'; continue
        if re.match(r'^\s*A\s*[:.]', ln):
            cur['a'] = re.sub(r'^\s*A\s*[:.]\s*', '', ln); mode = 'a'; continue
        if ln.strip():
            if mode == 'a': cur['a'] += '\n' + ln
            elif mode == 'q': cur['q'] += ' ' + ln.strip()
            elif mode == 'o' and cur['opts']: cur['opts'][-1]['t'] += ' ' + ln.strip()
        elif mode == 'a':
            cur['a'] += '\n'
    return qs


def html_question(ctx, q, qid):
    qt = ctx.md(q['q'], inline=True)
    ans = ctx.md(q['a']) if q['a'].strip() else ''
    if q['opts']:
        letters = 'ABCDEFGH'
        okattr = ' data-ok="1"'
        opts = ''.join(f'<button type="button" class="opt"{okattr if o["ok"] else ""}><span class="k">{letters[i]}</span><span>{ctx.md(o["t"], inline=True)}</span></button>'
                       for i, o in enumerate(q['opts']))
        return (f'<div class="q mcq" data-q="{qid}"><p class="qt">{qt}</p><div class="choices">{opts}</div>'
                f'<div class="fb" hidden><span class="v"></span> {ans}</div>'
                f'<button type="button" class="sbtn retry" hidden>Try again</button></div>')
    return (f'<div class="q recall" data-q="{qid}"><p class="qt">{qt}</p>'
            f'<label class="sr" for="ta-{qid}">Your answer</label><textarea id="ta-{qid}" placeholder="Type your answer, or just think it through, then check."></textarea>'
            f'<div class="row"><button type="button" class="sbtn solid show">Show answer</button></div>'
            f'<div class="ans fb" hidden>{ans}</div>'
            f'<div class="rate" hidden><span>How did you do?</span><button type="button" class="sbtn" data-r="got">Got it</button>'
            f'<button type="button" class="sbtn" data-r="partly">Partly</button><button type="button" class="sbtn" data-r="not">Not yet</button></div></div>')


# ----------------------------------------------------------------------------------------------- study page
def render_block_html(ctx, b, sec, figs, fig_urls, counters):
    if b[0] == 'md':
        return ctx.md(b[1])
    _, name, attrs, body = b
    meta = ctx.notes['meta']
    if name == 'bigidea':
        return f'<aside class="bigidea"><span class="lbl">{html.escape(str(ctx.notes["meta"].get("summary_label", "Big idea")))}</span>{ctx.md(body)}</aside>'
    if name in ('simple', 'expert'):
        label = meta['simple_label'] if name == 'simple' else meta['expert_label']
        return f'<div class="mode mode-{name}"><span class="mode-tag">{html.escape(label)}</span>{ctx.md(body)}</div>'
    if name in BOX_LABEL:
        return f'<aside class="box {name}"><span class="lbl">{html.escape(attrs.get("label", BOX_LABEL[name]))}</span>{ctx.md(body)}</aside>'
    if name == 'keypoints':
        return f'<aside class="keypoints"><span class="lbl">Lock it in</span>{ctx.md(body)}</aside>'
    if name == 'example':
        steps = [s for s in re.split(r'\n\s*---+\s*\n', body) if s.strip()]
        items = ''.join(f'<li>{ctx.md(s)}</li>' for s in steps)
        title = attrs.get('title', '')
        return (f'<div class="example"><span class="lbl">Worked example</span>' + (f'<p><strong>{html.escape(title)}</strong></p>' if title else '') +
                f'<ol class="steps">{items}</ol><div class="ex-ctl"><button type="button" class="sbtn solid ex-next"></button>'
                f'<button type="button" class="sbtn ex-all">Show all steps</button></div></div>')
    if name == 'check':
        qs = parse_check(body)
        out = []
        for q in qs:
            counters['q'] += 1
            qid = f'{sec["id"] if sec else "pre"}-q{counters["q"]}'
            q['id'] = qid; q['sec'] = sec
            counters['all_q'].append(q)
            out.append(html_question(ctx, q, qid))
        return f'<section class="check" aria-label="Check yourself"><div class="check-head"><span class="lbl">Check yourself</span><span class="score"></span></div>{"".join(out)}</section>'
    if name == 'figure':
        fid = attrs.get('id', '')
        counters['fig'] += 1
        title = attrs.get('title', fid)
        figs.append({'id': fid, 'title': title, 'n': counters['fig'], 'engine': attrs.get('engine', '')})
        h = re.sub(r'\D', '', attrs.get('height', '')) or '620'
        url = fig_urls.get(fid, '')
        link = f'<a class="openfig" href="{html.escape(url, True)}" target="_blank" rel="noopener">Open on its own</a>' if url else ''
        try_html = f'<div class="try"><span class="lbl">Try this</span>{ctx.md(body)}</div>' if body.strip() else ''
        return (f'<figure class="plate" id="fig-{html.escape(fid, True)}" data-fig="{html.escape(fid, True)}" data-title="{html.escape(title, True)}" style="--fh:{h}px">'
                f'<figcaption><div><span class="fk">Interactive 3D · Fig. {counters["fig"]}</span><div class="ft">{html.escape(title)}</div></div>'
                f'<div class="fbtns"><button type="button" class="expand">Full screen</button>{link}</div></figcaption>'
                f'<div class="frame"><button type="button" class="load">Load the 3D figure</button></div>{try_html}</figure>')
    if name == 'goals':
        return ''
    return f'<div class="box"><span class="lbl">{html.escape(name)}</span>{ctx.md(body)}</div>'


def sec_minutes(sec):
    shared = simple = expert = 0
    figs = qs = steps = 0
    for b in sec['blocks']:
        if b[0] == 'md':
            shared += words(b[1]); continue
        _, name, attrs, body = b
        if name == 'simple': simple += words(body)
        elif name == 'expert': expert += words(body)
        elif name == 'figure': figs += 1; shared += words(body)
        elif name == 'check': qs += len(parse_check(body))
        elif name == 'example':
            steps += len([s for s in re.split(r'\n\s*---+\s*\n', body) if s.strip()]); shared += words(body)
        else: shared += words(body)
    extra = figs * 2 + qs * 0.75 + steps * 0.4
    return (shared + simple) / 190 + extra, (shared + expert) / 160 + extra, shared, simple, expert


def build_study(notes, figdir, fig_urls, out):
    ctx = Ctx(notes, 'html')
    m = notes['meta']
    tpl = open(TEMPLATE, encoding='utf-8').read()
    figs, counters = [], {'q': 0, 'fig': 0, 'all_q': []}
    secs_html, toc = [], []
    n = len(notes['sections'])
    pre_html = ''.join(render_block_html(ctx, b, None, figs, fig_urls, counters) for b in notes['pre'])
    goals = [b for b in notes['pre'] if b[0] == 'dir' and b[1] == 'goals']
    for s in notes['sections']:
        ms, me, *_ = sec_minutes(s)
        body = ''.join(render_block_html(ctx, b, s, figs, fig_urls, counters) for b in s['blocks'])
        head = ctx.md(s['heading'], inline=True)
        secs_html.append(
            f'<article class="sec" id="{s["id"]}" data-step data-mins-simple="{ms:.2f}" data-mins-expert="{me:.2f}">'
            f'<div class="sec-head"><div class="eyebrow"><span>Section {s["n"]} of {n}</span><span class="mins"></span></div>'
            f'<button type="button" class="readsec">Read this section</button></div><h2>{head}</h2>{body}'
            f'<footer class="sec-foot"><button type="button" class="sbtn done" aria-pressed="false">Mark as done</button>'
            f'<button type="button" class="sbtn solid nextsec">Done, next section</button></footer></article>')
        toc.append(f'<li data-sec="{s["id"]}"><a href="#{s["id"]}"><span class="n">{s["n"]}</span><span class="tt">{head}</span><span class="m"></span><span class="tick" aria-hidden="true"></span></a></li>')

    # cover
    nq, nf = len(counters['all_q']), len(figs)
    goals_html = ''
    if goals:
        goals_html = f'<div class="goals"><h2>By the end you can</h2>{ctx.md(goals[0][3])}</div>'
    elif m.get('goals'):
        goals_html = '<div class="goals"><h2>By the end you can</h2><ul>' + ''.join(f'<li>{ctx.md(str(g), inline=True)}</li>' for g in m['goals']) + '</ul></div>'
    audience = html.escape(str(m.get('audience', LEVEL_NAMES.get(m['level'], ''))))
    def _has(fid, word):   # read the built page, so the help names only controls that exist
        f = os.path.join(figdir or '', fid + '.html')
        try: return word in open(f, encoding='utf-8').read()
        except OSError: return False
    has_xr = any(_has(f['id'], 'See-through') for f in figs)
    has_sim = any(_has(f['id'], 'mountSim(') for f in figs)
    how = ('Tap a dotted word to see what it means. ' +
           ('Each figure is live: drag to turn it and press its buttons to run the process' +
            (', and switch on See-through and Labels to look inside' if has_xr else '') +
            ('; in the simulator, predict first, then flip the switches to test yourself' if has_sim else '') + '.' if nf else '') +
           (f' Use {html.escape(m["simple_label"])} / {html.escape(m["expert_label"])} at the top to change the depth.' if any(b[0] == 'dir' and b[1] in ('simple', 'expert') for sx in notes['sections'] for b in sx['blocks']) and m['level'] > 2 else ''))
    cover = (f'<section class="cover" id="cover" data-step><div class="eyebrow">{audience} · {LEVEL_NAMES.get(m["level"], "")}</div>'
             f'<h1>{ctx.md(str(m["title"]), inline=True)}</h1>' + (f'<p class="sub">{ctx.md(str(m["subtitle"]), inline=True)}</p>' if m.get('subtitle') else '') +
             f'<div class="meta"><span class="chip">{n} section{"s" if n != 1 else ""}</span><span class="chip" id="totalMins"></span>' +
             (f'<span class="chip">{nf} interactive 3D figure{"s" if nf != 1 else ""}</span>' if nf else '') +
             (f'<span class="chip">{nq} recall question{"s" if nq != 1 else ""}</span>' if nq else '') + '</div>' +
             goals_html + pre_html + f'<p class="how">{how}</p>' +
             ('<div class="start"><button type="button" class="btn" id="startFocus">Start in focus mode</button>'
              '<button type="button" class="btn ghost" id="startScroll">Scroll through everything</button></div>' if m['focus'] else '') + '</section>'
             f'<nav class="toc" aria-label="Sections"><ol>{"".join(toc)}</ol></nav>')

    # wrap-up: key points, mixed review, revisit list, glossary, references
    kps = []
    for s in notes['sections']:
        for b in s['blocks']:
            if b[0] == 'dir' and b[1] == 'keypoints':
                kps.append(f'<h3>{ctx.md(s["heading"], inline=True)}</h3>{ctx.md(b[3])}')
    by_sec = {}
    for q in counters['all_q']:
        by_sec.setdefault(q['sec']['id'] if q['sec'] else 'pre', []).append(q)
    order = list(by_sec)
    inter = order[1::2] + order[0::2]  # interleave: not in section order
    picks = [by_sec[k][-1] for k in inter][:8]
    review = ''.join(html_question(ctx, q, 'r-' + q['id']) for q in picks)
    gloss = ''.join(f'<dt>{html.escape(t)}</dt><dd>{html.escape(d)}</dd>' for t, d in sorted(ctx.terms.items(), key=lambda x: x[0].lower()))
    refs_html = render_refs_html(ctx, notes)
    wrap = ('<section class="sec wrap" id="wrap" data-step><div class="sec-head"><div class="eyebrow"><span>Wrap-up</span></div>'
            '<button type="button" class="readsec">Read this section</button></div><h2>Lock it in</h2>' +
            (''.join(kps) if kps else '') +
            (f'<section class="check" aria-label="Mixed review"><div class="check-head"><span class="lbl">Mixed review</span><span class="score"></span></div>'
             f'<p>These come from different sections in a new order. Mixing topics makes you pick the right idea, not just repeat the last one.</p>{review}</section>' if picks else '') +
            '<h3>Revisit these</h3><div id="missed" class="missed"></div>'
            '<h3>Come back to it</h3><p>Do the mixed review again tomorrow, then in about a week. Spacing your practice out keeps it in memory far longer than one long session.</p>' +
            (f'<h3>Glossary</h3><dl class="gloss">{gloss}</dl>' if gloss else '') +
            (f'<h3>Sources</h3>{refs_html}' if refs_html else '') +
            '<p class="credit">3D figures drawn with the Colorfigures engine by April Zhu (MIT licence, april-zhu.com/colorfigures).</p></section>'
            if True else '')

    content = cover + ''.join(secs_html) + wrap
    # embedded figures
    figsrc, missing = [], []
    for f in figs:
        p = os.path.join(figdir or '', f['id'] + '.html')
        if figdir and os.path.exists(p):
            page = inject_embed(open(p, encoding='utf-8').read())
            figsrc.append(f'<script type="text/plain" id="figsrc-{html.escape(f["id"], True)}">{base64.b64encode(page.encode("utf-8")).decode()}</script>')
        else:
            missing.append(f['id'])
    if ctx.used_tex_fallback:
        figsrc.append('<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"></script>'
                      '<script>addEventListener("load",()=>{if(!window.katex)return;for(const el of document.querySelectorAll(".tex[data-tex]")){try{katex.render(el.dataset.tex,el,{output:"mathml",displayMode:el.dataset.display==="1",throwOnError:false});}catch(e){}}});</script>')
    key = hashlib.sha1((str(m['title']) + str(m.get('audience', ''))).encode()).hexdigest()[:10]
    meta_json = json.dumps({'key': key, 'defaultMode': m.get('default_mode', 'simple'), 'level': m['level'], 'focus': m['focus']}).replace('</', '<\\/')
    title = str(m.get('page_title') or m['title'])
    page = (tpl.replace('__TITLE__', html.escape(title)).replace('__SHORT_TITLE__', html.escape(str(m.get('short_title') or title)))
               .replace('__SIMPLE_LABEL__', html.escape(m['simple_label'])).replace('__EXPERT_LABEL__', html.escape(m['expert_label']))
               .replace('__META__', meta_json).replace('__FIGSRC__', '\n'.join(figsrc)).replace('__CONTENT__', content))
    lang = html.escape(str(m.get('language', 'en')), True)
    page = f'<script>document.documentElement.lang="{lang}";document.documentElement.dataset.mode={json.dumps(m.get("default_mode", "simple"))};</script>\n' + page
    open(out, 'w', encoding='utf-8').write(page)
    return {'figures': figs, 'missing_figures': missing, 'questions': nq, 'terms': len(ctx.terms), 'citations': len(ctx.cite_num),
            'missing_refs': sorted(ctx.missing_refs), 'bytes': len(page.encode('utf-8'))}


def render_refs_html(ctx, notes):
    keys = sorted(ctx.cite_num, key=ctx.cite_num.get) + [k for k in notes['ref_order'] if k not in ctx.cite_num]
    if not keys:
        return ''
    items = []
    for k in keys:
        r = notes['refs'].get(k)
        if not r:
            items.append(f'<li id="ref-{html.escape(k, True)}">Missing reference: {html.escape(k)}</li>'); continue
        badge = f'<span class="badge {r["grade"]}">{GRADE_LABEL.get(r["grade"], r["grade"])}</span>' if r['grade'] else ''
        txt = ctx.md(r['text'], inline=True)
        txt = re.sub(r'(?<!["\'>=])(https?://[^\s<]+)', lambda mm: f'<a href="{mm.group(1)}" target="_blank" rel="noopener">{mm.group(1)}</a>', txt)
        items.append(f'<li id="ref-{html.escape(k, True)}">{txt} {badge}</li>')
    return f'<ol class="refs">{"".join(items)}</ol>'


EMBED = ('<script>(()=>{const post=()=>{const b=document.body;if(!b)return;let h=0;for(const e of b.children){const r=e.getBoundingClientRect();'
         'if(r.height&&getComputedStyle(e).position!=="fixed")h=Math.max(h,r.bottom+scrollY);}try{parent.postMessage({f3n:"h",h:Math.ceil(h+20)},"*");}catch(e){}};'
         'addEventListener("load",()=>{post();let k=0;const t=setInterval(()=>{post();if(++k>8)clearInterval(t);},700);});addEventListener("resize",post);})();</script>')


def inject_embed(page):
    i = page.rfind('</body>')
    return page[:i] + EMBED + page[i:] if i >= 0 else page + EMBED


# ----------------------------------------------------------------------------------------------- doc export
def render_block_doc(ctx, b, sec, fig_urls, figdir, answers, counters, rich):
    if b[0] == 'md':
        return ctx.md(b[1])
    _, name, attrs, body = b
    meta = ctx.notes['meta']
    if name == 'bigidea':
        return f'> **{meta.get("summary_label", "Big idea")}:** ' + ctx.md(body).replace('\n\n', '\n>\n> ').replace('\n', '\n> ').replace('> > ', '> ')
    if name in ('simple', 'expert'):
        label = meta['simple_label'] if name == 'simple' else meta['expert_label']
        return f'**{label}**\n\n{ctx.md(body)}'
    if name in BOX_LABEL:
        return f'**{attrs.get("label", BOX_LABEL[name])}:** {ctx.md(body)}'
    if name == 'keypoints':
        return f'**Lock it in**\n\n{ctx.md(body)}'
    if name == 'example':
        steps = [s for s in re.split(r'\n\s*---+\s*\n', body) if s.strip()]
        t = attrs.get('title', '')
        return f'**Worked example{": " + t if t else ""}**\n\n' + '\n'.join(f'{i}. ' + ctx.md(s).replace('\n', '\n   ') for i, s in enumerate(steps, 1))
    if name == 'check':
        qs = parse_check(body); lines = ['**Check yourself** (answers at the end)', '']
        for q in qs:
            counters['q'] += 1; k = counters['q']
            lines.append(f'{k}. {ctx.md(q["q"])}')
            letters = 'abcdefgh'
            for i, o in enumerate(q['opts']):
                lines.append(f'   - {letters[i]}) {ctx.md(o["t"])}')
            right = ', '.join(f'{letters[i]})' for i, o in enumerate(q['opts']) if o['ok'])
            answers.append((sec['heading'] if sec else '', k, (f'**{right}** ' if right else '') + ctx.md(q['a'])))
        return '\n'.join(lines)
    if name == 'figure':
        fid = attrs.get('id', ''); title = attrs.get('title', fid); url = fig_urls.get(fid, '')
        counters['fig'] += 1
        head = f'**Interactive 3D figure {counters["fig"]}: {title}**' + (f' ([open the figure]({url}))' if url else '')
        out = head
        snap = os.path.join(figdir, fid + '.png') if figdir else ''
        if rich and snap and os.path.exists(snap):
            out += f'\n\n![{title}]({snap})'
        if body.strip():
            out += f'\n\n*Try this:* {ctx.md(body)}'
        return out
    if name == 'goals':
        return ''
    return ctx.md(body)


def build_doc(notes, out_dir, fig_urls, study_url, figdir):
    os.makedirs(out_dir, exist_ok=True)
    m = notes['meta']
    res = {}
    for rich in (False, True):
        ctx = Ctx(notes, 'doc'); answers = []; counters = {'q': 0, 'fig': 0}
        lead = []
        if m.get('subtitle'): lead.append(ctx.md(str(m['subtitle'])))
        lead.append(f'**Written for:** {m.get("audience", LEVEL_NAMES.get(m["level"], ""))}.' +
                    (f' **Interactive study page** ({"focus mode, quizzes, read-aloud, live 3D" if m.get("focus") else "live 3D figures and self-check questions"}): [open it]({study_url}).' if study_url else ''))
        goals = [b for b in notes['pre'] if b[0] == 'dir' and b[1] == 'goals']
        if goals: lead.append('**By the end you can**\n\n' + ctx.md(goals[0][3]))
        elif m.get('goals'): lead.append('**By the end you can**\n\n' + '\n'.join('- ' + ctx.md(str(g)) for g in m['goals']))
        for b in notes['pre']:
            if not (b[0] == 'dir' and b[1] == 'goals'):
                lead.append(render_block_doc(ctx, b, None, fig_urls, figdir, answers, counters, rich))
        sections = []
        for s in notes['sections']:
            parts = [render_block_doc(ctx, b, s, fig_urls, figdir, answers, counters, rich) for b in s['blocks']]
            figs = [b[2].get('id') for b in s['blocks'] if b[0] == 'dir' and b[1] == 'figure']
            body = re.sub(r'\n{3,}', '\n\n', '\n\n'.join(p for p in parts if p.strip()))
            sections.append({'heading': ctx.md(s['heading']), 'markdown': f'## {ctx.md(s["heading"])}\n\n' + body, 'figures': figs})
        ak = ['## Answer key']
        last = None
        for h, k, a in answers:
            if h != last: ak.append(f'\n**{h}**\n'); last = h
            ak.append(f'{k}. ' + a.replace('\n', '\n   '))
        gl = ''
        if ctx.terms:
            gl = '## Glossary\n\n| Term | Meaning |\n|---|---|\n' + '\n'.join(f'| {t} | {d.replace("|", "/")} |' for t, d in sorted(ctx.terms.items(), key=lambda x: x[0].lower()))
        keys = sorted(ctx.cite_num, key=ctx.cite_num.get) + [k for k in notes['ref_order'] if k not in ctx.cite_num]
        refs = ''
        if keys:
            rl = []
            for k in keys:
                r = notes['refs'].get(k, {'text': 'Missing reference ' + k, 'grade': ''})
                g = f' *({GRADE_LABEL.get(r["grade"], r["grade"])})*' if r['grade'] else ''
                rl.append(f'{ctx.cite_num.get(k, len(rl) + 1)}. {r["text"]}{g}')
            refs = '## Sources\n\n' + '\n'.join(rl)
        figinfo = {}
        for s in notes['sections']:
            for b in s['blocks']:
                if b[0] == 'dir' and b[1] == 'figure':
                    fid = b[2].get('id', ''); snap = os.path.join(figdir, fid + '.png') if figdir else ''
                    figinfo[fid] = {'title': b[2].get('title', fid), 'url': fig_urls.get(fid, ''), 'snapshot': snap if snap and os.path.exists(snap) else None}
        res[rich] = {'title': str(m['title']), 'lead': '\n\n'.join(x for x in lead if x.strip()), 'sections': sections,
                     'answer_key': '\n'.join(ak) if answers else '', 'glossary': gl, 'references': refs, 'figures': figinfo}
    d = res[False]
    json.dump(d, open(os.path.join(out_dir, 'doc.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    r = res[True]
    full = [f'# {r["title"]}', r['lead']] + [s['markdown'] for s in r['sections']] + [r['answer_key'], r['glossary'], r['references']]
    open(os.path.join(out_dir, 'doc.md'), 'w', encoding='utf-8').write(re.sub(r'\n{3,}', '\n\n', '\n\n'.join(x for x in full if x)) + '\n')
    return d



# ----------------------------------------------------------------------------------------------- print: PDF + cheat sheet
PRINT_CSS = """@page{size:A4;margin:16mm 15mm 18mm}
body{font:10.5pt/1.5 'Helvetica Neue',Arial,sans-serif;color:#1d1a15;max-width:none;margin:0}
h1{font-size:20pt;margin:0 0 6pt} h2{font-size:14pt;margin:18pt 0 6pt;border-bottom:1.5pt solid #1d1a15;padding-bottom:3pt;break-after:avoid}
h3{font-size:11.5pt;break-after:avoid} p,li{orphans:3;widows:3} a{color:#2b4f9e;text-decoration:none;overflow-wrap:anywhere}
img{max-width:100%;max-height:105mm;display:block;margin:6pt auto;border:1px solid #ddd6c8;border-radius:4pt;break-inside:avoid}
table{border-collapse:collapse;width:100%;font-size:9.5pt;margin:6pt 0;break-inside:auto} th,td{border:1px solid #cfc7b6;padding:3pt 5pt;text-align:left;vertical-align:top}
th{background:#f2efe7} blockquote{margin:6pt 0;padding:4pt 10pt;border-left:3pt solid #e0a526;background:#fff8e6}
.mathblock{margin:6pt 0;text-align:center;font-size:12pt} code{font-size:9.5pt}
.cover{border:1.5pt solid #1d1a15;border-radius:6pt;padding:10pt 14pt;margin-bottom:10pt;background:#f7f3ea}
"""

CHEAT_CSS = """@page{size:A4;margin:9mm}
*{box-sizing:border-box} body{margin:0;font:8.6pt/1.32 'Helvetica Neue',Arial,sans-serif;color:#1d1a15}
.top{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2pt solid #1d1a15;margin-bottom:5pt;padding-bottom:3pt}
.top h1{font-size:14pt;margin:0} .top span{font-size:8pt;color:#6b6457}
.cols{column-count:2;column-gap:9pt} .card{break-inside:avoid;border:1pt solid #cfc7b6;border-radius:5pt;padding:5pt 7pt;margin:0 0 6pt;background:#fff}
.card h2{font-size:9.6pt;margin:0 0 2pt;display:flex;gap:5pt} .card h2 b{flex:none;background:#1d1a15;color:#fff;border-radius:99pt;min-width:13pt;height:13pt;font-size:7.6pt;line-height:13pt;text-align:center}
.big{background:#fff4d6;border-left:3pt solid #e0a526;padding:2pt 5pt;margin:2pt 0 3pt;font-weight:600}
.card ul{margin:2pt 0 0 12pt;padding:0} .card li{margin:0 0 1pt} .card p{margin:0}
.fig{float:right;width:30%;margin:0 0 2pt 5pt;border:1px solid #ddd6c8;border-radius:3pt}
.terms dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:1pt 6pt} .terms dt{font-weight:700} .terms dd{margin:0}
.mathblock{text-align:center;margin:2pt 0}
"""


def _plain_html(h):
    h = re.sub(r'<sup class="cite">.*?</sup>', '', h, flags=re.S)
    h = re.sub(r'<button type="button" class="term"[^>]*>(.*?)</button>', r'<b>\1</b>', h, flags=re.S)
    return h


def _data_uri(path):
    ext = os.path.splitext(path)[1].lower().lstrip('.') or 'png'
    return f'data:image/{"jpeg" if ext in ("jpg", "jpeg") else ext};base64,' + base64.b64encode(open(path, 'rb').read()).decode()


def build_cheatsheet(notes, figdir, out):
    """One A4 page: per section the big idea + key points (+ the figure thumbnail), then the key terms."""
    m = notes['meta']; ctx = Ctx(notes, 'html'); cards = []
    for s in notes['sections']:          # collect every {{term|definition}} first, wherever it is defined
        for b in s['blocks']: ctx.protect(b[1] if b[0] == 'md' else b[3])
    for s in notes['sections']:
        big = kp = ''; thumb = ''
        for b in s['blocks']:
            if b[0] != 'dir': continue
            if b[1] == 'bigidea' and not big: big = ctx.md(b[3], inline=True)
            if b[1] == 'keypoints' and not kp: kp = ctx.md(b[3])
            if b[1] == 'figure' and not thumb and figdir:
                f = os.path.join(figdir, b[2].get('id', '') + '.png')
                if os.path.exists(f): thumb = f'<img class="fig" src="{_data_uri(f)}" alt="">'
        cards.append(f'<div class="card"><h2><b>{s["n"]}</b>{ctx.md(s["heading"], inline=True)}</h2>{thumb}<div class="big">{big}</div>{kp}</div>')
    terms = sorted(ctx.terms.items(), key=lambda x: x[0].lower())
    if terms:
        cards.append('<div class="card terms"><h2><b>A–Z</b>Key words</h2><dl>' + ''.join(f'<dt>{html.escape(t)}</dt><dd>{html.escape(d)}</dd>' for t, d in terms[:18]) + '</dl></div>')
    title = html.escape(str(m['title']))
    page = (f'<!doctype html><html lang="{m.get("language", "en")}"><head><meta charset="utf-8"><title>{title}: cheat sheet</title><style>{CHEAT_CSS}</style></head>'
            f'<body><div class="top"><h1>{title}</h1><span>Cheat sheet · {html.escape(str(m.get("audience", LEVEL_NAMES.get(m["level"], ""))))}</span></div>'
            f'<div class="cols">{_plain_html("".join(cards))}</div></body></html>')
    open(out, 'w', encoding='utf-8').write(page)
    return out


def build_print(notes, figdir, out_dir, fig_urls, study_url):
    """notes.pdf (the full notes: both depths, figures as pictures with links, answer key, glossary, sources) and the
    one-page cheat sheet as cheatsheet.html / .pdf / .png. Needs Playwright + Chromium."""
    os.makedirs(out_dir, exist_ok=True)
    build_doc(notes, out_dir, fig_urls, study_url, figdir)
    md_text = open(os.path.join(out_dir, 'doc.md'), encoding='utf-8').read()
    ph = []
    def keep(h): ph.append(h); return f'\n\nZZPR{len(ph) - 1}ZZ\n\n'
    md_text = re.sub(r'```latex\n(.*?)\n```', lambda mm: keep(f'<div class="mathblock">{mathml(mm.group(1), True)}</div>'), md_text, flags=re.S)
    def img(mm):
        src = mm.group(2); cand = [src, os.path.join(out_dir, src)]
        f = next((c for c in cand if os.path.exists(c)), None)
        return keep(f'<img src="{_data_uri(f)}" alt="{html.escape(mm.group(1), True)}">') if f else mm.group(0)
    md_text = re.sub(r'!\[([^\]]*)\]\(([^)\s]+)\)', img, md_text)
    body = _md.markdown(md_text, extensions=['tables', 'sane_lists'], output_format='html')
    body = re.sub(r'<p>\s*ZZPR(\d+)ZZ\s*</p>', lambda mm: ph[int(mm.group(1))], body)
    body = re.sub(r'ZZPR(\d+)ZZ', lambda mm: ph[int(mm.group(1))], body)
    m = notes['meta']; title = html.escape(str(m['title']))
    page = f'<!doctype html><html lang="{m.get("language", "en")}"><head><meta charset="utf-8"><title>{title}</title><style>{PRINT_CSS}</style></head><body>{body}</body></html>'
    ph_path = os.path.join(out_dir, 'print.html'); open(ph_path, 'w', encoding='utf-8').write(page)
    cs = build_cheatsheet(notes, figdir, os.path.join(out_dir, 'cheatsheet.html'))
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('WARN playwright missing: wrote print.html and cheatsheet.html only (print them to PDF from a browser)'); return
    foot = '<div style="font:8px Arial;color:#888;width:100%;text-align:center">' + title + ' · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        pg.goto('file://' + os.path.abspath(ph_path)); pg.wait_for_timeout(300)
        pg.pdf(path=os.path.join(out_dir, 'notes.pdf'), format='A4', print_background=True, display_header_footer=True,
               header_template='<span></span>', footer_template=foot, margin={'top': '16mm', 'bottom': '18mm', 'left': '15mm', 'right': '15mm'})
        # cheat sheet: shrink until it fits one A4 page (297 mm minus margins at 96 dpi = ~1054 px tall, 726 px wide)
        pg.set_viewport_size({'width': 726, 'height': 1054}); pg.goto('file://' + os.path.abspath(cs)); pg.wait_for_timeout(200)
        z = 1.0
        while z > .62 and pg.evaluate('document.documentElement.scrollHeight') > 1054:
            z -= .04; pg.evaluate(f'document.body.style.zoom = {z:.2f}')
        if pg.evaluate('document.documentElement.scrollHeight') > 1054: print('WARN cheat sheet runs over one page even at small print: trim key points')
        pg.pdf(path=os.path.join(out_dir, 'cheatsheet.pdf'), format='A4', print_background=True, page_ranges='1-2', margin={'top': '9mm', 'bottom': '9mm', 'left': '9mm', 'right': '9mm'})
        pg.set_viewport_size({'width': 794, 'height': 1123}); pg.evaluate('document.body.style.padding = "34px"')
        pg.screenshot(path=os.path.join(out_dir, 'cheatsheet.png'), full_page=True)
        b.close()
    print(f'wrote {os.path.join(out_dir, "notes.pdf")}, cheatsheet.pdf, cheatsheet.png (cheat sheet print scale {z:.2f})')


# ----------------------------------------------------------------------------------------------- check
def check(notes, figdir):
    errs, warns = [], []
    m = notes['meta']
    if not m.get('title'): errs.append('front matter: no title')
    if not m.get('audience'): warns.append('front matter: no audience line (who the notes are for)')
    if not 1 <= m['level'] <= 5: errs.append('front matter: level must be 1-5')
    if not notes['sections']: errs.append('no "## " sections found')
    if not any(b[0] == 'dir' and b[1] == 'goals' for b in notes['pre']) and not m.get('goals'):
        warns.append('no :::goals block before the first section (learners need a clear finish line)')
    ctx = Ctx(notes, 'html')
    lvc = max(1, min(5, m['level']))
    cap = ({1: 220, 2: 300, 3: 380, 4: 450, 5: 500} if m['focus'] else {1: 220, 2: 350, 3: 700, 4: 900, 5: 1100})[lvc]
    rows = []
    figs_all = []
    for s in notes['sections']:
        names = [b[1] for b in s['blocks'] if b[0] == 'dir']
        ms, me, shared, simple, expert = sec_minutes(s)
        tag = f'section {s["n"]} "{s["heading"]}"'
        if 'bigidea' not in names:
            (errs if m['focus'] or lvc <= 2 else warns).append(f'{tag}: no :::bigidea (one-sentence summary)')
        elif s['blocks'][0][0] != 'dir' or s['blocks'][0][1] != 'bigidea':
            warns.append(f'{tag}: put :::bigidea first, before anything else')
        if 'check' not in names and (m['focus'] or lvc <= 3): warns.append(f'{tag}: no :::check (retrieval practice after every chunk)')
        if ('simple' in names) != ('expert' in names): warns.append(f'{tag}: has :::simple or :::expert but not both')
        if shared + simple > cap: warns.append(f'{tag}: {shared + simple} words in the {m["simple_label"]} view; aim for <= {cap} at level {m["level"]} (split the section)')
        elif m['focus'] and ms > 6: warns.append(f'{tag}: about {ms:.0f} minutes with its figure and questions; aim for <= 6 (split the section or move a question to the next one)')
        for b in s['blocks']:
            if b[0] == 'dir' and b[1] not in KNOWN: warns.append(f'{tag}: unknown directive :::{b[1]}')
            if b[0] == 'dir' and b[1] == 'check':
                for q in parse_check(b[3]):
                    if not q['a'].strip(): errs.append(f'{tag}: question "{q["q"][:50]}" has no A: explanation')
                    if q['opts'] and sum(o['ok'] for o in q['opts']) != 1: errs.append(f'{tag}: question "{q["q"][:50]}" needs exactly one [x] option')
            if b[0] == 'dir' and b[1] == 'figure':
                fid = b[2].get('id')
                if not fid: errs.append(f'{tag}: :::figure without id=')
                else:
                    figs_all.append(fid)
                    if not b[3].strip(): warns.append(f'{tag}: figure {fid} has no "Try this" text (the figure page itself shows no instructions)')
                    if figdir and not os.path.exists(os.path.join(figdir, fid + '.html')): errs.append(f'{tag}: figure {fid}: {os.path.join(figdir, fid + ".html")} not found (build it first)')
            if b[0] == 'dir' and b[1] == 'expert' and m['level'] >= 3 and '[@' not in b[3]:
                warns.append(f'{tag}: the {m["expert_label"]} block cites nothing')
            text = b[1] if b[0] == 'md' else b[3]
            ctx.protect(text)
            if text.count('$$') % 2: errs.append(f'{tag}: unbalanced $$')
        rows.append((s['n'], s['heading'][:44], shared + simple, round(ms, 1), round(me, 1), names.count('figure'), sum(len(parse_check(b[3])) for b in s['blocks'] if b[0] == 'dir' and b[1] == 'check')))
    for k in sorted(ctx.missing_refs): errs.append(f'citation [@{k}] has no entry in :::references')
    for k in notes['ref_order']:
        if k not in ctx.cite_num: warns.append(f'reference {k} is never cited')
        elif not notes['refs'][k]['grade']: warns.append(f'reference {k} has no {{grade=...}}')
        elif notes['refs'][k]['grade'] not in GRADE_LABEL: warns.append(f'reference {k}: grade "{notes["refs"][k]["grade"]}" is not one of {", ".join(GRADE_LABEL)}')
    if len(set(figs_all)) != len(figs_all): errs.append('two :::figure blocks share an id (each figure appears once; to show the same model in another state, build a second page, e.g. pizza-cut4.html, or link to the first with a URL parameter in the Try-this text)')
    if m['level'] >= 3 and len(ctx.cite_num) < 3: warns.append(f'only {len(ctx.cite_num)} sources cited for a level-{m["level"]} set of notes')
    print(f'{"#":>2}  {"section":44}  {"words":>5}  {"min":>4}  {"min+":>4}  fig  q')
    for r in rows: print(f'{r[0]:>2}  {r[1]:44}  {r[2]:>5}  {r[3]:>4}  {r[4]:>4}  {r[5]:>3}  {r[6]}')
    print(f'total: {len(rows)} sections, {sum(r[3] for r in rows):.0f} min ({m["simple_label"]}) / {sum(r[4] for r in rows):.0f} min ({m["expert_label"]}), '
          f'{len(figs_all)} figures, {sum(r[6] for r in rows)} questions, {len(ctx.cite_num)} sources, {len(ctx.terms)} glossary terms')
    for w in warns: print('WARN ', w)
    for e in errs: print('ERROR', e)
    print('OK' if not errs else f'{len(errs)} error(s)')
    return not errs


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cmd', choices=['check', 'study', 'doc', 'print', 'cheatsheet'])
    ap.add_argument('notes')
    ap.add_argument('--figures', default='', help='folder holding built figures <id>.html (and snapshots <id>.png)')
    ap.add_argument('--figure-urls', default='', help='JSON map {figure id: published URL}')
    ap.add_argument('--study-url', default='')
    ap.add_argument('--out', default='study.html')
    ap.add_argument('--out-dir', default='.')
    a = ap.parse_args()
    notes = load(a.notes)
    urls = json.load(open(a.figure_urls)) if a.figure_urls and os.path.exists(a.figure_urls) else {}
    if a.cmd == 'check':
        sys.exit(0 if check(notes, a.figures) else 1)
    if a.cmd == 'study':
        info = build_study(notes, a.figures, urls, a.out)
        print(f'wrote {a.out} ({info["bytes"] // 1024} KB): {len(info["figures"])} figures, {info["questions"]} questions, {info["citations"]} sources, {info["terms"]} terms')
        if info['missing_figures']: print('WARN figures not embedded (not built):', ', '.join(info['missing_figures']))
        if info['missing_refs']: print('WARN citations without a reference:', ', '.join(info['missing_refs']))
    if a.cmd == 'doc':
        d = build_doc(notes, a.out_dir, urls, a.study_url, a.figures)
        print(f'wrote {os.path.join(a.out_dir, "doc.json")} and doc.md: {len(d["sections"])} sections')
    if a.cmd == 'print':
        build_print(notes, a.figures, a.out_dir, urls, a.study_url)
    if a.cmd == 'cheatsheet':
        print('wrote', build_cheatsheet(notes, a.figures, os.path.join(a.out_dir, 'cheatsheet.html')))


if __name__ == '__main__':
    main()
