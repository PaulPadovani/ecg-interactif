"use strict";
/* Arythmies : le circuit s'anime sur un schéma du cœur ; le tracé DII et le diagramme en échelle
   sont construits à partir de la MÊME chronologie d'évènements (oreillettes A, jonction N, ventricules V).
   Tracés de synthèse à visée pédagogique : les durées de conduction sont plausibles, pas mesurées. */
const ARY = (() => {
  const winMs = w => (w < 560 ? 3000 : 6000);   // fenêtre de tracé affichée (ms) : 150 mm à 25 mm/s, 75 mm sur téléphone
  const S = { id: 'tro', speed: 0.25, playing: !reduceMotion, t: 0, adeno: false, defi: null, tl: null, sig: null };
  const E = {};                             // éléments du DOM

  // ================= Chronologies =================
  const TL = dur => ({ dur, A: [], N: [], V: [], K: [], marks: [], flutter: null, af: null, block: null });
  const P_DUR = { sinus: 85, retro: 55, retroAP: 70, retroPS: 78, focal: 96, f1: 70, f2: 80, f3: 92 };
  const addA = (tl, t, src, shape, o = {}) => tl.A.push({ t, src, shape, dur: P_DUR[shape] || 80, ...o });
  const addN = (tl, t0, t1, path, dir = 1, block = null) => tl.N.push({ t0, t1, path, dir, block });
  const addV = (tl, t, kind = 'his') => tl.V.push({ t, kind });
  const addK = (tl, path, t0, t1, rev = false) => tl.K.push({ path, t0, t1, rev });
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

  // ================= Tracé DII à partir de la chronologie =================
  function synthTL(tl) {
    const s = Kit.sig(tl.dur + 300); const { g, ga, lobe, sstep } = Kit;
    const P = (t0, shape) => {
      const d = P_DUR[shape], c = t0 + d / 2, sg = d / 5.2; let fn;
      if (shape === 'sinus') fn = t => g(t, c, sg, 0.15);
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
    const Vs = tl.V.slice().sort((a, b) => a.t - b.t);
    Vs.forEach((v, i) => {
      const q = v.t; const rr = i ? Math.min(900, q - Vs[i - 1].t) : 700; let qEnd;
      if (v.kind === 'vt') {
        Kit.add(s, t => lobe(t, q, 100, 1.25, 0.9) + g(t, q + 34, 7, -0.16) + lobe(t, q + 100, 55, -0.38, 1.1), q, q + 160); qEnd = q + 155;
        Kit.add(s, t => ga(t, q + 250, 44, 30, -0.42), q + 150, q + 340);
      } else if (v.kind === 'prefull') {      // ventricules activés par la seule voie accessoire : onde delta large, QRS élargi, T secondaire
        Kit.add(s, t => 0.34 * sstep((t - q) / 64) * (1 - sstep((t - q - 64) / 46)) + lobe(t, q + 36, 74, 0.92, 1.0) + lobe(t, q + 110, 34, -0.16, 1.2), q, q + 150); qEnd = q + 144;
        const QT = clamp(400 * Math.sqrt(rr / 1000), 230, 420), td = QT * 0.42; Kit.add(s, t => ga(t, q + QT - td * 0.42, td * 0.30, td * 0.17, -0.12), qEnd - 10, q + QT + 80);
      } else if (v.kind === 'pre') {
        Kit.add(s, t => 0.26 * sstep((t - q) / 46) * (1 - sstep((t - q - 46) / 34)) + lobe(t, q + 38, 46, 0.95, 1.15) + lobe(t, q + 84, 28, -0.16, 1.2), q, q + 116); qEnd = q + 112;
        const QT = clamp(400 * Math.sqrt(rr / 1000), 210, 400), td = QT * 0.42; Kit.add(s, t => ga(t, q + QT - td * 0.42, td * 0.30, td * 0.17, 0.16), qEnd - 10, q + QT + 80);
      } else {
        Kit.add(s, t => lobe(t, q, 12, -0.06) + lobe(t, q + 12, 32, 1.0, 1.15) + lobe(t, q + 44, 24, -0.2), q, q + 70); qEnd = q + 68;
        const QT = clamp(400 * Math.sqrt(rr / 1000), 200, 400), td = QT * 0.42; Kit.add(s, t => ga(t, q + QT - td * 0.42, td * 0.30, td * 0.17, (rr < 450 ? 0.2 : 0.27) * (tl.flutter ? 0.5 : 1)), qEnd - 10, q + QT + 80);
      }
    });
    return s;
  }

  // ================= Schéma du cœur =================
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
  const SRC = { sa: [118, 118], avnR: [250, 226], kent: [428, 232], pj: [300, 232], focus: [392, 114], f1: [146, 200], f2: [366, 124], f3: [212, 110] };
  const SRCV = { his: [276, 396], kent: [428, 266], vt: [112, 300] };
  const far = (p, pts) => Math.max(...pts.map(q => Math.hypot(p[0] - q[0], p[1] - q[1])));
  const CORN_A = [[80, 80], [440, 80], [80, 244], [440, 244]], CORN_V = [[97, 247], [432, 247], [118, 400], [300, 500], [424, 400]];

  function buildHeart() {
    const p = (id, d, cls, extra = '') => `<path id="ary-${id}" class="${cls}" d="${d}" ${extra}/>`;
    const grp = k => `data-grp="${k}"`;
    let cond = '', comets = '';
    for (const [id, P] of Object.entries(PATHS)) {
      cond += `<path id="ary-p-${id}" class="${P.cls}" d="${P.d}" ${P.grp ? grp(P.grp) : ''}/>`;
      for (let k = 0; k < 2; k++) comets += `<path class="comet" data-path="${id}" data-k="${k}" d="${P.d}"/><circle class="comet-head" data-path="${id}" data-k="${k}" r="5.5"/>`;
    }
    const waves = (n, cls) => Array.from({ length: n }, () => `<circle class="wave ${cls}" r="0"/>`).join('');
    const svg = `
<svg viewBox="-90 24 640 508" class="heart-svg" role="img" aria-label="Schéma du cœur : oreillettes, ventricules et voies de conduction">
  <defs>
    <mask id="aryMA" maskUnits="userSpaceOnUse" x="-90" y="0" width="640" height="560"><g fill="#fff" stroke="#fff" stroke-width="13" stroke-linejoin="round"><path d="${SHAPES.RA}"/><path d="${SHAPES.LA}"/><path d="${SHAPES.septA}" stroke="none"/></g><rect x="-90" y="245" width="640" height="320" fill="#000"/></mask>
    <mask id="aryMV" maskUnits="userSpaceOnUse" x="-90" y="0" width="640" height="560"><g fill="#fff" stroke="#fff" stroke-linejoin="round"><path d="${SHAPES.RV}" stroke-width="18"/><path d="${SHAPES.LV}" stroke-width="32"/><path d="${SHAPES.septV}" stroke="none"/></g><rect x="-90" y="0" width="640" height="247" fill="#000"/></mask>
    <radialGradient id="aryGA"><stop offset="0" stop-color="var(--accent)" stop-opacity=".34"/><stop offset=".78" stop-color="var(--accent)" stop-opacity=".46"/><stop offset=".93" stop-color="var(--accent)" stop-opacity=".95"/><stop offset="1" stop-color="var(--accent)" stop-opacity=".5"/></radialGradient>
    <radialGradient id="aryGV"><stop offset="0" stop-color="var(--signal)" stop-opacity=".34"/><stop offset=".78" stop-color="var(--signal)" stop-opacity=".46"/><stop offset=".93" stop-color="var(--signal)" stop-opacity=".95"/><stop offset="1" stop-color="var(--signal)" stop-opacity=".5"/></radialGradient>
  </defs>
  <path class="hv-vessel svc" d="M150 96 V36"/>
  <path class="hv-vessel" d="M428 126 h40 M432 168 h36"/>
  <g class="hv-wall"><path d="${SHAPES.septA}"/><path d="${SHAPES.septV}"/><path d="${SHAPES.RA}" stroke-width="13"/><path d="${SHAPES.LA}" stroke-width="13"/><path d="${SHAPES.RV}" stroke-width="18"/><path d="${SHAPES.LV}" stroke-width="32"/></g>
  <g class="hv-cav"><path d="${SHAPES.RA}"/><path d="${SHAPES.LA}"/><path d="${SHAPES.RV}"/><path d="${SHAPES.LV}"/></g>
  <g mask="url(#aryMA)" id="ary-wa">${waves(4, 'wa')}</g>
  <g mask="url(#aryMV)" id="ary-wv">${waves(3, 'wv')}</g>
  <path class="hv-ring" d="M76 246 H252 M272 246 H446"/>
  <g class="hv-lab"><text x="168" y="176">OD</text><text x="352" y="176">OG</text><text x="186" y="336">VD</text><text x="346" y="356">VG</text></g>
  <g ${grp('inset')} class="hv-inset"><line x1="243" y1="232" x2="50" y2="398" class="lead"/><circle cx="2" cy="444" r="66" class="lens"/><text x="2" y="368" class="cap">Nœud AV, à la loupe</text><text x="-38" y="448" class="tag slow">lente</text><text x="44" y="448" class="tag">rapide</text></g>
  ${cond}
  ${comets}
  <ellipse id="ary-sa" class="node" cx="118" cy="118" rx="12" ry="7" transform="rotate(-38 118 118)"/>
  <ellipse id="ary-avn" class="node" cx="250" cy="224" rx="8" ry="11"/>
  <g id="ary-block" class="hv-block" hidden><circle cx="250" cy="224" r="15"/><path d="M243 217 l14 14 M257 217 l-14 14"/></g>
  <circle id="ary-f-focus" class="focus" cx="392" cy="114" r="8" ${grp('focus')}/>
  <g ${grp('foci3')}><circle id="ary-f-f1" class="focus" cx="146" cy="200" r="7"/><circle id="ary-f-f2" class="focus" cx="366" cy="124" r="7"/><circle id="ary-f-f3" class="focus" cx="212" cy="110" r="7"/></g>
  <circle id="ary-f-vt" class="focus" cx="112" cy="300" r="8" ${grp('vtf')}/>
  <circle id="ary-f-junc" class="focus" cx="259" cy="252" r="7" ${grp('junc')}/>
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
  </g>
</svg>`;
    const box = h('div', { class: 'heart-box', html: svg });
    E.svg = box.firstElementChild;
    E.wa = $$('.wa', E.svg); E.wv = $$('.wv', E.svg);
    E.paths = {};
    for (const id of Object.keys(PATHS)) {
      const base = $('#ary-p-' + id, E.svg);
      E.paths[id] = { base, len: 0, tails: $$(`.comet[data-path="${id}"]`, E.svg), heads: $$(`.comet-head[data-path="${id}"]`, E.svg), used: 0 };
    }
    return box;
  }
  function measurePaths() { for (const P of Object.values(E.paths)) { try { P.len = P.base.getTotalLength(); } catch (e) { P.len = 0; } } }

  function setWave(el, p, r, op, grad) { el.setAttribute('cx', p[0]); el.setAttribute('cy', p[1]); el.setAttribute('r', r.toFixed(1)); el.setAttribute('fill', `url(#${grad})`); el.style.opacity = op.toFixed(3); }
  function comet(id, pos, rev, alpha = 1) {
    const P = E.paths[id]; if (!P || !P.len || P.used >= P.tails.length) return; const k = P.used++;
    const L = P.len, seg = Math.min(44, L * 0.5), sPos = clamp(pos, 0, 1) * L, start = rev ? sPos : sPos - seg;
    const tail = P.tails[k], head = P.heads[k];
    tail.style.strokeDasharray = `${seg} ${L + seg + 20}`; tail.style.strokeDashoffset = String(-start); tail.style.opacity = String(alpha);
    const pt = P.base.getPointAtLength(sPos); head.setAttribute('cx', pt.x); head.setAttribute('cy', pt.y); head.style.opacity = String(alpha);
  }

  function updateHeart(t) {
    const tl = S.tl; if (!tl || !E.svg) return;
    for (const P of Object.values(E.paths)) P.used = 0;
    let ia = 0, iv = 0, saOn = false, avnOn = false; const fociOn = {};
    // --- oreillettes ---
    for (const a of tl.A) {
      const dt = t - a.t; if (dt < 0 || dt > a.dur + 170) continue;
      if (a.src === 'sa' && dt < 70) saOn = true; if (dt < 80) fociOn[a.src] = true;
      const p = SRC[a.src]; if (!p || ia >= E.wa.length) continue;
      const k = Math.min(1, dt / a.dur), fade = dt > a.dur ? 1 - (dt - a.dur) / 170 : 1;
      setWave(E.wa[ia++], p, 14 + k * far(p, CORN_A), fade, 'aryGA');
    }
    if (tl.flutter && E.paths.flut.len) {        // front tournant autour de l'anneau tricuspide
      const u = ((((t - tl.flutter.t0) % tl.flutter.period) + tl.flutter.period) % tl.flutter.period) / tl.flutter.period;
      comet('flut', u, false); const pt = E.paths.flut.base.getPointAtLength(u * E.paths.flut.len);
      if (ia < E.wa.length) setWave(E.wa[ia++], [pt.x, pt.y], 78, 0.85, 'aryGA');
    }
    if (tl.af) {                                  // fronts multiples et désordonnés
      const PTS = [[130, 130], [200, 190], [150, 200], [215, 115], [320, 120], [390, 150], [340, 205], [410, 205], [300, 170]];
      for (let k = 0; k < 4 && ia < E.wa.length; k++) {
        const slot = Math.floor((t + k * 43) / 95), ph = ((t + k * 43) % 95) / 95, hsh = Math.abs(Math.sin((slot + 1) * (k + 1) * 12.9898) * 43758.5453) % 1;
        setWave(E.wa[ia++], PTS[Math.floor(hsh * PTS.length)], 12 + ph * 62, 0.9 * (1 - ph), 'aryGA');
      }
    }
    // --- jonction et voies accessoires ---
    const NP = { avn: 'avn', avnR: 'avn', slow: 'slow', fast: 'fast', kent: 'kent', pjrt: 'pj', junc: 'avn' };
    for (const n of tl.N) {
      if (t < n.t0 || t > n.t1) continue; const id = NP[n.path]; if (!id) continue;
      let u = (t - n.t0) / (n.t1 - n.t0), alpha = 1;
      if (n.block != null && u > n.block) { alpha = 1 - (u - n.block) / (1 - n.block); u = n.block; }
      if (id === 'avn' || id === 'slow' || id === 'fast') avnOn = true;
      if (n.path === 'junc') { fociOn.junc = true; comet(id, 0.45 + 0.55 * u, false, alpha); continue; }
      const rev = n.dir < 0; comet(id, rev ? 1 - u : u, rev, alpha);
    }
    for (const k of tl.K) { if (t < k.t0 || t > k.t1) continue; const u = (t - k.t0) / (k.t1 - k.t0); comet(k.path, k.rev ? 1 - u : u, k.rev); }
    // --- ventricules ---
    for (const v of tl.V) {
      const dt = t - v.t; if (dt < -10 || dt > 330) continue;
      if (v.kind === 'vt' && dt >= 0 && dt < 90) fociOn.vt = true;
      const viaHis = v.kind !== 'vt' && v.kind !== 'prefull', d0 = v.kind === 'pre' ? 40 : 0;
      if (viaHis && dt - d0 >= -8 && dt - d0 <= 44) { const u = (dt - d0 + 8) / 52; comet('rbb', u, false); comet('lbb', u, false); }
      const spec = v.kind === 'vt' ? [[SRCV.vt, 150, 0]] : v.kind === 'prefull' ? [[SRCV.kent, 150, 0]] : v.kind === 'pre' ? [[SRCV.kent, 110, 0], [SRCV.his, 60, 44]] : [[SRCV.his, 68, 0]];
      for (const [p, dur, delay] of spec) {
        const d2 = dt - delay; if (d2 < 0 || d2 > dur + 180 || iv >= E.wv.length) continue;
        const k = Math.min(1, d2 / dur), fade = d2 > dur ? 1 - (d2 - dur) / 180 : 1;
        setWave(E.wv[iv++], p, 14 + k * far(p, CORN_V), fade, 'aryGV');
      }
    }
    for (; ia < E.wa.length; ia++) E.wa[ia].style.opacity = '0';
    for (; iv < E.wv.length; iv++) E.wv[iv].style.opacity = '0';
    for (const P of Object.values(E.paths)) for (let k = P.used; k < P.tails.length; k++) { P.tails[k].style.opacity = '0'; P.heads[k].style.opacity = '0'; }
    E.sa.classList.toggle('on', saOn); E.avn.classList.toggle('on', avnOn);
    for (const k of ['focus', 'f1', 'f2', 'f3', 'vt', 'junc']) E.foci[k]?.classList.toggle('on', !!fociOn[k]);
    E.block.hidden = !(tl.block && t >= tl.block[0] && t <= tl.block[1]);
  }

  // ================= Tracé + diagramme en échelle =================
  const LAD_H = 124, MX = 34;
  function drawStrip(t) {
    const f = E.fit; if (!f || !S.tl) return; const { ctx, w, h: H } = f; const tl = S.tl, sg = S.sig;
    const W_SEC = winMs(w), ecgH = H - LAD_H - 8, pxmm = (w - MX) / (W_SEC / 1000 * 25), pxMs = (w - MX) / W_SEC;
    const win0 = tl.dur <= W_SEC ? 0 : clamp(t - W_SEC * 0.55, 0, tl.dur - W_SEC); const X = tt => MX + (tt - win0) * pxMs;
    ctx.clearRect(0, 0, w, H);
    // papier et tracé
    drawPaper(ctx, MX, 0, w - MX, ecgH, pxmm); const y0 = Math.round(ecgH * 0.62);
    ctx.save(); ctx.beginPath(); ctx.rect(MX, 0, w - MX, ecgH); ctx.clip();
    drawTrace(ctx, sg.data, sg.fs, MX, y0, pxmm, 25, 10, { i0: Math.round(win0 * sg.fs / 1000), i1: Math.round(Math.min(tl.dur, win0 + W_SEC) * sg.fs / 1000) + 1, lw: 1.9 });
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
    const srcCol = s => s === 'sa' ? css('--fg') : s === 'avnR' ? css('--accent') : (s === 'kent' || s === 'pj') ? css('--signal') : s === 'flut' ? css('--fg-2') : css('--warn');
    ctx.lineCap = 'round';
    if (tl.af) { ctx.strokeStyle = css('--fg-3'); ctx.lineWidth = 1.2; ctx.beginPath(); const r = Kit.rng(3); for (let tt = Math.floor(win0 / 34) * 34; tt < win0 + W_SEC; tt += 34) { const x = X(tt); ctx.moveTo(x, yA0 + 5 + r() * 6); ctx.lineTo(x + 3, yA1 - 5 - r() * 6); } ctx.stroke(); }
    for (const a of tl.A) { const x = X(a.t + (a.src === 'flut' ? 0 : 20)); if (x < MX - 4 || x > w + 4) continue; ctx.strokeStyle = srcCol(a.src); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, yA0 + 5); ctx.lineTo(x, yA1 - 4); ctx.stroke(); if (a.src !== 'sa' && a.src !== 'flut' && a.src !== 'avnR') { ctx.fillStyle = srcCol(a.src); ctx.beginPath(); ctx.arc(x, a.src === 'kent' || a.src === 'pj' ? yA1 - 4 : yA0 + 5, 2.6, 0, 7); ctx.fill(); } }
    for (const n of tl.N) {
      const xa = X(n.t0), xb = X(n.t1); if (xb < MX - 4 || xa > w + 4) continue;
      let ya = n.dir > 0 ? yA1 : yV0, yb = n.dir > 0 ? yV0 : yA1; if (n.path === 'junc' || n.path === 'juncR') ya = yM;
      let x2 = xb, y2 = yb; if (n.block != null) { x2 = xa + (xb - xa) * n.block; y2 = ya + (yb - ya) * n.block; }
      ctx.strokeStyle = COL[n.path] || css('--fg'); ctx.lineWidth = n.path === 'kent' || n.path === 'pjrt' ? 2.2 : 1.8; ctx.setLineDash(n.path === 'kent' || n.path === 'pjrt' ? [5, 3] : []);
      ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
      if (n.block != null) { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x2 - 4, y2); ctx.lineTo(x2 + 4, y2); ctx.stroke(); }
      if (n.path === 'junc') { ctx.fillStyle = COL.junc; ctx.beginPath(); ctx.arc(xa, ya, 3, 0, 7); ctx.fill(); }
    }
    for (const v of tl.V) { const x = X(v.t + (v.kind === 'vt' ? 0 : 6)); if (x < MX - 4 || x > w + 4) continue; const vt = v.kind === 'vt'; ctx.strokeStyle = vt ? css('--signal') : css('--fg'); ctx.lineWidth = vt ? 3.4 : 2.2; ctx.beginPath(); ctx.moveTo(x, yV0 + 4); ctx.lineTo(x, yV1 - 5); ctx.stroke(); if (vt) { ctx.fillStyle = css('--signal'); ctx.beginPath(); ctx.arc(x, yV1 - 5, 3, 0, 7); ctx.fill(); } }
    ctx.restore();
    // curseur
    const xc = X(t); ctx.strokeStyle = css('--signal'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xc, 0); ctx.lineTo(xc, H); ctx.stroke();
    ctx.fillStyle = css('--signal'); ctx.beginPath(); ctx.arc(xc, y0 - Kit.at(sg, t) * 10 * pxmm, 4, 0, 7); ctx.fill();
  }

  // ================= Interface =================
  // Hauteur du canvas proportionnelle à sa largeur : 32 mm de papier pour DII, puis le diagramme en échelle
  function resize() {
    const w = E.cv.clientWidth; if (!w) return; const pxmm = (w - MX) / (winMs(w) / 1000 * 25);
    const hh = Math.round(32 * pxmm + LAD_H + 8); if (Math.abs(E.cv.clientHeight - hh) > 1) E.cv.style.height = hh + 'px';
    E.fit = fitCanvas(E.cv); drawStrip(S.t);
  }
  function rebuild(keepT) {
    const r = R[S.id]; S.tl = r.build(S.adeno); S.sig = synthTL(S.tl); if (!keepT) S.t = 0; S.t = S.t % S.tl.dur;
    if (E.scrub) { E.scrub.max = Math.round(S.tl.dur); E.scrub.value = Math.round(S.t); }
  }
  function refresh() { updateHeart(S.t); drawStrip(S.t); if (E.scrub && document.activeElement !== E.scrub) E.scrub.value = Math.round(S.t); }
  function frame(dt) { if (!S.playing) return; S.t += dt * S.speed; if (S.t >= S.tl.dur) S.t -= S.tl.dur; refresh(); }

  function setRhythm(id) { S.id = id; S.adeno = false; rebuild(); paintUI(); refresh(); }
  function setAdeno(on) { S.adeno = on; rebuild(); S.t = on ? Math.max(0, S.tl.block[0] - 2200) : 0; paintUI(); refresh(); if (on && !S.playing && !reduceMotion) togglePlay(true); }
  function togglePlay(v) { S.playing = v ?? !S.playing; E.play.textContent = S.playing ? '❚❚ Pause' : '▶︎ Lecture'; E.play.setAttribute('aria-pressed', String(S.playing)); }

  function paintUI() {
    const r = R[S.id], hidden = !!(S.defi && !S.defi.revealed);
    $$('.chip', E.chips).forEach(b => { const on = b.dataset.k === S.id; b.setAttribute('aria-pressed', String(!hidden && on)); if (!S.defi) b.classList.remove('correct', 'wrong'); });
    const show = new Set(hidden ? [] : r.show);
    $$('[data-grp]', E.svg).forEach(e => { e.style.display = show.has(e.dataset.grp) ? '' : 'none'; });
    E.veil.hidden = !hidden; E.title.textContent = hidden ? 'Rythme mystère' : r.label; E.rate.textContent = hidden ? '? /min' : r.rate; E.rate.hidden = false;
    E.adeno.setAttribute('aria-pressed', String(S.adeno)); E.adeno.textContent = S.adeno ? 'Arrêter le test' : 'Tester l’adénosine';
    E.banner.hidden = !S.defi;
    if (S.defi) E.bannerTxt.innerHTML = S.defi.revealed ? `<b>Réponse : ${r.label}.</b> Rejouez la séquence au ralenti pour suivre le circuit.` : '<b>Défi.</b> Lisez DII et le diagramme en échelle : fréquence, régularité, onde P, rapport RP/PR. Demandez un test à l’adénosine si besoin, puis cliquez le rythme proposé par la salle.';
    E.btnReveal.hidden = !hidden;
    // panneaux
    E.mech.innerHTML = hidden ? '<span class="muted">Masqué pendant le défi.</span>' : r.mech;
    E.signsBox.innerHTML = '';
    if (hidden) { S.defi.list = Kit.revealList(r.signs); E.signsBox.append(S.defi.list.el, h('p', { class: 'xs muted', style: 'margin-top:8px' }, 'Faites décrire chaque élément par la salle avant de le révéler.')); }
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

  let built = false, anim = null;
  function init() {
    if (built) return; built = true; const root = $('#aryRoot');
    E.chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Rythme' }, ORDER.map(k => h('button', { class: 'chip', 'data-k': k, onclick: () => { if (S.defi && !S.defi.revealed) revealDefi(k); else { if (S.defi) S.defi = null; setRhythm(k); } } }, R[k].chip)));
    E.banner = h('div', { class: 'mystery-banner', hidden: true }, E.bannerTxt = h('div'), h('div', { style: 'display:flex;gap:8px' }, E.btnReveal = h('button', { class: 'btn small', onclick: () => revealDefi(null) }, 'Révéler'), h('button', { class: 'btn small secondary', onclick: quitDefi }, 'Quitter le défi')));
    const heart = buildHeart();
    E.sa = $('#ary-sa', E.svg); E.avn = $('#ary-avn', E.svg); E.block = $('#ary-block', E.svg);
    E.foci = { focus: $('#ary-f-focus', E.svg), f1: $('#ary-f-f1', E.svg), f2: $('#ary-f-f2', E.svg), f3: $('#ary-f-f3', E.svg), vt: $('#ary-f-vt', E.svg), junc: $('#ary-f-junc', E.svg) };
    E.veil = h('div', { class: 'veil', hidden: true }, h('div', null, h('b', null, 'Mécanisme masqué'), h('span', null, 'Le circuit s’affichera à la révélation.')));
    E.cv = h('canvas', { class: 'ary-cv', 'aria-label': 'Tracé DII et diagramme en échelle' });
    E.play = h('button', { class: 'btn small secondary', 'aria-pressed': String(S.playing), onclick: () => togglePlay() }, S.playing ? '❚❚ Pause' : '▶︎ Lecture');
    E.adeno = h('button', { class: 'btn small', 'aria-pressed': 'false', onclick: () => setAdeno(!S.adeno) }, 'Tester l’adénosine');
    E.scrub = h('input', { type: 'range', min: 0, max: 6000, step: 1, value: 0, class: 'ary-scrub', 'aria-label': 'Position dans la séquence' });
    E.scrub.addEventListener('input', () => { S.t = +E.scrub.value; if (S.playing) togglePlay(false); refresh(); });
    E.title = h('h3', { class: 'ary-title' }); E.rate = h('span', { class: 'pill signal' });
    E.mech = h('p', { class: 'ary-txt' }); E.signsBox = h('div'); E.adenoTxt = h('p', { class: 'ary-txt' }); E.pearl = h('p', { class: 'pearl' });
    root.append(
      h('div', { class: 'section-head' },
        h('div', null, h('div', { class: 'eyebrow' }, 'Atlas des arythmies'), h('h2', null, 'Voir le circuit, lire le tracé.'),
          h('p', null, 'Choisissez un rythme : le front d’activation parcourt le cœur au ralenti pendant que DII et le diagramme en échelle défilent au même instant. Puis testez l’adénosine pour voir ce qui dépend du nœud AV.')),
        h('span', { class: 'hint-keys', html: '<kbd>Espace</kbd> lecture · <kbd>←</kbd> <kbd>→</kbd> rythme · <kbd>A</kbd> adénosine · <kbd>D</kbd> défi' })),
      h('div', { class: 'card sim-controls' }, h('div', { class: 'ctl-group', style: 'flex:1 1 520px' }, h('span', { class: 'ctl-lab' }, 'Rythme'), E.chips), h('button', { class: 'btn small', onclick: startDefi }, 'Défi : quel rythme ?')),
      E.banner,
      h('div', { class: 'ary-grid' },
        h('div', { class: 'card ary-heart' }, h('div', { class: 'ary-head' }, E.title, E.rate), h('div', { class: 'heart-wrap' }, heart, E.veil),
          h('div', { class: 'tray' }, h('span', { class: 'sw' }, h('i', { style: 'border-color:var(--accent);background:var(--accent-soft)' }), 'activation des oreillettes'), h('span', { class: 'sw' }, h('i', { style: 'border-color:var(--signal);background:var(--signal-soft)' }), 'activation des ventricules'), h('span', { class: 'sw' }, h('i', { style: 'border-color:var(--warn);background:var(--warn)' }), 'front de conduction'))),
        h('div', { class: 'card ecg-card' },
          h('div', { class: 'ecg-tools' },
            h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, E.play, segGroup([[1, '×1'], [0.5, '×½'], [0.25, '×¼'], [0.1, '×⅒']], S.speed, v => { S.speed = v; }, 'Vitesse de lecture')),
            E.adeno),
          E.cv, E.scrub,
          h('p', { class: 'xs muted', style: 'margin-top:6px' }, 'DII, 25 mm/s, 10 mm/mV. Diagramme en échelle : A, oreillettes ; AV, jonction ; V, ventricules. Une ligne oblique représente la conduction, une barre un bloc. Tracés de synthèse à visée pédagogique.'))),
      h('div', { class: 'sim-bottom ary-bottom' },
        h('div', { class: 'card panel' }, h('h4', null, 'Mécanisme'), E.mech),
        h('div', { class: 'card panel' }, h('h4', null, 'Sur le tracé'), E.signsBox),
        h('div', { class: 'card panel' }, h('h4', null, 'Adénosine ou manœuvres vagales'), E.adenoTxt, E.pearl)));
    measurePaths(); rebuild(); paintUI();
    observe(E.cv, resize);
    themeListeners.push(() => refresh());
    anim = Kit.loop('arythmies', frame); anim.start();
  }

  viewHooks.arythmies = () => { init(); if (!E.paths.avn.len) measurePaths(); resize(); refresh(); };
  viewKeys.arythmies = e => {
    const k = e.key;
    if (k === ' ') { e.preventDefault(); if (S.defi && !S.defi.revealed) { if (!S.defi.list.next()) revealDefi(null); } else togglePlay(); }
    else if (k === 'ArrowRight' || k === 'ArrowLeft') { if (S.defi && !S.defi.revealed) return; const i = ORDER.indexOf(S.id) + (k === 'ArrowRight' ? 1 : -1); S.defi = null; setRhythm(ORDER[(i + ORDER.length) % ORDER.length]); e.preventDefault(); }
    else if (k.toLowerCase() === 'a') setAdeno(!S.adeno);
    else if (k.toLowerCase() === 'd') startDefi();
    else if (k === 'Escape' && S.defi) quitDefi();
  };
  return { init, R, synthTL };
})();
