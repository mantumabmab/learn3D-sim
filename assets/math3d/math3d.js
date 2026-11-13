/* ============================================================
   math3d.js: small dependency-free engine for rotatable 3D maths figures (surfaces, 3D bars, points, curves,
   vectors, slicing planes), drawn on a canvas in the same paper-and-ink look as Colorfigures.
   A figure page loads this file (scripts/build_math3d.py inlines it) and calls mountMath3D({...}).

   mountMath3D({
     fig:'02', title:'Joint distribution of two dice',
     domain:{ x:[0,7], y:[0,7], z:[0,0.2] },       // data ranges shown in the box (z is up)
     aspect:[1,1,0.7],                              // relative box lengths (x, y, z)
     axes:{ x:'First die', y:'Second die', z:'P', ticks:{ x:[1,2,3,4,5,6], y:[1,2,3,4,5,6] }, fmt:{ z: v => v.toFixed(2) } },
     view:{ yaw:-38, pitch:26 },                    // degrees; flat:true locks the camera (2D plots: yaw 0, pitch 0)
     state:{ n:0 },
     params:[{ key:'rho', label:'Correlation ρ', min:-0.9, max:0.9, step:0.05, value:0, fmt:v=>v.toFixed(2) }],
     buttons:[{ label:'Roll 100 times', onClick(st, ui){ ... ui.render(); } }],
     stats: st => [{ label:'Rolls', value: st.n }],
     scene(st, g){ g.surface(...); g.bars(...); g.points(...); g.curve(...); g.arrow(...); g.plane(...); g.label(...); },
     params_url(st, q){}                            // optional: read extra URL params for screenshot states
   }) -> ui = { st, render(), animate(step), flash(text) }

   Scene helpers (all coordinates in DATA units):
     g.surface(f(x,y), { n:36, color:'height'|'#hex', mesh:true, opacity:1, x:[a,b], y:[a,b], clipZ:true })
     g.bars([{ x, y, h, w:0.8, d:0.8, color, label }], { base:0 })
     g.points([[x,y,z], ...], { r:3.2, color, top:false })      // top:true = always drawn over the surface
     g.curve(t => [x,y,z], { t:[0,1], n:120, color, width:2.4, dash:false, top:false })
     g.line([x,y,z], [x,y,z], { color, width, dash })
     g.arrow([x,y,z], [x,y,z], { color, width:2.6, label })
     g.plane({ z:0.1 } | { x:2 } | { y:3 }, { color, opacity:.28, label })
     g.poly([[x,y,z], ...], { color, opacity, ink:true })      // any flat convex polygon
     g.label([x,y,z], 'TEXT', { color, dx, dy, bold })
   Colours: PAL = { ink, paper, accent:'#e2483d', blue:'#3d63b8', teal:'#2f8f86', mustard:'#e0a526', plum:'#8a4f9e' },
   ramp(t) gives the height colour for t in 0..1.
   ============================================================ */
'use strict';
const PAL = { ink:'#231e16', paper:'#f2efe7', muted:'#857d6e', rule:'#ddd6c8', accent:'#e2483d', blue:'#3d63b8', teal:'#2f8f86', mustard:'#e0a526', plum:'#8a4f9e', green:'#43a35c' };
addEventListener('error', e => { document.documentElement.dataset.errors = (document.documentElement.dataset.errors || '') + ' ' + e.message + ';'; });

const M3_STOPS = [[0, [246, 226, 160]], [.35, [233, 160, 92]], [.65, [196, 84, 92]], [1, [86, 52, 120]]];
function ramp(t){ t = Math.max(0, Math.min(1, t)); for (let i = 1; i < M3_STOPS.length; i++){ const [b, cb] = M3_STOPS[i], [a, ca] = M3_STOPS[i - 1];
  if (t <= b){ const u = (t - a) / (b - a); return ca.map((v, k) => Math.round(v + (cb[k] - v) * u)); } } return M3_STOPS[M3_STOPS.length - 1][1]; }
