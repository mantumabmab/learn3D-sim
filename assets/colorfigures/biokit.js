/* ============================================================
   biokit.js: cell and molecule scenes for Colorfigures. Load it right after core.js:
       <script src="core.js"> ... then <script src="biokit.js"> (each with its closing tag)
   (scripts/build_figure.py inlines both.)

   Units: 1 unit = 1 Å. Axes as in core.js: x = depth (front face at large x), y = width, z = up = OUTSIDE the cell.
   The scene assumes the camera looks down on the membrane from outside (the engine's normal pitch range).

   BIO.setMembrane({ z0:70, z1:110, x0:6, x1:76, y0:0, y1:250 })   // inner face, outer face, patch extent
   const S = BIO.scene();                // a layered part list: 0 cytoplasm (z < z0), 1 inside the membrane, 2 outside
     S.rod(a, b, r, mat)                 // helix / rod, split automatically where it crosses the membrane faces
     S.blob(c, [rx, ry, rz], mat, w)     // rounded globular domain (ellipsoid); or S.blob(c, {A, B, Z}, mat) for tilted axes
     S.tube(pts, r, colour)              // loop, linker, tail (a smooth path of points)
     S.bead(p, r, colour)                // atom-scale bead
     S.mol(kind, p, opacity)             // 'atp' 'adp' 'amp' 'camp' 'gtp' 'gdp' 'cgmp' 'pi' 'ppi'
     S.anchor(p, colour)                 // lipid anchor (palmitoyl / myristoyl / prenyl): a squiggle from p into the inner leaflet
     S.put(layer, [min, max], svg)       // anything else, with its bounding box
     S.svg({ xr: k, membrane: .55 })     // assembled drawing; k = see-through 0..1; membrane = its opacity when closed
   BIO.helixRing({ c:[x, y], n:7, r:11, start:210, step:-51.4, zb, zt })  -> [{ i, a:[x,y,zb], b:[x,y,zt] }] in order
   BIO.loop(a, b, lift)                  // a hairpin loop between two helix ends, bulging by `lift` along z
   BIO.run(ui, st, steps, done)          // step animations: [{ dur:1.2, to:{ key: value }, start(st), fn(st, e), end(st) }]
   BIO.COL                               // default colours for the small molecules (override per set)
   Vector helpers: BIO.V.add/sub/mul/lerp, BIO.lerp1, BIO.clamp01, BIO.rad, BIO.boxAround(pts, pad), BIO.qcurve(a, c, b, n), BIO.smooth(pts, it)
   ============================================================ */
