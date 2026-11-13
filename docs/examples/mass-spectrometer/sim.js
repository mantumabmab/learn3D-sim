/* Mass spectrometer simulation.
   Physics verified against scipy before this file was written:
     Mathieu apex  q = 0.70600, a = 0.23699   (direct trajectory integration)
     q intercept at a = 0       q = 0.90805
     TOF, sector and Orbitrap   all reproduce the sqrt(m) / 1/sqrt(m) scalings
*/
(function () {
'use strict';

var E  = 1.602176634e-19;        // C,  SI defining constant
var U  = 1.66053906892e-27;      // kg, CODATA 2022

var A_APEX = 0.23699, Q_APEX = 0.70600;
var SCAN_SLOPE = A_APEX / Q_APEX;

/* ---------------------------------------------------------------- the sample
   Chlorobenzene EI fragment set. The m/z values are exact nominal masses and
   the 112:114 ratio is the verified 35-Cl/37-Cl abundance ratio; the other
   relative intensities are schematic, chosen to make the spectrum legible. */
var SAMPLE = [
  { mz:  51, rel: 0.22, lab: 'C₄H₃⁺',        col: '#b9770e' },
  { mz:  77, rel: 1.00, lab: 'C₆H₅⁺',        col: '#1f6f8b' },
  { mz: 112, rel: 0.78, lab: 'M⁺• (³⁵Cl)', col: '#2e7d4f' },
  { mz: 114, rel: 0.25, lab: 'M⁺• (³⁷Cl)', col: '#7d4f9c' }
];

/* ------------------------------------------------------------------- state */
var P = {
  analyser: 'quad',
  V: 4000,          // accelerating voltage, V      (sector, TOF)
  B: 0.35,          // flux density, T              (sector)
  res: 0.010,       // 1 - (slope / apex slope)     (quadrupole)
  scanning: false,  // park on one m/z, or sweep the whole range
  park: 77,         // the m/z the filter is parked on
  ncyc: 18,         // RF cycles across the rods    (quadrupole, display only)
  L: 1.0,           // flight tube, m               (TOF)
  mirror: true,     // reflectron on                (TOF)
  spread: 8,        // initial energy spread, eV    (TOF)
  trans: 64,        // transient length, ms         (Orbitrap)
  run: true,
  speed: 1
};

var az = -0.62, el = 0.40;
var t = 0;                 // scene time, arbitrary units
var scan = 0;              // 0..1 progress of a scanning analyser
var ions = [];             // live particles
var spectrum = [];         // {mz, h} accumulated at the detector
var transient = null;      // Orbitrap image current

var cv, ctx, W, H, sv, sx, SW, SH;

/* ------------------------------------------------------------- projection */
/* Each analyser occupies a different part of the scene box, so the view is
   centred and scaled per analyser rather than globally. */
var VIEW = {
  sector: { cx: -0.45, cz: 0.30, span: 0.78, az: -0.40, el: 1.00 },
  quad:   { cx: -0.22, cz: 0.00, span: 0.90, az: -0.62, el: 0.40 },
  tof:    { cx: -0.16, cz: 0.00, span: 1.02, az: -0.62, el: 0.40 },
  orbi:   { cx:  0.00, cz: 0.00, span: 0.80, az: -0.62, el: 0.34 }
};
function proj(x, y, z) {
  var v = VIEW[P.analyser];
  var ca = Math.cos(az), sa = Math.sin(az);
  var xx = x - v.cx, zz = z - v.cz;
  var X = xx * ca - zz * sa, Z = xx * sa + zz * ca;
  var ce = Math.cos(el), se = Math.sin(el);
  var sy = -(y * ce - Z * se);
  var d  = Z * ce + y * se;
  var sc = Math.min(W * 0.46, H * 0.88) / v.span;
  return { x: W / 2 + X * sc, y: H * 0.54 + sy * sc, d: d };
}

/* ------------------------------------------------------------ draw helpers */
var bag;
function push(d, fn) { bag.push({ d: d, fn: fn }); }
function flush() {
  bag.sort(function (a, b) { return a.d - b.d; });
  for (var i = 0; i < bag.length; i++) bag[i].fn();
  bag = [];
}
function line3(a, b, col, w, dash) {
  var p = proj(a[0], a[1], a[2]), q = proj(b[0], b[1], b[2]);
  push((p.d + q.d) / 2, function () {
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = w || 1;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.restore();
  });
}
function poly3(pts, fill, stroke, w) {
  var pr = pts.map(function (p) { return proj(p[0], p[1], p[2]); });
  var dm = 0; for (var i = 0; i < pr.length; i++) dm += pr[i].d; dm /= pr.length;
  push(dm, function () {
    ctx.beginPath(); ctx.moveTo(pr[0].x, pr[0].y);
    for (var i = 1; i < pr.length; i++) ctx.lineTo(pr[i].x, pr[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = w || 1; ctx.stroke(); }
  });
}
function dot3(x, y, z, r, col, alpha) {
  var p = proj(x, y, z);
  push(p.d, function () {
    ctx.save(); ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fill();
    ctx.restore();
  });
}
function text3(x, y, z, s, col, size, align) {
  var p = proj(x, y, z);
  push(1e6, function () {
    ctx.save();
    ctx.fillStyle = col; ctx.font = (size || 11) + 'px ui-sans-serif,system-ui,sans-serif';
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, p.x, p.y);
    ctx.restore();
  });
}
/* a cylinder along the beam axis, drawn as a shaded tube */
function tube(x0, x1, cy, cz, r, col, edge) {
  // Subdivided along the axis: a single long quad gets one depth value and
  // then paints over whatever is in front of it.
  var N = 14, M = 16, seg = [];
  for (var i = 0; i <= N; i++) {
    var th = i / N * 6.2832;
    seg.push([cy + r * Math.cos(th), cz + r * Math.sin(th)]);
  }
  for (var j = 0; j < M; j++) {
    var xa = x0 + (x1 - x0) * j / M, xb = x0 + (x1 - x0) * (j + 1) / M;
    for (var i = 0; i < N; i++) {
      var a = seg[i], b = seg[i + 1];
      poly3([[xa, a[0], a[1]], [xb, a[0], a[1]], [xb, b[0], b[1]], [xa, b[0], b[1]]],
            col, null, 0);
    }
  }
  if (edge) {
    for (var i = 0; i < N; i++) {
      line3([x0, seg[i][0], seg[i][1]], [x0, seg[i + 1][0], seg[i + 1][1]], edge, 1);
      line3([x1, seg[i][0], seg[i][1]], [x1, seg[i + 1][0], seg[i + 1][1]], edge, 1);
    }
  }
}

/* ------------------------------------------------------------ the ion source
   Always drawn at the left: filament, electron beam, repeller, accel stack. */
function drawSource() {
  var x0 = -1.02, x1 = -0.74;
  // ionisation volume
  poly3([[x0, -0.10, -0.10], [x1, -0.10, -0.10], [x1, -0.10, 0.10], [x0, -0.10, 0.10]],
        'rgba(120,140,160,0.10)', 'rgba(90,110,130,0.45)', 1);
  poly3([[x0, 0.10, -0.10], [x1, 0.10, -0.10], [x1, 0.10, 0.10], [x0, 0.10, 0.10]],
        'rgba(120,140,160,0.10)', 'rgba(90,110,130,0.45)', 1);
  // filament: a glowing coil on the near side
  var fx = (x0 + x1) / 2;
  for (var i = 0; i < 8; i++) {
    var a1 = i / 8 * 6.2832, a2 = (i + 1) / 8 * 6.2832;
    line3([fx + 0.02 * Math.cos(a1), -0.055 + 0.018 * Math.sin(a1), -0.17],
          [fx + 0.02 * Math.cos(a2), -0.055 + 0.018 * Math.sin(a2), -0.17],
          '#d9822b', 2);
  }
  text3(fx, -0.055, -0.27, '70 eV filament', '#b9770e', 10);
  // electron beam crossing the volume
  line3([fx, -0.05, -0.16], [fx, -0.02, 0.16], 'rgba(217,130,43,0.55)', 1.5, [3, 3]);
  // repeller plate behind
  poly3([[x0 - 0.02, -0.09, -0.09], [x0 - 0.02, 0.09, -0.09],
         [x0 - 0.02, 0.09, 0.09], [x0 - 0.02, -0.09, 0.09]],
        'rgba(160,120,80,0.22)', 'rgba(140,100,60,0.6)', 1);
  // acceleration stack: three apertures
  for (var k = 0; k < 3; k++) {
    var xx = x1 + 0.035 + k * 0.045;
    poly3([[xx, -0.085, -0.085], [xx, 0.085, -0.085], [xx, 0.085, 0.085], [xx, -0.085, 0.085]],
          'rgba(90,110,130,0.14)', 'rgba(90,110,130,0.55)', 1);
  }
  text3(x1 + 0.08, 0.15, 0, 'accelerate', '#5a6b7b', 10);
}

function drawSectorDetector() {
  var ex = sectorPos(SECT_R, 1);
  for (var k = 0; k < 4; k++) {
    var d = 0.055 + k * 0.022, sz = 0.05 - k * 0.004;
    var cx = ex[0] + d * 0.7071, cz2 = ex[2] + d * 0.7071;
    poly3([[cx - sz * 0.7071, -sz, cz2 + sz * 0.7071],
           [cx + sz * 0.7071, -sz, cz2 - sz * 0.7071],
           [cx + sz * 0.7071,  sz, cz2 - sz * 0.7071],
           [cx - sz * 0.7071,  sz, cz2 + sz * 0.7071]],
          'rgba(130,90,140,0.16)', 'rgba(120,80,130,0.5)', 1);
  }
  text3(ex[0] + 0.10, -0.16, ex[2] + 0.10, 'detector', '#7d4f9c', 10);
}
function drawTofDetector() {
  if (!P.mirror) { drawDetector(TOF_X1 + 0.04, 0); return; }
  for (var k = 0; k < 4; k++) {
    var xx = TOF_X0 - 0.03 - k * 0.022, sz = 0.05 - k * 0.004;
    poly3([[xx, TOF_YOFF - sz, -sz], [xx, TOF_YOFF + sz, -sz],
           [xx, TOF_YOFF + sz, sz], [xx, TOF_YOFF - sz, sz]],
          'rgba(130,90,140,0.16)', 'rgba(120,80,130,0.5)', 1);
  }
  text3(TOF_X0 - 0.09, TOF_YOFF - 0.10, 0, 'detector', '#7d4f9c', 10);
}
function drawDetector(x, yc) {
  // electron multiplier: a stack of dynodes
  for (var k = 0; k < 4; k++) {
    var xx = x + k * 0.022, s = 0.055 - k * 0.004, y0 = yc || 0;
    poly3([[xx, y0 - s, -s], [xx, y0 + s, -s], [xx, y0 + s, s], [xx, y0 - s, s]],
          'rgba(130,90,140,0.16)', 'rgba(120,80,130,0.5)', 1);
  }
  text3(x + 0.04, (yc || 0) - 0.13, 0, 'detector', '#7d4f9c', 10);
}

/* ================================================================= ANALYSERS */

/* ---- common: speed after acceleration, v = sqrt(2 z e V / m) --------------*/
function speed(mz, V) { return Math.sqrt(2 * E * V / (mz * U)); }

/* ---- magnetic sector ------------------------------------------------------
   radius r = sqrt(2 V m/z) / B.  Scene shows a 90-degree sector; the exit
   slit sits at a fixed radius, so scanning B sweeps m/z across it.          */
var SECT_R = 0.52;                       // scene radius of the exit slit
function sectorRadius(mz) {
  return Math.sqrt(2 * P.V * mz * U / E) / P.B;   // metres
}
function sectorScene(mz) {               // scene units, slit at SECT_R
  var rSel = Math.sqrt(2 * P.V * scanMass() * U / E) / P.B;
  return SECT_R * sectorRadius(mz) / rSel;
}
/* Ions enter at SECT_X travelling along +x. An ion of radius r turns about a
   centre at (SECT_X, 0, r), so after turning through theta it sits at
     x = SECT_X + r sin(theta),  z = r (1 - cos theta).
   After a quarter turn it lands at (SECT_X + r, 0, r): the landing points of
   all masses lie on a diagonal focal plane, and the slit sits on it.        */
var SECT_X = -0.62;
function sectorPos(r, f) {               // f = 0..1 of the quarter turn
  var th = f * Math.PI / 2;
  return [SECT_X + r * Math.sin(th), 0, r * (1 - Math.cos(th))];
}
function drawSector() {
  // the field region: the band swept by arcs between 0.62 and 1.38 of r_slit
  var N = 20, rLo = SECT_R * 0.62, rHi = SECT_R * 1.38;
  for (var i = 0; i < N; i++) {
    var f1 = i / N, f2 = (i + 1) / N;
    var a = sectorPos(rLo, f1), b = sectorPos(rHi, f1);
    var c = sectorPos(rHi, f2), d = sectorPos(rLo, f2);
    poly3([[a[0], -0.085, a[2]], [b[0], -0.085, b[2]],
           [c[0], -0.085, c[2]], [d[0], -0.085, d[2]]],
          'rgba(70,110,160,0.14)', null, 0);
  }
  for (var i = 0; i <= N; i += 5) {
    var a = sectorPos(rLo, i / N), b = sectorPos(rHi, i / N);
    line3([a[0], -0.085, a[2]], [b[0], -0.085, b[2]], 'rgba(50,90,140,0.26)', 1);
  }
  // B is vertical, out of the pole face
  for (var k = 0; k < 4; k++) {
    var p = sectorPos(SECT_R, (k + 0.5) / 4);
    line3([p[0], -0.085, p[2]], [p[0], 0.03, p[2]], 'rgba(43,108,176,0.30)', 1);
    if (k === 0) text3(p[0] - 0.02, 0.13, p[2], 'B = ' + P.B.toFixed(2) + ' T',
                       '#2b6cb0', 11);
  }
  // one faint guide arc per species, so the mass fan is visible
  for (var j = 0; j < SAMPLE.length; j++) {
    var rr = sectorScene(SAMPLE[j].mz), prev = null;
    for (var i = 0; i <= 24; i++) {
      var p = sectorPos(rr, i / 24);
      if (prev) line3([prev[0], 0, prev[2]], [p[0], 0, p[2]],
                      SAMPLE[j].col, 1, [2, 4]);
      prev = p;
    }
    var endp = sectorPos(rr, 1), off = 0.075 + 0.06 * (j % 2);
    text3(endp[0] + off, 0.06 + 0.05 * (j % 2), endp[2] + off, SAMPLE[j].mz,
          SAMPLE[j].col, 10.5);
  }
  // focal plane and the exit slit on it
  var lo = sectorPos(rLo, 1), hi = sectorPos(rHi, 1);
  line3([lo[0], 0, lo[2]], [hi[0], 0, hi[2]], 'rgba(120,80,130,0.30)', 1, [4, 4]);
  var ex = sectorPos(SECT_R, 1);
  line3([ex[0] - 0.035, -0.05, ex[2] - 0.035], [ex[0] - 0.035, 0.05, ex[2] - 0.035],
        '#7d4f9c', 2.5);
  line3([ex[0] + 0.035, -0.05, ex[2] + 0.035], [ex[0] + 0.035, 0.05, ex[2] + 0.035],
        '#7d4f9c', 2.5);
  text3(ex[0] + 0.14, -0.10, ex[2] + 0.14, 'exit slit', '#7d4f9c', 10);
}

/* ---- quadrupole -----------------------------------------------------------
   Reduced Mathieu equations integrated directly:
     x'' = -(a - 2q cos 2xi) x ,  y'' = +(a - 2q cos 2xi) y
   with a, q scaled from the mass currently at the apex.                      */
var ROD_R = 0.075, ROD_X0 = -0.52, ROD_X1 = 0.52;
function aqFor(mz) {
  var s = scanMass() / mz;
  var slope = SCAN_SLOPE * (1 - P.res);
  var q = Q_APEX * s;
  return { a: slope * q, q: q };
}
// Real round-rod quadrupoles use r_rod = 1.1468 r0; the rods are drawn thinner
// than that so the trajectories inside stay visible. The inscribed radius -- the
// surface an ion is lost at -- is still exactly ROD_R.
var ROD_RAD = 0.52 * ROD_R;
var ROD_C   = ROD_R + ROD_RAD;
function drawQuad() {
  var pos = [[0, ROD_C], [0, -ROD_C], [ROD_C, 0], [-ROD_C, 0]];
  for (var i = 0; i < 4; i++) {
    var col = (i < 2) ? 'rgba(190,120,60,0.20)' : 'rgba(70,110,160,0.20)';
    var ed  = (i < 2) ? 'rgba(170,100,40,0.45)' : 'rgba(50,90,140,0.45)';
    tube(ROD_X0, ROD_X1, pos[i][0], pos[i][1], ROD_RAD, col, ed);
  }
  text3(0, ROD_C + ROD_RAD + 0.07, 0, '+(U + V cos Ωt)', '#b9770e', 11);
  text3(0, -ROD_C - ROD_RAD - 0.08, 0, '−(U + V cos Ωt)', '#2b6cb0', 11);
}

/* ---- time of flight -------------------------------------------------------
   Field-free drift plus, optionally, a linear-field mirror. Time inside the
   mirror is 2 m v / (z e Efield), which is proportional to v: faster ions go
   deeper and take longer, so the energy spread is focused out.               */
var TOF_X0 = -0.60, TOF_X1 = 0.62;
function tofTime(mz, frac) {            // frac = kinetic energy multiplier
  var v = speed(mz, P.V * frac);
  var tt = P.L / v;
  if (P.mirror) {
    // First-order energy focusing requires dt/dv = 0, i.e. L/v^2 = 2m/(zeE),
    // which for v^2 = 2zeV/m gives exactly E = 4V/L. At that field the total
    // time becomes L(1+frac)/v, whose derivative in frac vanishes at frac = 1.
    var Efield = 4 * P.V / P.L;
    tt += 2 * mz * U * v / (E * Efield);
  }
  return tt;
}
/* Phase times, in seconds, for one ion. With the mirror on, the field-free
   path L is split into an outward and a return leg, and the detector sits
   beside the source — the standard reflectron layout. */
/* Scene scale: the outward leg (TOF_X0 -> TOF_XM) is L/2. First-order
   focusing needs E = 4V/L, so an ion of nominal energy penetrates to a depth
   of L/4 -- half the length of one drift leg. The mirror is drawn that deep,
   which is why single-stage reflectrons are long; two-stage designs use a
   steep first retarding stage to shorten the penetration. */
var TOF_XM = 0.18, TOF_YOFF = -0.165;
var TOF_DEPTH = 0.5 * (TOF_XM - (-0.60));
function tofPhases(mz, frac) {
  var v = speed(mz, P.V * frac);
  if (!P.mirror) return { v: v, drift: P.L / v, mir: 0 };
  var Efield = 4 * P.V / P.L;
  return { v: v, drift: (P.L / 2) / v, mir: 2 * mz * U * v / (E * Efield) };
}
function tofTime(mz, frac) {
  var p = tofPhases(mz, frac);
  return P.mirror ? 2 * p.drift + p.mir : p.drift;
}
/* Where an ion is at elapsed time tt. */
function tofPos(o, tt) {
  var p = o.ph;
  if (!P.mirror) return [TOF_X0 + (tt / p.drift) * (TOF_X1 - TOF_X0), 0, 0];
  if (tt < p.drift)
    return [TOF_X0 + (tt / p.drift) * (TOF_XM - TOF_X0), 0, 0];
  if (tt < p.drift + p.mir) {
    var tau = (tt - p.drift) / p.mir;             // 0..1 inside the mirror
    var depth = TOF_DEPTH * (1 - Math.pow(2 * tau - 1, 2)) * o.frac;
    return [TOF_XM + depth, TOF_YOFF * tau, 0];
  }
  var g = (tt - p.drift - p.mir) / p.drift;
  return [TOF_XM - g * (TOF_XM - TOF_X0), TOF_YOFF, 0];
}
function drawTOF() {
  var xEnd = P.mirror ? TOF_XM : TOF_X1;
  tube(TOF_X0, xEnd, 0, 0, 0.085, 'rgba(120,140,160,0.07)',
       'rgba(100,120,140,0.26)');
  text3((TOF_X0 + xEnd) / 2, 0.145, 0,
        'field-free drift, L = ' + P.L.toFixed(2) + ' m', '#5a6b7b', 11);
  if (P.mirror) {
    tube(TOF_X0, xEnd, TOF_YOFF, 0, 0.055, 'rgba(120,140,160,0.05)',
         'rgba(100,120,140,0.18)');
    for (var k = 0; k < 9; k++) {
      var xx = TOF_XM + 0.015 + k * (TOF_DEPTH + 0.03) / 9;
      poly3([[xx, -0.075, -0.075], [xx, 0.075, -0.075],
             [xx, 0.075, 0.075], [xx, -0.075, 0.075]],
            'rgba(200,90,70,' + (0.04 + k * 0.022) + ')', 'rgba(190,80,60,0.38)', 1);
    }
    text3(TOF_XM + TOF_DEPTH * 0.5, 0.14, 0, 'reflectron', '#c0392b', 10);
    text3(TOF_XM + TOF_DEPTH * 0.5, -0.145, 0,
          'deeper = faster = later', '#c0392b', 9.5);
  }
}

/* ---- Orbitrap -------------------------------------------------------------
   U(r,z) = (k/2)(z^2 - r^2/2) + (k/2) Rm^2 ln(r/Rm).
   Axial motion is exactly harmonic with omega = sqrt(k z/m), independent of
   ion energy; that frequency is what the image current reports.             */
var ORB_K = 2.2e7, ORB_RM = 0.015, ORB_AX = 1.0;
function orbOmega(mz) { return Math.sqrt(ORB_K * E / (mz * U)); }
function spindleR(x) {                 // fattest in the middle, tapering out
  var f = 1 - 0.93 * Math.pow(x / 0.50, 2);
  return f > 0 ? 0.062 * Math.sqrt(f) : 0;
}
function barrelR(x) {
  var f = 1 - 0.50 * Math.pow(x / 0.56, 2);
  return f > 0 ? 0.255 * Math.sqrt(f) : 0;
}
function ring(x, r, col, w, skipNear) {
  var N = 26, prev = null;
  for (var i = 0; i <= N; i++) {
    var th = i / N * 6.2832;
    var p = [x, r * Math.cos(th), r * Math.sin(th)];
    if (prev && !(skipNear && Math.sin(th) > 0.1)) line3(prev, p, col, w);
    prev = p;
  }
}
function drawOrbitrap() {
  // central spindle, a shaded solid
  var N = 20;
  for (var s2 = 0; s2 < 20; s2++) {
    var x1 = -0.46 + s2 * 0.046, x2 = x1 + 0.046;
    var r1 = spindleR(x1), r2 = spindleR(x2);
    for (var i = 0; i < N; i++) {
      var t1 = i / N * 6.2832, t2 = (i + 1) / N * 6.2832;
      var sh = 0.16 + 0.20 * Math.max(0, Math.sin(t1 + 2.2));
      poly3([[x1, r1 * Math.cos(t1), r1 * Math.sin(t1)],
             [x2, r2 * Math.cos(t1), r2 * Math.sin(t1)],
             [x2, r2 * Math.cos(t2), r2 * Math.sin(t2)],
             [x1, r1 * Math.cos(t2), r1 * Math.sin(t2)]],
            'rgba(86,104,122,' + sh.toFixed(3) + ')', null, 0);
    }
  }
  text3(-0.60, -0.10, 0, 'central spindle', '#5a6b7b', 10, 'right');

  // outer barrel as a wireframe, so the orbits inside stay visible
  var col = 'rgba(120,140,160,0.42)';
  for (var k = -3; k <= 3; k++) {
    var x = k * 0.17;
    if (Math.abs(x) > 0.56) continue;
    ring(x, barrelR(x), k === 0 ? 'rgba(125,79,156,0.40)' : col, 1, false);
  }
  for (var a2 = 0; a2 < 8; a2++) {
    var th = a2 / 8 * 6.2832, prev = null;
    for (var i = 0; i <= 24; i++) {
      var x = -0.56 + i / 24 * 1.12, R = barrelR(x);
      var p = [x, R * Math.cos(th), R * Math.sin(th)];
      if (prev) line3(prev, p, col, 1);
      prev = p;
    }
  }
  // the barrel is split at z = 0; each half is one pickup plate
  text3(0, barrelR(0) + 0.055, 0,
        'outer electrode, split here \u2014 the two halves are the pickup',
        '#7d4f9c', 10);
  text3(0, -barrelR(0) - 0.055, 0,
        'axial \u03C9 = \u221A(k / (m/z)), independent of ion energy',
        '#2e7d4f', 11);
}

/* ============================================================== PARTICLES */
function scanMass() {         // the m/z the analyser is currently passing
  return P.scanning ? 40 + scan * 90 : P.park;
}

function spawn() {
  for (var i = 0; i < SAMPLE.length; i++) {
    var s = SAMPLE[i];
    if (Math.random() > 0.55 * s.rel) continue;
    var ion = { mz: s.mz, col: s.col, rel: s.rel, s: 0, dead: false, trail: [] };
    if (P.analyser === 'quad') {
      var aq = aqFor(s.mz);
      ion.a = aq.a; ion.q = aq.q;
      ion.xi = 0;
      ion.u = (Math.random() - 0.5) * 0.30; ion.du = 0;
      ion.v = (Math.random() - 0.5) * 0.30; ion.dv = 0;
    } else if (P.analyser === 'tof') {
      ion.frac = 1 + (Math.random() - 0.5) * 2 * (P.spread / P.V);
      ion.ph = tofPhases(s.mz, ion.frac);
      var ra = Math.random() * 6.2832, rr2 = 0.05 * Math.sqrt(Math.random());
      ion.oy = rr2 * Math.cos(ra); ion.oz = rr2 * Math.sin(ra);
      ion.T = tofTime(s.mz, ion.frac);
      ion.tt = 0;
    } else if (P.analyser === 'sector') {
      ion.r = sectorScene(s.mz);
    } else if (P.analyser === 'orbi') {
      var w = orbOmega(s.mz);
      ion.w = w;
      ion.ph = Math.random() * 6.2832;      // axial phase
      ion.rr = 0.10 + Math.random() * 0.05; // orbit radius
      ion.om = 1.5 * w * (0.9 + 0.2 * Math.random());  // angular rate
      ion.th = Math.random() * 6.2832;
      ion.amp = 0.30 + Math.random() * 0.08;
    }
    ions.push(ion);
  }
}

function record(mz) {
  for (var i = 0; i < spectrum.length; i++) {
    if (spectrum[i].mz === mz) { spectrum[i].h += 1; return; }
  }
  spectrum.push({ mz: mz, h: 1 });
}

var pulseClock = 0;
function step(dt) {
  if (P.analyser === 'orbi') { stepOrbi(dt); return; }
  if (P.analyser === 'tof') {
    // a pulsed source: every ion in a shot starts at the same instant
    pulseClock -= dt;
    if (pulseClock <= 0) {
      for (var n = 0; n < 9; n++) spawn();
      var longest = 0;
      for (var j = 0; j < SAMPLE.length; j++)
        longest = Math.max(longest,
          tofTime(SAMPLE[j].mz, 1 + P.spread / P.V));
      pulseClock = longest * 2.6e5 * 1.35;
    }
  } else if (Math.random() < 0.55) spawn();

  for (var i = ions.length - 1; i >= 0; i--) {
    var o = ions[i];
    if (P.analyser === 'quad') {
      // integrate the reduced Mathieu equations with leapfrog in xi
      var dxi = dt * 20.0, sub = 48, h = dxi / sub;
      for (var k = 0; k < sub; k++) {
        var f = o.a - 2 * o.q * Math.cos(2 * o.xi);
        o.du += -f * o.u * h; o.dv += f * o.v * h;
        o.u += o.du * h; o.v += o.dv * h;
        o.xi += h;
      }
      o.s = o.xi / (P.ncyc * Math.PI);
      if (Math.abs(o.u) > 1 || Math.abs(o.v) > 1) {       // struck a rod
        o.dead = true; ions.splice(i, 1); continue;
      }
      if (o.s >= 1) { record(o.mz); ions.splice(i, 1); continue; }
      o.trail.push([o.s, o.u, o.v]);
      if (o.trail.length > 120) o.trail.shift();
    } else if (P.analyser === 'tof') {
      o.tt += dt / 2.6e5;
      if (o.tt >= o.T) { record(o.mz); ions.splice(i, 1); continue; }
    } else if (P.analyser === 'sector') {
      o.s += dt * 0.55 / Math.sqrt(o.mz / 77);
      if (o.s >= 1) {
        // transmitted only if the arc radius matches the slit
        if (Math.abs(o.r - SECT_R) < 0.012) record(o.mz);
        ions.splice(i, 1); continue;
      }
    }
  }
}

/* Orbitrap: all ions are trapped at once. The transient is the summed axial
   displacement; the spectrum is its magnitude DFT, mapped frequency -> m/z. */
var orbT = 0;
function stepOrbi(dt) {
  if (!ions.length) {
    for (var i = 0; i < SAMPLE.length; i++) {
      for (var j = 0; j < 2; j++) {
        var s = SAMPLE[i];
        var w = orbOmega(s.mz);
        ions.push({ mz: s.mz, col: s.col, rel: s.rel, w: w,
                    ph: Math.random() * 0.6, rr: 0.105 + Math.random() * 0.05,
                    om: 1.6 * w * (0.92 + 0.16 * Math.random()),
                    th: Math.random() * 6.2832, amp: 0.40 + Math.random() * 0.08,
                    trail: [] });
      }
    }
    orbT = 0;
  }
  orbT += dt * 2.2e-6 * P.speed;
  for (var i = 0; i < ions.length; i++) {
    var o = ions[i];
    o.z = o.amp * Math.sin(o.w * orbT + o.ph);
    o.th = o.om * orbT;
    o.trail.push([o.z, o.rr * Math.cos(o.th), o.rr * Math.sin(o.th)]);
    if (o.trail.length > 85) o.trail.shift();
  }
  buildTransient();
}

var transKey = null;
function buildTransient() {
  // The spectrum depends only on the transient length, so rebuild it only
  // when that changes. Sample well above Nyquist for the highest frequency
  // present (m/z 45 here), or the DFT folds high frequencies back as ghosts.
  var key = P.trans + '|' + ions.length;
  if (key === transKey && transient) return;
  transKey = key;
  var T = P.trans * 1e-6;
  var fMax = orbOmega(40) / 6.2832;
  var N = Math.min(4096, Math.max(512, Math.ceil(T * fMax * 2.6)));
  var sig = new Float64Array(N);
  for (var n = 0; n < N; n++) {
    var tt = n / N * T, s = 0;
    for (var i = 0; i < ions.length; i++) {
      var o = ions[i];
      s += o.rel * Math.sin(o.w * tt + o.ph);
    }
    sig[n] = s * 0.5 * (1 - Math.cos(6.2832 * n / (N - 1)));   // Hann window
  }
  // magnitude DFT over the m/z range of interest
  var out = [];
  for (var mz = 40; mz <= 130; mz += 0.25) {
    var w = orbOmega(mz), re = 0, im = 0;
    for (var n = 0; n < N; n++) {
      var tt = n / N * T;
      re += sig[n] * Math.cos(w * tt);
      im += sig[n] * Math.sin(w * tt);
    }
    out.push({ mz: mz, h: Math.sqrt(re * re + im * im) / N });
  }
  transient = { sig: sig, spec: out };
}

/* =================================================================== RENDER */
function render() {
  ctx.clearRect(0, 0, W, H);
  bag = [];

  if (P.analyser !== 'orbi') drawSource();

  if (P.analyser === 'sector')      drawSector();
  else if (P.analyser === 'quad')   drawQuad();
  else if (P.analyser === 'tof')    drawTOF();
  else                              drawOrbitrap();

  if (P.analyser === 'sector')      drawSectorDetector();
  else if (P.analyser === 'quad')   drawDetector(ROD_X1 + 0.06);
  else if (P.analyser === 'tof')    drawTofDetector();

  // ions
  for (var i = 0; i < ions.length; i++) {
    var o = ions[i];
    if (P.analyser === 'quad') {
      var x = ROD_X0 + o.s * (ROD_X1 - ROD_X0);
      for (var k = 1; k < o.trail.length; k++) {
        var p1 = o.trail[k - 1], p2 = o.trail[k];
        line3([ROD_X0 + p1[0] * (ROD_X1 - ROD_X0), p1[1] * ROD_R, p1[2] * ROD_R],
              [ROD_X0 + p2[0] * (ROD_X1 - ROD_X0), p2[1] * ROD_R, p2[2] * ROD_R],
              o.col, 1.1);
      }
      dot3(x, o.u * ROD_R, o.v * ROD_R, 2.6, o.col);
    } else if (P.analyser === 'tof') {
      var pp = tofPos(o, o.tt);
      dot3(pp[0], pp[1] + o.oy, o.oz, 2.8, o.col);
    } else if (P.analyser === 'sector') {
      var p = sectorPos(o.r, o.s);
      dot3(p[0], 0, p[2], 2.6, o.col);
    } else {
      for (var k = 1; k < o.trail.length; k++) {
        var p1 = o.trail[k - 1], p2 = o.trail[k];
        line3([p1[0] * ORB_AX, p1[1], p1[2]], [p2[0] * ORB_AX, p2[1], p2[2]],
              o.col, 1.0);
      }
      dot3(o.z * ORB_AX, o.rr * Math.cos(o.th), o.rr * Math.sin(o.th), 2.4, o.col);
    }
  }

  flush();

  // what the analyser is currently set to, pinned to the canvas so it can
  // never collide with a label out in the scene
  if (P.analyser === 'quad' || P.analyser === 'sector') {
    ctx.save();
    ctx.fillStyle = '#3b4a59';
    ctx.font = '13px ui-sans-serif,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText((P.scanning ? 'scanning — now passing m/z ≈ '
                             : 'parked on m/z ') + scanMass().toFixed(1),
                 12, H - 10);
    ctx.restore();
  }
  drawSpectrum();
}