const m3hex = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const m3rgb = (c, k = 1, a = 1) => `rgba(${c.map(v => Math.round(Math.max(0, Math.min(255, v * k)))).join(',')},${a})`;

function mountMath3D(cfg){
  document.title = cfg.title;
  const css = document.createElement('style'); css.textContent = `
  :root{--paper:#f2efe7;--ink:#231e16;--muted:#857d6e;--rule:#ddd6c8}
  *{box-sizing:border-box} html,body{margin:0}
  body{background:var(--paper);color:var(--ink);font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;display:flex;flex-direction:column;align-items:center;padding:20px 16px 26px}
  header{width:100%;max-width:760px} header h1{font-size:13px;font-weight:600;margin:0 0 8px;letter-spacing:.02em}
  .m3stage{position:relative;width:100%;max-width:760px}
  #m3c{width:100%;aspect-ratio:4/3;display:block;touch-action:none;cursor:grab;border-radius:6px}
  #m3c.drag{cursor:grabbing} .flat #m3c{cursor:default}
  .m3btns{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 8px;width:100%;max-width:760px}
  button{font:inherit;color:var(--ink);background:var(--paper);border:1.5px solid var(--ink);border-radius:999px;padding:5px 14px;cursor:pointer}
  button:hover{background:#0000000d} button:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
  button.main{box-shadow:2px 2px 0 var(--ink)} button:disabled{opacity:.45;cursor:default}
  .m3stats{position:absolute;top:6px;right:8px;display:flex;flex-direction:column;align-items:flex-end;gap:8px;text-align:right;pointer-events:none}
  .m3stats .k{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
  .m3stats .v{font-size:26px;font-weight:800;line-height:1.05;font-variant-numeric:tabular-nums}
  .m3ctl{width:100%;max-width:760px;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px 26px;border-top:1px solid var(--rule);padding-top:12px;margin-top:8px}
  .m3ctl label{display:flex;justify-content:space-between;color:var(--muted);font-size:11px;letter-spacing:.08em;text-transform:uppercase}
  .m3ctl label b{color:var(--ink);font-variant-numeric:tabular-nums}
  .m3ctl input{width:100%;accent-color:var(--ink)}
  .m3views{display:flex;gap:6px;flex-wrap:wrap;align-items:end}
  .m3toast{position:absolute;left:50%;top:8px;transform:translateX(-50%);background:#fff1bf;border:1px solid rgba(35,30,22,.28);border-radius:8px;padding:6px 12px;opacity:0;transition:opacity .2s;pointer-events:none;max-width:86%}
  .m3toast.show{opacity:1}
  @media (max-width:560px){body{padding:12px 10px 20px} header{display:none} #m3c{aspect-ratio:1/1} .m3stats{position:static;flex-direction:row;flex-wrap:wrap;justify-content:flex-end;gap:6px 18px;margin-bottom:2px} .m3stats .v{font-size:19px}}`;
  document.head.appendChild(css);
  document.body.innerHTML = `<header><h1>Fig. ${cfg.fig || ''} — ${cfg.title}</h1></header>
    <div class="m3btns" id="m3b"></div>
    <div class="m3stage${cfg.view && cfg.view.flat ? ' flat' : ''}"><canvas id="m3c" role="img" aria-label="${cfg.title}"></canvas><div class="m3stats" id="m3s" aria-live="polite"></div><div class="m3toast" id="m3t"></div></div>
    <div class="m3ctl" id="m3p"></div>`;
  const cv = document.getElementById('m3c'), cx = cv.getContext('2d');
  const q = new URLSearchParams(location.search);
  const st = Object.assign({}, cfg.state || {});
  for (const p of cfg.params || []) st[p.key] = q.has(p.key) ? +q.get(p.key) : p.value;
  const v0 = Object.assign({ yaw: -38, pitch: 26 }, cfg.view || {});
  let yaw = q.has('yaw') ? +q.get('yaw') : v0.yaw, pitch = q.has('pitch') ? +q.get('pitch') : v0.pitch, zoom = 1;
  const D = Object.assign({ x: [0, 1], y: [0, 1], z: [0, 1] }, cfg.domain || {}), AS = cfg.aspect || [1, 1, .75];
  const W = () => cv.clientWidth, H = () => cv.clientHeight;
  const norm = (p) => [((p[0] - D.x[0]) / (D.x[1] - D.x[0]) - .5) * 2 * AS[0], ((p[1] - D.y[0]) / (D.y[1] - D.y[0]) - .5) * 2 * AS[1], ((p[2] - D.z[0]) / (D.z[1] - D.z[0]) - .5) * 2 * AS[2]];
  function cam(){ const a = yaw * Math.PI / 180, b = pitch * Math.PI / 180; return { ca: Math.cos(a), sa: Math.sin(a), cb: Math.cos(b), sb: Math.sin(b) }; }
  let C = cam(), S = 1, OX = 0, OY = 0;
  // world (normalised) -> screen. x right, y into the screen, z up; yaw turns about z, pitch tilts toward the viewer.
  const rot = (w) => { const x1 = w[0] * C.ca - w[1] * C.sa, y1 = w[0] * C.sa + w[1] * C.ca; return [x1, y1 * C.sb + w[2] * C.cb, y1 * C.cb - w[2] * C.sb]; };
  const proj = (p) => { const r = rot(norm(p)); return [OX + r[0] * S, OY - r[1] * S, r[2]]; };   // r[2]: bigger = further away
  const lightDir = () => { const l = [-.45, -.55, .7], n = Math.hypot(...l); return l.map(v => v / n); };
  function frame(){
    const dpr = Math.min(2.5, devicePixelRatio || 1); cv.width = Math.round(W() * dpr); cv.height = Math.round(H() * dpr); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    C = cam(); let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]){ const r = rot([sx * AS[0], sy * AS[1], sz * AS[2]]); mnx = Math.min(mnx, r[0]); mxx = Math.max(mxx, r[0]); mny = Math.min(mny, r[1]); mxy = Math.max(mxy, r[1]); }
    const padX = Math.min(64, W() * .1), padY = Math.min(54, H() * .09); S = Math.min((W() - 2 * padX) / (mxx - mnx), (H() - 2 * padY) / (mxy - mny)) * zoom;
    OX = W() / 2 - (mxx + mnx) / 2 * S; OY = H() / 2 + (mxy + mny) / 2 * S + 6;
  }
  // ---------- scene graph: everything becomes items {z, draw()} sorted far -> near ----------
  let items = [];
  const L = lightDir();
  const shadeOf = (n, base) => { let d = n[0] * L[0] + n[1] * L[1] + n[2] * L[2]; const k = .72 + .38 * Math.abs(d); return m3rgb(base, k); };
  const nrm = (a, b, c) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1; return n.map(x => x / l); };
  function polyItem(pts3, fill, opt = {}){
    const sp = pts3.map(proj), z = sp.reduce((a, p) => a + p[2], 0) / sp.length + (opt.bias || 0);
    items.push({ z, draw(){ cx.beginPath(); sp.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])); cx.closePath();
      cx.globalAlpha = opt.opacity ?? 1; cx.fillStyle = fill; cx.fill(); cx.globalAlpha = 1;
      if (opt.ink !== false){ cx.strokeStyle = opt.stroke || 'rgba(35,30,22,.55)'; cx.lineWidth = opt.lw || .7; cx.lineJoin = 'round'; cx.stroke(); } } });
  }
  const g = {
    surface(f, o = {}){
      const n = o.n || 36, xr = o.x || D.x, yr = o.y || D.y, P = [];
      for (let i = 0; i <= n; i++){ P.push([]); for (let j = 0; j <= n; j++){ const x = xr[0] + (xr[1] - xr[0]) * i / n, y = yr[0] + (yr[1] - yr[0]) * j / n; let z = f(x, y); if (!isFinite(z)) z = D.z[0]; if (o.clipZ !== false) z = Math.max(D.z[0], Math.min(D.z[1], z)); P[i].push([x, y, z]); } }
      const base = o.color && o.color !== 'height' ? m3hex(o.color) : null;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++){
        const q4 = [P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1]], zz = (q4[0][2] + q4[1][2] + q4[2][2] + q4[3][2]) / 4;
        const c = base || ramp((zz - D.z[0]) / (D.z[1] - D.z[0])), nn = nrm(norm(q4[0]), norm(q4[1]), norm(q4[2]));
        polyItem(q4, shadeOf(nn, c), { opacity: o.opacity ?? 1, lw: o.mesh === false ? 0.01 : .45, stroke: o.mesh === false ? m3rgb(c, .9) : 'rgba(35,30,22,.35)' });
      }
    },
    bars(list, o = {}){
      for (const b of list){ const w = (b.w ?? .8) / 2, d = (b.d ?? .8) / 2, z0 = o.base ?? D.z[0], z1 = z0 + b.h, c = m3hex(b.color || PAL.teal);
        const x0 = b.x - w, x1 = b.x + w, y0 = b.y - d, y1 = b.y + d;
        const faces = [ [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]],
          [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] ];
        // one item per bar (its faces drawn far to near inside it) so bars never interleave wrongly
        const sp = faces.map(f => f.map(proj)), cz = proj([b.x, b.y, (z0 + z1) / 2])[2];
        const ord = sp.map((f, i) => [f.reduce((a, p) => a + p[2], 0) / 4, i]).sort((a, b2) => b2[0] - a[0]);
        items.push({ z: cz, draw(){ for (const [, i] of ord){ const f = sp[i], nn = nrm(...faces[i].slice(0, 3).map(norm)); cx.beginPath(); f.forEach((p, k) => k ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])); cx.closePath();
          cx.fillStyle = shadeOf(nn, c); cx.globalAlpha = b.opacity ?? 1; cx.fill(); cx.globalAlpha = 1; cx.strokeStyle = PAL.ink; cx.lineWidth = 1.1; cx.lineJoin = 'round'; cx.stroke(); }
          if (b.label){ const t = proj([b.x, b.y, z1]); txt(b.label, t[0], t[1] - 8, { size: 11, bold: true }); } } });
      }
    },
    points(list, o = {}){ const c = o.color || PAL.blue, r = o.r || 3.2;
      for (const p of list){ const s = proj(p); items.push({ z: o.top ? -9e3 : s[2] - .001, draw(){ cx.beginPath(); cx.arc(s[0], s[1], r, 0, 7); cx.fillStyle = p[3] || c; cx.globalAlpha = o.opacity ?? .9; cx.fill(); cx.globalAlpha = 1; cx.lineWidth = .8; cx.strokeStyle = PAL.ink; cx.stroke(); } }); } },
    line(a, b, o = {}){ seg(a, b, o); },
    curve(f, o = {}){ const t = o.t || [0, 1], n = o.n || 120; let prev = f(t[0]); for (let i = 1; i <= n; i++){ const p = f(t[0] + (t[1] - t[0]) * i / n); seg(prev, p, o); prev = p; } },
    arrow(a, b, o = {}){ seg(a, b, Object.assign({ width: 2.6 }, o)); const s = proj(b), s0 = proj(a), ang = Math.atan2(s[1] - s0[1], s[0] - s0[0]), c = o.color || PAL.accent;
      items.push({ z: s[2] - .01, draw(){ cx.beginPath(); cx.moveTo(s[0], s[1]); cx.lineTo(s[0] - 11 * Math.cos(ang - .4), s[1] - 11 * Math.sin(ang - .4)); cx.lineTo(s[0] - 11 * Math.cos(ang + .4), s[1] - 11 * Math.sin(ang + .4)); cx.closePath(); cx.fillStyle = c; cx.fill(); cx.strokeStyle = PAL.ink; cx.lineWidth = .9; cx.stroke();
        if (o.label) txt(o.label, s[0] + 8 * Math.cos(ang), s[1] + 8 * Math.sin(ang) - 6, { color: c, bold: true }); } }); },
    plane(where, o = {}){ const c = o.color || PAL.blue; let P;
      if ('z' in where) P = [[D.x[0], D.y[0], where.z], [D.x[1], D.y[0], where.z], [D.x[1], D.y[1], where.z], [D.x[0], D.y[1], where.z]];
      else if ('x' in where) P = [[where.x, D.y[0], D.z[0]], [where.x, D.y[1], D.z[0]], [where.x, D.y[1], D.z[1]], [where.x, D.y[0], D.z[1]]];
      else P = [[D.x[0], where.y, D.z[0]], [D.x[1], where.y, D.z[0]], [D.x[1], where.y, D.z[1]], [D.x[0], where.y, D.z[1]]];
      // a plane spans the box: drawn in a band of strips so surfaces in front and behind sort correctly
      const k = 10; for (let i = 0; i < k; i++){ const a = i / k, b = (i + 1) / k, lerp = (p, q2, t) => p.map((v, j) => v + (q2[j] - v) * t);
        const s = [lerp(P[0], P[1], a), lerp(P[0], P[1], b), lerp(P[3], P[2], b), lerp(P[3], P[2], a)]; polyItem(s, c, { opacity: o.opacity ?? .26, ink: false }); }
      const e = P.map(proj); items.push({ z: -1e3, draw(){ cx.beginPath(); e.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])); cx.closePath(); cx.strokeStyle = c; cx.lineWidth = 1.4; cx.setLineDash([5, 4]); cx.stroke(); cx.setLineDash([]);
        if (o.label){ txt(o.label, e[1][0] + 6, e[1][1], { color: c, bold: true, align: 'left' }); } } }); },
    poly(pts, o = {}){ polyItem(pts, o.color || PAL.mustard, o); },
    label(p, t, o = {}){ const s = proj(p); items.push({ z: -1e4, draw(){ txt(t, s[0] + (o.dx || 0), s[1] + (o.dy || 0), o); } }); },
  };
  function seg(a, b, o){ const s0 = proj(a), s1 = proj(b), c = o.color || PAL.ink;
    items.push({ z: o.top ? -8e3 : (s0[2] + s1[2]) / 2 - .002, draw(){ cx.beginPath(); cx.moveTo(s0[0], s0[1]); cx.lineTo(s1[0], s1[1]); cx.strokeStyle = c; cx.lineWidth = o.width || 2.2; cx.lineCap = 'round'; if (o.dash) cx.setLineDash([6, 5]); cx.stroke(); cx.setLineDash([]); } }); }
  function txt(t, x, y, o = {}){ cx.font = `${o.bold ? 700 : 500} ${o.size || 12}px ui-monospace,SFMono-Regular,Menlo,monospace`; cx.textAlign = o.align || 'center'; cx.textBaseline = 'middle';
    cx.lineWidth = 4; cx.strokeStyle = 'rgba(242,239,231,.9)'; cx.strokeText(t, x, y); cx.fillStyle = o.color || PAL.ink; cx.fillText(t, x, y); }
  // ---------- axes box: floor grid, the three back walls' edges, ticks and names ----------
  const nice = (a, b, n = 5) => { const span = b - a, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0))), r = step0 / mag, step = (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
    const out = []; for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10)); return out; };
  function axes(){
    const A = cfg.axes || {}, fmt = Object.assign({ x: v => +v.toFixed(3) + '', y: v => +v.toFixed(3) + '', z: v => +v.toFixed(3) + '' }, A.fmt || {});
    const T = { x: (A.ticks && A.ticks.x) || nice(...D.x), y: (A.ticks && A.ticks.y) || nice(...D.y), z: (A.ticks && A.ticks.z) || nice(...D.z, 4) };
    const z0 = D.z[0], flat = cfg.view && cfg.view.flat;
    // floor + grid (far from everything)
    const fl = [[D.x[0], D.y[0], z0], [D.x[1], D.y[0], z0], [D.x[1], D.y[1], z0], [D.x[0], D.y[1], z0]].map(proj);
    items.push({ z: 1e4, draw(){ if (!flat){ cx.beginPath(); fl.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])); cx.closePath(); cx.fillStyle = 'rgba(35,30,22,.045)'; cx.fill(); }
      cx.strokeStyle = 'rgba(35,30,22,.16)'; cx.lineWidth = 1;
      if (!flat){ for (const x of T.x){ const a = proj([x, D.y[0], z0]), b = proj([x, D.y[1], z0]); cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke(); }
        for (const y of T.y){ const a = proj([D.x[0], y, z0]), b = proj([D.x[1], y, z0]); cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke(); } }
      // back vertical wall grid lines for z: choose the far corner
      const far = farCorner(); for (const z of T.z){ const a = proj([far[0], D.y[0], z]), b = proj([far[0], D.y[1], z]), c2 = proj([D.x[0], far[1], z]), d = proj([D.x[1], far[1], z]);
        cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.moveTo(c2[0], c2[1]); cx.lineTo(d[0], d[1]); cx.stroke(); } } });
    // axis lines + labels (drawn on top)
    items.push({ z: -1e5, draw(){
      const far = farCorner(), near = [far[0] === D.x[0] ? D.x[1] : D.x[0], far[1] === D.y[0] ? D.y[1] : D.y[0]];
      cx.strokeStyle = PAL.ink; cx.lineWidth = 1.5;
      const xa = [proj([D.x[0], near[1], z0]), proj([D.x[1], near[1], z0])], ya = [proj([near[0], D.y[0], z0]), proj([near[0], D.y[1], z0])], za = [proj([far[0], near[1], D.z[0]]), proj([far[0], near[1], D.z[1]])];
      for (const [a, b] of flat ? [xa, za] : [xa, ya, za]){ cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke(); }
      const tk = (p, t, dx, dy) => txt(t, p[0] + dx, p[1] + dy, { size: 11, color: PAL.muted });
      const out = (a, b) => { const mx = (a[0] + b[0]) / 2 - OX, my = (a[1] + b[1]) / 2 - OY, l = Math.hypot(mx, my) || 1; return [mx / l, my / l]; };
      const ox = out(xa[0], xa[1]); for (const x of T.x){ const p = proj([x, near[1], z0]); tk(p, fmt.x(x), ox[0] * 16, ox[1] * 16); }
      if (!flat){ const oy = out(ya[0], ya[1]); for (const y of T.y){ const p = proj([near[0], y, z0]); tk(p, fmt.y(y), oy[0] * 16, oy[1] * 16); } }
      for (const z of T.z){ const p = proj([far[0], near[1], z]); tk(p, fmt.z(z), (p[0] < OX ? -1 : 1) * 20, 0); }
      const nm = (t, a, b, o2, k = 34) => { if (!t) return; const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; txt(t, m[0] + o2[0] * k, m[1] + o2[1] * k, { bold: true, size: 12 }); };
      nm(A.x, xa[0], xa[1], ox); if (!flat) nm(A.y, ya[0], ya[1], out(ya[0], ya[1]));
      if (A.z){ const p = proj([far[0], near[1], D.z[1]]); txt(A.z, p[0], p[1] - 16, { bold: true, size: 12 }); }
    } });
  }
  function farCorner(){ let best = null, bz = -1e9; for (const x of D.x) for (const y of D.y){ const z = proj([x, y, D.z[0]])[2]; if (z > bz){ bz = z; best = [x, y]; } } return best; }
  // ---------- page parts ----------
  const ui = { st, render: () => draw(), flash, animate };
  function draw(){
    frame(); items = []; cx.clearRect(0, 0, W(), H());
    try { axes(); cfg.scene(st, g, ui); } catch (e) { document.documentElement.dataset.errors = (document.documentElement.dataset.errors || '') + ' ' + e.message + ';'; throw e; }
    items.sort((a, b) => b.z - a.z); for (const it of items) it.draw();
    const s = document.getElementById('m3s'); s.innerHTML = cfg.stats ? cfg.stats(st).map(x => `<div class="stat"><div class="k">${x.label}</div><div class="v">${x.value}</div></div>`).join('') : '';
    for (const p of cfg.params || []){ const o = document.getElementById('m3o-' + p.key); if (o) o.textContent = p.fmt ? p.fmt(st[p.key]) : st[p.key]; }
    for (const b of cfg.buttons || []) if (b.disabled && b._el) b._el.disabled = !!b.disabled(st);
  }
  let tt = 0; function flash(t, ms = 1800){ const el = document.getElementById('m3t'); el.textContent = t; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), ms); }
  let anim = null; function animate(step){ anim = step; let last = performance.now(); const go = now => { if (anim !== step) return; const dt = Math.min(.05, (now - last) / 1000); last = now; const more = step(dt); draw(); if (more) requestAnimationFrame(go); else anim = null; }; requestAnimationFrame(go); }
  const bwrap = document.getElementById('m3b');
  for (const b of cfg.buttons || []){ const el = document.createElement('button'); el.className = 'main'; el.textContent = b.label; el.onclick = () => { b.onClick(st, ui); draw(); }; b._el = el; bwrap.appendChild(el); }
  const pw = document.getElementById('m3p');
  for (const p of cfg.params || []){ const d = document.createElement('div'); const id = 'm3i-' + p.key;
    d.innerHTML = `<label for="${id}"><span>${p.label}</span><b id="m3o-${p.key}"></b></label><input type="range" id="${id}" min="${p.min}" max="${p.max}" step="${p.step || (p.max - p.min) / 100}" value="${st[p.key]}">`;
    d.querySelector('input').addEventListener('input', e => { st[p.key] = +e.target.value; if (p.onChange) p.onChange(st, ui); draw(); }); pw.appendChild(d); }
  const vw = document.createElement('div'); vw.className = 'm3views';
  if (!(cfg.view && cfg.view.flat)){
    for (const [lbl, y, p] of [['Reset view', v0.yaw, v0.pitch], ['From above', 0, 89], ['Side on', 0, 0]]){ const b = document.createElement('button'); b.textContent = lbl; b.onclick = () => { yaw = y; pitch = p; zoom = 1; draw(); }; vw.appendChild(b); }
    const turn = document.createElement('button'); turn.textContent = 'Turntable'; turn.setAttribute('aria-pressed', 'false');
    let spinning = false; turn.onclick = () => { spinning = !spinning; turn.setAttribute('aria-pressed', spinning); if (spinning){ const spin = () => { if (!spinning) return; yaw += .4; draw(); requestAnimationFrame(spin); }; spin(); } };
    vw.appendChild(turn);
  }
  pw.appendChild(vw);
  if (cfg.params_url) cfg.params_url(st, q);
  // drag to turn, ctrl/cmd + wheel or pinch to zoom; arrow keys turn too
  if (!(cfg.view && cfg.view.flat)){
    const pts = new Map(); let pinch = 0;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); cv.classList.add('drag'); });
    cv.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; const [px, py] = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2){ const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) zoom = Math.max(.6, Math.min(3, zoom * d / pinch)); pinch = d; draw(); return; }
      yaw -= (e.clientX - px) * .45; pitch = Math.max(-5, Math.min(89, pitch + (e.clientY - py) * .35)); draw(); });
    const up = e => { pts.delete(e.pointerId); pinch = 0; if (!pts.size) cv.classList.remove('drag'); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoom = Math.max(.6, Math.min(3, zoom * Math.exp(-e.deltaY * .004))); draw(); }, { passive: false });
    cv.tabIndex = 0; cv.addEventListener('keydown', e => { const k = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, 4], ArrowDown: [0, -4] }[e.key]; if (!k) return; e.preventDefault(); yaw += k[0]; pitch = Math.max(-5, Math.min(89, pitch + k[1])); draw(); });
  }
  addEventListener('resize', draw);
  window.__st = st; window.__ui = ui;
  draw(); if (cfg.onMount) cfg.onMount(st, ui);
  return ui;
}
