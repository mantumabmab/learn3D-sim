/* ============================================================
   sim.js: a small "what if" simulator page, in the same paper-and-ink look as the figures. The learner flips
   switches (drugs, conditions), moves sliders (doses, rates, priors), presses event buttons, and watches a live
   chart and readouts change. One per set of notes: it is where the learner tests their own predictions.
   scripts/build_page.py inlines it.

   mountSim({
     fig:'05', title:'Gs pathway simulator', note:'Illustrative model: shapes of response, not real concentrations.',
     chart:'time' | 'bars',
     // inputs (all optional)
     params:[{ key:'dose', label:'Agonist dose', min:0, max:10, step:.1, value:1, fmt:v=>v.toFixed(1) }],
     toggles:[{ key:'ptx', label:'Propranolol', value:false, hint:'blocks the receptor' }],
     events:[{ label:'Give a pulse', apply(s, p){ s.agonist += 5; } }],
     // 'time' chart: an ODE / update model stepped live
     init(p){ return { camp:0, pka:0 }; },
     step(s, p, dt){ s.camp += (p.dose - s.camp) * dt; },        // advance the state by dt model-time units
     time:{ window:60, speed:4, dt:.02, unit:'s' },                // window shown, model units per real second
     series:[{ key:'camp', label:'cAMP', color:'#3d63b8', max:10 }],  // max fixes the y axis (else auto)
     // 'bars' chart: recomputed whenever an input changes
     bars(p){ return [{ label:'Prior', value:.01, color:'#857d6e', group:'D' }, ...]; }, yMax:1, yFmt:v=>(v*100).toFixed(0)+'%',
     readouts:(s, p) => [{ label:'Peak cAMP', value:'3.2' }],
     explain:(s, p) => 'One live sentence saying what the learner is seeing.'
   })
   game (optional, for levels 1-2 or quick self-tests): a scored round of questions above the chart
     game:{ rounds:5, ask(i, p){ return { prompt:'Which is bigger?', choices:['1/3','1/4'], answer:0,
            set:{ a:3, b:4 },                      // optional: inputs to set so the chart shows the question
            why:'Fewer pieces means each piece is bigger.' }; } }
     The chart stays hidden until the learner answers (predict first; game.reveal:false shows it throughout).
     Big buttons (48 px), a star per correct answer, kind feedback with the reason, never a lost star, "Play again".
   URL parameters: any param or toggle key (?dose=5&ptx=1), &t=SECONDS to fast-forward a time chart (screenshots).
   Errors are recorded on <html data-errors> for scripts/snapshot.py.
   ============================================================ */
'use strict';
addEventListener('error', e => { document.documentElement.dataset.errors = (document.documentElement.dataset.errors || '') + ' ' + e.message + ';'; });
const SIMPAL = { ink:'#231e16', paper:'#f2efe7', muted:'#857d6e', rule:'#ddd6c8', red:'#d9473d', blue:'#3d63b8', teal:'#2f8f86', mustard:'#e0a526', plum:'#8a4f9e', green:'#43a35c' };

