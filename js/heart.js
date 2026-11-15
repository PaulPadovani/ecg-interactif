"use strict";
/* Schéma du cœur animé, commun aux modules Arythmies, Méthode (blocs de branche) et Stimulateur.
   Une chronologie (tl) décrit les évènements : oreillettes (A), jonction et voies (N), ventricules (V),
   trajets dans le myocarde (K), spicules de stimulation (S), fibrillation ventriculaire (vf), chocs.
   Le schéma, DII et le diagramme en échelle sont calculés à partir de cette même chronologie.
   Tracés de synthèse à visée pédagogique : durées plausibles, pas mesurées. */
const Heart = (() => {
  const { g, ga, lobe, sstep } = Kit;

  // ================= Chronologie =================
  const P_DUR = { sinus: 85, retro: 55, retroAP: 70, retroPS: 78, focal: 96, f1: 70, f2: 80, f3: 92, paced: 100 };
  const TL = dur => ({ dur, A: [], N: [], V: [], K: [], S: [], marks: [], flutter: null, af: null, block: null, vf: null, shocks: [], bb: null });
  const addA = (tl, t, src, shape, o = {}) => tl.A.push({ t, src, shape, dur: P_DUR[shape] || 80, ...o });
  const addN = (tl, t0, t1, path, dir = 1, block = null) => tl.N.push({ t0, t1, path, dir, block });
  const addV = (tl, t, kind = 'his', o = {}) => tl.V.push({ t, kind, ...o });
  const addK = (tl, path, t0, t1, rev = false) => tl.K.push({ path, t0, t1, rev });
  const addS = (tl, t, ch, o = {}) => tl.S.push({ t, ch, ...o });

  // ================= DII =================
  function synth(tl) {
    const s = Kit.sig(tl.dur + 300);
    const P = (t0, shape) => {
      const d = P_DUR[shape], c = t0 + d / 2, sg = d / 5.2; let fn;
      if (shape === 'sinus') fn = t => g(t, c, sg, 0.15);
      else if (shape === 'paced') fn = t => g(t, c, sg, 0.13);
      else if (shape === 'retro') fn = t => g(t, c, sg, -0.15);
      else if (shape === 'retroAP') fn = t => g(t, c, sg, -0.12);
      else if (shape === 'retroPS') fn = t => g(t, c, sg, -0.22);
      else if (shape === 'focal') fn = t => g(t, t0 + d * 0.33, d / 7.5, 0.10) + g(t, t0 + d * 0.70, d / 7.5, 0.125);
      else if (shape === 'f1') fn = t => g(t, c, sg * 0.8, 0.2);
      else if (shape === 'f2') fn = t => g(t, c, sg, -0.14);
      else fn = t => g(t, t0 + d * 0.32, d / 7, 0.09) + g(t, t0 + d * 0.72, d / 6.5, -0.11);
      Kit.add(s, fn, t0 - 25, t0 + d + 25);
    };
    for (const a of tl.A) if (a.ecg !== false && a.shape) P(a.t, a.shape);
    if (tl.flutter) {            // ondes F : descente lente, remontée rapide, sans retour à la ligne de base
      const T = tl.flutter.period; const tmp = new Float32Array(s.N);
      for (let i = 0; i < s.N; i++) { const t = i * 1000 / s.fs; const ph = ((((t - tl.flutter.t0) % T) + T) % T) / T; tmp[i] = ph < 0.72 ? 0.12 - 0.36 * (ph / 0.72) : -0.24 + 0.36 * ((ph - 0.72) / 0.28); }
      for (let i = 0; i < s.N; i++) { let m = 0, n = 0; for (let k = -4; k <= 4; k++) { const j = i + k; if (j >= 0 && j < s.N) { m += tmp[j]; n++; } } s.data[i] += m / n; }
    }
    if (tl.af) {                 // ondes f : somme de sinusoïdes 4 à 9 Hz
      const rnd = Kit.rng(tl.af.seed); const comp = Array.from({ length: 7 }, () => ({ f: 4.2 + rnd() * 5, ph: rnd() * 6.28, a: 0.018 + rnd() * 0.022, fm: 0.2 + rnd() * 0.5 }));
      for (let i = 0; i < s.N; i++) { const t = i / s.fs; let v = 0; for (const c of comp) v += c.a * (0.6 + 0.4 * Math.sin(6.28 * c.fm * t + c.ph)) * Math.sin(6.28 * c.f * t + c.ph); s.data[i] += v; }
    }
    if (tl.vf) {                 // fibrillation ventriculaire : oscillations rapides, irrégulières, d'amplitude variable
      const [a, b, seed] = tl.vf; const rnd = Kit.rng(seed || 7);
      const comp = Array.from({ length: 6 }, () => ({ f: 3.6 + rnd() * 3.2, ph: rnd() * 6.28, a: 0.12 + rnd() * 0.16, fm: 0.3 + rnd() * 0.6 }));
      Kit.add(s, t => { const x = t / 1000; let v = 0; for (const c of comp) v += c.a * (0.55 + 0.45 * Math.sin(6.28 * c.fm * x + c.ph)) * Math.sin(6.28 * c.f * x + c.ph); return v * sstep((t - a) / 250) * (1 - sstep((t - b + 30) / 30)); }, a, b);
    }
    const Vs = tl.V.slice().sort((a, b) => a.t - b.t);
    Vs.forEach((v, i) => {
      const q = v.t; const rr = i ? Math.min(900, q - Vs[i - 1].t) : 700; let qEnd;
      const T = (amp, qtMin, qtMax, k = 400) => { const QT = clamp(k * Math.sqrt(rr / 1000), qtMin, qtMax), td = QT * 0.42; Kit.add(s, t => ga(t, q + QT - td * 0.42, td * 0.30, td * 0.17, amp), qEnd - 10, q + QT + 80); };
      if (v.kind === 'vt') {
        Kit.add(s, t => lobe(t, q, 100, 1.25, 0.9) + g(t, q + 34, 7, -0.16) + lobe(t, q + 100, 55, -0.38, 1.1), q, q + 160); qEnd = q + 155;
        Kit.add(s, t => ga(t, q + 250, 44, 30, -0.42), q + 150, q + 340);
      } else if (v.kind === 'paced' || v.kind === 'atp') {   // stimulation de la pointe du VD : QRS large, négatif en DII, T de sens opposé
        Kit.add(s, t => lobe(t, q + 2, 24, 0.1) + lobe(t, q + 18, 130, -0.95, 0.9), q, q + 150); qEnd = q + 148;
        T(0.32, 250, 460, 440);
      } else if (v.kind === 'prefull') {                      // ventricules activés par la seule voie accessoire
        Kit.add(s, t => 0.34 * sstep((t - q) / 64) * (1 - sstep((t - q - 64) / 46)) + lobe(t, q + 36, 74, 0.92, 1.0) + lobe(t, q + 110, 34, -0.16, 1.2), q, q + 150); qEnd = q + 144;
        T(-0.12, 230, 420);
      } else if (v.kind === 'pre') {
        Kit.add(s, t => 0.26 * sstep((t - q) / 46) * (1 - sstep((t - q - 46) / 34)) + lobe(t, q + 38, 46, 0.95, 1.15) + lobe(t, q + 84, 28, -0.16, 1.2), q, q + 116); qEnd = q + 112;
        T(0.16, 210, 400);
      } else if (v.kind === 'rbbb') {                         // DII : onde S large et traînante
        Kit.add(s, t => lobe(t, q, 12, -0.05) + lobe(t, q + 12, 34, 0.95, 1.15) + lobe(t, q + 46, 74, -0.3, 0.8), q, q + 122); qEnd = q + 120;
        T(0.2, 220, 420);
      } else if (v.kind === 'lbbb') {                         // DII : R large et crochetée, T opposée
        Kit.add(s, t => lobe(t, q, 146, 0.92, 0.7) - g(t, q + 70, 9, 0.22), q, q + 148); qEnd = q + 146;
        T(-0.24, 260, 440);
      } else {
        Kit.add(s, t => lobe(t, q, 12, -0.06) + lobe(t, q + 12, 32, 1.0, 1.15) + lobe(t, q + 44, 24, -0.2), q, q + 70); qEnd = q + 68;
        T((rr < 450 ? 0.2 : 0.27) * (tl.flutter ? 0.5 : 1), 200, 400);
      }
    });
    for (const sp of tl.S) Kit.add(s, t => g(t, sp.t, 2, 0.9) - g(t, sp.t + 5, 2.5, 0.25), sp.t - 8, sp.t + 14);   // spicule (redessiné net par le lecteur)
    for (const sh of tl.shocks) Kit.add(s, t => { const d = t - sh.t; return d < 0 ? 0 : 4 * Math.exp(-d / 10) - 0.8 * Math.exp(-d / 320) * sstep(d / 20); }, sh.t, sh.t + 1500);
    return s;
  }

  // ================= Schéma =================
  const SHAPES = {
    RA: 'M252 238 L252 122 C252 98 232 86 204 86 C154 86 98 102 86 152 C78 188 86 224 106 238 Z',
    LA: 'M268 238 L268 122 C268 98 288 86 316 86 C366 86 422 102 434 152 C442 188 434 224 414 238 Z',
    RV: 'M106 256 L250 256 C254 340 266 420 292 486 C220 470 120 380 106 256 Z',
    LV: 'M274 262 L414 262 C426 340 392 448 300 492 C290 440 280 340 274 262 Z',
    septA: 'M250 120 L270 120 L270 240 L250 240 Z',
    septV: 'M250 256 L274 262 C280 340 290 440 300 492 L292 486 C266 420 254 340 250 256 Z',
  };
  const PATHS = {
    avn: { d: 'M250 220 C250 232 254 242 262 262 L262 286', cls: 'cond' },
    rbb: { d: 'M262 286 C256 340 258 400 268 444 C226 432 160 388 126 310', cls: 'cond' },
    lbb: { d: 'M262 286 C274 298 282 322 286 352 C290 410 296 450 306 478 C356 452 400 392 412 300', cls: 'cond' },
    kent: { d: 'M428 230 L428 270', cls: 'acc', grp: 'kent' },
    lvk: { d: 'M306 478 C356 452 404 396 428 270', cls: 'track', grp: 'kent' },
    lak: { d: 'M252 226 L264 236 C310 242 380 244 428 230', cls: 'track', grp: 'kent' },
    pj: { d: 'M300 230 C308 238 292 246 300 253 C308 260 292 266 300 272', cls: 'acc', grp: 'pj' },
    vpj: { d: 'M262 290 C276 292 292 286 300 272', cls: 'track', grp: 'pj' },
    pja: { d: 'M300 230 C288 222 270 220 254 222', cls: 'track', grp: 'pj' },
    flut: { d: 'M166 216 A56 48 0 0 0 222 168 A56 48 0 0 0 166 120 A56 48 0 0 0 110 168 A56 48 0 0 0 166 216 Z', cls: 'track', grp: 'flut' },
    slow: { d: 'M2 396 C-36 410 -32 430 -18 442 C-2 455 -30 472 2 492', cls: 'cond slowp', grp: 'inset' },
    fast: { d: 'M2 396 C34 418 34 470 2 492', cls: 'cond', grp: 'inset' },
  };
  // Sondes : boîtier en région pectorale gauche (à droite de l'image), veine sous-clavière puis veine cave supérieure
  const LEAD_A = 'M446 50 C380 30 220 26 160 40 C150 60 150 86 156 102 C162 118 186 124 206 108';
  const LEAD_V = 'M446 56 C380 36 224 32 166 42 C158 70 160 110 176 150 C196 196 222 228 236 262 C246 310 250 380 256 440';
  const SRC = { sa: [118, 118], avnR: [250, 226], kent: [428, 232], pj: [300, 232], focus: [392, 114], f1: [146, 200], f2: [366, 124], f3: [212, 110], leadA: [206, 108] };
  const SRCV = { his: [276, 396], kent: [428, 266], vt: [112, 300], sepR: [262, 350], sepL: [286, 350], rvTip: [256, 440] };
  // Activation ventriculaire selon le type de battement. pk : branches parcourues ; w : [cavité (R, L, B = les deux), point de départ, durée, délai] ; base : durée de QRS de référence
  const KIND = {
    his: { pk: 'both', base: 70, w: [['B', 'his', 68, 0]] },
    cap: { pk: 'both', base: 70, w: [['B', 'his', 68, 0]] },
    pre: { pk: 'both', d0: 40, w: [['B', 'kent', 110, 0], ['B', 'his', 60, 44]] },
    prefull: { w: [['B', 'kent', 150, 0]] },
    vt: { w: [['B', 'vt', 150, 0]] },
    rbbb: { pk: 'lbb', base: 125, w: [['L', 'sepL', 72, 0], ['R', 'sepR', 108, 48]] },
    lbbb: { pk: 'rbb', base: 145, w: [['R', 'sepR', 62, 0], ['L', 'sepL', 128, 42]] },
    paced: { w: [['R', 'rvTip', 95, 0], ['L', 'sepL', 130, 45]] },
    atp: { w: [['R', 'rvTip', 95, 0], ['L', 'sepL', 130, 45]] },
  };
  const far = (p, pts) => Math.max(...pts.map(q => Math.hypot(p[0] - q[0], p[1] - q[1])));
  const CORN_A = [[80, 80], [440, 80], [80, 244], [440, 244]], CORN_V = [[97, 247], [432, 247], [118, 400], [300, 500], [424, 400]];
  const VF_R = [[150, 300], [205, 360], [236, 430], [176, 280]], VF_L = [[322, 300], [372, 330], [330, 420], [300, 365], [392, 290]];

  function create(id) {
    const grp = k => `data-grp="${k}"`;
    let cond = '', comets = '';
    for (const [pid, P] of Object.entries(PATHS)) {
      cond += `<path data-p="${pid}" class="${P.cls}" d="${P.d}" ${P.grp ? grp(P.grp) : ''}/>`;
      for (let k = 0; k < 2; k++) comets += `<path class="comet" data-path="${pid}" d="${P.d}"/><circle class="comet-head" data-path="${pid}" r="5.5"/>`;
    }
    const waves = n => Array.from({ length: n }, () => '<circle class="wave" r="0"/>').join('');
    const mask = (mid, inner, cut) => `<mask id="${mid}" maskUnits="userSpaceOnUse" x="-90" y="0" width="640" height="560"><g fill="#fff" stroke="#fff" stroke-linejoin="round">${inner}</g>${cut}</mask>`;
    const grad = (gid, col) => `<radialGradient id="${gid}"><stop offset="0" stop-color="var(${col})" stop-opacity=".34"/><stop offset=".78" stop-color="var(${col})" stop-opacity=".46"/><stop offset=".93" stop-color="var(${col})" stop-opacity=".95"/><stop offset="1" stop-color="var(${col})" stop-opacity=".5"/></radialGradient>`;
    const svg = `
<svg viewBox="-90 24 640 508" class="heart-svg" role="img" aria-label="Schéma du cœur : oreillettes, ventricules et voies de conduction">
  <defs>
    ${mask(id + 'MA', `<path d="${SHAPES.RA}" stroke-width="13"/><path d="${SHAPES.LA}" stroke-width="13"/><path d="${SHAPES.septA}" stroke="none"/>`, '<rect x="-90" y="245" width="640" height="320" fill="#000"/>')}
    ${mask(id + 'MR', `<path d="${SHAPES.RV}" stroke-width="18"/>`, '<rect x="-90" y="0" width="640" height="247" fill="#000"/>')}
    ${mask(id + 'ML', `<path d="${SHAPES.LV}" stroke-width="32"/><path d="${SHAPES.septV}" stroke="none"/>`, '<rect x="-90" y="0" width="640" height="247" fill="#000"/>')}
    ${grad(id + 'GA', '--accent')}${grad(id + 'GV', '--signal')}
  </defs>
  <path class="hv-vessel svc" d="M150 96 V36"/>
  <path class="hv-vessel" d="M428 126 h40 M432 168 h36"/>
  <g class="hv-wall"><path d="${SHAPES.septA}"/><path d="${SHAPES.septV}"/><path d="${SHAPES.RA}" stroke-width="13"/><path d="${SHAPES.LA}" stroke-width="13"/><path d="${SHAPES.RV}" stroke-width="18"/><path d="${SHAPES.LV}" stroke-width="32"/></g>
  <g class="hv-cav"><path d="${SHAPES.RA}"/><path d="${SHAPES.LA}"/><path d="${SHAPES.RV}"/><path d="${SHAPES.LV}"/></g>
  <g mask="url(#${id}MA)" class="w-a">${waves(4)}</g>
  <g mask="url(#${id}MR)" class="w-r">${waves(4)}</g>
  <g mask="url(#${id}ML)" class="w-l">${waves(5)}</g>
  <g class="shockfx"><path d="${SHAPES.RA}"/><path d="${SHAPES.LA}"/><path d="${SHAPES.RV}"/><path d="${SHAPES.LV}"/></g>
  <path class="hv-ring" d="M76 246 H252 M272 246 H446"/>
  <g class="hv-lab"><text x="168" y="176">OD</text><text x="352" y="176">OG</text><text x="186" y="336">VD</text><text x="346" y="356">VG</text></g>
  <g ${grp('inset')} class="hv-inset"><line x1="243" y1="232" x2="50" y2="398" class="lead"/><circle cx="2" cy="444" r="66" class="lens"/><text x="2" y="368" class="cap">Nœud AV, à la loupe</text><text x="-38" y="448" class="tag slow">lente</text><text x="44" y="448" class="tag">rapide</text></g>
  ${cond}
  <g class="bbmark" data-bb="rbbb"><circle cx="258" cy="312" r="10"/><path d="M252 306 l12 12 M264 306 l-12 12"/></g>
  <g class="bbmark" data-bb="lbbb"><circle cx="279" cy="314" r="10"/><path d="M273 308 l12 12 M285 308 l-12 12"/></g>
  <g ${grp('gen')} class="gen"><rect x="446" y="28" width="62" height="48" rx="13"/><text x="477" y="57" class="gen-lab">PM</text></g>
  <g ${grp('leadA')} class="pmlead" data-lead="A"><path d="${LEAD_A}"/><circle cx="206" cy="108" r="5" class="pmtip"/></g>
  <g ${grp('leadV')} class="pmlead" data-lead="V"><path d="${LEAD_V}"/><circle cx="256" cy="440" r="5" class="pmtip"/></g>
  <path ${grp('coil')} class="coil" d="${LEAD_V}" pathLength="100" stroke-dasharray="0 70 23 100"/>
  <circle class="spark" data-ch="A" cx="206" cy="108" r="0"/>
  <circle class="spark" data-ch="V" cx="256" cy="440" r="0"/>
  ${comets}
  <ellipse class="node n-sa" cx="118" cy="118" rx="12" ry="7" transform="rotate(-38 118 118)"/>
  <ellipse class="node n-avn" cx="250" cy="224" rx="8" ry="11"/>
  <g class="hv-block" hidden><circle cx="250" cy="224" r="15"/><path d="M243 217 l14 14 M257 217 l-14 14"/></g>
  <circle class="focus" data-f="focus" cx="392" cy="114" r="8" ${grp('focus')}/>
  <g ${grp('foci3')}><circle class="focus" data-f="f1" cx="146" cy="200" r="7"/><circle class="focus" data-f="f2" cx="366" cy="124" r="7"/><circle class="focus" data-f="f3" cx="212" cy="110" r="7"/></g>
  <circle class="focus" data-f="vt" cx="112" cy="300" r="8" ${grp('vtf')}/>
  <circle class="focus" data-f="junc" cx="259" cy="252" r="7" ${grp('junc')}/>
  <g class="hv-note">
    <text x="70" y="112" text-anchor="end">Nœud sinusal</text><line x1="74" y1="110" x2="104" y2="116"/>
    <text x="284" y="222">Nœud AV</text><line x1="280" y1="220" x2="260" y2="223"/>
    <text x="286" y="298" class="his">His</text>
    <g ${grp('kent')}><text x="452" y="254">Faisceau</text><text x="452" y="270">de Kent</text><line x1="448" y1="254" x2="434" y2="252"/></g>
    <g ${grp('pj')}><text x="316" y="296">Voie accessoire lente</text><line x1="322" y1="284" x2="304" y2="264"/></g>
    <g ${grp('flut')}><text x="70" y="226" text-anchor="end">Isthme</text><text x="70" y="242" text-anchor="end">cavo-tricuspide</text><line x1="74" y1="226" x2="140" y2="214"/></g>
    <g ${grp('focus')}><text x="452" y="108">Foyer</text><text x="452" y="124">ectopique</text><line x1="448" y1="110" x2="402" y2="113"/></g>
    <g ${grp('foci3')}><text x="452" y="108">3 foyers</text><text x="452" y="124">à tour de rôle</text></g>
    <g ${grp('vtf')}><text x="70" y="298" text-anchor="end">Foyer</text><text x="70" y="314" text-anchor="end">ventriculaire</text><line x1="74" y1="300" x2="102" y2="300"/></g>
    <g ${grp('junc')}><text x="286" y="262">Foyer jonctionnel</text></g>
    <g ${grp('leadA')}><text x="226" y="70">Sonde atriale</text></g>
    <g ${grp('leadV')}><text x="44" y="470" text-anchor="end">Sonde</text><text x="44" y="486" text-anchor="end">ventriculaire</text><line x1="48" y1="472" x2="248" y2="442"/></g>
  </g>
</svg>`;
    const el = h('div', { class: 'heart-box', html: svg }); const root = el.firstElementChild;
    const W = { a: $$('.w-a .wave', root), r: $$('.w-r .wave', root), l: $$('.w-l .wave', root) };
    const paths = {};
    for (const pid of Object.keys(PATHS)) paths[pid] = { base: $(`[data-p="${pid}"]`, root), len: 0, tails: $$(`.comet[data-path="${pid}"]`, root), heads: $$(`.comet-head[data-path="${pid}"]`, root), used: 0 };
    const nodes = { sa: $('.n-sa', root), avn: $('.n-avn', root), block: $('.hv-block', root) };
    const foci = {}; $$('[data-f]', root).forEach(e => { foci[e.dataset.f] = e; });
    const sparks = { A: $('.spark[data-ch="A"]', root), V: $('.spark[data-ch="V"]', root) };
    const bbm = { rbbb: $('[data-bb="rbbb"]', root), lbbb: $('[data-bb="lbbb"]', root) };
    const shockfx = $('.shockfx', root), coil = $('.coil', root);
    let measured = false;
    const measure = () => { if (!root.isConnected) return; for (const P of Object.values(paths)) { try { P.len = P.base.getTotalLength(); } catch (e) { P.len = 0; } } measured = !!paths.avn.len; };

    const used = { a: 0, r: 0, l: 0 };
    function wave(set, p, r, op) {
      const arr = W[set]; if (used[set] >= arr.length) return; const c = arr[used[set]++];
      c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', Math.max(0, r).toFixed(1)); c.setAttribute('fill', `url(#${id}${set === 'a' ? 'GA' : 'GV'})`); c.style.opacity = clamp(op, 0, 1).toFixed(3);
    }
    function comet(pid, pos, rev, alpha = 1) {
      const P = paths[pid]; if (!P || !P.len || P.used >= P.tails.length) return; const k = P.used++;
      const L = P.len, seg = Math.min(44, L * 0.5), sPos = clamp(pos, 0, 1) * L, start = rev ? sPos : sPos - seg;
      const tail = P.tails[k], head = P.heads[k];
      tail.style.strokeDasharray = `${seg} ${L + seg + 20}`; tail.style.strokeDashoffset = String(-start); tail.style.opacity = String(alpha);
      const pt = P.base.getPointAtLength(sPos); head.setAttribute('cx', pt.x); head.setAttribute('cy', pt.y); head.style.opacity = String(alpha);
    }

    function update(t, tl) {
      if (!tl) return; if (!measured) measure(); if (!measured) return;
      for (const P of Object.values(paths)) P.used = 0; used.a = used.r = used.l = 0;
      let saOn = false, avnOn = false; const fociOn = {};
      // oreillettes
      for (const a of tl.A) {
        const dt = t - a.t; if (dt < 0 || dt > a.dur + 170) continue;
        if (a.src === 'sa' && dt < 70) saOn = true; if (dt < 80) fociOn[a.src] = true;
        const p = SRC[a.src]; if (!p) continue;
        const k = Math.min(1, dt / a.dur), fade = dt > a.dur ? 1 - (dt - a.dur) / 170 : 1;
        wave('a', p, 14 + k * far(p, CORN_A), fade);
      }
      if (tl.flutter && paths.flut.len) {          // front tournant autour de l'anneau tricuspide
        const u = ((((t - tl.flutter.t0) % tl.flutter.period) + tl.flutter.period) % tl.flutter.period) / tl.flutter.period;
        comet('flut', u, false); const pt = paths.flut.base.getPointAtLength(u * paths.flut.len); wave('a', [pt.x, pt.y], 78, 0.85);
      }
      const chaos = (set, pts, n, period) => { for (let k = 0; k < n; k++) { const slot = Math.floor((t + k * 43) / period), ph = ((t + k * 43) % period) / period, hsh = Math.abs(Math.sin((slot + 1) * (k + 1) * 12.9898) * 43758.5453) % 1; wave(set, pts[Math.floor(hsh * pts.length)], 12 + ph * 62, 0.9 * (1 - ph)); } };
      if (tl.af) chaos('a', [[130, 130], [200, 190], [150, 200], [215, 115], [320, 120], [390, 150], [340, 205], [410, 205], [300, 170]], 4, 95);
      if (tl.vf && t >= tl.vf[0] && t <= tl.vf[1]) { chaos('r', VF_R, 3, 110); chaos('l', VF_L, 4, 110); }
      // jonction et voies accessoires
      const NP = { avn: 'avn', avnR: 'avn', slow: 'slow', fast: 'fast', kent: 'kent', pjrt: 'pj', junc: 'avn' };
      for (const n of tl.N) {
        if (t < n.t0 || t > n.t1) continue; const pid = NP[n.path]; if (!pid) continue;
        let u = (t - n.t0) / (n.t1 - n.t0), alpha = 1;
        if (n.block != null && u > n.block) { alpha = 1 - (u - n.block) / (1 - n.block); u = n.block; }
        if (pid === 'avn' || pid === 'slow' || pid === 'fast') avnOn = true;
        if (n.path === 'junc') { fociOn.junc = true; comet(pid, 0.45 + 0.55 * u, false, alpha); continue; }
        const rev = n.dir < 0; comet(pid, rev ? 1 - u : u, rev, alpha);
      }
      for (const k of tl.K) { if (t < k.t0 || t > k.t1) continue; const u = (t - k.t0) / (k.t1 - k.t0); comet(k.path, k.rev ? 1 - u : u, k.rev); }
      // ventricules
      for (const v of tl.V) {
        const K = KIND[v.kind] || KIND.his, sc = v.qd && K.base ? v.qd / K.base : 1;
        const dt = t - v.t; if (dt < -10 || dt > 340 * sc) continue;
        if (v.kind === 'vt' && dt >= 0 && dt < 90) fociOn.vt = true;
        if (K.pk) {
          const d0 = K.d0 || 0, u = (dt - d0 + 8) / 52, blockedU = 0.12;
          if (u >= 0 && u <= 1) {
            if (K.pk === 'both' || K.pk === 'lbb') comet('lbb', u, false); else comet('lbb', Math.min(u, blockedU), false, u > blockedU ? Math.max(0, 1 - (u - blockedU) * 3) : 1);
            if (K.pk === 'both' || K.pk === 'rbb') comet('rbb', u, false); else comet('rbb', Math.min(u, blockedU), false, u > blockedU ? Math.max(0, 1 - (u - blockedU) * 3) : 1);
          }
        }
        for (const [cav, pk, dur0, delay0] of K.w) {
          const dur = dur0 * sc, delay = delay0 * sc, p = SRCV[pk], d2 = dt - delay; if (d2 < 0 || d2 > dur + 180) continue;
          const k = Math.min(1, d2 / dur), fade = d2 > dur ? 1 - (d2 - dur) / 180 : 1, r = 14 + k * far(p, CORN_V);
          if (cav !== 'L') wave('r', p, r, fade); if (cav !== 'R') wave('l', p, r, fade);
        }
      }
      for (const set of ['a', 'r', 'l']) for (let i = used[set]; i < W[set].length; i++) W[set][i].style.opacity = '0';
      for (const P of Object.values(paths)) for (let k = P.used; k < P.tails.length; k++) { P.tails[k].style.opacity = '0'; P.heads[k].style.opacity = '0'; }
      nodes.sa.classList.toggle('on', saOn); nodes.avn.classList.toggle('on', avnOn);
      for (const [k, e] of Object.entries(foci)) e.classList.toggle('on', !!fociOn[k]);
      nodes.block.hidden = !(tl.block && t >= tl.block[0] && t <= tl.block[1]);
      bbm.rbbb.style.display = tl.bb === 'rbbb' ? 'inline' : 'none'; bbm.lbbb.style.display = tl.bb === 'lbbb' ? 'inline' : 'none';
      // spicules et chocs
      for (const ch of ['A', 'V']) {
        let best = null; for (const sp of tl.S) { const d = t - sp.t; if (sp.ch === ch && d >= 0 && d < 90 && (best == null || d < best)) best = d; }
        sparks[ch].setAttribute('r', best == null ? 0 : (6 + best * 0.25).toFixed(1)); sparks[ch].style.opacity = best == null ? '0' : (1 - best / 90).toFixed(2);
      }
      let shock = 0; for (const sh of tl.shocks) { const d = t - sh.t; if (d >= 0 && d < 260) shock = Math.max(shock, 1 - d / 260); }
      shockfx.style.opacity = shock.toFixed(2); coil.classList.toggle('hot', shock > 0);
    }
    return {
      el, svg: root, update, measure,
      show(set) { $$('[data-grp]', root).forEach(e => { e.style.display = set.has(e.dataset.grp) ? '' : 'none'; }); },
      leadsOff(off) { $$('.pmlead', root).forEach(e => e.classList.toggle('off', !!off[e.dataset.lead])); },
      gen(label) { $('.gen-lab', root).textContent = label; },
    };
  }

  // ================= Lecteur : schéma + DII + diagramme en échelle =================
  const LAD_H = 124, MX = 34;
  const winMs = w => (w < 560 ? 3000 : 6000);   // fenêtre affichée : 150 mm à 25 mm/s, 75 mm sur téléphone
  function player({ view, id, foot, speed = 0.25 }) {
    const P = { t: 0, speed, playing: !reduceMotion, tl: null, sig: null, fit: null };
    const heart = create(id);
    const wrap = h('div', { class: 'heart-wrap' }, heart.el);
    const cv = h('canvas', { class: 'ary-cv', 'aria-label': 'Tracé DII et diagramme en échelle' });
    const play = h('button', { class: 'btn small secondary', 'aria-pressed': String(P.playing), onclick: () => api.play() }, P.playing ? '❚❚ Pause' : '▶︎ Lecture');
    const scrub = h('input', { type: 'range', min: 0, max: 6000, step: 1, value: 0, class: 'ary-scrub', 'aria-label': 'Position dans la séquence' });
    scrub.addEventListener('input', () => { P.t = +scrub.value; if (P.playing) api.play(false); api.refresh(); });
    const right = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' });
    const ecg = h('div', null,
      h('div', { class: 'ecg-tools' }, h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, play, segGroup([[1, '×1'], [0.5, '×½'], [0.25, '×¼'], [0.1, '×⅒']], P.speed, v => { P.speed = v; }, 'Vitesse de lecture')), right),
      cv, scrub, foot ? h('p', { class: 'xs muted', style: 'margin-top:6px' }, foot) : null);

    function draw(t) {
      const f = P.fit, tl = P.tl, sg = P.sig; if (!f || !tl) return; const { ctx, w, h: H } = f;
      const W_SEC = winMs(w), ecgH = H - LAD_H - 8, pxmm = (w - MX) / (W_SEC / 1000 * 25), pxMs = (w - MX) / W_SEC;
      const win0 = tl.dur <= W_SEC ? 0 : clamp(t - W_SEC * 0.55, 0, tl.dur - W_SEC); const X = tt => MX + (tt - win0) * pxMs;
      ctx.clearRect(0, 0, w, H);
      drawPaper(ctx, MX, 0, w - MX, ecgH, pxmm); const y0 = Math.round(ecgH * 0.62);
      ctx.save(); ctx.beginPath(); ctx.rect(MX, 0, w - MX, ecgH); ctx.clip();
      drawTrace(ctx, sg.data, sg.fs, MX, y0, pxmm, 25, 10, { i0: Math.round(win0 * sg.fs / 1000), i1: Math.round(Math.min(tl.dur, win0 + W_SEC) * sg.fs / 1000) + 1, lw: 1.9 });
      ctx.strokeStyle = css('--trace'); ctx.lineWidth = 1.6; ctx.beginPath();
      for (const sp of tl.S) { const x = Math.round(X(sp.t)) + 0.5; if (x < MX || x > w) continue; ctx.moveTo(x, y0 + 2 * pxmm); ctx.lineTo(x, y0 - 11 * pxmm); }
      ctx.stroke();
      for (const m of tl.marks) { const x = X(m.t); if (x < MX - 40 || x > w) continue; ctx.setLineDash([4, 4]); ctx.strokeStyle = css('--fg-3'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x, ecgH); ctx.stroke(); ctx.setLineDash([]); Kit.haloText(ctx, m.txt, x + 5, 16, { color: css('--fg-2') }); }
      ctx.restore();
      ctx.fillStyle = css('--fg-2'); ctx.font = '600 12px ' + css('--font'); ctx.textAlign = 'left'; ctx.fillText('DII', 4, 16);
      // diagramme en échelle
      const L0 = ecgH + 8, yA0 = L0, yA1 = L0 + 28, yV0 = L0 + LAD_H - 28, yV1 = L0 + LAD_H, yM = (yA1 + yV0) / 2;
      ctx.fillStyle = css('--surface-2'); ctx.fillRect(MX, L0, w - MX, LAD_H);
      ctx.strokeStyle = css('--line-2'); ctx.lineWidth = 1; ctx.beginPath(); for (const y of [yA0, yA1, yV0, yV1]) { ctx.moveTo(MX, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); } ctx.stroke();
      ctx.fillStyle = css('--fg-2'); ctx.fillText('A', 10, (yA0 + yA1) / 2 + 4); ctx.fillText('AV', 6, yM + 4); ctx.fillText('V', 10, (yV0 + yV1) / 2 + 4);
      ctx.save(); ctx.beginPath(); ctx.rect(MX, L0, w - MX, LAD_H); ctx.clip();
      if (tl.block) { const a = X(tl.block[0]), b = X(tl.block[1]); ctx.fillStyle = css('--warn-soft'); ctx.fillRect(a, yA1, b - a, yV0 - yA1); Kit.haloText(ctx, 'nœud AV freiné par l’adénosine', a + 6, yV0 - 6, { color: css('--warn'), halo: css('--surface-2'), font: '600 11px ' + css('--font') }); }
      const COL = { avn: css('--fg'), avnR: css('--fg-3'), slow: css('--warn'), fast: css('--accent'), kent: css('--signal'), pjrt: css('--signal'), junc: css('--signal'), juncR: css('--fg-3') };
      const srcCol = s => s === 'sa' ? css('--fg') : s === 'avnR' ? css('--accent') : (s === 'kent' || s === 'pj') ? css('--signal') : s === 'flut' ? css('--fg-2') : s === 'leadA' ? css('--accent') : css('--warn');
      const tag = (txt, x, y, col) => Kit.haloText(ctx, txt, x + 4, y, { color: col, halo: css('--surface-2'), font: '700 10px ' + css('--font') });
      ctx.lineCap = 'round';
      if (tl.af) { ctx.strokeStyle = css('--fg-3'); ctx.lineWidth = 1.2; ctx.beginPath(); const r = Kit.rng(3); for (let tt = Math.floor(win0 / 34) * 34; tt < win0 + W_SEC; tt += 34) { const x = X(tt); ctx.moveTo(x, yA0 + 5 + r() * 6); ctx.lineTo(x + 3, yA1 - 5 - r() * 6); } ctx.stroke(); }
      if (tl.vf) { ctx.strokeStyle = css('--signal'); ctx.lineWidth = 1.2; ctx.beginPath(); const r = Kit.rng(5); for (let tt = Math.max(tl.vf[0], Math.floor(win0 / 30) * 30); tt < Math.min(tl.vf[1], win0 + W_SEC); tt += 30) { const x = X(tt); ctx.moveTo(x, yV0 + 4 + r() * 6); ctx.lineTo(x + 3, yV1 - 4 - r() * 6); } ctx.stroke(); }
      for (const a of tl.A) {
        const x = X(a.t + (a.src === 'flut' ? 0 : 20)); if (x < MX - 4 || x > w + 4) continue;
        ctx.strokeStyle = srcCol(a.src); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, yA0 + 5); ctx.lineTo(x, yA1 - 4); ctx.stroke();
        if (a.src !== 'sa' && a.src !== 'flut' && a.src !== 'avnR' && a.src !== 'leadA') { ctx.fillStyle = srcCol(a.src); ctx.beginPath(); ctx.arc(x, a.src === 'kent' || a.src === 'pj' ? yA1 - 4 : yA0 + 5, 2.6, 0, 7); ctx.fill(); }
        if (a.mark) tag(a.mark, x, yA0 + 12, a.mark === 'AP' ? css('--accent') : css('--fg-2'));
      }
      for (const n of tl.N) {
        const xa = X(n.t0), xb = X(n.t1); if (xb < MX - 4 || xa > w + 4) continue;
        let ya = n.dir > 0 ? yA1 : yV0, yb = n.dir > 0 ? yV0 : yA1; if (n.path === 'junc' || n.path === 'juncR') ya = yM;
        let x2 = xb, y2 = yb; if (n.block != null) { x2 = xa + (xb - xa) * n.block; y2 = ya + (yb - ya) * n.block; }
        ctx.strokeStyle = COL[n.path] || css('--fg'); ctx.lineWidth = n.path === 'kent' || n.path === 'pjrt' ? 2.2 : 1.8; ctx.setLineDash(n.path === 'kent' || n.path === 'pjrt' ? [5, 3] : []);
        ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
        if (n.block != null) { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x2 - 4, y2); ctx.lineTo(x2 + 4, y2); ctx.stroke(); }
        if (n.path === 'junc') { ctx.fillStyle = COL.junc; ctx.beginPath(); ctx.arc(xa, ya, 3, 0, 7); ctx.fill(); }
      }
      for (const v of tl.V) {
        const x = X(v.t + (v.kind === 'vt' ? 0 : 6)); if (x < MX - 4 || x > w + 4) continue;
        const vt = v.kind === 'vt', pace = v.kind === 'paced' || v.kind === 'atp';
        ctx.strokeStyle = vt ? css('--signal') : pace ? css('--accent') : css('--fg'); ctx.lineWidth = vt || pace ? 3.4 : 2.2;
        ctx.beginPath(); ctx.moveTo(x, yV0 + 4); ctx.lineTo(x, yV1 - 5); ctx.stroke();
        if (vt) { ctx.fillStyle = css('--signal'); ctx.beginPath(); ctx.arc(x, yV1 - 5, 3, 0, 7); ctx.fill(); }
        if (v.mark) tag(v.mark, x, yV1 - 8, v.mark === 'VP' ? css('--accent') : css('--fg-2'));
      }
      for (const sh of tl.shocks) { const x = X(sh.t); if (x < MX - 4 || x > w + 4) continue; ctx.fillStyle = css('--warn'); ctx.fillRect(x - 2, yA0, 4, LAD_H); }
      ctx.restore();
      const xc = X(t); ctx.strokeStyle = css('--signal'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xc, 0); ctx.lineTo(xc, H); ctx.stroke();
      ctx.fillStyle = css('--signal'); ctx.beginPath(); ctx.arc(xc, clamp(y0 - Kit.at(sg, t) * 10 * pxmm, 4, ecgH - 4), 4, 0, 7); ctx.fill();
    }
    function resize() {
      const w = cv.clientWidth; if (!w) return; const pxmm = (w - MX) / (winMs(w) / 1000 * 25);
      const hh = Math.round(32 * pxmm + LAD_H + 8); if (Math.abs(cv.clientHeight - hh) > 1) cv.style.height = hh + 'px';
      P.fit = fitCanvas(cv); draw(P.t);
    }
    const api = {
      heart, heartWrap: wrap, ecg, right, P,
      setTL(tl, t = 0) { P.tl = tl; P.sig = synth(tl); P.t = clamp(t, 0, tl.dur - 1); scrub.max = Math.round(tl.dur); api.refresh(); },
      refresh() { if (!P.tl) return; heart.update(P.t, P.tl); draw(P.t); if (document.activeElement !== scrub) scrub.value = Math.round(P.t); },
      play(v) { P.playing = v ?? !P.playing; play.textContent = P.playing ? '❚❚ Pause' : '▶︎ Lecture'; play.setAttribute('aria-pressed', String(P.playing)); },
      resize,
    };
    observe(cv, resize); themeListeners.push(() => api.refresh());
    Kit.loop(view, dt => { if (!P.playing || !P.tl) return; P.t += dt * P.speed; if (P.t >= P.tl.dur) P.t -= P.tl.dur; api.refresh(); }).start();
    return api;
  }

  // Légende commune sous le schéma
  const legend = (extra = []) => h('div', { class: 'tray' },
    h('span', { class: 'sw' }, h('i', { style: 'border-color:var(--accent);background:var(--accent-soft)' }), 'oreillettes'),
    h('span', { class: 'sw' }, h('i', { style: 'border-color:var(--signal);background:var(--signal-soft)' }), 'ventricules'),
    h('span', { class: 'sw' }, h('i', { style: 'border-color:var(--warn);background:var(--warn)' }), 'front de conduction'), ...extra);

  return { TL, addA, addN, addV, addK, addS, synth, create, player, legend, P_DUR };
})();
