"use strict";
/* Repolarisation : de l'occlusion coronaire à la séquelle.
   - ECG 12 dérivations : le modèle dipolaire de la plateforme (ECGModel) reçoit un « vecteur de lésion » dirigé vers le
     territoire ischémié. Sus-décalage, miroir, onde Q et inversion de T en découlent dans toutes les dérivations à la fois.
   - Coronarographie : deux vraies images (Wikimedia Commons) ; l'injection et l'occlusion sont simulées par traitement
     d'image (voir tools/build_coro.py).
   Limites : dipôle unique, amplitudes et chronologie indicatives ; ce n'est pas un modèle de l'ischémie cellulaire. */
const REPOL = (() => {
  const S = { art: 'ivaP', stage: 2, occl: true, labels: true, defi: null, playing: false, tau: 2, injecting: false, res: null };
  const E = {};
  const norm = v => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
  const neg = v => [-v[0], -v[1], -v[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const dirF = (deg, ant) => { const r = deg * Math.PI / 180, c = Math.sqrt(Math.max(0, 1 - ant * ant)); return [Math.cos(r) * c, Math.sin(r) * c, ant]; };

  // Repère du modèle : x = gauche du patient, y = bas, z = avant. dir = direction du territoire vu depuis le centre du cœur.
  const ART = {
    ivaP: { chip: 'IVA proximale', label: 'Interventriculaire antérieure proximale', set: 'lca', bit: 0, dir: norm([0.34, -0.30, 0.89]),
      terr: 'Antérieur étendu', up: 'V1 à V5, DI, aVL', mirror: 'DIII, aVF', seek: 'Occlusion en amont de la première septale et de la première diagonale : le sus-décalage gagne aVL et le miroir inférieur apparaît.' },
    ivaM: { chip: 'IVA moyenne', label: 'Interventriculaire antérieure moyenne', set: 'lca', bit: 1, dir: norm([0.14, -0.06, 0.99]),
      terr: 'Antéro-apical', up: 'V2 à V5, maximum en V3–V4', mirror: 'Peu ou pas de miroir inférieur', seek: 'Occlusion en aval de la première diagonale : DI et aVL sont épargnées.' },
    cx: { chip: 'Circonflexe', label: 'Artère circonflexe', set: 'lca', bit: 2, dir: norm([0.80, 0.30, -0.52]),
      terr: 'Latéral, souvent inféro-postérieur', up: 'DI, aVL, V5, V6 ; parfois DII, aVF', mirror: 'V1 à V3 (miroir de la paroi postérieure)', seek: 'Tracé parfois peu parlant : enregistrer V7, V8, V9.' },
    cd: { chip: 'Coronaire droite', label: 'Artère coronaire droite', set: 'rca', bit: 0, dir: norm([-0.30, 0.93, -0.20]),
      terr: 'Inférieur', up: 'DII, DIII, aVF, avec DIII > DII', mirror: 'DI, aVL', seek: 'Enregistrer V3R et V4R (extension au ventricule droit). Bradycardie et bloc AV fréquents.' },
    peri: { chip: 'Péricardite (comparaison)', label: 'Péricardite aiguë', set: 'lca', bit: null, peri: true, dir: norm([0.70, 0.45, 0.45]),
      terr: 'Diffus, sans systématisation coronaire', up: 'Sus-décalage concave dans presque toutes les dérivations', mirror: 'Pas de miroir, sauf en aVR', seek: 'Sous-décalage du PQ ; en aVR, PQ sus-décalé et ST sous-décalé.' },
  };
  const ORDER = ['ivaP', 'ivaM', 'cx', 'cd', 'peri'];

  // Stades : paramètres du modèle (interpolés entre deux stades voisins)
  const KF_IDM = [ // st : lésion, th : T suraiguë, ti : T négative, q : nécrose
    { st: 0, th: 0, ti: 0, q: 0 }, { st: 0.04, th: 0.5, ti: 0, q: 0 }, { st: 0.27, th: 0.2, ti: 0, q: 0.12 },
    { st: 0.21, th: 0, ti: 0.22, q: 0.7 }, { st: 0.06, th: 0, ti: 0.56, q: 1 }, { st: 0, th: 0, ti: 0.27, q: 1 }];
  const KF_PERI = [ // st : sus-décalage diffus, pr : sous-décalage du PQ, ti : aplatissement puis inversion de T
    { st: 0, pr: 0, ti: 0 }, { st: 0.11, pr: 0.6, ti: 0 }, { st: 0.22, pr: 1, ti: 0 },
    { st: 0.02, pr: 0.3, ti: 0.36 }, { st: 0, pr: 0, ti: 0.64 }, { st: 0, pr: 0, ti: 0 }];
  const STAGES_IDM = [
    ['Avant', 'Tracé de base', 'Repolarisation normale : segment ST isoélectrique, onde T positive et asymétrique.'],
    ['Minutes', 'Ischémie suraiguë : ondes T amples', 'Dans le territoire de l’artère occluse, l’onde T devient ample, large et symétrique ; le point J commence à s’élever. Signe précoce et fugace, souvent manqué.'],
    ['1 à 6 h', 'Lésion : sus-décalage du ST', 'Sus-décalage convexe vers le haut, englobant l’onde T : <b>onde de Pardee</b>. Sous-décalage en miroir dans les dérivations opposées. C’est la fenêtre de la reperfusion.'],
    ['6 à 24 h', 'Nécrose : l’onde Q apparaît', 'L’onde Q se creuse et l’onde R s’amenuise. Le ST reste sus-décalé ; la fin de l’onde T commence à se négativer.'],
    ['Jours', 'Onde T négative, le ST redescend', 'Le ST revient vers la ligne de base. L’onde T est négative, symétrique et pointue. L’onde Q est constituée.'],
    ['Semaines', 'Séquelle', 'L’onde Q persiste. L’onde T peut rester négative ou se normaliser. Un sus-décalage persistant au-delà de 3 semaines fait rechercher un anévrisme ventriculaire.']];
  const STAGES_PERI = [
    ['Avant', 'Tracé de base', 'Repolarisation normale.'],
    ['Début', 'Les premiers signes', 'Le sus-décalage diffus s’installe ; le segment PQ commence à se sous-décaler.'],
    ['Stade I', 'Sus-décalage diffus, PQ sous-décalé', 'Sus-décalage <b>concave vers le haut</b>, dans presque toutes les dérivations, sans miroir (sauf aVR). Sous-décalage du PQ. Pas d’onde Q.'],
    ['Stade II', 'Le ST se normalise', 'Le ST revient à la ligne de base, les ondes T s’aplatissent.'],
    ['Stade III', 'Ondes T négatives diffuses', 'Inversion diffuse des ondes T, sans onde Q de nécrose.'],
    ['Stade IV', 'Retour à la normale', 'Normalisation du tracé, en quelques semaines.']];
  const stagesOf = () => (ART[S.art].peri ? STAGES_PERI : STAGES_IDM);
  function keyAt(s, KF) { const i = clamp(Math.floor(s), 0, KF.length - 2), k = clamp(s - i, 0, 1), a = KF[i], b = KF[i + 1], o = {}; for (const key in a) o[key] = a[key] + (b[key] - a[key]) * k; return o; }

  // Modification des composantes du vecteur cardiaque (voir ECGModel : composantes gaussiennes { t, s, a, d })
  function mod(c) {
    const A = ART[S.art], d = A.dir, out = c.map(x => ({ ...x }));
    if (A.peri) {
      const k = keyAt(S.stage, KF_PERI);
      if (k.st) for (const [t, w] of [[128, 0.5], [185, 0.82], [245, 1]]) out.push({ t, s: 30, a: k.st * w, d });          // concave : monte vers l'onde T
      if (k.pr) out.push({ t: -44, s: 26, a: 0.075 * k.pr, d: neg(dirF(60, 0.15)) });                                       // repolarisation atriale : PQ sous-décalé
      if (k.ti) out.push({ t: 305, s: 58, s2: 40, a: k.ti, d: neg(dirF(45, 0.5)) });
      return out;
    }
    const k = keyAt(S.stage, KF_IDM);
    if (k.q) {                                           // nécrose : les forces initiales fuient la zone, l'onde R s'y amenuise
      out.push({ t: 22, s: 10, a: 0.62 * k.q, d: neg(d) });
      const m = out[3], pr = dot(m.d, d); if (pr > 0) out.push({ t: m.t, s: m.s, a: m.a * pr * 0.55 * k.q, d: neg(d) });
    }
    if (k.st) for (const [t, w] of [[98, 0.85], [150, 1], [205, 1], [258, 0.8]]) out.push({ t, s: 30, a: k.st * w, d });    // courant de lésion : plateau du point J à l'onde T
    if (k.th) out.push({ t: 286, s: 68, s2: 46, a: k.th, d });
    if (k.ti) out.push({ t: 316, s: 52, s2: 42, a: k.ti, d: neg(d) });
    return out;
  }
  // Pathologie « hors catalogue » : non énumérable, pour ne pas apparaître dans le simulateur d'électrodes
  Object.defineProperty(ECGModel.PATHO, '__repol', { enumerable: false, value: { label: 'Repolarisation', mod } });

  const GRID = [['I', 'aVR', 'V1', 'V4'], ['II', 'aVL', 'V2', 'V5'], ['III', 'aVF', 'V3', 'V6']];
  const NAME = { I: 'DI', II: 'DII', III: 'DIII' };
  const QON = 420;
  function compute() {
    const r = ECGModel.compute(SIM_STD(), { profile: 'adulte', patho: '__repol', hr: 72, duration: 2400, offset: QON });
    const iB = Math.round((QON - 215) * r.fs / 1000), iJ = Math.round((QON + 160) * r.fs / 1000); r.st = {};   // ST mesuré 60 ms après le point J, par rapport au segment TP
    for (const row of GRID) for (const l of row) r.st[l] = (r[l][iJ] - r[l][iB]) * 10;                         // en mm
    S.res = r;
  }
  const hidden = () => !!(S.defi && !S.defi.revealed);

  function drawECG() {
    const cv = E.ecg; if (!cv.clientWidth || !S.res) return;
    const wCss = cv.clientWidth, pxmm = wCss / 190, rhMm = 33; const { ctx, w, h: H } = fitCanvas(cv, Math.round(3 * rhMm * pxmm));
    const r = S.res, cw = w / 4, rh = H / 3, i0 = Math.round(0.12 * r.fs), n = Math.round(1.9 * r.fs), show = !hidden();
    drawPaper(ctx, 0, 0, w, H, pxmm);
    GRID.forEach((row, ri) => row.forEach((l, ci) => {
      const x = ci * cw, y0 = ri * rh + rh * 0.58;
      ctx.save(); ctx.beginPath(); ctx.rect(x, ri * rh, cw, rh); ctx.clip(); drawTrace(ctx, r[l], r.fs, x, y0, pxmm, 25, 10, { i0, i1: i0 + n, lw: 1.7 }); ctx.restore();
      const st = r.st[l], up = st >= 1, dn = st <= -0.5; const col = show && up ? css('--bad') : show && dn ? css('--accent') : css('--fg-2');
      Kit.haloText(ctx, (NAME[l] || l) + (show && up ? '  ▲' : show && dn ? '  ▼' : ''), x + 7, ri * rh + 17, { color: col, font: '700 13px ' + css('--font') });
    }));
    ctx.strokeStyle = css('--line-2'); ctx.lineWidth = 1; ctx.beginPath(); for (let c = 1; c < 4; c++) { ctx.moveTo(Math.round(c * cw) + 0.5, 0); ctx.lineTo(Math.round(c * cw) + 0.5, H); } ctx.stroke();
  }

  // ---------- Coronarographie ----------
  const SETS = {};
  function loadSet(name) {
    if (SETS[name]) return SETS[name]; const D = CORO_DATA[name], n = D.size;
    const load = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, n, n); res(x.getImageData(0, 0, n, n).data); }; im.onerror = rej; im.src = src; });
    return SETS[name] = Promise.all([load(D.bg), load(D.map)]).then(([bg, map]) => {
      const N = n * n, o = { name, n, scale: D.scale, lesions: D.lesions, credit: D.credit, bg: new Uint8Array(N), den: new Uint8Array(N), arr: new Uint8Array(N), lab: new Uint8Array(N) };
      for (let i = 0, j = 0; i < N; i++, j += 4) { o.bg[i] = bg[j]; o.den[i] = map[j]; o.arr[i] = map[j + 1]; o.lab[i] = map[j + 2]; }
      return o;
    });
  }
  // [texte, x, y, occlusions qui masquent la légende (le segment n'est alors plus opacifié)]
  const LABELS = {
    lca: [['Sonde', 30, 128, 0], ['Tronc commun', 96, 150, 0], ['IVA', 372, 142, 1], ['Circonflexe', 256, 356, 4]],
    rca: [['Sonde', 372, 34, 0], ['Coronaire droite', 28, 304, 1], ['Branches distales', 392, 412, 1]],
  };
  const VIEW = { lca: 'Injection de la coronaire gauche', rca: 'Injection de la coronaire droite' };
  const occBit = () => { const A = ART[S.art]; return (S.occl && A.bit != null && S.stage >= 0.5) ? (1 << A.bit) : 0; };

  function drawCoro() {
    const D = E.set, cv = E.coro; if (!D) return; const n = D.n;
    if (cv.width !== n) { cv.width = cv.height = n; E.cctx = cv.getContext('2d'); E.img = E.cctx.createImageData(n, n); }
    const out = E.img.data, occ = occBit(), T = S.tau * 250, sc = D.scale, bg = D.bg, den = D.den, arr = D.arr, lab = D.lab;
    for (let i = 0, j = 0, N = n * n; i < N; i++, j += 4) {
      let v = bg[i]; const a = arr[i];
      if (a !== 255 && !(occ && (lab[i] & occ))) { const wgt = a === 0 ? 1 : (T - a) / 14; if (wgt > 0) v -= den[i] * sc * (wgt > 1 ? 1 : wgt); }   // fond − densité du vaisseau × remplissage
      out[j] = out[j + 1] = out[j + 2] = v; out[j + 3] = 255;
    }
    const c = E.cctx; c.putImageData(E.img, 0, 0);
    if (hidden()) return;
    if (S.labels) for (const [txt, x, y, hideIf] of LABELS[D.name]) if (!(hideIf & occ)) Kit.haloText(c, txt, x, y, { color: '#fff', halo: 'rgba(0,0,0,.75)', font: '600 15px ' + css('--font') });
    if (occ) {
      const [lx, ly] = D.lesions[ART[S.art].bit]; c.save(); c.strokeStyle = '#ff375f'; c.lineWidth = 3; c.beginPath(); c.arc(lx, ly, 22, 0, 7); c.stroke(); c.restore();
      Kit.haloText(c, 'Occlusion', lx + 28, ly - 20, { color: '#ff6b88', halo: 'rgba(0,0,0,.8)', font: '700 16px ' + css('--font') });
    }
  }
  function inject() { if (reduceMotion) { S.tau = 2; S.injecting = false; drawCoro(); return; } S.tau = 0; S.injecting = true; }
  function setArtSet() { const name = ART[S.art].set; return loadSet(name).then(D => { if (ART[S.art].set !== name) return; E.set = D; paintCoroText(); inject(); drawCoro(); }).catch(() => { E.coroCap.textContent = 'Image de coronarographie indisponible.'; }); }
  function paintCoroText() {
    const D = E.set, A = ART[S.art]; if (!D) return; const occ = occBit();
    E.coroCap.textContent = hidden() ? 'Coronarographie masquée pendant le défi.' : `${VIEW[D.name]}. ${A.peri ? 'La péricardite n’est pas due à une occlusion coronaire.' : occ ? `Occlusion simulée : ${A.label.toLowerCase()}.` : 'Sans occlusion simulée.'}`;
    E.credit.innerHTML = `Image réelle : ${D.credit.author}, ${D.credit.license}, <a href="${D.credit.url}" target="_blank" rel="noopener">Wikimedia Commons</a>. Injection et occlusion simulées par traitement d’image.`;
  }

  // ---------- Interface ----------
  function update(opts = {}) {
    compute(); drawECG(); paintTexts(); paintCoroText();
    if (opts.coro) drawCoro();
  }
  function paintTexts() {
    const A = ART[S.art], st = stagesOf(), i = clamp(Math.round(S.stage), 0, 5), hid = hidden();
    $$('.chip', E.chips).forEach(b => { b.setAttribute('aria-pressed', String(!hid && b.dataset.k === S.art)); if (!S.defi) b.classList.remove('correct', 'wrong'); });
    $$('button', E.ticks).forEach((b, k) => { b.textContent = st[k][0]; b.setAttribute('aria-pressed', String(k === i)); });
    E.stageName.textContent = st[i][1]; E.stageTxt.innerHTML = st[i][2];
    E.slider.value = S.stage; E.veil.hidden = !hid;
    E.occSeg.style.visibility = (A.bit == null || hid) ? 'hidden' : 'visible';
    $$('button', E.occSeg).forEach(b => { b.setAttribute('aria-pressed', String((b.dataset.v === '1') === S.occl)); b.disabled = S.stage < 0.5; });
    E.banner.hidden = !S.defi;
    if (S.defi) E.bannerTxt.innerHTML = hid ? '<b>Défi.</b> Où est le sus-décalage ? Y a-t-il un miroir ? Nommez le territoire, puis cliquez l’artère proposée par la salle.' : `<b>Réponse : ${A.label}.</b> ${A.terr}.`;
    E.btnReveal.hidden = !hid;
    E.terr.innerHTML = '';
    const rows = [['Sus-décalage', A.up], ['Miroir', A.mirror], ['Territoire', A.terr], [A.peri ? 'Diagnostic' : 'Artère', A.label], ['À rechercher', A.seek]];
    if (hid) { S.defi.list = Kit.revealList(rows.slice(0, 3)); E.terr.append(S.defi.list.el); }
    else {
      E.terr.append(Kit.revealList(rows, { open: true }).el);
      const chips = h('div', { class: 'st-map' });
      for (const row of GRID) for (const l of row) { const v = S.res.st[l]; chips.append(h('span', { class: 'st-chip' + (v >= 1 ? ' up' : v <= -0.5 ? ' dn' : '') }, h('b', null, NAME[l] || l), ' ', (v > 0 ? '+' : v < 0 ? '−' : '') + Kit.frNum(Math.abs(v)))); }
      E.terr.append(h('p', { class: 'xs muted', style: 'margin:10px 0 6px' }, 'Décalage du ST calculé par le modèle, en mm, 60 ms après le point J :'), chips);
    }
  }
  function setArt(k) { S.art = k; S.occl = true; update(); setArtSet(); }
  function setStage(v, fromPlay) { const was = occBit(); S.stage = clamp(v, 0, 5); if (!fromPlay) S.playing = false; paintPlay(); update(); if (occBit() !== was) inject(); }
  function paintPlay() { E.play.textContent = S.playing ? '❚❚ Pause' : '▶︎ Dérouler'; }
  function startDefi() {
    let k; do { k = ORDER[Math.floor(Math.random() * ORDER.length)]; } while (k === S.lastDefi); S.lastDefi = k;
    S.defi = { revealed: false }; S.playing = false; S.art = k; S.stage = 2; S.occl = true; $$('.chip', E.chips).forEach(b => b.classList.remove('correct', 'wrong')); update(); setArtSet();
  }
  function revealDefi(guess) {
    if (!hidden()) return; S.defi.revealed = true;
    $$('.chip', E.chips).forEach(b => { if (b.dataset.k === S.art) b.classList.add('correct'); else if (guess && b.dataset.k === guess) b.classList.add('wrong'); });
    if (guess) toast(guess === S.art ? 'Bonne réponse' : `Réponse attendue : ${ART[S.art].chip}`);
    update(); inject();
  }
  function quitDefi() { S.defi = null; $$('.chip', E.chips).forEach(b => b.classList.remove('correct', 'wrong')); update({ coro: true }); }

  function frame(dt) {
    if (S.injecting) { S.tau += dt / 2400; if (S.tau >= 1.25) { S.tau = 2; S.injecting = false; } drawCoro(); }
    if (S.playing) { let v = S.stage + dt / 3200; if (v >= 5) { v = 5; S.playing = false; } setStage(v, true); }
  }

  let built = false;
  function init() {
    if (built) return; built = true; const root = $('#repolRoot');
    E.chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Artère' }, ORDER.map(k => h('button', { class: 'chip', 'data-k': k, onclick: () => { if (hidden()) revealDefi(k); else { S.defi = null; setArt(k); } } }, ART[k].chip)));
    E.slider = h('input', { type: 'range', min: 0, max: 5, step: 0.05, value: S.stage, 'aria-label': 'Temps écoulé depuis l’occlusion' });
    E.slider.addEventListener('input', () => setStage(+E.slider.value));
    E.ticks = h('div', { class: 'stage-ticks' }, [0, 1, 2, 3, 4, 5].map(k => h('button', { onclick: () => setStage(k) }, '')));
    E.play = h('button', { class: 'btn small secondary', onclick: () => { S.playing = !S.playing; if (S.playing && S.stage >= 4.95) S.stage = 0; paintPlay(); } }, '▶︎ Dérouler');
    E.banner = h('div', { class: 'mystery-banner', hidden: true }, E.bannerTxt = h('div'), h('div', { style: 'display:flex;gap:8px' }, E.btnReveal = h('button', { class: 'btn small', onclick: () => revealDefi(null) }, 'Révéler'), h('button', { class: 'btn small secondary', onclick: quitDefi }, 'Quitter le défi')));
    E.coro = h('canvas', { class: 'coro-cv', 'aria-label': 'Coronarographie' });
    E.veil = h('div', { class: 'veil dark', hidden: true }, h('div', null, h('b', null, 'Coronarographie masquée'), h('span', null, 'Nommez d’abord le territoire sur l’ECG.')));
    E.coroCap = h('p', { class: 'small', style: 'margin-top:10px' }, 'Chargement de l’image…'); E.credit = h('p', { class: 'xs muted', style: 'margin-top:4px' });
    E.occSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'État de l’artère' }, h('button', { 'data-v': '1', onclick: () => { S.occl = true; update(); inject(); } }, 'Occlusion'), h('button', { 'data-v': '0', onclick: () => { S.occl = false; update(); inject(); } }, 'Après désobstruction'));
    E.ecg = h('canvas', { 'aria-label': 'ECG 12 dérivations simulé' });
    E.stageName = h('p', { class: 'dx' }); E.stageTxt = h('p', { class: 'ary-txt' }); E.terr = h('div');
    root.append(
      h('div', { class: 'section-head' },
        h('div', null, h('div', { class: 'eyebrow' }, 'Repolarisation · ischémie'), h('h2', null, 'De l’occlusion à la séquelle.'),
          h('p', null, 'Choisissez l’artère occluse et faites avancer le temps. Le vecteur de lésion pointe vers le territoire ischémié : les 12 dérivations en découlent, miroir compris. La coronarographie montre où l’artère s’arrête.')),
        h('span', { class: 'hint-keys', html: '<kbd>←</kbd> <kbd>→</kbd> stade · <kbd>Espace</kbd> dérouler · <kbd>D</kbd> défi' })),
      h('div', { class: 'card sim-controls' },
        h('div', { class: 'ctl-group' }, h('span', { class: 'ctl-lab' }, 'Artère'), E.chips),
        h('div', { class: 'ctl-group', style: 'flex:1 1 420px' }, h('span', { class: 'ctl-lab' }, 'Temps'), h('div', { class: 'stage-ctl' }, E.slider, E.ticks), E.play),
        h('button', { class: 'btn small', onclick: startDefi }, 'Défi : quelle artère ?')),
      E.banner,
      h('div', { class: 'repol-grid' },
        h('div', { class: 'card coro-card' },
          h('div', { class: 'ecg-tools' }, E.occSeg, h('div', { style: 'display:flex;gap:8px' }, h('button', { class: 'btn small secondary', onclick: inject }, 'Réinjecter'), h('button', { class: 'chip', 'aria-pressed': 'true', onclick: e => { S.labels = !S.labels; e.currentTarget.setAttribute('aria-pressed', String(S.labels)); drawCoro(); } }, 'Légendes'))),
          h('div', { class: 'coro-wrap' }, E.coro, E.veil), E.coroCap, E.credit),
        h('div', { class: 'card ecg-card' }, E.ecg,
          h('p', { class: 'xs muted', style: 'margin-top:8px' }, '25 mm/s, 10 mm/mV. ▲ sus-décalage ≥ 1 mm, ▼ sous-décalage ≥ 0,5 mm. Tracé simulé : modèle à dipôle unique, amplitudes et chronologie indicatives. La reperfusion accélère cette séquence et peut limiter l’onde Q.'))),
      h('div', { class: 'repol-bottom' },
        h('div', { class: 'card panel answer' }, h('h4', null, 'Ce que montre le tracé'), E.stageName, E.stageTxt),
        h('div', { class: 'card panel' }, h('h4', null, 'Territoire'), E.terr)));
    update(); setArtSet();
    observe(E.ecg, drawECG); themeListeners.push(() => { drawECG(); });
    Kit.loop('repol', frame).start();
  }

  viewHooks.repol = () => { init(); drawECG(); };
  viewKeys.repol = e => {
    const k = e.key;
    if (k === 'ArrowRight') { setStage(Math.min(5, Math.floor(S.stage + 1e-6) + 1)); e.preventDefault(); }
    else if (k === 'ArrowLeft') { setStage(Math.max(0, Math.ceil(S.stage - 1e-6) - 1)); e.preventDefault(); }
    else if (k === ' ') { e.preventDefault(); if (hidden()) { if (!S.defi.list.next()) revealDefi(null); } else E.play.click(); }
    else if (k.toLowerCase() === 'd') startDefi();
    else if (k === 'Escape' && S.defi) quitDefi();
  };
  return { init, ART, S, compute };
})();