/* ------------------------------------------------------------- the spectrum */
function drawSpectrum() {
  sx.clearRect(0, 0, SW, SH);
  var L = 44, R = SW - 14, B = SH - 26, T = 12;
  sx.strokeStyle = '#c9d2da'; sx.lineWidth = 1;
  sx.beginPath(); sx.moveTo(L, T); sx.lineTo(L, B); sx.lineTo(R, B); sx.stroke();
  sx.fillStyle = '#7b8794';
  sx.font = '10px ui-sans-serif,system-ui,sans-serif';
  sx.textAlign = 'center';
  for (var m = 40; m <= 130; m += 10) {
    var px = L + (m - 40) / 90 * (R - L);
    sx.fillText(m, px, B + 13);
    sx.strokeStyle = '#eef2f5';
    sx.beginPath(); sx.moveTo(px, T); sx.lineTo(px, B); sx.stroke();
  }
  sx.textAlign = 'right'; sx.fillText('m/z', R, B + 24);
  sx.save(); sx.translate(13, (T + B) / 2); sx.rotate(-Math.PI / 2);
  sx.textAlign = 'center'; sx.fillText('abundance', 0, 0); sx.restore();

  var data, mx = 1;
  if (P.analyser === 'orbi') {
    if (!transient) return;
    data = transient.spec;
    for (var i = 0; i < data.length; i++) mx = Math.max(mx, data[i].h);
    sx.strokeStyle = '#2e7d4f'; sx.lineWidth = 1.6;
    sx.beginPath();
    for (var i = 0; i < data.length; i++) {
      var px = L + (data[i].mz - 40) / 90 * (R - L);
      var py = B - data[i].h / mx * (B - T) * 0.94;
      i ? sx.lineTo(px, py) : sx.moveTo(px, py);
    }
    sx.stroke();
  } else {
    data = spectrum;
    for (var i = 0; i < data.length; i++) mx = Math.max(mx, data[i].h);
    for (var i = 0; i < data.length; i++) {
      var px = L + (data[i].mz - 40) / 90 * (R - L);
      var py = B - data[i].h / mx * (B - T) * 0.94;
      var col = '#4a5a6a';
      for (var j = 0; j < SAMPLE.length; j++)
        if (SAMPLE[j].mz === data[i].mz) col = SAMPLE[j].col;
      sx.strokeStyle = col; sx.lineWidth = 2.5;
      sx.beginPath(); sx.moveTo(px, B); sx.lineTo(px, py); sx.stroke();
      if (data[i].h / mx > 0.14) {
        sx.fillStyle = col; sx.textAlign = 'center';
        sx.fillText(data[i].mz, px, py - 5);
      }
    }
  }
}

