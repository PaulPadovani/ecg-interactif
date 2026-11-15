"use strict";
/* « Nommer le QRS » : atelier d'introduction de la Méthode.
   Trois parties : les règles (cours), un atelier où l'on construit un complexe, puis un quiz à révéler. */
const QRSNAME = (() => {
  const TH = 5; // mm : seuil conventionnel entre majuscule et minuscule (0,5 mV à 10 mm/mV)

  // Un complexe est une suite de déflexions { a : amplitude en mm (signée), w : largeur en ms }.
  // Deux déflexions consécutives de même signe n'en forment qu'une (ex. : négative + négative sans R = QS).
  function clean(defs) {
    const out = [];
    for (const d of defs) {
      if (Math.abs(d.a) < 0.5) continue;
      const p = out[out.length - 1];
      if (p && Math.sign(p.a) === Math.sign(d.a)) { p.w += d.w * 0.6; if (Math.abs(d.a) > Math.abs(p.a)) p.a = d.a; }
      else out.push({ ...d });
    }
    return out;
  }

  // Règles de nomenclature
  function nameOf(defs) {
    const d = clean(defs); const parts = []; let nPos = 0, nNeg = 0;
    if (!d.length) return { name: '', parts, d };
    if (d.length === 1 && d[0].a < 0) return { name: 'QS', parts: ['QS'], d };
    for (const x of d) {
      const big = Math.abs(x.a) >= TH;
      if (x.a > 0) { parts.push((big ? 'R' : 'r') + '′'.repeat(nPos)); nPos++; }
      else if (!nPos) parts.push(big ? 'Q' : 'q');
      else { parts.push((big ? 'S' : 's') + '′'.repeat(nNeg)); nNeg++; }
    }
    return { name: parts.join(''), parts, d };
  }

  function explain(defs) {
    const { parts, d } = nameOf(defs);
    if (parts[0] === 'QS') return [['QS', `complexe entièrement négatif (${Kit.frNum(Math.abs(d[0].a))} mm), sans onde R`]];
    let seenR = false;
    return d.map((x, i) => {
      let why;
      if (x.a > 0) { why = seenR ? 'deuxième onde positive' : 'première onde positive'; seenR = true; }
      else why = seenR ? 'négative, après une onde R' : 'négative, avant l’onde R';
      return [parts[i], `${why} · ${Kit.frNum(Math.abs(x.a))} mm, ${Math.abs(x.a) >= TH ? 'ample : majuscule' : 'petite : minuscule'}`];
    });
  }

  // Signal : P discrète, QRS construit déflexion par déflexion, puis T
  function build(defs, o = {}) {
    const d = clean(defs); const q0 = 300; const s = Kit.sig(1000); let t = q0; const peaks = [];
    for (const x of d) {
      const a = x.a * 0.1, t0 = t;
      Kit.add(s, tt => Kit.lobe(tt, t0, x.w, a, x.p || 1.15), t0, t0 + x.w);
      if (x.notch) Kit.add(s, tt => Kit.g(tt, t0 + x.w * 0.5, x.w * 0.075, -a * x.notch), t0, t0 + x.w);   // crochetage : ne franchit pas la ligne de base
      peaks.push({ t: t0 + x.w / 2, a: x.a }); t += x.w;
    }
    const net = d.reduce((m, x) => m + x.a * x.w, 0);
    const tAmp = o.t ?? (net >= 0 ? 0.2 : -0.12);
    Kit.add(s, tt => Kit.g(tt, q0 - 120, 19, 0.1), q0 - 200, q0 - 40);
    Kit.add(s, tt => Kit.ga(tt, t + 200, 58, 34, tAmp), t + 20, t + 340);
    return { sig: s, peaks, q0, qEnd: t, d };
  }

  function draw(cv, defs, o = {}) {
    if (!cv.isConnected || !cv.clientWidth) return;
    const W = build(defs, o.build || {}); const { ctx, w, h: H } = fitCanvas(cv);
    const amps = W.peaks.map(p => p.a); const maxA = Math.max(5, ...amps), minA = Math.min(-5, ...amps);
    const top = Math.ceil((maxA + 3.5) / 5) * 5, bot = Math.floor((minA - 3.5) / 5) * 5;       // en mm, multiples de 5 : la ligne de base tombe sur un trait épais
    const pxmm = H / (top - bot); drawPaper(ctx, 0, 0, w, H, pxmm);
    const tA = W.q0 - 190, tB = W.qEnd + 330;
    const speed = Math.min(100, (w - 8) / pxmm / ((tB - tA) / 1000));                           // « loupe » : jusqu'à 100 mm/s
    const y0 = top * pxmm; let x0 = (w - (tB - tA) / 1000 * speed * pxmm) / 2; x0 = Math.max(0, Math.round(x0 / pxmm) * pxmm);
    const X = t => x0 + (t - tA) / 1000 * speed * pxmm; const fs = W.sig.fs;
    if (o.th) {
      ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = css('--accent'); ctx.lineWidth = 1.4; ctx.beginPath();
      for (const k of [TH, -TH]) { ctx.moveTo(0, y0 - k * pxmm); ctx.lineTo(w, y0 - k * pxmm); } ctx.stroke(); ctx.restore();
      Kit.haloText(ctx, '+5 mm', 8, y0 - TH * pxmm - 5, { color: css('--accent') }); Kit.haloText(ctx, '−5 mm', 8, y0 + TH * pxmm + 15, { color: css('--accent') });
    }
    drawTrace(ctx, W.sig.data, fs, x0, y0, pxmm, speed, 10, { i0: Math.round(tA * fs / 1000), i1: Math.round(tB * fs / 1000), lw: 2.6 });
    if (o.labels) W.peaks.forEach((p, i) => {
      if (!o.labels[i]) return;
      Kit.haloText(ctx, o.labels[i], X(p.t), y0 - p.a * pxmm + (p.a > 0 ? -9 : 24), { color: css('--signal'), font: '700 20px ' + css('--font-display'), align: 'center' });
    });
    Kit.haloText(ctx, `Loupe · ${Math.round(speed)} mm/s · 10 mm/mV`, w - 8, H - 8, { color: css('--fg-3'), font: '500 11px ' + css('--font'), align: 'right' });
  }

  // ---------- Banque du quiz ----------
  const BANK = [
    { d: [{ a: -1.5, w: 18 }, { a: 14, w: 38 }, { a: -2.5, w: 24 }], where: '<b>V5–V6 : aspect normal.</b> La petite onde q traduit la dépolarisation du septum, de la gauche vers la droite.' },
    { d: [{ a: 3, w: 22 }, { a: -14, w: 42 }], where: '<b>V1 chez le grand enfant et l’adulte : aspect normal.</b> Petite r septale, puis grande S : le ventricule gauche domine.' },
    { d: [{ a: 13, w: 36 }, { a: -3.5, w: 26 }], where: '<b>V1 chez le nouveau-né : aspect normal.</b> La R domine, reflet de la prépondérance ventriculaire droite des premières semaines.', o: { t: -0.14 } },
    { d: [{ a: 9, w: 34 }, { a: -10, w: 36 }], where: '<b>V2–V4 : zone de transition.</b> R et S d’amplitude voisine, là où le complexe passe de négatif à positif.' },
    { d: [{ a: 3, w: 22 }, { a: -7, w: 30 }, { a: 9, w: 44 }], where: '<b>V1 : retard droit.</b> Bloc incomplet si le QRS dure 80 à 120 ms, bloc de branche droit complet au-delà de 120 ms (normes du cours).', o: { t: -0.2 } },
    { d: [{ a: 2.5, w: 20 }, { a: -8, w: 34 }, { a: 2.5, w: 24 }], where: '<b>V1, QRS fin.</b> Petite r′ terminale : retard droit minime, fréquent et le plus souvent sans valeur pathologique chez l’enfant et le sportif.' },
    { d: [{ a: 2.5, w: 18 }, { a: -3, w: 20 }, { a: 11, w: 46 }], where: '<b>V1 : R′ plus ample que r.</b> Aspect classique de la surcharge diastolique du ventricule droit, comme dans la communication interauriculaire.', o: { t: -0.2 } },
    { d: [{ a: -3, w: 20 }, { a: 15, w: 44 }], where: '<b>En V1, une onde q n’est pas attendue.</b> L’aspect qR en V1 évoque une hypertrophie ventriculaire droite marquée.', o: { t: -0.22 } },
    { d: [{ a: -13, w: 74 }], where: '<b>V1–V2 : complexe entièrement négatif.</b> Se voit dans le bloc de branche gauche ; chez l’adulte, faire aussi évoquer une séquelle de nécrose antéro-septale.', opts: ['rS', 'Qr', 'qR'], o: { t: 0.3 } },
    { d: [{ a: -6, w: 34 }, { a: 9, w: 40 }], where: '<b>Onde Q large et profonde.</b> Une onde q physiologique est fine (&lt; 20 ms) et peu profonde (&lt; 1/3 du QRS) : ce n’est pas le cas ici.' },
    { d: [{ a: -11, w: 44 }, { a: 3, w: 24 }], where: '<b>aVR : aspect habituel.</b> La dépolarisation s’éloigne de l’épaule droite : le complexe y est surtout négatif.' },
    { d: [{ a: 12, w: 52 }], where: '<b>R exclusive.</b> En V1, elle fait rechercher une hypertrophie ventriculaire droite ; en V6, large et crochetée, un bloc de branche gauche.', opts: ['Rs', 'qR', 'QS'] },
    { d: [{ a: 13, w: 124, p: 0.75, notch: 0.42 }], label: 'R crochetée', where: '<b>V6 dans un bloc de branche gauche.</b> R exclusive, large, « en M ». Le crochetage ne redescend pas sous la ligne de base : ce n’est pas une onde S.', opts: ['RSR′', 'rSr′', 'RS'], o: { t: -0.3 } },
    { d: [{ a: -2, w: 18 }, { a: 12, w: 34 }, { a: -9, w: 46 }], where: '<b>DI et V6 dans un bloc de branche droit.</b> L’onde S est large et traînante : le ventricule droit se dépolarise en retard.' },
  ];
  BANK.forEach(b => { b.name = nameOf(b.d).name; b.answer = b.label || b.name; });

  function shuffle(a, rnd = Math.random) { const o = a.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; }

  // Distracteurs : variantes de casse du bon nom (le piège le plus fréquent), complétées par d'autres noms
  function options(item) {
    let wrong = item.opts;
    if (!wrong) {
      const letters = [...item.name.matchAll(/[QRSqrs]′*/g)].map(m => m[0]); const pool = new Set();
      letters.forEach((L, i) => { const sw = L[0] === L[0].toUpperCase() ? L[0].toLowerCase() : L[0].toUpperCase(); pool.add(letters.map((x, k) => k === i ? sw + x.slice(1) : x).join('')); });
      const others = shuffle(BANK.map(b => b.answer).filter(n => n !== item.answer && !pool.has(n) && n !== 'R crochetée'));
      wrong = shuffle([...pool]).slice(0, 2); for (const n of others) { if (wrong.length >= 3) break; if (!wrong.includes(n)) wrong.push(n); }
    }
    return shuffle([item.answer, ...wrong]);
  }

  // ---------- Rendu ----------
  let quiz = null; // état du quiz en cours, pour le clavier

  function render(card, { onNext } = {}) {
    card.innerHTML = '';
    const cleanups = [];
    card.append(
      h('div', { class: 'section-head', style: 'margin:0' },
        h('div', null, h('div', { class: 'eyebrow' }, 'Avant de commencer · Vocabulaire'), h('h3', null, 'Nommer le QRS'))),
      h('p', { class: 'step-q', html: 'Chaque déflexion du complexe porte une lettre. <b>Trois questions</b> suffisent : positive ou négative ? avant ou après R ? grande ou petite ?' }),
      h('div', { class: 'cols-2' },
        h('div', { class: 'blk' }, h('h4', null, 'Quelle lettre ?'), h('ul', null,
          h('li', { html: '<b>R</b> : toute déflexion <b>positive</b>. La deuxième s’appelle R′ (« R prime »).' }),
          h('li', { html: '<b>Q</b> : déflexion négative qui <b>précède</b> la première onde R.' }),
          h('li', { html: '<b>S</b> : déflexion négative qui <b>suit</b> une onde R (S′ après R′).' }),
          h('li', { html: '<b>QS</b> : complexe entièrement négatif, sans onde R.' }))),
        h('div', { class: 'blk' }, h('h4', null, 'Majuscule ou minuscule ?'), h('ul', null,
          h('li', { html: 'Onde ample, <b>5 mm ou plus</b> (0,5 mV à 10 mm/mV) : majuscule, Q R S.' }),
          h('li', { html: 'Petite onde, <b>moins de 5 mm</b> : minuscule, q r s.' }),
          h('li', { html: 'On dit toujours « complexe QRS », même s’il ne comporte ni onde Q ni onde S.' })))));

    // --- Atelier ---
    {
      const v = { q: 1.5, r: 12, s: 3, rp: 0 };
      const defs = () => [{ a: -v.q, w: 14 + v.q * 1.6 }, { a: v.r, w: 26 + v.r * 0.9 }, { a: -v.s, w: 20 + v.s * 0.9 }, { a: v.rp, w: 24 + v.rp * 1.4 }];
      const cv = h('canvas', { class: 'strip' }); cv.style.height = '300px';
      const out = h('div', { class: 'qrs-out' });
      const drawIt = () => {
        const d = defs(); const n = nameOf(d); draw(cv, d, { th: true, labels: n.parts });
        out.innerHTML = '';
        out.append(h('div', { class: 'qrs-name' }, n.name || '—'),
          h('div', { class: 'qrs-why' }, n.name ? explain(d).map(([L, why]) => h('div', null, h('b', null, L), ' ', why)) : h('div', { class: 'muted' }, 'Ligne isoélectrique : aucune déflexion.')));
      };
      const slider = (key, label, max) => {
        const val = h('span', { class: 'mono' }, Kit.frNum(v[key]) + ' mm');
        const r = h('input', { type: 'range', min: 0, max, step: 0.5, value: v[key], 'aria-label': label });
        r.addEventListener('input', () => { v[key] = +r.value; val.textContent = Kit.frNum(v[key]) + ' mm'; drawIt(); });
        return h('label', { class: 'ctrl qrs-ctrl' }, h('span', null, label), r, val);
      };
      const presets = [['qRs', { q: 1.5, r: 12, s: 3, rp: 0 }], ['rS', { q: 0, r: 3, s: 14, rp: 0 }], ['rSR′', { q: 0, r: 3, s: 7, rp: 9 }], ['QS', { q: 6, r: 0, s: 12, rp: 0 }], ['qR', { q: 3, r: 15, s: 0, rp: 0 }]];
      const el = h('div', { class: 'widget' });
      const rows = h('div', { class: 'ctrl-row' });
      const rebuild = () => { rows.innerHTML = ''; rows.append(slider('q', 'Négative initiale', 12), slider('r', '1re positive', 25), slider('s', 'Négative suivante', 25), slider('rp', '2e positive', 15)); };
      rebuild();
      el.append(h('div', { class: 'w-head' }, h('h4', null, 'Atelier : construisez un complexe'),
        h('div', { class: 'chips' }, presets.map(([t, p]) => h('button', { class: 'chip', onclick: () => { Object.assign(v, p); rebuild(); drawIt(); } }, t)))),
        cv, rows, out,
        h('p', { class: 'xs muted' }, 'Les pointillés bleus marquent le seuil de 5 mm. Faites passer une onde de part et d’autre : la lettre change de casse.'));
      card.append(el); cleanups.push(observe(cv, drawIt));
    }

    // --- Quiz à révéler ---
    {
      const Q = quiz = { order: shuffle(BANK.map((_, i) => i)), i: 0, answered: null, opts: null, ok: 0, n: 0 };
      const cv = h('canvas', { class: 'strip' }); cv.style.height = '300px';
      const side = h('div', { class: 'qrs-side' }); const score = h('span', { class: 'pill' }, '0 / 0');
      const item = () => BANK[Q.order[Q.i % Q.order.length]];
      const drawIt = () => { const it = item(); const done = Q.answered != null; draw(cv, it.d, { build: it.o, th: done, labels: done ? nameOf(it.d).parts : null }); };
      const paint = () => {
        const it = item(); const done = Q.answered != null; if (!Q.opts) Q.opts = options(it);
        side.innerHTML = '';
        const opts = h('div', { class: 'opts' });
        Q.opts.forEach((o, k) => { const cls = done ? (o === it.answer ? ' correct' : o === Q.answered ? ' wrong' : '') : ''; opts.append(h('button', { class: 'opt' + cls, disabled: done ? true : null, onclick: () => answer(k) }, h('span', { class: 'k' }, 'ABCD'[k]), h('span', { class: 'qrs-opt' }, o))); });
        side.append(h('p', { class: 'qtext' }, 'Comment nommez-vous ce complexe ?'), opts);
        if (!done) side.append(h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px' }, h('button', { class: 'btn secondary small', onclick: () => answer(-1) }, 'Révéler · Espace'), h('span', { class: 'xs muted' }, 'Vote de la salle, puis touches 1 à 4.')));
        else side.append(h('div', { class: 'answer', style: 'margin-top:14px' },
          h('p', { class: 'dx' }, it.answer),
          h('ul', null, explain(it.d).map(([L, why]) => h('li', null, h('b', null, L), ' : ', why))),
          h('p', { class: 'pearl', html: it.where }),
          h('div', null, h('button', { class: 'btn small', onclick: next }, 'Complexe suivant ›'))));
        score.textContent = `${Q.ok} / ${Q.n}`; drawIt();
      };
      const answer = k => {
        if (Q.answered != null) return; const it = item(); if (k >= Q.opts.length) return;
        if (k < 0) Q.answered = it.answer;                       // simple révélation : pas de point
        else { Q.answered = Q.opts[k]; Q.n++; if (Q.answered === it.answer) Q.ok++; toast(Q.answered === it.answer ? 'Bonne réponse' : `Réponse attendue : ${it.answer}`); }
        paint();
      };
      const next = () => { Q.i++; if (Q.i % Q.order.length === 0) Q.order = shuffle(Q.order); Q.answered = null; Q.opts = null; paint(); };
      Q.answer = answer; Q.next = next; Q.reveal = () => (Q.answered == null ? answer(-1) : next());
      const el = h('div', { class: 'widget' });
      el.append(h('div', { class: 'w-head' }, h('h4', null, 'À vous : nommez ce complexe'), h('div', { style: 'display:flex;gap:8px;align-items:center' }, score, h('button', { class: 'btn secondary small', onclick: next }, 'Passer ›'))),
        h('div', { class: 'qrs-quiz' }, cv, side));
      card.append(el); paint(); cleanups.push(observe(cv, drawIt));
    }

    card.append(
      h('div', { class: 'pitfall', html: '<b>Pièges. </b>Un crochetage qui ne franchit pas la ligne de base n’est pas une nouvelle onde. Le seuil de 5 mm est une convention d’usage : certains auteurs raisonnent en amplitude relative et écrivent en majuscule l’onde dominante. L’onde delta (pré-excitation) et l’onde J ne font pas partie de la nomenclature du QRS.' }),
      h('div', { class: 'step-foot' }, h('span'), h('button', { class: 'btn', onclick: () => onNext?.() }, 'Commencer la méthode : VIP ›')));
    return () => { cleanups.forEach(f => f()); quiz = null; };
  }

  // Clavier : Espace révèle puis passe au suivant, 1 à 4 répondent
  function key(e) {
    if (!quiz) return false; const k = e.key;
    if (k === ' ') { e.preventDefault(); quiz.reveal(); return true; }
    if (['1', '2', '3', '4'].includes(k)) { quiz.answer(+k - 1); return true; }
    return false;
  }

  return { render, key, nameOf };
})();
