"use strict";
/* Troubles métaboliques : on fait varier la kaliémie, la calcémie ou la température, le complexe se déforme.
   Modèle paramétrique d'un battement (P, QRS, onde J, ST, T, U). Les seuils sont les repères classiques de
   l'enseignement ; la relation entre la valeur biologique et l'ECG est en réalité variable d'un patient à l'autre. */
const METABO = (() => {
  const { g, ga, lobe, sstep, lerp } = Kit;
  const S = { tab: 'k', v: { k: 4.2, ca: 2.4, temp: 37 }, playing: false, dir: 1, defi: null };
  const E = {};

  const NORMAL = { hr: 75, pAmp: 0.15, pDur: 90, pr: 150, qrs: 85, r: 1, s: -0.22, st: 0, stLen: 95, tAmp: 0.3, tW: 170, tSym: 0, u: 0.02, sine: 0, j: 0, tremor: 0 };
  const TABS = {
    k: {
      chip: 'Kaliémie', sym: 'K⁺', unit: 'mmol/L', min: 1.5, max: 9.5, step: 0.1, dec: 1, start: 4.2, sweep: [2.0, 9.2], defi: [2.1, 2.9, 4.2, 5.9, 6.9, 7.8, 8.9],
      title: 'Faites monter la kaliémie, regardez le complexe.',
      zones: [[1.5, 2.5, 'bad', 'Hypokaliémie sévère'], [2.5, 3.5, 'warn', 'Hypokaliémie'], [3.5, 5.0, 'ok', 'Kaliémie normale'], [5.0, 6.0, 'warn', 'Hyperkaliémie légère'], [6.0, 7.0, 'bad', 'Hyperkaliémie modérée'], [7.0, 9.5, 'crit', 'Hyperkaliémie sévère']],
      params(v) {
        const hypo = clamp((3.5 - v) / 2, 0, 1), a = sstep((v - 5.0) / 1.5), b = sstep((v - 6.0) / 1.5), c = sstep((v - 6.5) / 2.0), d = sstep((v - 8.0) / 1.2);
        return { ...NORMAL, hr: 75 - 10 * c, pAmp: (0.15 + 0.07 * hypo) * (1 - b), pDur: 90 + 55 * b, pr: 150 + 40 * hypo + 100 * b,
          qrs: 85 + 110 * c, r: 1 - 0.35 * c, s: -0.22 - 0.5 * c, st: -0.11 * hypo, stLen: 95 - 15 * a,
          tAmp: 0.30 - 0.34 * hypo + 0.72 * a - 0.12 * c, tW: 170 * (1 - 0.2 * a) + 70 * c, tSym: a, u: 0.02 + 0.30 * hypo, sine: d };
      },
      signs: [
        ['Hypokaliémie', [['Onde T aplatie', v => v < 3.5], ['Sous-décalage du ST', v => v < 3.0], ['Onde U proéminente', v => v < 3.0], ['Onde U plus ample que T : faux QT long (intervalle QU)', v => v < 2.5], ['Onde P ample, PR allongé', v => v < 2.5]]],
        ['Hyperkaliémie', [['Ondes T amples, pointues, symétriques, à base étroite', v => v >= 5.5], ['Onde P aplatie, PR allongé', v => v >= 6.5], ['QRS élargi', v => v >= 7.0], ['Disparition de l’onde P', v => v >= 7.5], ['Fusion du QRS et de T : aspect sinusoïdal', v => v >= 8.5]]]],
      causes: [['Hypokaliémie', 'Pertes digestives (vomissements, diarrhée), diurétiques, insuline, bêta-2-mimétiques, alcalose.'], ['Hyperkaliémie', 'Insuffisance rénale, IEC et épargneurs de potassium, lyse cellulaire, acidose, insuffisance surrénale. Écarter d’abord une fausse hyperkaliémie par hémolyse du prélèvement.']],
      pearl: 'La corrélation entre kaliémie et ECG est imparfaite : un ECG normal n’élimine pas une hyperkaliémie sévère. À l’inverse, des signes ECG d’hyperkaliémie sont une urgence. En hypokaliémie, le risque est celui des torsades de pointes.',
    },
    ca: {
      chip: 'Calcémie', sym: 'Ca²⁺', unit: 'mmol/L', min: 1.2, max: 4.0, step: 0.05, dec: 2, start: 2.4, sweep: [1.3, 3.9], defi: [1.5, 1.9, 2.4, 3.1, 3.7],
      title: 'La calcémie règle la longueur du segment ST.',
      zones: [[1.2, 1.9, 'bad', 'Hypocalcémie sévère'], [1.9, 2.2, 'warn', 'Hypocalcémie'], [2.2, 2.6, 'ok', 'Calcémie normale'], [2.6, 3.0, 'warn', 'Hypercalcémie légère'], [3.0, 3.5, 'bad', 'Hypercalcémie modérée'], [3.5, 4.0, 'crit', 'Hypercalcémie sévère']],
      params(v) {
        const lo = clamp((2.2 - v) / 1.0, 0, 1), hi = clamp((v - 2.6) / 1.4, 0, 1), sev = sstep((v - 3.4) / 0.6);
        return { ...NORMAL, pr: 150 + 40 * sev, qrs: 85 + 25 * sev, stLen: 95 + 215 * lo - 92 * Math.min(1, hi * 1.6), j: 0.12 * sev };
      },
      signs: [
        ['Hypocalcémie', [['Segment ST allongé', v => v < 2.2], ['QT long, onde T de forme et de durée conservées', v => v < 2.0]]],
        ['Hypercalcémie', [['Segment ST raccourci, QT court', v => v > 2.6], ['Onde T naissant dès la fin du QRS', v => v > 3.2], ['Formes sévères : PR allongé, QRS élargi, onde J possible', v => v > 3.5]]]],
      causes: [['Hypocalcémie', 'Hypoparathyroïdie (dont microdélétion 22q11), carence en vitamine D, hypocalcémie néonatale, hypomagnésémie.'], ['Hypercalcémie', 'Hyperparathyroïdie, cancers, intoxication à la vitamine D, immobilisation prolongée.']],
      pearl: 'C’est le segment ST qui s’allonge ou se raccourcit, pas l’onde T. Devant un QT long chez un nourrisson, doser la calcémie avant d’évoquer un QT long congénital. La jauge affiche une calcémie totale : c’est le calcium ionisé qui agit, à interpréter selon l’albuminémie.',
    },
    temp: {
      chip: 'Température', sym: 'T°', unit: '°C', min: 24, max: 37, step: 0.5, dec: 1, start: 37, sweep: [37, 24.5], defi: [36.5, 33.5, 31, 28, 25.5],
      title: 'Quand la température baisse, l’onde J apparaît.',
      zones: [[24, 28, 'crit', 'Hypothermie sévère'], [28, 32, 'bad', 'Hypothermie modérée'], [32, 35, 'warn', 'Hypothermie légère'], [35, 37, 'ok', 'Température normale']],
      params(v) {
        const x = clamp((35 - v) / 11, 0, 1), j = sstep((33 - v) / 7);
        return { ...NORMAL, hr: 75 - 45 * x, pAmp: 0.15 * (1 - 0.4 * x), pDur: 90 + 20 * x, pr: 150 + 90 * x, qrs: 85 + 50 * x, stLen: 95 + 60 * x, tAmp: 0.3 - 0.12 * x, tW: 170 + 110 * x, j: 0.5 * j,
          tremor: clamp(1 - Math.abs(v - 33) / 2.6, 0, 1) };
      },
      signs: [
        ['Hypothermie', [['Bradycardie sinusale', v => v < 35], ['Artéfacts de frisson sur la ligne de base', v => v < 35.5 && v > 30.4], ['Onde J d’Osborn : déflexion positive à la jonction QRS–ST', v => v < 32], ['PR, QRS et QT allongés', v => v < 32], ['Risque d’arythmies : fibrillation atriale, puis ventriculaire sous 28 °C (non représentées ici)', v => v < 30]]]],
      causes: [['Contextes', 'Exposition au froid, noyade, hypothermie thérapeutique ou per-opératoire (circulation extracorporelle).']],
      pearl: 'L’onde J d’Osborn grandit à mesure que la température baisse et disparaît au réchauffement. Manipuler doucement un patient très hypotherme : le myocarde est irritable.',
    },
  };
  const ORDER = ['k', 'ca', 'temp'];
  const T = () => TABS[S.tab], val = () => S.v[S.tab], hidden = () => !!(S.defi && !S.defi.revealed);
  const zoneOf = (tab, v) => tab.zones.find(z => v >= z[0] && v <= z[1]) || tab.zones[tab.zones.length - 1];

  // ---------- Signal ----------
  function beat(s, q, P) {
    const pOn = q - P.pr; if (P.pAmp > 0.004) Kit.add(s, t => g(t, pOn + P.pDur / 2, P.pDur / 5.2, P.pAmp), pOn - 30, pOn + P.pDur + 30);
    const d = P.qrs, wq = d * 0.15, wr = d * 0.40, ws = d * 0.45;
    Kit.add(s, t => lobe(t, q, wq, -0.06) + lobe(t, q + wq, wr, P.r, 1.15) + lobe(t, q + wq + wr, ws, P.s, 1.1), q, q + d);
    const J = q + d; if (P.j > 0.01) Kit.add(s, t => g(t, J + 10, 15, P.j), J - 35, J + 75);
    const s1 = lerp(0.30, 0.20, P.tSym) * P.tW, s2 = lerp(0.17, 0.20, P.tSym) * P.tW, tC = J + P.stLen + 2 * s1, tEnd = tC + 2.4 * s2;
    Kit.add(s, t => ga(t, tC, s1, s2, P.tAmp), J, tEnd + 40);
    if (P.st) Kit.add(s, t => P.st * sstep((t - J + 6) / 24) * (1 - sstep((t - (tC - s1 * 1.4)) / (s1 * 1.8))), J - 6, tC + s1);
    const uC = tEnd + 62; if (P.u > 0.03) Kit.add(s, t => g(t, uC, 34, P.u), uC - 120, uC + 120);
    return { q, pC: pOn + P.pDur / 2, rC: q + wq + wr / 2, J, tC, tEnd, uC };
  }
  function strip(P, dur, q0 = 420) {
    const s = Kit.sig(dur), rr = 60000 / P.hr, marks = [];
    for (let q = q0; q < dur + rr; q += rr) marks.push(beat(s, q, P));
    if (P.sine > 0) for (let i = 0; i < s.N; i++) { const t = i * 1000 / s.fs; s.data[i] = (1 - P.sine) * s.data[i] + P.sine * 0.72 * Math.sin(2 * Math.PI * (t - q0 + rr * 0.08) / rr); }
    if (P.tremor > 0.01) { const r = Kit.rng(9), c = Array.from({ length: 6 }, () => ({ f: 22 + r() * 26, ph: r() * 6.28, fm: 0.6 + r() * 1.8 })); for (let i = 0; i < s.N; i++) { const t = i / s.fs; let v = 0; for (const k of c) v += Math.sin(6.28 * k.f * t + k.ph) * (0.5 + 0.5 * Math.sin(6.28 * k.fm * t + k.ph)); s.data[i] += 0.016 * P.tremor * v; } }
    return { sig: s, marks, rr };
  }
  function measures(P) {
    const s1 = lerp(0.30, 0.20, P.tSym) * P.tW, s2 = lerp(0.17, 0.20, P.tSym) * P.tW, qt = P.qrs + P.stLen + 2 * s1 + 2.4 * s2, rr = 60000 / P.hr;
    return { fc: Math.round(P.hr), pr: P.pAmp > 0.02 ? Math.round(P.pr / 5) * 5 : null, qrs: Math.round(P.qrs / 5) * 5, qtc: P.sine > 0.35 ? null : Math.round(qt / Math.sqrt(rr / 1000) / 5) * 5 };
  }

  // ---------- Dessin ----------
  function drawBeat() {
    const cv = E.beat; if (!cv.clientWidth) return; const { ctx, w, h: H } = fitCanvas(cv); const P = T().params(val());
    const rr = 60000 / P.hr, q = 520, S1 = strip(P, 2600, q), m = S1.marks[0];
    const pxmm = H / 34; drawPaper(ctx, 0, 0, w, H, pxmm);
    const tA = q - Math.max(260, P.pr + 110), tB = Math.min(q + rr - 30, Math.max(m.uC + 150, q + 560)), winS = (tB - tA) / 1000;
    const speed = (w - 16) / pxmm / winS, y0 = Math.round(21 * pxmm), fs = S1.sig.fs, X = t => 8 + (t - tA) / 1000 * speed * pxmm, Y = t => y0 - Kit.at(S1.sig, t) * 10 * pxmm;
    drawTrace(ctx, S1.sig.data, fs, 8, y0, pxmm, speed, 10, { i0: Math.round(tA * fs / 1000), i1: Math.round(tB * fs / 1000), lw: 2.8 });
    if (hidden()) return;
    const lab = (txt, t, up, col) => Kit.haloText(ctx, txt, X(t), Y(t) + (up ? -11 : 25), { color: col || css('--signal'), font: '700 19px ' + css('--font-display'), align: 'center' });
    if (P.sine > 0.6) { Kit.haloText(ctx, 'Aspect sinusoïdal', w / 2, 30, { color: css('--bad'), font: '700 18px ' + css('--font-display'), align: 'center' }); return; }
    if (P.pAmp > 0.03) lab('P', m.pC, true); else Kit.haloText(ctx, 'P absente', X(m.pC), y0 - 16, { color: css('--fg-3'), font: '600 13px ' + css('--font'), align: 'center' });
    lab('QRS', m.rC, true);
    if (P.j > 0.06) lab('J', m.J + 10, true, css('--accent'));
    if (Math.abs(P.tAmp) > 0.06) lab('T', m.tC, P.tAmp > 0); else Kit.haloText(ctx, 'T plate', X(m.tC), y0 - 16, { color: css('--fg-3'), font: '600 13px ' + css('--font'), align: 'center' });
    if (P.u > 0.07) lab('U', m.uC, true, css('--accent'));
  }
  function drawStrip() {
    const cv = E.strip; if (!cv.clientWidth) return; const { ctx, w, h: H } = fitCanvas(cv); const P = T().params(val());
    const pxmm = Math.max(3, Math.min(H / 30, w / 150)), dur = Math.ceil(w / pxmm / 25 * 1000) + 200, S1 = strip(P, dur);
    drawPaper(ctx, 0, 0, w, H, pxmm); let x = 8; const y0 = H * 0.64; x += drawCalPulse(ctx, 8, y0, pxmm, 25, 10) + 4;
    drawTrace(ctx, S1.sig.data, S1.sig.fs, x, y0, pxmm, 25, 10, { lw: 1.9, maxX: w - 4 });
  }
  function draw() { drawBeat(); drawStrip(); }

  // ---------- Jauge ----------
  function buildGauge() {
    E.gauge = h('div', { class: 'gauge' }); return E.gauge;
  }
  function paintGauge() {
    const tab = T(), v = val(), hid = hidden(), cx = 130, cy = 134, r = 104; const ang = x => Math.PI + (x - tab.min) / (tab.max - tab.min) * Math.PI;
    const pt = (x, rad = r) => [cx + rad * Math.cos(ang(x)), cy + rad * Math.sin(ang(x))];
    const col = { ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', crit: 'var(--crit)' };
    let arcs = '';
    for (const [a, b, k] of tab.zones) { const gap = (tab.max - tab.min) * 0.006, [x1, y1] = pt(a + gap), [x2, y2] = pt(b - gap); arcs += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${col[k]}" class="g-arc"/>`; }
    const z = zoneOf(tab, v), [nx, ny] = pt(v, r - 4), [bx, by] = pt(v, r - 34);
    const ticks = tab.zones.map(zz => zz[0]).concat([tab.max]).map(x => { const [tx, ty] = pt(x, r + 18); return `<text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" class="g-tick">${String(x).replace('.', ',')}</text>`; }).join('');
    E.gauge.innerHTML = `<svg viewBox="-14 -6 288 182" role="img" aria-label="${tab.chip} : ${hid ? 'valeur masquée' : Kit.frNum(v, tab.dec) + ' ' + tab.unit}">${arcs}${ticks}
      ${hid ? '' : `<line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" class="g-needle"/><circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="7" class="g-dot" fill="${col[z[2]]}"/>`}
      <text x="${cx}" y="${cy - 26}" class="g-sym">${tab.sym}</text><text x="${cx}" y="${cy + 14}" class="g-val">${hid ? '?' : Kit.frNum(v, tab.dec)}</text><text x="${cx}" y="${cy + 32}" class="g-unit">${tab.unit}</text></svg>`;
    E.status.textContent = hid ? 'Valeur masquée' : z[3]; E.status.className = 'verdict ' + (hid ? 'info' : z[2] === 'crit' ? 'bad' : z[2]);
  }

  function paint() {
    const tab = T(), v = val(), hid = hidden(), P = tab.params(v), M = measures(P);
    $$('button', E.tabs).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === S.tab)));
    E.h2.textContent = tab.title; E.slider.min = tab.min; E.slider.max = tab.max; E.slider.step = tab.step; E.slider.value = v; E.sliderRow.style.visibility = hid ? 'hidden' : 'visible';
    paintGauge();
    E.read.innerHTML = [['FC', M.fc, '/min'], ['PR', M.pr, 'ms'], ['QRS', M.qrs, 'ms'], ['QTc', M.qtc, 'ms']].map(([k, x, u]) => `<div><b>${x == null ? '–' : x}</b><span>${k}${x == null ? '' : ' · ' + u}</span></div>`).join('');
    E.signs.innerHTML = '';
    if (hid) { const rows = [['Rythme, FC', 'À décrire : fréquence, onde P, PR.'], ['QRS', 'Fin ou large ?'], ['ST, T, U', 'Segment ST, forme de T, onde U ou onde J ?']]; S.defi.list = Kit.revealList(rows.map(([a, b]) => [a, b])); E.signs.append(h('p', { class: 'small', style: 'margin-bottom:8px' }, 'Faites décrire le tracé, puis proposez une valeur.'), S.defi.list.el); }
    else for (const [head, items] of tab.signs) { E.signs.append(h('div', { class: 'xs muted', style: 'font-weight:600;margin-top:6px' }, head)); const box = h('div', { class: 'alerts' }); for (const [txt, on] of items) { const act = on(v); box.append(h('div', { class: 'alert sign ' + (act ? 'on' : 'off') }, h('i'), h('span', null, txt))); } E.signs.append(box); }
    E.causes.innerHTML = ''; for (const [k, txt] of tab.causes) E.causes.append(h('p', { class: 'ary-txt', style: 'margin-bottom:8px', html: `<b>${k}.</b> ${txt}` }));
    E.pearl.innerHTML = '<b>À retenir. </b>' + tab.pearl;
    E.banner.hidden = !S.defi;
    if (S.defi) E.bannerTxt.innerHTML = hid ? `<b>Défi.</b> ${tab.chip} masquée. Décrivez le tracé, annoncez une valeur, puis révélez.` : `<b>Réponse : ${Kit.frNum(v, tab.dec)} ${tab.unit}.</b> ${zoneOf(tab, v)[3]}.`;
    E.btnReveal.hidden = !hid; E.play.textContent = S.playing ? '❚❚ Pause' : '▶︎ Faire varier';
    draw();
  }
  function setVal(x, fromPlay) { const tab = T(); S.v[S.tab] = clamp(Math.round(x / tab.step) * tab.step, tab.min, tab.max); if (!fromPlay) S.playing = false; paint(); }
  function setTab(k) { S.tab = k; S.playing = false; S.defi = null; paint(); }
  function startDefi() { const tab = T(); let x; do { x = tab.defi[Math.floor(Math.random() * tab.defi.length)]; } while (x === S.lastDefi && tab.defi.length > 1); S.lastDefi = x; S.playing = false; S.defi = { revealed: false }; S.v[S.tab] = x; paint(); }
  function revealDefi() { if (!hidden()) return; S.defi.revealed = true; paint(); }
  function quitDefi() { S.defi = null; paint(); }
  function togglePlay() {
    S.playing = !S.playing; S.defi = null;
    if (S.playing) { const [a, b] = T().sweep; S.dir = b > a ? 1 : -1; if (Math.abs(val() - b) < 2 * T().step) S.v[S.tab] = a; S.acc = val(); }
    paint();
  }
  function frame(dt) {
    if (!S.playing) return; const tab = T(), [a, b] = tab.sweep; S.acc += S.dir * Math.abs(b - a) * dt / 16000;        // un balayage complet en 16 s
    if ((S.dir > 0 && S.acc >= b) || (S.dir < 0 && S.acc <= b)) { S.acc = b; S.playing = false; }
    const next = clamp(Math.round(S.acc / tab.step) * tab.step, tab.min, tab.max); if (next !== val() || !S.playing) { S.v[S.tab] = next; paint(); }
  }

  let built = false;
  function init() {
    if (built) return; built = true; const root = $('#metaboRoot');
    E.tabs = h('div', { class: 'seg', role: 'group', 'aria-label': 'Paramètre' }, ORDER.map(k => h('button', { 'data-k': k, onclick: () => setTab(k) }, TABS[k].chip)));
    E.slider = h('input', { type: 'range', 'aria-label': 'Valeur' }); E.slider.addEventListener('input', () => setVal(+E.slider.value));
    E.play = h('button', { class: 'btn small secondary', onclick: togglePlay }, '▶︎ Faire varier');
    E.sliderRow = h('div', { class: 'meta-slider' }, E.slider);
    E.status = h('span', { class: 'verdict ok' }); E.read = h('div', { class: 'axis-read meta-read' });
    E.beat = h('canvas', { class: 'strip', 'aria-label': 'Un battement agrandi' }); E.beat.style.height = '300px';
    E.strip = h('canvas', { class: 'strip', 'aria-label': 'Dérivation DII' }); E.strip.style.height = '150px';
    E.signs = h('div'); E.causes = h('div'); E.pearl = h('p', { class: 'pearl' }); E.h2 = h('h2');
    E.banner = h('div', { class: 'mystery-banner', hidden: true }, E.bannerTxt = h('div'), h('div', { style: 'display:flex;gap:8px' }, E.btnReveal = h('button', { class: 'btn small', onclick: revealDefi }, 'Révéler'), h('button', { class: 'btn small secondary', onclick: quitDefi }, 'Quitter le défi')));
    root.append(
      h('div', { class: 'section-head' },
        h('div', null, h('div', { class: 'eyebrow' }, 'Troubles métaboliques'), E.h2,
          h('p', null, 'Déplacez le curseur : onde P, QRS, segment ST, onde T et onde U se transforment en continu. Les seuils affichés sont des repères d’enseignement.')),
        h('span', { class: 'hint-keys', html: '<kbd>←</kbd> <kbd>→</kbd> valeur · <kbd>Espace</kbd> faire varier · <kbd>D</kbd> défi' })),
      h('div', { class: 'card sim-controls' }, h('div', { class: 'ctl-group' }, h('span', { class: 'ctl-lab' }, 'Paramètre'), E.tabs), h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, E.play, h('button', { class: 'btn small', onclick: startDefi }, 'Défi : quelle valeur ?'))),
      E.banner,
      h('div', { class: 'meta-grid' },
        h('div', { class: 'card panel meta-gauge' }, buildGauge(), h('div', { style: 'text-align:center' }, E.status), E.sliderRow, E.read,
          h('p', { class: 'xs muted' }, 'FC, PR, QRS et QTc (Bazett) sont ceux du tracé simulé.')),
        h('div', { class: 'card ecg-card meta-ecg' },
          h('div', { class: 'xs muted', style: 'font-weight:600;margin-bottom:6px' }, 'Un battement, agrandi'), E.beat,
          h('div', { class: 'xs muted', style: 'font-weight:600;margin:12px 0 6px' }, 'DII · 25 mm/s · 10 mm/mV'), E.strip)),
      h('div', { class: 'sim-bottom meta-bottom' },
        h('div', { class: 'card panel' }, h('h4', null, 'Sur le tracé'), E.signs),
        h('div', { class: 'card panel' }, h('h4', null, 'Causes à évoquer'), E.causes),
        h('div', { class: 'card panel answer' }, h('h4', null, 'En pratique'), E.pearl)));
    paint(); observe(E.beat, draw); Kit.loop('metabolique', frame).start();
  }

  viewHooks.metabolique = () => { init(); draw(); };
  viewKeys.metabolique = e => {
    const k = e.key, tab = T();
    if (k === 'ArrowRight' || k === 'ArrowLeft') { if (hidden()) return; setVal(val() + (k === 'ArrowRight' ? 1 : -1) * tab.step * (e.shiftKey ? 5 : 1)); e.preventDefault(); }
    else if (k === ' ') { e.preventDefault(); if (hidden()) { if (!S.defi.list.next()) revealDefi(); } else togglePlay(); }
    else if (k.toLowerCase() === 'd') startDefi();
    else if (k === 'Escape' && S.defi) quitDefi();
  };
  return { init, TABS, S };
})();
