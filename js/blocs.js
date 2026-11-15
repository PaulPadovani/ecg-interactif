"use strict";
/* Méthode, étape QRS : l'influx dans les branches du faisceau de His, sur le schéma commun (js/heart.js),
   synchronisé avec V1 et V6. Remplace l'outil « Durée et morphologie » de index.html. */
(() => {
  const MORPH = {
    n: { kind: 'his', dur: 70, txt: 'L’influx descend les deux branches en même temps : les deux ventricules se dépolarisent ensemble, le QRS est fin.' },
    bbd: { kind: 'rbbb', dur: 140, txt: 'Branche droite bloquée : le VG se dépolarise d’abord ; le VD ensuite, de proche en proche à travers le septum. V1 : rSR′. V6 : onde S large.' },
    bbg: { kind: 'lbbb', dur: 150, txt: 'Branche gauche bloquée : le VD se dépolarise d’abord ; le VG ensuite, lentement, de proche en proche. V1 : rS ou QS large. V6 : R large et crochetée.' },
  };
  const PR = 140, Q0 = 380, RR = 1000;   // mêmes battements que les tracés V1 et V6

  WIDGETS.qrs = function (el) {
    let morph = 'n', dur = MORPH.n.dur, t = 0, speed = 0.25, playing = !reduceMotion, loopMs = 3000, tl = null;
    const heart = Heart.create('mq'); heart.show(new Set());
    const a = h('canvas', { class: 'strip' }), b = h('canvas', { class: 'strip' }); a.style.height = b.style.height = '132px';
    const out = h('div', { class: 'readout' }), note = h('div', { class: 'scen-explain' });
    const r = h('input', { type: 'range', min: 40, max: 170, step: 5, value: dur, 'aria-label': 'Durée du QRS' });
    const playBtn = h('button', { class: 'btn small secondary', onclick: () => { playing = !playing; playBtn.textContent = playing ? '❚❚ Pause' : '▶︎ Lecture'; } }, playing ? '❚❚ Pause' : '▶︎ Lecture');
    const cache = new Map();
    const kindOf = () => (morph !== 'n' && dur > 90 ? MORPH[morph].kind : 'his');

    function buildTL() {
      const kind = kindOf(); tl = Heart.TL(loopMs); tl.bb = kind === 'his' ? null : kind;
      for (let q = Q0 - RR; q < loopMs + RR; q += RR) { Heart.addA(tl, q - PR, 'sa', 'sinus'); Heart.addN(tl, q - PR + 45, q - 12, 'avn'); Heart.addV(tl, q, kind, { qd: dur }); }
    }
    function drawStrips() {
      const beats = regularBeats(RR, 4600, { pr: PR, start: Q0 }); const wide = dur > 90;
      const v1 = morph === 'bbd' && wide ? { q: 0, r: 0.35, s: -0.45, rp: 0.9 } : morph === 'bbg' && wide ? { q: 0, r: 0.08, s: -1.5 } : { q: 0, r: 0.35, s: -1.0 };
      const v6 = morph === 'bbd' && wide ? { q: -0.1, r: 1.0, s: -0.5 } : morph === 'bbg' && wide ? { q: 0, r: 1.3, s: 0, rp: 1.1 } : { q: -0.1, r: 1.2, s: -0.15 };
      const tv1 = morph === 'bbd' && wide ? -0.25 : morph === 'bbg' && wide ? 0.35 : -0.1; const tv6 = morph === 'bbg' && wide ? -0.3 : 0.3;
      const sigs = [[a, synth({ dur: 4600, beats, qrs: Object.assign({ dur }, v1), t: { amp: tv1 }, qt: 360 + dur * 0.3 }), 0.5], [b, synth({ dur: 4600, beats, qrs: Object.assign({ dur }, v6), t: { amp: tv6 }, qt: 360 + dur * 0.3 }), 0.66]];
      for (const [cv, sig, y] of sigs) {
        let X = null; renderStrip(cv, sig, { y, mark: (ctx, g) => { X = g.X; } });
        const bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height; bg.getContext('2d').drawImage(cv, 0, 0);
        cache.set(cv, { bg, X });
      }
      // boucle sur le nombre entier de battements visibles (2 à 4 s)
      const c = cache.get(a); const visible = (a.clientWidth - 8 - c.X(0)) / (c.X(1000) - c.X(0)) * 1000;
      loopMs = clamp(Math.floor(visible / RR) * RR, 2 * RR, 4 * RR); t %= loopMs;
      const mx = NORMS.qrsMax(ageM()); let v;
      if (dur <= mx) v = `<span class="verdict ok">Normal pour l’âge (&lt; ${mx} ms)</span>`;
      else if (dur <= 120) v = `<span class="verdict warn">Élargi pour l’âge${dur >= 80 ? ' · bloc incomplet (80–120 ms)' : ''}</span>`;
      else v = '<span class="verdict bad">Bloc complet (&gt; 120 ms)</span>';
      out.innerHTML = `<div><span class="big">${dur}</span><span class="unit">ms</span></div>${v}`;
      note.textContent = MORPH[kindOf() === 'his' ? 'n' : morph].txt;
      buildTL();
    }
    function overlay() {
      for (const cv of [a, b]) {
        const c = cache.get(cv); if (!c || !cv.isConnected) continue; const ctx = cv.getContext('2d');
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(c.bg, 0, 0); ctx.restore();
        const x = c.X(t); ctx.strokeStyle = css('--signal'); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cv.clientHeight); ctx.stroke();
      }
      heart.update(t, tl);
    }
    const redraw = () => { drawStrips(); overlay(); };
    r.addEventListener('input', () => { dur = +r.value; redraw(); });
    el.append(
      h('div', { class: 'w-head' }, h('h4', null, 'Branches du faisceau de His'),
        chipGroup([['n', 'Conduction normale'], ['bbd', 'Bloc de branche droit'], ['bbg', 'Bloc de branche gauche']], morph, v => { morph = v; dur = MORPH[v].dur; r.value = dur; redraw(); })),
      h('div', { class: 'bb-grid' }, h('div', { class: 'bb-heart' }, heart.el),
        h('div', null, h('div', { class: 'xs muted', style: 'font-weight:600' }, 'V1'), a, h('div', { class: 'xs muted', style: 'font-weight:600;margin-top:8px' }, 'V6'), b)),
      h('div', { class: 'ctrl-row' }, h('label', { class: 'ctrl' }, 'Durée du QRS', r), playBtn,
        segGroup([[0.25, '×¼'], [0.1, '×⅒']], speed, v => { speed = v; }, 'Vitesse de lecture')),
      note, out);
    const stopObs = observe(a, redraw);
    const loop = Kit.loop('methode', dt => { if (!playing || !tl) return; t = (t + dt * speed) % loopMs; overlay(); }); loop.start();
    return () => { loop.stop(); stopObs(); };
  };
})();