'use strict';
const BIO = (() => {
  const M = { z0: 70, z1: 110, x0: 6, x1: 76, y0: 0, y1: 250, head: 8 };
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  };
  const lerp1 = (a, b, t) => a + (b - a) * t, clamp01 = t => Math.max(0, Math.min(1, t)), rad = d => d * Math.PI / 180;
  const boxAround = (pts, pad = 0) => [[Math.min(...pts.map(p => p[0])) - pad, Math.min(...pts.map(p => p[1])) - pad, Math.min(...pts.map(p => p[2])) - pad],
    [Math.max(...pts.map(p => p[0])) + pad, Math.max(...pts.map(p => p[1])) + pad, Math.max(...pts.map(p => p[2])) + pad]];
  const layerOf = z => z > M.z1 + 1 ? 2 : z < M.z0 - 1 ? 0 : 1;
  const qcurve = (a, c, b, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [0, 1, 2].map(k => u * u * a[k] + 2 * u * t * c[k] + t * t * b[k]); });
  const smooth = (pts, it = 3) => { for (let k = 0; k < it; k++){ const o = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++){ const a = pts[i], b = pts[i + 1]; o.push(a.map((v, j) => v * .75 + b[j] * .25), a.map((v, j) => v * .25 + b[j] * .75)); }
      o.push(pts[pts.length - 1]); pts = o; } return pts; };
  const COL = { phos: '#e2483d', atp: '#f8e9a8', adp: '#f3dc8c', amp: '#aaa69e', camp: '#f2c230', gua: '#f6eedb', rib: '#e7d6aa', cgmp: '#9ad0e6', lip: '#6b5a3e', site: '#3b3530' };
  const HEADC = { l: '#f1e0c0', m: '#dcc69f', d: '#b39d77' }, CORE = { l: '#e5cfa4', m: '#cdb387', d: '#a58d63' };

  // ---------- primitives (return SVG strings) ----------
  function bead(p, r, col, w = .8){ const q = P(...p), rr = r * CAM_K;
    return `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f(rr)}" fill="${col}" stroke="${INK}" stroke-width="${w}"/>`
      + `<circle cx="${f(q[0] - rr * .32)}" cy="${f(q[1] - rr * .32)}" r="${f(rr * .34)}" fill="#ffffff" opacity=".45"/>`; }
  function ellip(c, A, B, Z, m, w = 1.8, nLat = 9, nLon = 20){
    const rings = [];
    for (let i = 1; i < nLat; i++){ const ph = Math.PI * i / nLat, cz = Math.cos(ph), sr = Math.sin(ph);
      rings.push(Array.from({ length: nLon }, (_, j) => { const t = 2 * Math.PI * j / nLon, ca = Math.cos(t) * sr, sa = Math.sin(t) * sr;
        return [0, 1, 2].map(k => c[k] + A[k] * ca + B[k] * sa + Z[k] * cz); })); }
    let s = '';
    for (let i = 0; i < rings.length - 1; i++) s += loft(rings[i], rings[i + 1], n => tone(n, m));
    const nT = norm(Z), nB = V.mul(nT, -1);
    if (vis(nT)) s += face(pd(rings[0]), tone(nT, m));
    if (vis(nB)) s += face(pd(rings[rings.length - 1]), tone(nB, m));
    return s + hullInk(rings.flat(), w);
  }
  const axesOf = R => Array.isArray(R) ? [[R[0], 0, 0], [0, R[1], 0], [0, 0, R[2]]] : [R.A, R.B, R.Z];
  const ellipBox = (c, A, B, Z) => { const e = [0, 1, 2].map(k => Math.hypot(A[k], B[k], Z[k])); return [V.add(c, V.mul(e, -1)), V.add(c, e)]; };
  function tube(pts, r, col){ const d = pd(pts, false), w = 2 * r * CAM_K, cap = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';
    return `<path d="${d}" ${cap} stroke="${INK}" style="stroke-width:${f(w + 1.7 * INK_K)}"/><path d="${d}" ${cap} stroke="${col}" style="stroke-width:${f(w)}"/>`
      + `<path d="${d}" ${cap} stroke="#ffffff" opacity=".28" style="stroke-width:${f(w * .32)}"/>`; }
  function squiggle(a, b, col){ const pts = []; for (let i = 0; i <= 6; i++){ const p = V.lerp(a, b, i / 6); pts.push(i % 2 ? V.add(p, [1.2, 1.2, 0]) : p); }
    return `<path d="${pd(pts, false)}" fill="none" stroke="${col || COL.lip}" stroke-width="1.5" stroke-linejoin="round"/>`; }
  const PCH = norm([0, -1, -.45]);
  function mol(kind, p, o = 1){
    const ph = (n, r0) => { let s = ''; for (let i = 1; i <= n; i++) s += bead(V.add(p, V.mul(PCH, r0 + 2.7 * (i - 1) + 1.4)), 1.5, COL.phos, .6); return s; };
    const base = (col, n) => ph(n, 2.6) + bead(p, 2.8, col);
    const gua = n => ph(n, 2.6) + bead(V.add(p, [0, 1.8, 1]), 2.2, COL.rib) + bead(V.add(p, [0, 4.2, 1.9]), 2.7, COL.gua);
    const s = { atp: () => base(COL.atp, 3), adp: () => base(COL.adp, 2), amp: () => base(COL.amp, 1), camp: () => base(COL.camp, 1),
      cgmp: () => base(COL.cgmp, 1), gtp: () => gua(3), gdp: () => gua(2),
      pi: () => bead(p, 1.9, COL.phos, .7), ppi: () => bead(p, 1.5, COL.phos, .6) + bead(V.add(p, V.mul(PCH, 2.8)), 1.5, COL.phos, .6) }[kind];
    if (!s) throw new Error('BIO.mol: unknown kind ' + kind);
    return o >= 1 ? s() : `<g opacity="${f(clamp01(o))}">${s()}</g>`;
  }
  function splitByLayer(a, b){
    const cuts = [0, 1]; for (const zc of [M.z0, M.z1]){ const t = (zc - a[2]) / (b[2] - a[2]); if (t > 0 && t < 1) cuts.push(t); }
    cuts.sort((p, q) => p - q); const out = [];
    for (let i = 0; i < cuts.length - 1; i++){ const p = V.lerp(a, b, cuts[i]), q = V.lerp(a, b, cuts[i + 1]), zm = (p[2] + q[2]) / 2;
      out.push({ layer: zm < M.z0 ? 0 : zm > M.z1 ? 2 : 1, a: p, b: q }); }
    return out;
  }

  // ---------- membrane: head-group bands, tail core, a row of lipid heads along the visible edges ----------
  function membrane(){
    const { x0, x1, y0, y1, z0, z1, head } = M;
    const sides = [
      [[1, 0, 0], (za, zb) => [[x1, y0, za], [x1, y1, za], [x1, y1, zb], [x1, y0, zb]], [[x1, y0], [x1, y1]]],
      [[-1, 0, 0], (za, zb) => [[x0, y1, za], [x0, y0, za], [x0, y0, zb], [x0, y1, zb]], [[x0, y1], [x0, y0]]],
      [[0, 1, 0], (za, zb) => [[x1, y1, za], [x0, y1, za], [x0, y1, zb], [x1, y1, zb]], [[x1, y1], [x0, y1]]],
      [[0, -1, 0], (za, zb) => [[x0, y0, za], [x1, y0, za], [x1, y0, zb], [x0, y0, zb]], [[x0, y0], [x1, y0]]]];
    const bands = [[z0, z0 + head, HEADC], [z0 + head, z1 - head, CORE], [z1 - head, z1, HEADC]];
    let s = '';
    for (const [n, q, e] of sides){ if (!vis(n)) continue;
      for (const [za, zb, m] of bands) s += face(pd(q(za, zb)), tone(n, m));
      const [a, b] = e, len = Math.hypot(b[0] - a[0], b[1] - a[1]), N = Math.max(2, Math.floor(len / 5)); let tl = '';
      for (let i = 1; i < N; i++){ const t = i / N, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
        tl += pd([[px, py, z1 - head], [px, py, z1 - head - 10]], false) + pd([[px, py, z0 + head], [px, py, z0 + head + 10]], false); }
      s += `<path d="${tl}" fill="none" stroke="${CORE.d}" stroke-width=".7" opacity=".6"/>` + ink(pd(q(z0, z1)), 1.3);
    }
    const top = [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    s += face(pd(top), tone([0, 0, 1], HEADC)) + ink(pd(top), 1.3);
    const hb = p => { const q = P(...p), rr = 2.3 * CAM_K; return `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f(rr)}" fill="${HEADC.l}" stroke="${INK}" stroke-width=".55"/>`; };
    for (const [n, , e] of sides){ if (!vis(n)) continue;
      const [a, b] = e, len = Math.hypot(b[0] - a[0], b[1] - a[1]), N = Math.max(2, Math.floor(len / 5));
      for (let i = 0; i <= N; i++){ const t = i / N, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t; s += hb([px, py, z1 - 2.3]) + hb([px, py, z0 + 2.3]); } }
    const corners = []; for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) corners.push([x, y, z]);
    return s + hullInk(corners, 2.4);
  }

  // ---------- layered scene ----------
  function scene(){
    const LY = [[], [], []];
    const put = (layer, box, svg) => { LY[layer].push({ box, svg }); };
    const S = {
      put,
      rod(a, b, r, m, w = 1.1){ for (const pc of splitByLayer(a, b)) put(pc.layer, boxAround([pc.a, pc.b], r), rod(pc.a, pc.b, r, m, tone, w, r, 14)); },
      blob(c, R, m, w = 1.8){ const [A, B, Z] = axesOf(R); put(layerOf(c[2]), ellipBox(c, A, B, Z), ellip(c, A, B, Z, m, w)); },
      tube(pts, r, col){ // long tubes are cut into short pieces so each piece sorts on its own
        for (let i = 0; i < pts.length - 1; i += 3){ const pc = pts.slice(i, i + 4); const zm = pc.reduce((a, p) => a + p[2], 0) / pc.length; put(layerOf(zm), boxAround(pc, r), tube(pc, r, col)); } },
      bead(p, r, col){ put(layerOf(p[2]), boxAround([p], r), bead(p, r, col)); },
      mol(kind, p, o = 1){ put(layerOf(p[2]), boxAround([p], 4), mol(kind, p, o)); },
      anchor(p, col){ const a = [p[0], p[1], M.z0], b = [p[0], p[1], M.z0 + 9]; put(0, boxAround([p, a], 1), squiggle(p, a, col)); put(1, boxAround([a, b], 1), squiggle(a, b, col)); },
      svg(o = {}){ const k = clamp01(o.xr || 0), base = o.membrane ?? .55, mem = membrane();
        let s = byDepth(LY[0]) + byDepth(LY[1]);                                          // cytoplasm, then what is inside the membrane
        s += `<g opacity="${f(base * (1 - .8 * k))}">${mem}</g>`;                        // the membrane over it, translucent
        if (k > 0) s += `<g opacity="${f(k)}">${byDepth(LY[1])}</g>`;                     // see-through: membrane parts drawn crisp on top
        return s + byDepth(LY[2]); },
    };
    return S;
  }

  // ---------- helpers for proteins ----------
  function helixRing({ c, n = 7, r = 11, start = 210, step, zb, zt }){
    const st = step ?? -360 / n;
    return Array.from({ length: n }, (_, i) => { const th = rad(start + st * i), x = c[0] + r * Math.cos(th), y = c[1] + r * Math.sin(th);
      return { i: i + 1, a: [x, y, zb], b: [x, y, zt] }; });
  }
  const loop = (a, b, lift = 8) => qcurve(a, V.add(V.lerp(a, b, .5), [0, 0, lift]), b, 8);

  // ---------- step runner: ease state keys over time, one step after another; refuses while busy ----------
  function run(ui, st, steps, done){
    st.busy = true; st.runId = (st.runId || 0) + 1; const id = st.runId; let i = 0, t = 0, from = null;
    const begin = () => { const s = steps[i]; from = {}; if (s.start) s.start(st); if (s.to) for (const key in s.to) from[key] = st[key]; };
    begin();
    ui.animate(dt => {
      if (st.runId !== id) return false;
      const s = steps[i]; t += dt; const e = s.dur ? Math.min(1, t / s.dur) : 1, ee = ease(e);
      if (s.to) for (const key in s.to) st[key] = lerp1(from[key], s.to[key], ee);
      if (s.fn) s.fn(st, e);
      if (e >= 1){ if (s.end) s.end(st); i++; t = 0; if (i >= steps.length){ st.busy = false; if (done) done(st); return false; } begin(); }
      return true; });
  }

  return { M, setMembrane: o => Object.assign(M, o), V, lerp1, clamp01, rad, boxAround, layerOf, qcurve, smooth, COL,
    bead, ellip, ellipBox, tube, mol, squiggle, membrane, splitByLayer, scene, helixRing, loop, run };
})();
