"use strict";
/* Arythmies : le circuit s'anime sur un schéma du cœur ; le tracé DII et le diagramme en échelle
   sont construits à partir de la MÊME chronologie d'évènements (oreillettes A, jonction N, ventricules V).
   Tracés de synthèse à visée pédagogique : les durées de conduction sont plausibles, pas mesurées. */
const ARY = (() => {
  const S = { id: 'tro', adeno: false, defi: null };
  const E = {};                             // éléments du DOM
  let PL = null;                            // lecteur commun : schéma + DII + diagramme en échelle (js/heart.js)

  // ================= Chronologies =================
  const { TL, addA, addN, addV, addK } = Heart;
  const adenoMark = (tl, a, b) => { tl.block = [a, b]; tl.marks.push({ t: a, txt: 'Adénosine' }); };

  // Battement sinusal : P, traversée du nœud AV, QRS. Options : P bloquée, pré-excitation (fusion Kent + His).
  function sinusBeat(tl, tP, pr = 130, o = {}) {
    addA(tl, tP, 'sa', 'sinus');
    if (o.blocked) { addN(tl, tP + 45, tP + pr - 12, 'avn', 1, 0.45); return; }
    // pré-excitation : fusion entre la voie accessoire et le nœud AV ; si le nœud est bloqué (adénosine), tout passe par le Kent
    if (o.pre) { addN(tl, tP + 52, tP + 82, 'kent', 1); addN(tl, tP + 45, tP + 128, 'avn', 1, o.avnBlock ? 0.45 : null); addV(tl, tP + 86, o.avnBlock ? 'prefull' : 'pre'); return; }
    addN(tl, tP + 45, tP + pr - 12, 'avn', 1); addV(tl, tP + pr, 'his');
  }

  const R = {
    sinus: {
      label: 'Rythme sinusal', chip: 'Sinusal', show: [], rate: '90/min',
      build(ad) {
        if (!ad) { const tl = TL(6000); for (let k = -1; k < 10; k++) sinusBeat(tl, 120 + k * 2000 / 3, 130); return tl; }
        const tl = TL(9000); const pp = t => 667 + 330 * Math.exp(-0.5 * ((t - 3700) / 800) ** 2); let t = 120;
        while (t < 9200) { const blocked = t > 3000 && t < 4300; sinusBeat(tl, t, blocked ? 150 : 130, { blocked }); t += pp(t); }
        adenoMark(tl, 2500, 4600); return tl;
      },
      mech: 'Le nœud sinusal commande. L’influx gagne les oreillettes, franchit le nœud AV, <b>seul passage électrique</b> entre oreillettes et ventricules, puis descend par le faisceau de His et ses branches.',
      signs: [['Fréquence', 'Normale pour l’âge, ici 90/min.'], ['Onde P', 'Positive en DII, une devant chaque QRS.'], ['PR', 'Constant, normal pour l’âge.'], ['QRS', 'Fin.']],
      adeno: 'Ralentissement sinusal et bloc AV transitoires, quelques secondes, puis retour à l’état initial.',
      pearl: 'C’est le tracé de référence : toute tachycardie se lit par comparaison avec lui.',
    },
    tsin: {
      label: 'Tachycardie sinusale', chip: 'Tachycardie sinusale', show: [], rate: '150/min',
      build(ad) {
        if (!ad) { const tl = TL(6000); for (let k = -1; k < 16; k++) sinusBeat(tl, 60 + k * 400, 110); return tl; }
        const tl = TL(9000); const pp = t => 400 + 330 * Math.exp(-0.5 * ((t - 3900) / 900) ** 2); let t = 60;
        while (t < 9200) { const blocked = t > 3550 && t < 4050; sinusBeat(tl, t, 110, { blocked }); t += pp(t); }
        adenoMark(tl, 2500, 4700); return tl;
      },
      mech: 'Même trajet qu’en rythme sinusal. Le nœud sinusal accélère <b>en réponse à une cause</b> : fièvre, douleur, hypovolémie, anémie, insuffisance cardiaque. Début et fin progressifs.',
      signs: [['Fréquence', 'Rapide mais variable d’un moment à l’autre ; en règle &lt; 220/min chez le nourrisson et &lt; 180/min chez l’enfant.'], ['Onde P', 'Sinusale, devant chaque QRS, parfois accolée à l’onde T précédente.'], ['PR', 'Constant.'], ['QRS', 'Fin.']],
      adeno: 'Ralentissement progressif et transitoire, parfois une P bloquée, puis ré-accélération progressive : il n’y a pas de circuit à interrompre.',
      pearl: 'On traite la cause, pas la fréquence.',
    },
    trin: {
      label: 'Tachycardie par réentrée intranodale', chip: 'Réentrée intranodale', show: ['inset'], rate: '200/min',
      build(ad) {
        const RR = 300; const tl = TL(ad ? 9000 : 6000);
        const cyc = (c, last) => { addV(tl, c, 'his'); addN(tl, c - 14, c + 42, 'fast', -1); addA(tl, c + 42, 'avnR', 'retro'); addN(tl, c + 50, c + 285, 'slow', 1, last ? 0.5 : null); };
        if (!ad) { for (let k = -1; k < 21; k++) cyc(40 + k * RR); return tl; }
        addN(tl, 40 - 250, 40 - 15, 'slow', 1); let c = 40;
        while (c < 2700) { cyc(c, c + RR >= 2700); c += RR; }
        let t = c - RR + 42 + 900; while (t < 9200) { sinusBeat(tl, t, 130); t += 680; }
        adenoMark(tl, 2450, 4600); return tl;
      },
      mech: 'Le nœud AV possède deux voies. L’influx <b>descend par la voie lente</b> et <b>remonte par la voie rapide</b> : un micro-circuit tourne dans le nœud. Oreillettes et ventricules sont activés presque en même temps.',
      signs: [['Fréquence', 'Régulière, 150 à 250/min, début et fin brusques.'], ['Onde P', 'Rétrograde, cachée dans le QRS ou accolée à sa fin : pseudo-onde s en DII, DIII, aVF, pseudo-r′ en V1.'], ['RP', 'Très court, &lt; 70 ms.'], ['QRS', 'Fin.']],
      adeno: 'Arrêt brutal : le bloc dans le nœud AV coupe le circuit. Retour en rythme sinusal.',
      pearl: 'Rare chez le nourrisson, de plus en plus fréquente à partir de l’adolescence.',
    },
    tro: {
      label: 'Tachycardie réciproque sur voie accessoire', chip: 'Voie accessoire (Kent)', show: ['kent'], rate: '222/min',
      build(ad) {
        const RR = 270; const tl = TL(ad ? 9000 : 5940);
        const cyc = (c, last) => { addV(tl, c, 'his'); addK(tl, 'lvk', c + 12, c + 64); addN(tl, c + 64, c + 94, 'kent', -1); addA(tl, c + 94, 'kent', 'retroAP'); addK(tl, 'lak', c + 94, c + 140, true); addN(tl, c + 140, c + 258, 'avn', 1, last ? 0.4 : null); };
        if (!ad) { for (let k = -1; k < 23; k++) cyc(30 + k * RR); return tl; }
        addN(tl, 30 - 130, 30 - 12, 'avn', 1); let c = 30;
        while (c < 2700) { cyc(c, c + RR >= 2700); c += RR; }
        let t = c - RR + 94 + 850; while (t < 9200) { sinusBeat(tl, t, 130, { pre: true, avnBlock: t + 45 < 4600 }); t += 690; }
        adenoMark(tl, 2450, 4600); tl.marks.push({ t: c - RR + 94 + 850 + 86, txt: 'pré-excitation maximale (Kent seul)' }); return tl;
      },
      mech: 'Une voie accessoire, le <b>faisceau de Kent</b>, relie oreillette et ventricule en dehors du nœud AV. L’influx descend par le nœud AV et le His (QRS fin), traverse le ventricule, puis <b>remonte à l’oreillette par la voie accessoire</b> : un grand circuit.',
      signs: [['Fréquence', 'Régulière, souvent 220 à 280/min chez le nourrisson.'], ['Onde P', 'Rétrograde, visible après le QRS, dans le segment ST.'], ['RP', 'RP &gt; 70 ms, mais RP &lt; PR.'], ['QRS', 'Fin (forme orthodromique). En rythme sinusal : PR court et onde delta si la voie conduit aussi vers le bas (Wolff-Parkinson-White).']],
      adeno: 'Arrêt brutal ; la tachycardie se termine par une onde P bloquée dans le nœud. Si la voie accessoire conduit aussi vers le bas (WPW manifeste), les battements sinusaux qui suivent passent par elle seule tant que le nœud est bloqué : pré-excitation maximale, puis PR court et onde delta.',
      pearl: 'Mécanisme le plus fréquent des tachycardies supraventriculaires du nourrisson et de l’enfant.',
    },
    pjrt: {
      label: 'Tachycardie jonctionnelle réciproque permanente', chip: 'PJRT (Coumel)', show: ['pj'], rate: '167/min',
      build(ad) {
        const RR = 360; const tl = TL(ad ? 9000 : 5760);
        const tail = (c, last) => { addK(tl, 'vpj', c + 12, c + 48); addN(tl, c + 48, c + 222, 'pjrt', -1); addA(tl, c + 222, 'pj', 'retroPS'); addK(tl, 'pja', c + 222, c + 252); addN(tl, c + 252, c + 348, 'avn', 1, last ? 0.4 : null); };
        const cyc = (c, last) => { addV(tl, c, 'his'); tail(c, last); };
        if (!ad) { for (let k = -1; k < 17; k++) cyc(40 + k * RR); return tl; }
        addN(tl, 40 - 108, 40 - 12, 'avn', 1); let c = 40;
        while (c < 2700) { cyc(c, c + RR >= 2700); c += RR; }
        const s1 = c - RR + 222 + 820; sinusBeat(tl, s1, 130); sinusBeat(tl, s1 + 680, 130);
        c = s1 + 680 + 130; tail(c); c += RR; while (c < 9200) { cyc(c); c += RR; }       // redémarrage spontané : tachycardie incessante
        adenoMark(tl, 2450, 4300); tl.marks.push({ t: s1 + 680 + 130 + 222, txt: 'redémarrage' }); return tl;
      },
      mech: 'Voie accessoire <b>cachée</b>, le plus souvent postéro-septale, à conduction rétrograde <b>lente</b>. Le circuit est celui de la réentrée sur faisceau de Kent, mais la remontée est lente : l’onde P arrive tard, juste avant le QRS suivant.',
      signs: [['Fréquence', 'Souvent modérée, 120 à 200/min ; tachycardie incessante.'], ['Onde P', 'Négative et profonde en DII, DIII, aVF.'], ['RP', 'Long : RP &gt; PR.'], ['QRS', 'Fin.']],
      adeno: 'Arrêt transitoire, puis redémarrage spontané après quelques battements sinusaux : la tachycardie est incessante.',
      pearl: 'Tachycardie de Coumel. Incessante, elle peut conduire à une cardiomyopathie rythmique.',
    },
    taf: {
      label: 'Tachycardie atriale focale', chip: 'Atriale focale', show: ['focus'], rate: '176/min',
      build(ad) {
        const PP = 340; const tl = TL(ad ? 9000 : 5780); let n = 0;
        for (let c = 50 - PP; c < tl.dur + 200; c += PP) {
          addA(tl, c, 'focus', 'focal'); let conducted = true;
          if (ad) { if (c > 2500 && c < 4700) conducted = false; else if (c >= 4700 && c < 6100) conducted = (n++ % 2 === 0); }
          if (conducted) { addN(tl, c + 55, c + 104, 'avn', 1); addV(tl, c + 116, 'his'); } else addN(tl, c + 55, c + 104, 'avn', 1, 0.4);
        }
        if (ad) adenoMark(tl, 2500, 4700); return tl;
      },
      mech: 'Un <b>foyer atrial ectopique</b> décharge plus vite que le nœud sinusal. L’influx descend normalement par le nœud AV, qui ne fait pas partie du mécanisme.',
      signs: [['Fréquence', 'Variable, avec accélération et ralentissement progressifs (« warm-up », « cool-down »).'], ['Onde P', 'P′ de morphologie différente de la P sinusale ; son aspect dépend du siège du foyer.'], ['RP', 'P′ devant le QRS : RP &gt; PR. Un bloc AV du 2e degré peut survenir sans arrêter la tachycardie.'], ['QRS', 'Fin.']],
      adeno: 'Le plus souvent, la tachycardie continue : le bloc AV transitoire démasque les ondes P′. Certaines formes focales sont toutefois sensibles à l’adénosine.',
      pearl: 'Souvent incessante chez l’enfant : risque de cardiomyopathie rythmique.',
    },
    flutter: {
      label: 'Flutter atrial', chip: 'Flutter', show: ['flut'], rate: '300/min aux oreillettes, 150/min aux ventricules',
      build(ad) {
        const F = 200; const tl = TL(ad ? 9000 : 6000); tl.flutter = { period: F, t0: 0 }; let n = 0;
        for (let c = -F; c < tl.dur + 200; c += F) {
          addA(tl, c + 60, 'flut', null, { ecg: false }); let conducted = (Math.round(c / F) % 2 === 0);
          if (ad) { if (c > 2500 && c < 4900) conducted = false; else if (c >= 4900 && c < 6500) conducted = (n++ % 4 === 0); }
          if (conducted) { addN(tl, c + 75, c + 205, 'avn', 1); addV(tl, c + 215, 'his'); } else addN(tl, c + 75, c + 150, 'avn', 1, 0.45);
        }
        if (ad) adenoMark(tl, 2500, 4900); return tl;
      },
      mech: '<b>Macro-réentrée dans l’oreillette droite</b>, autour de l’anneau tricuspide, par l’isthme cavo-tricuspide. Les oreillettes battent autour de 300/min, souvent plus de 400/min chez le nouveau-né. Le nœud AV filtre : conduction 2:1 le plus souvent.',
      signs: [['Fréquence', 'Ventriculaire régulière, fraction de la fréquence atriale : environ 150/min en 2:1, 200 à 220/min chez le nouveau-né.'], ['Onde P', 'Pas d’onde P ni de retour à la ligne isoélectrique : ondes F en dents de scie en DII, DIII, aVF.'], ['Conduction', 'En 2:1, une onde F sur deux se cache dans le QRS ou l’onde T.'], ['QRS', 'Fin.']],
      adeno: 'Le flutter continue. Le bloc AV transitoire fait apparaître les ondes F en dents de scie : c’est un test diagnostique.',
      pearl: 'Tachycardie régulière et fixe, à 150/min chez l’adulte ou autour de 200/min chez le nouveau-né : penser au flutter 2:1.',
    },
    tam: {
      label: 'Tachycardie atriale multifocale', chip: 'Atriale multifocale', show: ['foci3'], rate: 'irrégulière',
      build(ad) {
        const tl = TL(ad ? 9000 : 6000); const rnd = Kit.rng(11); const foci = [['f1', 122], ['f2', 100], ['f3', 142]]; let t = 80, lastV = -999;
        while (t < tl.dur + 100) {
          const [shape, pr] = foci[Math.floor(rnd() * 3)]; addA(tl, t, shape, shape);
          const blocked = (ad && t > 2500 && t < 4500) || (t + pr - lastV < 260);
          if (blocked) addN(tl, t + 45, t + pr - 12, 'avn', 1, 0.45); else { addN(tl, t + 45, t + pr - 12, 'avn', 1); addV(tl, t + pr, 'his'); lastV = t + pr; }
          t += 300 + rnd() * 230;
        }
        if (ad) adenoMark(tl, 2500, 4500); return tl;
      },
      mech: '<b>Plusieurs foyers atriaux</b> déchargent à tour de rôle (tachycardie atriale chaotique). Chaque foyer donne une onde P de forme différente et un PR différent.',
      signs: [['Fréquence', 'Irrégulière.'], ['Onde P', 'Au moins 3 morphologies différentes, avec retour à la ligne isoélectrique entre les ondes P.'], ['Intervalles', 'PP, PR et RR variables ; certaines P sont bloquées.'], ['QRS', 'Fin.']],
      adeno: 'Pas d’arrêt : ralentissement ventriculaire transitoire, l’activité atriale reste désorganisée.',
      pearl: 'À distinguer de la fibrillation atriale : ici, de vraies ondes P sont identifiables.',
    },
    fa: {
      label: 'Fibrillation atriale', chip: 'Fibrillation atriale', show: [], rate: 'irrégulière',
      build(ad) {
        const tl = TL(ad ? 9000 : 6000); const rnd = Kit.rng(5); tl.af = { seed: 5 }; let t = 150; const vs = [];
        while (t < tl.dur + 100) { if (!(ad && t > 2600 && t < 4500)) { addV(tl, t, 'his'); addN(tl, t - 105, t - 12, 'avn', 1); vs.push(t); } t += 330 + rnd() * 330; }
        for (let u = -60; u < tl.dur; u += 85 + rnd() * 95) { if (!vs.some(v => v - 105 > u - 70 && v - 105 < u + 70)) addN(tl, u, u + 50 + rnd() * 40, 'avn', 1, 0.2 + rnd() * 0.35); }   // conduction cachée
        if (ad) adenoMark(tl, 2500, 4600); return tl;
      },
      mech: 'Activité atriale <b>totalement désorganisée</b> : de multiples fronts d’onde parcourent les oreillettes. Le nœud AV est bombardé en continu et ne laisse passer que certains influx, de façon aléatoire.',
      signs: [['Fréquence', 'Ventriculaire irrégulière.'], ['Onde P', 'Aucune : trémulation de la ligne de base (ondes f).'], ['RR', 'Irrégulièrement irrégulier.'], ['QRS', 'Fin, sauf bloc de branche ou pré-excitation.']],
      adeno: 'Ralentissement ventriculaire transitoire ; la fibrillation persiste.',
      pearl: 'Rare chez l’enfant : chercher une cardiopathie ou une voie accessoire. FA à QRS larges et irréguliers : penser à une pré-excitation, les bloqueurs du nœud AV sont alors contre-indiqués.',
    },
    jet: {
      label: 'Tachycardie jonctionnelle ectopique (JET)', chip: 'JET', show: ['junc'], rate: '200/min',
      build(ad) {
        const RR = 300; const tl = TL(ad ? 9000 : 6000);
        for (let c = 100 - RR; c < tl.dur + 200; c += RR) { addN(tl, c - 22, c - 4, 'junc', 1); addV(tl, c, 'his'); addN(tl, c - 22, c + 30, 'juncR', -1, 0.55); }
        const pp = t => 500 + (ad ? 200 * Math.exp(-0.5 * ((t - 3600) / 700) ** 2) : 0);
        for (let a = 30 - 500; a < tl.dur + 200; a += pp(a)) { addA(tl, a, 'sa', 'sinus'); addN(tl, a + 45, a + 100, 'avn', 1, 0.4); }
        if (ad) adenoMark(tl, 2500, 4600); return tl;
      },
      mech: 'Un <b>foyer situé dans la jonction</b> (nœud AV – faisceau de His) décharge rapidement. Les ventricules sont activés par les voies normales : QRS fin. Les oreillettes gardent leur propre rythme (dissociation) ou sont activées à rebours.',
      signs: [['Fréquence', 'Régulière et rapide, souvent &gt; 170/min.'], ['Onde P', 'Dissociation AV avec des ventricules plus rapides que les oreillettes, ou ondes P rétrogrades 1:1.'], ['QRS', 'Fin, identique au QRS sinusal.'], ['Contexte', 'Surtout les premiers jours après une chirurgie cardiaque ; forme congénitale rare.']],
      adeno: 'Pas d’arrêt, pas de ralentissement ventriculaire : le foyer est sous le niveau du bloc. La dissociation entre oreillettes et ventricules persiste.',
      pearl: 'QRS fins + ventricules plus rapides que les oreillettes : le foyer est jonctionnel.',
    },
    tv: {
      label: 'Tachycardie ventriculaire', chip: 'TV', show: ['vtf'], rate: '176/min',
      build(ad) {
        const RR = 340; const tl = TL(ad ? 9060 : 6040); const cap = 3130;
        const vt = c => { addV(tl, c, 'vt'); addN(tl, c + 70, c + 150, 'avnR', -1, 0.5); };
        for (let c = 150 - RR; c < cap - 200; c += RR) vt(c);
        addV(tl, cap, 'cap'); for (let c = cap + RR; c < tl.dur + 200; c += RR) vt(c);
        for (let a = 2960 - 6 * 612; a < tl.dur + 200; a += 612) { addA(tl, a, 'sa', 'sinus'); if (Math.abs(a - 2960) < 1) addN(tl, a + 45, cap - 12, 'avn', 1); else addN(tl, a + 45, a + 110, 'avn', 1, 0.45); }
        tl.marks.push({ t: cap, txt: 'capture' }); if (ad) adenoMark(tl, 4600, 6600); return tl;
      },
      mech: 'Un foyer ou un circuit <b>ventriculaire</b> active les ventricules de proche en proche, sans passer par le réseau de His-Purkinje : la dépolarisation est lente, le QRS est large. Les oreillettes restent le plus souvent sous la commande du nœud sinusal.',
      signs: [['Fréquence', 'Régulière, 120 à 250/min.'], ['Onde P', 'Dissociation AV : ondes P sinusales plus lentes, sans lien avec les QRS.'], ['QRS', 'Large pour l’âge, de morphologie différente du QRS sinusal.'], ['Signes forts', 'Complexes de capture (un QRS fin au milieu de la tachycardie) et de fusion.']],
      adeno: 'Pas d’effet dans la grande majorité des cas : la tachycardie se poursuit.',
      pearl: 'Toute tachycardie à QRS larges est une tachycardie ventriculaire jusqu’à preuve du contraire.',
    },
  };
  const ORDER = ['sinus', 'tsin', 'trin', 'tro', 'pjrt', 'taf', 'flutter', 'tam', 'fa', 'jet', 'tv'];

  // ================= Interface =================
  function rebuild() { PL.setTL(R[S.id].build(S.adeno), 0); }
  function refresh() { PL.refresh(); }

  function setRhythm(id) { S.id = id; S.adeno = false; rebuild(); paintUI(); refresh(); }
  function setAdeno(on) { S.adeno = on; const tl = R[S.id].build(on); PL.setTL(tl, on ? Math.max(0, tl.block[0] - 2200) : 0); paintUI(); if (on && !PL.P.playing && !reduceMotion) PL.play(true); }
  function togglePlay(v) { PL.play(v); }

  function paintUI() {
    const r = R[S.id], hidden = !!(S.defi && !S.defi.revealed);
    $$('.chip', E.chips).forEach(b => { const on = b.dataset.k === S.id; b.setAttribute('aria-pressed', String(!hidden && on)); if (!S.defi) b.classList.remove('correct', 'wrong'); });
    const show = new Set(hidden ? [] : r.show);
    PL.heart.show(show);
    E.veil.hidden = !hidden; E.title.textContent = hidden ? 'Rythme mystère' : r.label; E.rate.textContent = hidden ? '? /min' : r.rate; E.rate.hidden = false;
    E.adeno.setAttribute('aria-pressed', String(S.adeno)); E.adeno.textContent = S.adeno ? 'Arrêter le test' : 'Tester l’adénosine';
    E.banner.hidden = !S.defi;
    if (S.defi) E.bannerTxt.innerHTML = S.defi.revealed ? `<b>Réponse :</b> ${r.label}.` : '<b>Défi :</b> fréquence, régularité, onde P, RP/PR. Cliquez le rythme proposé.';
    E.btnReveal.hidden = !hidden;
    // panneaux
    E.mech.innerHTML = hidden ? '<span class="muted">Masqué pendant le défi.</span>' : r.mech;
    E.signsBox.innerHTML = '';
    if (hidden) { S.defi.list = Kit.revealList(r.signs); E.signsBox.append(S.defi.list.el); }
    else E.signsBox.append(Kit.revealList(r.signs, { open: true }).el);
    E.adenoTxt.innerHTML = hidden ? (S.adeno ? '<span class="muted">Observez l’effet sur le tracé.</span>' : '<span class="muted">Le test à l’adénosine reste disponible.</span>') : r.adeno;
    E.pearl.innerHTML = hidden ? '' : '<b>À retenir. </b>' + r.pearl; E.pearl.hidden = hidden;
  }

  function startDefi() {
    let id; do { id = ORDER[1 + Math.floor(Math.random() * (ORDER.length - 1))]; } while (id === S.lastDefi); S.lastDefi = id;
    S.defi = { revealed: false }; $$('.chip', E.chips).forEach(b => b.classList.remove('correct', 'wrong')); S.id = id; S.adeno = false; rebuild(); paintUI(); refresh();
  }
  function revealDefi(guess) {
    if (!S.defi || S.defi.revealed) return; S.defi.revealed = true;
    $$('.chip', E.chips).forEach(b => { if (b.dataset.k === S.id) b.classList.add('correct'); else if (guess && b.dataset.k === guess) b.classList.add('wrong'); });
    if (guess) toast(guess === S.id ? 'Bonne réponse' : `Réponse attendue : ${R[S.id].label}`);
    paintUI(); refresh();
  }
  function quitDefi() { S.defi = null; $$('.chip', E.chips).forEach(b => b.classList.remove('correct', 'wrong')); paintUI(); refresh(); }

  let built = false;
  function init() {
    if (built) return; built = true; const root = $('#aryRoot');
    E.chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Rythme' }, ORDER.map(k => h('button', { class: 'chip', 'data-k': k, onclick: () => { if (S.defi && !S.defi.revealed) revealDefi(k); else { if (S.defi) S.defi = null; setRhythm(k); } } }, R[k].chip)));
    E.banner = h('div', { class: 'mystery-banner', hidden: true }, E.bannerTxt = h('div'), h('div', { style: 'display:flex;gap:8px' }, E.btnReveal = h('button', { class: 'btn small', onclick: () => revealDefi(null) }, 'Révéler'), h('button', { class: 'btn small secondary', onclick: quitDefi }, 'Quitter le défi')));
    PL = Heart.player({ view: 'arythmies', id: 'ary', foot: 'DII, 25 mm/s, 10 mm/mV. Échelle : A oreillettes, AV jonction, V ventricules ; oblique = conduction, barre = bloc. Tracés simulés.' });
    E.veil = h('div', { class: 'veil', hidden: true }, h('div', null, h('b', null, 'Mécanisme masqué')));
    PL.heartWrap.append(E.veil);
    E.adeno = h('button', { class: 'btn small', 'aria-pressed': 'false', onclick: () => setAdeno(!S.adeno) }, 'Tester l’adénosine');
    PL.right.append(E.adeno);
    E.title = h('h3', { class: 'ary-title' }); E.rate = h('span', { class: 'pill signal' });
    E.mech = h('p', { class: 'ary-txt' }); E.signsBox = h('div'); E.adenoTxt = h('p', { class: 'ary-txt' }); E.pearl = h('p', { class: 'pearl' });
    root.append(
      h('div', { class: 'section-head' },
        h('div', null, h('h2', null, 'Arythmies'),
          h('p', null, 'Circuit, DII et diagramme en échelle synchronisés.')),
        h('span', { class: 'hint-keys', html: '<kbd>Espace</kbd> lecture · <kbd>←</kbd> <kbd>→</kbd> rythme · <kbd>A</kbd> adénosine · <kbd>D</kbd> défi' })),
      h('div', { class: 'card sim-controls' }, h('div', { class: 'ctl-group', style: 'flex:1 1 520px' }, h('span', { class: 'ctl-lab' }, 'Rythme'), E.chips), h('button', { class: 'btn small', onclick: startDefi }, 'Défi : quel rythme ?')),
      E.banner,
      h('div', { class: 'ary-grid' },
        h('div', { class: 'card ary-heart' }, h('div', { class: 'ary-head' }, E.title, E.rate), PL.heartWrap, Heart.legend()),
        h('div', { class: 'card ecg-card' }, PL.ecg)),
      h('div', { class: 'sim-bottom ary-bottom' },
        h('div', { class: 'card panel' }, h('h4', null, 'Mécanisme'), E.mech),
        h('div', { class: 'card panel' }, h('h4', null, 'Sur le tracé'), E.signsBox),
        h('div', { class: 'card panel' }, h('h4', null, 'Adénosine ou manœuvres vagales'), E.adenoTxt, E.pearl)));
    rebuild(); paintUI();
  }

  viewHooks.arythmies = () => { init(); PL.heart.measure(); PL.resize(); PL.refresh(); };
  viewKeys.arythmies = e => {
    const k = e.key;
    if (k === ' ') { e.preventDefault(); if (S.defi && !S.defi.revealed) { if (!S.defi.list.next()) revealDefi(null); } else togglePlay(); }
    else if (k === 'ArrowRight' || k === 'ArrowLeft') { if (S.defi && !S.defi.revealed) return; const i = ORDER.indexOf(S.id) + (k === 'ArrowRight' ? 1 : -1); S.defi = null; setRhythm(ORDER[(i + ORDER.length) % ORDER.length]); e.preventDefault(); }
    else if (k.toLowerCase() === 'a') setAdeno(!S.adeno);
    else if (k.toLowerCase() === 'd') startDefi();
    else if (k === 'Escape' && S.defi) quitDefi();
  };
  return { init, R };
})();