/* ------------------------------------------------------- readouts and wiring */
function readouts() {
  var el2 = document.getElementById('rOut');
  var s = '';
  if (P.analyser === 'sector') {
    s = 'r = √(2V·m/z)/B — at ' + P.V + ' V and ' + P.B.toFixed(2) +
        ' T, m/z 77 bends through ' + (sectorRadius(77) * 100).toFixed(1) + ' cm';
  } else if (P.analyser === 'quad') {
    var aq = aqFor(scanMass()), R = 0.75 / P.res;
    s = 'apex m/z ' + scanMass().toFixed(1) + ' · a = ' + aq.a.toFixed(4) +
        ', q = ' + aq.q.toFixed(4) + ' · operating at ' +
        ((1 - P.res) * 100).toFixed(2) + '% of the apex slope → R ≈ ' +
        Math.round(R) + ', window ≈ ' + (scanMass() / R).toFixed(2) + ' Da';
  } else if (P.analyser === 'tof') {
    var t77 = tofTime(77, 1), t114 = tofTime(114, 1);
    s = 'm/z 77 arrives at ' + (t77 * 1e6).toFixed(2) + ' µs, m/z 114 at ' +
        (t114 * 1e6).toFixed(2) + ' µs · Δt = ' +
        ((t114 - t77) * 1e9).toFixed(0) + ' ns';
    // peak width = the full spread of arrival times over the energy window.
    // With the mirror on the minimum is interior, so endpoints are not enough.
    var f = P.spread / P.V, lo = 1e9, hi = -1e9;
    for (var i2 = 0; i2 <= 40; i2++) {
      var tt2 = tofTime(77, 1 - f + 2 * f * i2 / 40);
      if (tt2 < lo) lo = tt2;
      if (tt2 > hi) hi = tt2;
    }
    var w = hi - lo;
    s += ' · ±' + P.spread + ' eV of initial energy spreads that peak over ' +
         (w > 1e-9 ? (w * 1e9).toFixed(1) + ' ns' : (w * 1e12).toFixed(1) + ' ps') +
         ' → R ≈ ' + (w > 0 ? Math.round(t77 / (2 * w)).toLocaleString('en') : '\u221E') +
         ' from this term alone';
  } else {
    var f77 = orbOmega(77) / 6.2832, f114 = orbOmega(114) / 6.2832;
    var T = P.trans * 1e-6;
    var f112 = orbOmega(112) / 6.2832;
    s = 'm/z 77 oscillates at ' + (f77 / 1e3).toFixed(1) + ' kHz, m/z 114 at ' +
        (f114 / 1e3).toFixed(1) + ' kHz · the 112/114 pair differs by only ' +
        ((f112 - f114) / 1e3).toFixed(1) + ' kHz, and a ' + P.trans +
        ' µs transient resolves ' + ((2 / T) / 1e3).toFixed(1) +
        ' kHz → R ≈ ' + Math.round(f77 * T / 4) +
        (f112 - f114 > 2 / T ? ' (resolved)' : ' (not resolved)');
  }
  el2.textContent = s;
}

