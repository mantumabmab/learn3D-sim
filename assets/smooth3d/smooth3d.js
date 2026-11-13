/* ============================================================
   smooth3d.js: smooth, shaded 3D teaching figures on three.js (r128, bundled; works offline once built).
   Use it for molecules and structures (proteins, ligands in pockets, ball-and-stick, crystal lattices, orbitals,
   anatomy). Instruments, machines, cells-as-scenes and physical models stay in Colorfigures; maths objects in math3d.

   A figure page loads, in this order:
     <script src="three.min.js"></script><script src="OrbitControls.js"></script><script src="smooth3d.js"></script>
   and calls mountSmooth3D({...}). scripts/build_page.py inlines all three.

   mountSmooth3D({
     fig:'03', title:'Agonist in the β2 pocket',
     note:'Shapes simplified; sizes roughly to scale (1 unit = 1 Å).',     // shown under the figure
     camera:{ yaw:30, pitch:18, dist:160, target:[0,0,0], fov:35 },        // degrees; dist in scene units
     state:{ bound:false },                                                 // your own state, shared with steps
     build(K, st){ ...make meshes with K..., return parts },               // runs once; return what steps animate
     steps:[{ label:'Bind agonist', main:true, async run(K, parts, st){ await K.move(parts.lig, [0,4,0], 1200); } }],
     pickers:[{ label:'Drug', options:['Adrenaline','Propranolol'], value:0, onChange(i, K, parts, st){} }],
     params:[{ key:'k', label:'Rate', min:0, max:1, step:.05, value:.5, fmt:v=>v.toFixed(2), onInput(v,K,parts,st){} }],
     stats: st => [{ label:'cAMP made', value: st.camp }],
     tick(dt, K, parts, st){},                                              // optional, every frame (dt in s)
     reset(K, parts, st){}                                                  // optional; default reloads the start
   }) -> K

   Kit K (all sizes in scene units; y is UP; colours '#hex' or a PAL name):
     K.group(parent?)                         new THREE.Group added to parent (default the scene)
     K.sphere(r, color, pos, o)               o: { parent, opacity, shell, label, labelWhen }
     K.cyl(from, to, r, color, o)             a rod between two points (helix rods, bonds, tubes)
     K.helix(from, to, r, color, o)           an α-helix as a rod with a faint coil groove (r ≈ 2.3 Å for a ribbon look, 5 for a rod)
     K.tube(points, r, color, o)              a smooth tube through points (loops, chains, paths)
     K.box(size[x,y,z], color, pos, o)        o.round: corner radius look via bevel-free soft material
     K.blob(r, color, pos, o)                 a lumpy globular domain (o.seed, o.scale:[sx,sy,sz])
     K.membrane({ w, d, thick, y, color })    lipid slab: head-group bands + core, translucent; tagged shell
     K.molecule(atoms, bonds, o)              atoms [{el:'C'|'N'|'O'|'S'|'P'|'H'|..., p:[x,y,z]}], bonds [[i,j],...]; CPK colours
     K.arrow(from, to, color, o)              a straight arrow (o.r)
     K.label(obj, 'TEXT', o)                  HTML pill label that follows obj (o.when: () => bool, o.dy)
     K.shell(obj)                             mark obj as an outer surface that See-through ghosts
     K.move(obj, to[x,y,z], ms, ease?)        promise; tweens position
     K.turn(obj, to[x,y,z] radians, ms)       promise; tweens rotation
     K.fade(obj, opacity, ms)                 promise
     K.tween(ms, fn(t 0..1))                  promise; your own animation (eased)
     K.wait(ms)                               promise
     K.flash('text')                          a short notice on the figure
     K.setStats()                             re-read cfg.stats(st) now (also done every frame)
     K.busy                                   true while a step runs (buttons are disabled meanwhile)
     K.THREE, K.scene, K.camera, K.renderer   escape hatches
   Colours: PAL = { ink, paper, red, blue, teal, mustard, plum, green, grey, membrane }.

   URL parameters (for screenshots and links from the notes): ?xr=1 (See-through) &labels=1 &yaw=..&pitch=..
   &press=Label@300,Other@1500 (press buttons by label after a delay in ms).
   ============================================================ */
'use strict';
const PAL = { ink:'#231e16', paper:'#f2efe7', muted:'#857d6e', rule:'#ddd6c8', red:'#d9473d', blue:'#3d63b8', teal:'#2f8f86',
  mustard:'#e0a526', plum:'#8a4f9e', green:'#43a35c', grey:'#9a9384', membrane:'#e9c98a' };