function mountSim(cfg){
  document.title = cfg.title;
  const css = document.createElement('style'); css.textContent = `
  :root{--paper:#f2efe7;--ink:#231e16;--muted:#857d6e;--rule:#ddd6c8}
  *{box-sizing:border-box} html,body{margin:0}
  body{background:var(--paper);color:var(--ink);font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;display:flex;flex-direction:column;align-items:center;padding:20px 16px 26px}
  .w{width:100%;max-width:860px} h1{font-size:13px;font-weight:600;margin:0 0 10px}
  .row{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px;align-items:center}
  button{font:inherit;color:var(--ink);background:var(--paper);border:1.5px solid var(--ink);border-radius:999px;padding:5px 14px;cursor:pointer}
  button:hover{background:#0000000d} button:focus-visible,input:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
  button.main{box-shadow:2px 2px 0 var(--ink)}
  button.tog[aria-pressed="true"]{background:var(--ink);color:var(--paper)}
  button.tog small{display:block;font-size:10px;opacity:.75}
  .stage{position:relative;background:#fbf8f1;border:1px solid var(--rule);border-radius:8px}
  canvas{display:block;width:100%;height:330px}
  .ro{display:flex;flex-wrap:wrap;gap:6px 26px;margin:10px 0 4px}
  .ro .k{font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--muted)}
  .ro .v{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}
  .ex{background:#fff4d6;border-left:4px solid var(--ink);padding:8px 12px;margin:8px 0;border-radius:0 6px 6px 0;font-size:13.5px;line-height:1.5}
  .ctl{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px 26px;border-top:1px solid var(--rule);padding-top:12px;margin-top:6px}
  .ctl label{display:flex;justify-content:space-between;color:var(--muted);font-size:11px;letter-spacing:.08em;text-transform:uppercase}
  .ctl label b{color:var(--ink);font-variant-numeric:tabular-nums} .ctl input{width:100%;accent-color:var(--ink)}
  .lg{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:11px;margin:6px 0 0}.lg i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:5px;border-radius:2px}
  .note{color:var(--muted);font-size:11px;margin-top:10px}
  .game{border:1.5px solid var(--ink);border-radius:10px;background:#fff;padding:12px 14px;margin:0 0 12px}
  .game .gq{font:600 17px/1.35 system-ui,sans-serif;margin:0 0 10px} .game .gc{display:flex;flex-wrap:wrap;gap:10px}
  .game .gc button{min-height:48px;min-width:72px;font:700 18px system-ui,sans-serif;border-radius:12px}
  .game .gc button.ok{background:#d9f0dd} .game .gc button.no{background:#fde2dc}
  .game .gf{font:15px/1.4 system-ui,sans-serif;margin:10px 0 0;min-height:1.4em} .game .gs{float:right;font-size:18px;letter-spacing:2px}
  @media (max-width:560px){body{padding:10px 10px 18px} h1{display:none} canvas{height:250px} .ro .v{font-size:18px}}`;
  document.head.appendChild(css);
  const isTime = (cfg.chart || 'time') === 'time';
  document.body.innerHTML = `<div class="w"><h1>Fig. ${cfg.fig || ''} — ${cfg.title}</h1>
    <div class="row" id="tg"></div><div class="row" id="ev"></div>
    <div class="game" id="gm" hidden></div>
    <div class="stage"><canvas id="c" role="img" aria-label="${cfg.title}"></canvas></div>
    <div class="lg" id="lg"></div><div class="ro" id="ro" aria-live="polite"></div><div class="ex" id="ex" aria-live="polite"></div>
    <div class="ctl" id="pp"></div><div class="note">${cfg.note || ''}</div></div>`;
  const q = new URLSearchParams(location.search), p = {};
  for (const x of cfg.params || []) p[x.key] = q.has(x.key) ? +q.get(x.key) : x.value;
  for (const x of cfg.toggles || []) p[x.key] = q.has(x.key) ? q.get(x.key) === '1' : !!x.value;
  const T = Object.assign({ window: 60, speed: 4, dt: .02, unit: 's' }, cfg.time || {});
  let s = cfg.init ? cfg.init(p) : {}, t = 0, hist = [];
  const reset = () => { s = cfg.init ? cfg.init(p) : {}; t = 0; hist = []; };
  const changed = () => { if (!isTime) draw(); show(); };

  // inputs
  const tg = document.getElementById('tg');
  for (const x of cfg.toggles || []){ const b = document.createElement('button'); b.className = 'tog'; b.setAttribute('aria-pressed', p[x.key]);
    b.innerHTML = x.label + (x.hint ? `<small>${x.hint}</small>` : ''); b.onclick = () => { p[x.key] = !p[x.key]; b.setAttribute('aria-pressed', p[x.key]); changed(); }; tg.appendChild(b); }
  const ev = document.getElementById('ev');
  for (const x of cfg.events || []){ const b = document.createElement('button'); b.className = 'main'; b.textContent = x.label; b.onclick = () => { x.apply(s, p); changed(); }; ev.appendChild(b); }
  if (isTime){ const r = document.createElement('button'); r.textContent = 'Restart'; r.onclick = () => { reset(); changed(); }; ev.appendChild(r);
    const pz = document.createElement('button'); pz.textContent = 'Pause'; pz.onclick = () => { paused = !paused; pz.textContent = paused ? 'Play' : 'Pause'; }; ev.appendChild(pz); }
  const pp = document.getElementById('pp');
  for (const x of cfg.params || []){ const l = document.createElement('div'), fmt = x.fmt || (v => v);
    l.innerHTML = `<label>${x.label} <b>${fmt(p[x.key])}</b></label>`; const r = document.createElement('input');
    Object.assign(r, { type: 'range', min: x.min, max: x.max, step: x.step || .01, value: p[x.key] }); r.setAttribute('aria-label', x.label);
    r.oninput = () => { p[x.key] = +r.value; l.querySelector('b').textContent = fmt(p[x.key]); changed(); }; l.appendChild(r); pp.appendChild(l); }
  if (isTime) document.getElementById('lg').innerHTML = (cfg.series || []).map(x => `<span><i style="background:${x.color}"></i>${x.label}</span>`).join('');

  // chart
  const cv = document.getElementById('c'), cx = cv.getContext('2d');
  const size = () => { const r = devicePixelRatio || 1; cv.width = cv.clientWidth * r; cv.height = cv.clientHeight * r; cx.setTransform(r, 0, 0, r, 0, 0); };
  const axes = (W, H, L, B, yMax, yFmt, xLab) => { cx.strokeStyle = SIMPAL.rule; cx.fillStyle = SIMPAL.muted; cx.font = '10.5px ui-monospace,Menlo,monospace'; cx.lineWidth = 1;
    for (let i = 0; i <= 4; i++){ const y = H - B - (H - B - 14) * i / 4; cx.beginPath(); cx.moveTo(L, y); cx.lineTo(W - 8, y); cx.stroke(); cx.fillText(yFmt(yMax * i / 4), 4, y + 3); }
    if (xLab) cx.fillText(xLab, W - 8 - cx.measureText(xLab).width, H - 6); };
  function draw(){ const W = cv.clientWidth, H = cv.clientHeight; cx.clearRect(0, 0, W, H); const L = 44, B = 22;
    if (isTime){
      const t0 = Math.max(0, t - T.window), X = v => L + (v - t0) / T.window * (W - L - 10);
      let yMax = Math.max(...(cfg.series || []).map(x => x.max || 0)); if (!yMax) yMax = Math.max(1e-9, ...hist.flatMap(h => (cfg.series || []).map(x => h[x.key])));
      axes(W, H, L, B, yMax, cfg.yFmt || (v => +v.toFixed(2)), `time (${T.unit}) →`);
      const Y = v => H - B - (H - B - 14) * Math.min(1.05, v / yMax);
      for (const x of cfg.series || []){ cx.strokeStyle = x.color; cx.lineWidth = 2.6; cx.beginPath();
        hist.forEach((h, i) => { if (h.t < t0) return; i && hist[i - 1].t >= t0 ? cx.lineTo(X(h.t), Y(h[x.key])) : cx.moveTo(X(h.t), Y(h[x.key])); }); cx.stroke(); }
      for (const h of hist) if (h.mark && h.t >= t0){ cx.strokeStyle = SIMPAL.ink; cx.setLineDash([3, 3]); cx.beginPath(); cx.moveTo(X(h.t), 10); cx.lineTo(X(h.t), H - B); cx.stroke(); cx.setLineDash([]); cx.fillStyle = SIMPAL.ink; cx.fillText(h.mark, X(h.t) + 4, 20); }
    } else {
      const bs = cfg.bars(p), yMax = cfg.yMax || Math.max(...bs.map(b => b.value)), n = bs.length, gw = (W - L - 10) / n, fmt = cfg.yFmt || (v => +v.toFixed(2));
      axes(W, H, L, B, yMax, fmt, '');
      bs.forEach((b, i) => { const h = (H - B - 14) * Math.min(1, b.value / yMax), x = L + i * gw + gw * .18, w = gw * .64;
        cx.fillStyle = b.color || SIMPAL.blue; cx.fillRect(x, H - B - h, w, h); cx.strokeStyle = SIMPAL.ink; cx.lineWidth = 1.5; cx.strokeRect(x, H - B - h, w, h);
        cx.fillStyle = SIMPAL.ink; cx.font = '700 11px ui-monospace,Menlo,monospace'; const v = fmt(b.value), lw = cx.measureText(v).width; cx.fillText(v, x + w / 2 - lw / 2, H - B - h - 5);
        cx.font = '10.5px ui-monospace,Menlo,monospace'; cx.fillStyle = SIMPAL.muted; const lt = b.label, ll = cx.measureText(lt).width; cx.fillText(lt, x + w / 2 - ll / 2, H - 6); });
    } }
  const show = () => { const ro = cfg.readouts ? cfg.readouts(s, p) : [];
    document.getElementById('ro').innerHTML = ro.map(r => `<div><div class="k">${r.label}</div><div class="v">${r.value}</div></div>`).join('');
    const ex = document.getElementById('ex'), e = cfg.explain ? cfg.explain(s, p) : ''; ex.textContent = e; ex.style.display = e ? '' : 'none'; };
  // events in a time chart leave a dashed marker
  if (isTime) for (const x of cfg.events || []){ const a = x.apply; x.apply = (S, P) => { a(S, P); hist.push(Object.assign({ t, mark: x.mark || x.label }, S)); }; }

  // game: scored questions; sets inputs so the chart shows each question
  if (cfg.game){ const G = cfg.game, gm = document.getElementById('gm'), R = G.rounds || 5; let i = 0, stars = 0; gm.hidden = false;
    const ask = () => { if (i >= R){ gm.innerHTML = `<div class="gq">${'⭐'.repeat(stars)} ${stars} out of ${R}! ${stars === R ? 'Perfect!' : 'Well played.'}</div><div class="gc"><button class="main" id="ga">Play again</button></div>`;
        gm.querySelector('#ga').onclick = () => { i = 0; stars = 0; ask(); }; return; }
      const Q = G.ask(i, p); if (Q.set){ Object.assign(p, Q.set); changed(); }
      const hideEls = ['.stage', '#ro', '#ex', '#lg'].map(x => document.querySelector(x)); if (G.reveal !== false) hideEls.forEach(e => e && (e.style.visibility = 'hidden'));   // predict first: the chart appears after the answer
      gm.innerHTML = `<span class="gs" aria-label="${stars} stars">${'⭐'.repeat(stars)}</span><div class="gq"><small style="font-weight:400;opacity:.7">Round ${i + 1} of ${R}</small><br>${Q.prompt}</div><div class="gc"></div><div class="gf" aria-live="polite"></div>`;
      const gc = gm.querySelector('.gc'), gf = gm.querySelector('.gf'); let done = false;
      Q.choices.forEach((c, k) => { const b = document.createElement('button'); b.textContent = c; b.onclick = () => { if (done) return; done = true;
        const right = k === Q.answer; if (right) stars++; ['.stage', '#ro', '#ex', '#lg'].forEach(x => { const e = document.querySelector(x); if (e) e.style.visibility = ''; }); b.classList.add(right ? 'ok' : 'no'); if (!right) gc.children[Q.answer].classList.add('ok');
        gf.textContent = (right ? 'Yes! ' : 'Good try. Look at the picture: ') + (Q.why || '');
        const nx = document.createElement('button'); nx.className = 'main'; nx.textContent = i + 1 < R ? 'Next' : 'See stars'; nx.style.marginLeft = '8px';
        nx.onclick = () => { i++; ask(); }; gf.appendChild(nx); }; gc.appendChild(b); }); };
    ask(); }

  let paused = false, last = performance.now();
  const advance = sec => { const n = Math.ceil(sec * T.speed / T.dt); for (let i = 0; i < n; i++){ cfg.step(s, p, T.dt); t += T.dt;
      if (!hist.length || t - hist[hist.length - 1].t >= T.window / 400) hist.push(Object.assign({ t }, s)); }
    while (hist.length && hist[0].t < t - T.window * 1.05) hist.shift(); };
  addEventListener('resize', () => { size(); draw(); }); size();
  if (isTime){ if (q.has('t')) advance(+q.get('t') / T.speed);
    const loop = now => { const d = Math.min(.1, (now - last) / 1000); last = now; if (!paused) advance(d); draw(); show(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  } else { draw(); show(); }
}