var last = 0;
function frame(ts) {
  var dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
  if (P.run) {
    t += dt * P.speed;
    step(dt * P.speed);
    if (P.scanning && (P.analyser === 'quad' || P.analyser === 'sector')) {
      scan += dt * 0.055 * P.speed;
      if (scan > 1) { scan = 0; }
    }
  }
  render(); readouts();
  requestAnimationFrame(frame);
}

function reset() {
  ions = []; spectrum = []; scan = 0;
  transient = null; transKey = null; orbT = 0;
}

function init() {
  cv = document.getElementById('cv'); ctx = cv.getContext('2d');
  sv = document.getElementById('sp'); sx = sv.getContext('2d');
  function size() {
    var r = cv.parentNode.getBoundingClientRect();
    var w = Math.max(320, r.width), dpr = window.devicePixelRatio || 1;
    W = w; H = Math.round(Math.min(460, Math.max(300, w * 0.56)));
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    SW = w; SH = 150;
    sv.width = SW * dpr; sv.height = SH * dpr;
    sv.style.width = SW + 'px'; sv.style.height = SH + 'px';
    sx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size(); window.addEventListener('resize', size);

  // orbit
  var drag = false, lx = 0, ly = 0;
  function down(x, y) { drag = true; lx = x; ly = y; }
  function move(x, y) {
    if (!drag) return;
    az += (x - lx) * 0.009;
    el = Math.max(-0.1, Math.min(1.25, el + (y - ly) * 0.006));
    lx = x; ly = y;
  }
  cv.addEventListener('mousedown', function (ev) { down(ev.clientX, ev.clientY); });
  window.addEventListener('mousemove', function (ev) { move(ev.clientX, ev.clientY); });
  window.addEventListener('mouseup', function () { drag = false; });
  cv.addEventListener('touchstart', function (ev) {
    down(ev.touches[0].clientX, ev.touches[0].clientY);
  }, { passive: true });
  cv.addEventListener('touchmove', function (ev) {
    move(ev.touches[0].clientX, ev.touches[0].clientY); ev.preventDefault();
  }, { passive: false });
  cv.addEventListener('touchend', function () { drag = false; });

  // analyser buttons
  var names = { sector: 'Magnetic sector', quad: 'Quadrupole',
                tof: 'Time of flight', orbi: 'Orbitrap' };
  ['sector', 'quad', 'tof', 'orbi'].forEach(function (k) {
    document.getElementById('b_' + k).addEventListener('click', function () {
      P.analyser = k; reset();
      az = VIEW[k].az; el = VIEW[k].el;
      ['sector', 'quad', 'tof', 'orbi'].forEach(function (j) {
        document.getElementById('b_' + j).className =
          'anbtn' + (j === k ? ' on' : '');
        var pane = document.getElementById('p_' + j);
        if (pane) pane.style.display = (j === k) ? 'grid' : 'none';
      });
      document.getElementById('p_scanmode').style.display =
        (k === 'quad' || k === 'sector') ? 'grid' : 'none';
      document.getElementById('anName').textContent = names[k];
    });
  });

  function slider(id, key, fmt, scale) {
    var s = document.getElementById(id), o = document.getElementById(id + 'v');
    function upd() {
      P[key] = parseFloat(s.value) * (scale || 1);
      if (o) o.textContent = fmt(P[key]);
      if (key !== 'speed') reset();
    }
    s.addEventListener('input', upd); upd();
  }
  slider('sV', 'V', function (v) { return v + ' V'; });
  slider('sB', 'B', function (v) { return v.toFixed(2) + ' T'; }, 0.01);
  slider('sRes', 'res', function (v) {
    return (v * 100).toFixed(2) + '%  (R ≈ ' + Math.round(0.75 / v) + ')';
  }, 0.0001);
  slider('sL', 'L', function (v) { return v.toFixed(2) + ' m'; }, 0.01);
  slider('sSpread', 'spread', function (v) {
    return '±' + v.toFixed(0) + ' eV';
  });
  slider('sTrans', 'trans', function (v) { return v + ' µs'; });
  slider('sPark', 'park', function (v) { return 'm/z ' + v; });

  document.getElementById('cScan').addEventListener('change', function () {
    P.scanning = this.checked; reset();
    document.getElementById('parkRow').style.opacity = this.checked ? 0.35 : 1;
    document.getElementById('sPark').disabled = this.checked;
  });
  slider('sSpeed', 'speed', function (v) { return v.toFixed(1) + '×'; }, 0.1);

  document.getElementById('cMirror').addEventListener('change', function () {
    P.mirror = this.checked; reset();
  });
  document.getElementById('bRun').addEventListener('click', function () {
    P.run = !P.run; this.textContent = P.run ? 'Pause' : 'Play';
  });
  document.getElementById('bClear').addEventListener('click', reset);

  document.getElementById('b_quad').click();
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', init);
else init();
})();