addEventListener('error', e => { document.documentElement.dataset.errors = (document.documentElement.dataset.errors || '') + ' ' + e.message + ';'; });
addEventListener('unhandledrejection', e => { document.documentElement.dataset.errors = (document.documentElement.dataset.errors || '') + ' ' + (e.reason && e.reason.message || e.reason) + ';'; });
const CPK = { H:'#f4f1ea', C:'#5c574e', N:'#3d63b8', O:'#d9473d', S:'#e0b526', P:'#e08a26', F:'#7fbf5a', Cl:'#43a35c', Br:'#8a3b2e', I:'#6a3d8f', Fe:'#c06030', Mg:'#5aa05a' };
const VDW = { H:.5, C:.75, N:.72, O:.7, S:.95, P:.95, F:.65, Cl:.9, Br:1, I:1.1, Fe:.9, Mg:.9 };

function mountSmooth3D(cfg){
  if (!window.THREE) throw new Error('three.min.js did not load before smooth3d.js');
  const THREE = window.THREE;
  document.title = cfg.title;
  const css = document.createElement('style'); css.textContent = `
  :root{--paper:#f2efe7;--ink:#231e16;--muted:#857d6e;--rule:#ddd6c8}
  *{box-sizing:border-box} html,body{margin:0}
  body{background:var(--paper);color:var(--ink);font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;display:flex;flex-direction:column;align-items:center;padding:20px 16px 26px}
  header{width:100%;max-width:820px} header h1{font-size:13px;font-weight:600;margin:0 0 8px;letter-spacing:.02em}
  .s3btns,.s3ctl,.s3foot{width:100%;max-width:820px}
  .s3btns{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 8px}
  button,select{font:inherit;color:var(--ink);background:var(--paper);border:1.5px solid var(--ink);border-radius:999px;padding:5px 14px;cursor:pointer}
  button:hover{background:#0000000d} button:focus-visible,select:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
  button.main{box-shadow:2px 2px 0 var(--ink)} button:disabled{opacity:.45;cursor:default}
  button.tog[aria-pressed="true"]{background:var(--ink);color:var(--paper)}
  #fig{position:relative;width:100%;max-width:820px;aspect-ratio:4/3;border-radius:8px;overflow:hidden;background:radial-gradient(ellipse at 50% 40%,#fbf8f1,#ece6d8);touch-action:none}
  #fig canvas{display:block;width:100%!important;height:100%!important}
  .s3lab{position:absolute;left:0;top:0;transform:translate(-50%,-120%);font:700 10.5px/1 ui-monospace,Menlo,monospace;letter-spacing:.06em;
    background:#fff8e6;border:1.2px solid var(--ink);border-radius:999px;padding:3px 7px;white-space:nowrap;pointer-events:none;box-shadow:1px 1px 0 var(--ink)}
  .s3stats{position:absolute;top:8px;right:10px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;text-align:right;pointer-events:none}
  .s3stats .k{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
  .s3stats .v{font-size:24px;font-weight:800;line-height:1.05;font-variant-numeric:tabular-nums}
  .s3toast{position:absolute;left:50%;top:8px;transform:translateX(-50%);background:#fff1bf;border:1px solid rgba(35,30,22,.28);border-radius:8px;padding:6px 12px;opacity:0;transition:opacity .2s;pointer-events:none;max-width:70%;text-align:center}
  .s3toast.show{opacity:1}
  .s3ctl{display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center;border-top:1px solid var(--rule);padding-top:10px;margin-top:10px}
  .s3ctl label{display:flex;gap:8px;align-items:center;color:var(--muted);font-size:11px;letter-spacing:.08em;text-transform:uppercase}
  .s3ctl label b{color:var(--ink);font-variant-numeric:tabular-nums} .s3ctl input[type=range]{accent-color:var(--ink);width:150px}
  .s3foot{color:var(--muted);font-size:11px;margin-top:10px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .s3foot a{color:inherit}
  @media (max-width:560px){body{padding:10px 10px 18px} header{display:none} #fig{aspect-ratio:1/1.05} .s3stats .v{font-size:18px}}`;
  document.head.appendChild(css);
  document.body.innerHTML = `<header><h1>Fig. ${cfg.fig || ''} — ${cfg.title}</h1></header>
    <div class="s3btns" id="s3b"></div>
    <div id="fig" role="img" aria-label="${cfg.title}"><div class="s3stats" id="s3s" aria-live="polite"></div><div class="s3toast" id="s3t"></div></div>
    <div class="s3ctl" id="s3c"></div>
    <div class="s3foot"><span>${cfg.note || 'Drag to turn · pinch or scroll to zoom.'}</span><span>3D: <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a></span></div>`;
  const box = document.getElementById('fig');
  const q = new URLSearchParams(location.search);

  // ---------- renderer, camera, light
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  box.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const c0 = Object.assign({ yaw: 30, pitch: 18, dist: 160, target: [0, 0, 0], fov: 35 }, cfg.camera || {});
  const camera = new THREE.PerspectiveCamera(c0.fov, 4 / 3, .5, c0.dist * 20);
  const ctr = new THREE.OrbitControls(camera, renderer.domElement);
  ctr.enableDamping = true; ctr.dampingFactor = .08; ctr.enablePan = false; ctr.target.set(...c0.target);
  ctr.minDistance = c0.dist * .35; ctr.maxDistance = c0.dist * 2.5;
  const place = (yaw, pitch) => { const y = yaw * Math.PI / 180, p = pitch * Math.PI / 180;
    camera.position.set(c0.target[0] + c0.dist * Math.cos(p) * Math.sin(y), c0.target[1] + c0.dist * Math.sin(p), c0.target[2] + c0.dist * Math.cos(p) * Math.cos(y));
    camera.lookAt(...c0.target); ctr.update(); };
  place(q.has('yaw') ? +q.get('yaw') : c0.yaw, q.has('pitch') ? +q.get('pitch') : c0.pitch);
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0x8a7f6a, .75));
  const key = new THREE.DirectionalLight(0xffffff, .75); key.position.set(1, 2, 1.4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe6c0, .3); rim.position.set(-1.5, .4, -1); scene.add(rim);

  const col = c => new THREE.Color(PAL[c] || c);
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: col(c), roughness: o.rough ?? .55, metalness: 0,
    transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, depthWrite: (o.opacity ?? 1) >= 1, side: o.side || THREE.FrontSide });
  const V = a => Array.isArray(a) ? new THREE.Vector3(...a) : a.clone();
  const shells = new Set(), labels = [];
  const finish = (m, o = {}) => { (o.parent || scene).add(m); if (o.shell) K.shell(m); if (o.label) K.label(m, o.label, { when: o.labelWhen, dy: o.labelDy }); m.userData.op0 = o.opacity ?? 1; return m; };

  const K = {
    THREE, scene, camera, renderer, busy: false, PAL,
    group(parent){ const g = new THREE.Group(); (parent || scene).add(g); return g; },
    sphere(r, c, pos = [0, 0, 0], o = {}){ const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), mat(c, o)); m.position.copy(V(pos)); return finish(m, o); },
    cyl(a, b, r, c, o = {}){ a = V(a); b = V(b); const L = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(o.r2 ?? r, r, L, 24, 1, false), mat(c, o));
      m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return finish(m, o); },
    helix(a, b, r, c, o = {}){ const av = V(a), bv = V(b), L = av.distanceTo(bv), turns = L / 5.4;
      // a rod with a shallow spiral groove: reads as an α-helix (5.4 Å per turn) and still sorts and shades simply
      const g = new THREE.CylinderGeometry(r, r, L, 28, Math.max(8, Math.round(turns * 10)), false), p = g.attributes.position;
      for (let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ang = Math.atan2(z, x), ph = (y / L + .5) * turns * 2 * Math.PI;
        const k = 1 - .1 * Math.max(0, Math.cos(ang - ph)) ** 6; if (Math.hypot(x, z) > r * .9){ p.setX(i, x * k); p.setZ(i, z * k); } }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat(c, o)); m.position.copy(av).add(bv).multiplyScalar(.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bv.clone().sub(av).normalize()); return finish(m, o); },
    tube(pts, r, c, o = {}){ const curve = new THREE.CatmullRomCurve3(pts.map(V));
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, pts.length * 12), r, 12, false), mat(c, o)); return finish(m, o); },
    box(s, c, pos = [0, 0, 0], o = {}){ const m = new THREE.Mesh(new THREE.BoxGeometry(...s), mat(c, o)); m.position.copy(V(pos)); return finish(m, o); },
    blob(r, c, pos = [0, 0, 0], o = {}){ const g = new THREE.IcosahedronGeometry(r, 4), p = g.attributes.position, s = o.seed || 1, sc = o.scale || [1, 1, 1];
      const n = (x, y, z) => Math.sin(x * 1.7 / r * 3 + s) * Math.sin(y * 1.3 / r * 3 + 2 * s) * Math.sin(z * 1.9 / r * 3 + 3 * s);
      for (let i = 0; i < p.count; i++){ const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)), k = 1 + .09 * n(v.x, v.y, v.z);
        p.setXYZ(i, v.x * k * sc[0], v.y * k * sc[1], v.z * k * sc[2]); }
      g.computeVertexNormals(); const m = new THREE.Mesh(g, mat(c, o)); m.position.copy(V(pos)); return finish(m, o); },
    membrane(o = {}){ const w = o.w || 200, d = o.d || 140, t = o.thick || 40, y = o.y || 0, g = K.group(o.parent);
      const head = t * .22;
      for (const sgn of [1, -1]){ const hb = new THREE.Mesh(new THREE.BoxGeometry(w, head, d), mat(o.head || '#e8b478', { opacity: .5 }));
        hb.position.y = y + sgn * (t / 2 - head / 2); hb.renderOrder = 2; g.add(hb); K.shell(hb); hb.userData.op0 = .5; }
      const core = new THREE.Mesh(new THREE.BoxGeometry(w, t - 2 * head, d), mat(o.color || PAL.membrane, { opacity: .32 }));
      core.position.y = y; core.renderOrder = 2; g.add(core); K.shell(core); core.userData.op0 = .32; return g; },
    molecule(atoms, bonds = [], o = {}){ const g = K.group(o.parent), sc = o.scale ?? 1;
      const pos = atoms.map(a => V(a.p).multiplyScalar(sc));
      atoms.forEach((a, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry((VDW[a.el] || .8) * (o.atom ?? .55) * sc * 1.6, 24, 16), mat(a.color || CPK[a.el] || '#888', o)); m.position.copy(pos[i]); g.add(m); });
      for (const [i, j] of bonds) K.cyl(pos[i], pos[j], (o.bond ?? .18) * sc, o.bondColor || '#b9b0a0', { parent: g, opacity: o.opacity });
      if (o.label) K.label(g, o.label, { when: o.labelWhen });
      return g; },
    arrow(a, b, c, o = {}){ a = V(a); b = V(b); const r = o.r || 1, dir = b.clone().sub(a), L = dir.length(), h = Math.min(L * .35, r * 5), g = K.group(o.parent);
      K.cyl(a, a.clone().add(dir.clone().setLength(L - h)), r, c, { parent: g });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 2.4, h, 20), mat(c)); cone.position.copy(b.clone().sub(dir.clone().setLength(h / 2)));
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); g.add(cone); return g; },
    label(obj, text, o = {}){ const el = document.createElement('div'); el.className = 's3lab'; el.textContent = text; box.appendChild(el);
      labels.push({ obj, el, when: o.when, dy: o.dy || 0 }); return el; },
    shell(obj){ obj.traverse(m => { if (m.isMesh){ shells.add(m); if (m.userData.op0 === undefined) m.userData.op0 = m.material.opacity; } }); return obj; },
    tween(ms, fn, ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2){
      return new Promise(res => { const t0 = performance.now(); const go = () => { const t = Math.min(1, (performance.now() - t0) / ms); fn(ease(t)); t < 1 ? requestAnimationFrame(go) : res(); }; go(); }); },
    move(obj, to, ms = 900, ease){ const a = obj.position.clone(), b = V(to); return K.tween(ms, t => obj.position.lerpVectors(a, b, t), ease); },
    turn(obj, to, ms = 900){ const a = obj.rotation.toArray().slice(0, 3); return K.tween(ms, t => obj.rotation.set(...a.map((v, i) => v + (to[i] - v) * t))); },
    fade(obj, op, ms = 500){ const ms_ = []; obj.traverse(m => { if (m.isMesh) ms_.push([m, m.material.opacity]); });
      for (const [m] of ms_){ m.material.transparent = true; m.material.depthWrite = false; }
      return K.tween(ms, t => { for (const [m, a] of ms_){ m.material.opacity = a + (op - a) * t; m.userData.op0 = m.material.opacity; } }); },
    wait(ms){ return new Promise(r => setTimeout(r, ms)); },
    flash(text, ms = 2200){ const t = document.getElementById('s3t'); t.textContent = text; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms); },
    setStats(){ if (!cfg.stats) return; const s = cfg.stats(st, K);
      const html = s.map(x => `<div><div class="k">${x.label}</div><div class="v">${x.value}</div></div>`).join('');
      const el = document.getElementById('s3s'); if (el._h !== html){ el.innerHTML = html; el._h = html; } }
  };

  // ---------- build
  const st = JSON.parse(JSON.stringify(cfg.state || {}));
  const parts = cfg.build ? (cfg.build(K, st) || {}) : {};

  // ---------- see-through and labels
  let xr = q.get('xr') === '1', showLabels = q.get('labels') === '1';
  const applyXR = () => { for (const m of shells){ m.material.transparent = true; m.material.depthWrite = !xr && m.userData.op0 >= 1;
    m.material.opacity = xr ? Math.min(m.userData.op0, .12) : m.userData.op0; m.material.needsUpdate = true; } };

  // ---------- controls
  const bwrap = document.getElementById('s3b'), cwrap = document.getElementById('s3c'), btns = [];
  const run = async s => { if (K.busy) return; K.busy = true; btns.forEach(b => b.disabled = true);
    try { await s.run(K, parts, st); } finally { K.busy = false; btns.forEach(b => b.disabled = false); K.setStats(); } };
  for (const s of cfg.steps || []){ const b = document.createElement('button'); b.textContent = s.label; if (s.main) b.className = 'main';
    b.onclick = () => run(s); bwrap.appendChild(b); btns.push(b); b._step = s; }
  const rb = document.createElement('button'); rb.textContent = 'Reset'; rb.onclick = () => { if (cfg.reset){ cfg.reset(K, parts, st); K.setStats(); } else location.reload(); };
  bwrap.appendChild(rb);
  const tog = (label, on, fn) => { const b = document.createElement('button'); b.className = 'tog'; b.textContent = label; b.setAttribute('aria-pressed', on);
    b.onclick = () => { on = !on; b.setAttribute('aria-pressed', on); fn(on); }; cwrap.appendChild(b); };
  tog('See-through', xr, v => { xr = v; applyXR(); });
  tog('Labels', showLabels, v => { showLabels = v; });
  for (const p of cfg.pickers || []){ const l = document.createElement('label'); l.textContent = p.label; const s = document.createElement('select');
    p.options.forEach((o, i) => { const op = document.createElement('option'); op.value = i; op.textContent = o; s.appendChild(op); });
    s.value = p.value || 0; s.onchange = () => { p.onChange(+s.value, K, parts, st); K.setStats(); }; l.appendChild(s); cwrap.appendChild(l); }
  for (const p of cfg.params || []){ const l = document.createElement('label'), fmt = p.fmt || (v => v);
    const v0 = q.has(p.key) ? +q.get(p.key) : p.value; st[p.key] = v0;
    l.innerHTML = `${p.label} <b>${fmt(v0)}</b>`; const r = document.createElement('input'); Object.assign(r, { type: 'range', min: p.min, max: p.max, step: p.step || .01, value: v0 });
    r.oninput = () => { st[p.key] = +r.value; l.querySelector('b').textContent = fmt(+r.value); p.onInput && p.onInput(+r.value, K, parts, st); K.setStats(); };
    l.appendChild(r); cwrap.appendChild(l); }
  applyXR();

  // ---------- loop
  const resize = () => { const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();
  const tmp = new THREE.Vector3(); let last = performance.now();
  const loop = now => { const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (cfg.tick) cfg.tick(dt, K, parts, st);
    ctr.update(); renderer.render(scene, camera); K.setStats();
    const w = box.clientWidth, h = box.clientHeight;
    for (const L of labels){ const vis = showLabels && (!L.when || L.when(st)) && L.obj.visible;
      if (!vis){ L.el.style.display = 'none'; continue; }
      L.obj.getWorldPosition(tmp); tmp.y += L.dy; tmp.project(camera);
      if (tmp.z > 1 || !isFinite(tmp.x)){ L.el.style.display = 'none'; continue; }
      L.el.style.display = ''; L.el.style.left = ((tmp.x + 1) / 2 * w).toFixed(1) + 'px'; L.el.style.top = ((1 - tmp.y) / 2 * h).toFixed(1) + 'px'; }
    requestAnimationFrame(loop); };
  requestAnimationFrame(loop);

  // ---------- ?press=Label@ms,...
  if (q.get('press')) for (const item of q.get('press').split(',')){ const [lab, ms] = item.split('@');
    setTimeout(() => { const b = btns.find(x => x.textContent.trim().toLowerCase() === lab.trim().toLowerCase()); if (b) run(b._step); }, +ms || 300); }
  return K;
}
