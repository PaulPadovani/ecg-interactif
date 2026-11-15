"use strict";
/* Outils communs aux modules ajoutés : Nommer le QRS, Arythmies, Repolarisation, Métabolique.
   Ce fichier s'appuie sur les fonctions du script principal de index.html (h, $, css, clamp, fitCanvas, drawPaper, drawTrace…). */
const Kit = (() => {
  const FS = 500; // Hz, comme le reste de la plateforme

  // --- Briques de signal (t en ms, amplitudes en mV) ---
  const g = (t, c, s, a) => { const u = (t - c) / s; return u * u > 40 ? 0 : a * Math.exp(-0.5 * u * u); };   // gaussienne
  const ga = (t, c, s1, s2, a) => g(t, c, t < c ? s1 : s2, a);                                                   // gaussienne asymétrique
  const lobe = (t, t0, w, a, p = 1.2) => (t <= t0 || t >= t0 + w) ? 0 : a * Math.pow(Math.sin(Math.PI * (t - t0) / w), p); // déflexion du QRS
  const sstep = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  const lerp = (a, b, k) => a + (b - a) * k;

  function sig(dur) { const N = Math.round(dur * FS / 1000); return { fs: FS, dur, N, data: new Float32Array(N) }; }
  function add(s, fn, from, to) {
    const a = Math.max(0, Math.floor(from * FS / 1000)), b = Math.min(s.N, Math.ceil(to * FS / 1000));
    for (let i = a; i < b; i++) s.data[i] += fn(i * 1000 / FS);
  }
  const at = (s, t) => s.data[clamp(Math.round(t * FS / 1000), 0, s.N - 1)] || 0;

  // Générateur pseudo-aléatoire reproductible (les rythmes irréguliers sont identiques d'une séance à l'autre)
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // Boucle d'animation : ne tourne que lorsque la vue concernée est affichée
  function loop(view, fn) {
    let id = 0, last = 0, on = false;
    const tick = now => {
      if (!on) return;
      const dt = last ? Math.min(64, now - last) : 16; last = now;
      if (currentView === view && !document.hidden) fn(dt);
      id = requestAnimationFrame(tick);
    };
    return { start() { if (on) return; on = true; last = 0; id = requestAnimationFrame(tick); }, stop() { on = false; cancelAnimationFrame(id); } };
  }

  // Liste « à révéler », sur le modèle de la lecture pas à pas des cas cliniques
  function revealList(items, opts = {}) {
    let n = opts.open ? items.length : 0; const box = h('div', { class: 'rsteps' });
    const render = () => {
      box.innerHTML = '';
      items.forEach(([lbl, html], k) => {
        const shown = k < n;
        box.append(h('div', { class: 'rstep' + (shown ? '' : ' hidden') }, h('span', { class: 'lbl' }, lbl),
          shown ? h('span', { class: 'val', html }) : h('span', null, h('button', { class: 'reveal', onclick: () => { n = k + 1; render(); opts.onChange?.(n); } }, k === n ? 'Révéler · Espace' : 'Révéler'))));
      });
    };
    render();
    return {
      el: box,
      next() { if (n < items.length) { n++; render(); opts.onChange?.(n); return true; } return false; },
      all() { n = items.length; render(); },
      get done() { return n >= items.length; },
    };
  }

  // Texte avec halo sur un canvas (lisible sur un tracé comme sur une image)
  function haloText(ctx, txt, x, y, { color, halo, font, align = 'left' } = {}) {
    ctx.save(); ctx.font = font || ('600 12px ' + css('--font')); ctx.textAlign = align; ctx.lineJoin = 'round';
    ctx.strokeStyle = halo || css('--paper'); ctx.lineWidth = 4; ctx.strokeText(txt, x, y);
    ctx.fillStyle = color || css('--fg'); ctx.fillText(txt, x, y); ctx.restore();
  }

  const frNum = (v, d = 1) => v.toFixed(d).replace('.', ',');

  return { FS, g, ga, lobe, sstep, lerp, sig, add, at, rng, loop, revealList, haloText, frNum };
})();
