"use strict";
/* Stimulateur double chambre (modes AAI, VVI, DDD) et défibrillateur, sur le schéma commun (js/heart.js).
   Boîtier simplifié simulé pas à pas (1 ms) : fréquence de base 60/min, délai AV 150 ms après une onde P détectée,
   180 ms après une stimulation atriale, période réfractaire atriale post-ventriculaire 250 ms.
   Valeurs d'exemple. Non modélisés : hystérésis, fréquence maximale de suivi, conduction rétrograde, asservissement. */
const STIM = (() => {
  const { TL, addA, addN, addV, addS } = Heart;
  const S = { mode: 'DDD', rh: 'bav', icd: 'atp' };
  const E = {};
  let PM = null, ICD = null;

  // ================= Stimulateur =================
  function pacemaker(mode, rh) {
    const dur = 6000, LRI = 1000, SAV = 150, PAV = 180, PVARP = 250, VRP = 250;
    const bav = rh === 'bav', sinusCL = bav ? 750 : 1500, PR = 160, escCL = 1700, T0 = -8000;
    const tl = TL(dur); const keep = t => t >= -200 && t < dur + 400;
    const senseA = mode !== 'VVI', senseV = mode !== 'AAI';
    let nextSinus = 200 - Math.ceil((200 - T0) / sinusCL) * sinusCL, lastA = -1e9, lastV = -1e9, condAt = null, condFrom = 0, pmA = T0, pmV = T0, avAt = null;
    const atrial = (t, paced) => {
      lastA = t; let mark = null;
      if (paced) { nextSinus = t + sinusCL; mark = 'AP'; pmA = t; if (keep(t)) addS(tl, t, 'A'); if (mode === 'DDD') avAt = t + PAV; }
      else if (senseA && t - pmV > PVARP) { mark = 'AS'; pmA = t; if (mode === 'DDD' && avAt == null) avAt = t + SAV; }
      if (keep(t)) { addA(tl, t, paced ? 'leadA' : 'sa', paced ? 'paced' : 'sinus', { mark }); if (bav) addN(tl, t + 45, t + 120, 'avn', 1, 0.5); }
      if (!bav) { condAt = t + PR; condFrom = t; }
    };
    const ventricle = (t, kind, fromA) => {
      if (t - lastV <= VRP) return;
      lastV = t; const paced = kind === 'paced';
      if (keep(t)) { if (fromA != null) addN(tl, fromA + 45, t - 12, 'avn', 1); addV(tl, t, kind, { mark: paced ? 'VP' : senseV ? 'VS' : null }); }
      if (paced || senseV) { pmV = t; avAt = null; }
    };
    const paceV = t => { if (keep(t)) addS(tl, t, 'V'); ventricle(t, 'paced'); pmV = t; avAt = null; };
    for (let t = T0; t < dur + 400; t++) {
      if (t >= nextSinus) { nextSinus = t + sinusCL; if (t - lastA > 280) atrial(t, false); }
      if (mode === 'AAI' && t - pmA >= LRI) atrial(t, true);
      if (mode === 'DDD' && avAt == null && pmA <= pmV && t - pmV >= LRI - PAV) atrial(t, true);
      if (condAt != null && t >= condAt) { const a0 = condFrom; condAt = null; ventricle(t, 'his', a0); }
      if (mode === 'VVI' && t - pmV >= LRI) paceV(t);
      if (mode === 'DDD' && avAt != null && t >= avAt) paceV(t);
      if (bav && t - lastV >= escCL) ventricle(t, 'his');
    }
    return tl;
  }
  const MODES = {
    AAI: { code: [['A', 'stimule l’oreillette'], ['A', 'détecte l’oreillette'], ['I', 'inhibé par une onde P spontanée']], pearl: 'Suppose une conduction AV normale : dysfonction sinusale isolée.' },
    VVI: { code: [['V', 'stimule le ventricule'], ['V', 'détecte le ventricule'], ['I', 'inhibé par un QRS spontané']], pearl: 'Protège de la bradycardie, sans synchroniser oreillettes et ventricules.' },
    DDD: { code: [['D', 'stimule oreillette et ventricule'], ['D', 'détecte oreillette et ventricule'], ['D', 'inhibe ; une onde P détectée déclenche une stimulation ventriculaire après le délai AV']], pearl: 'Maintient la synchronisation AV. Dans un BAV, la fréquence ventriculaire suit le sinus.' },
  };
  const RHYTHMS = { brady: 'Dysfonction sinusale', bav: 'BAV complet' };
  const RH_TXT = { brady: 'Sinus à 40/min, conduction AV normale.', bav: 'Ondes P à 80/min non conduites, échappement à 35/min.' };
  const COMBO = {
    'brady-AAI': 'Spicule, onde P, puis QRS fin conduit par le nœud AV. Fréquence 60/min.',
    'brady-VVI': 'Spicule suivi d’un QRS large. Les QRS conduits après une onde P inhibent la stimulation. Oreillettes et ventricules ne sont pas synchronisés.',
    'brady-DDD': 'Stimulation atriale (AP), puis QRS fin conduit (VS) : le délai AV laisse passer la conduction propre.',
    'bav-AAI': 'Les ondes P spontanées inhibent la stimulation atriale mais ne sont pas conduites : seul persiste l’échappement lent. Mode inadapté au BAV.',
    'bav-VVI': 'QRS larges stimulés à 60/min, ondes P à 80/min sans lien avec eux : dissociation AV.',
    'bav-DDD': 'Chaque onde P détectée (AS) déclenche une stimulation ventriculaire (VP) après le délai AV : QRS larges à la fréquence sinusale.',
  };

  // ================= Défibrillateur =================
  function icd(sc) {
    const tl = TL(sc === 'atp' ? 8000 : 9000);
    const sinus = (from, to) => {
      for (let p = 160; p < tl.dur + 300; p += 800) {
        addA(tl, p, 'sa', 'sinus');
        if (p + 140 >= from && p + 140 <= to) addN(tl, p + 45, p + 110, 'avn', 1, 0.5);
        else { addN(tl, p + 45, p + 128, 'avn', 1); addV(tl, p + 140, 'his'); }
      }
    };
    if (sc === 'atp') {
      sinus(1500, 6600);
      for (let q = 1700; q <= 3680; q += 330) addV(tl, q, 'vt');
      for (let k = 1; k <= 8; k++) { const q = 3680 + 290 * k; addS(tl, q, 'V'); addV(tl, q, 'atp', { mark: 'VP' }); }
      tl.marks.push({ t: 3350, txt: 'TV détectée' }, { t: 3970, txt: 'Stimulation antitachycardique' }, { t: 6700, txt: 'Rythme sinusal' });
    } else {
      sinus(1450, 6600);
      tl.vf = [1500, 5200, 11]; tl.shocks.push({ t: 5200 });
      tl.marks.push({ t: 2700, txt: 'FV détectée, charge' }, { t: 5200, txt: 'Choc' }, { t: 6700, txt: 'Rythme sinusal' });
    }
    return tl;
  }
  const ICDS = {
    atp: { chip: 'TV : stimulation antitachycardique', rate: 'TV 182/min', signs: 'TV à QRS larges, puis salve de 8 spicules un peu plus rapides que la TV, chacun suivi d’un QRS large. La TV s’arrête, le rythme sinusal reprend.' },
    choc: { chip: 'FV : choc', rate: 'FV', signs: 'Oscillations rapides et irrégulières, sans QRS identifiable. Après la charge, choc (grand artéfact), puis reprise du rythme sinusal.' },
  };

  // ================= Interface =================
  function paintPM() {
    const m = MODES[S.mode];
    PM.setTL(pacemaker(S.mode, S.rh), 0);
    PM.heart.leadsOff({ A: S.mode === 'VVI', V: S.mode === 'AAI' });
    E.pmTitle.textContent = `Mode ${S.mode}`;
    E.code.innerHTML = ''; E.code.append(h('div', { class: 'nbg' }, m.code.map(([L, txt], i) => h('div', { class: 'nbg-row' }, h('b', null, L), h('span', null, `${['1re', '2e', '3e'][i]} lettre : ${txt}`)))));
    E.pmSigns.innerHTML = `<b>${RHYTHMS[S.rh]}.</b> ${RH_TXT[S.rh]}<br>${COMBO[S.rh + '-' + S.mode]}`;
    E.pmPearl.innerHTML = '<b>À retenir. </b>' + m.pearl;
  }
  function paintICD() {
    const c = ICDS[S.icd]; ICD.setTL(icd(S.icd), 0);
    E.icdTitle.textContent = c.chip; E.icdRate.textContent = c.rate; E.icdSigns.textContent = c.signs;
  }

  let built = false;
  function init() {
    if (built) return; built = true; const root = $('#stimRoot');
    const foot = 'DII, 25 mm/s, 10 mm/mV. Marqueurs : AP et VP stimulation, AS et VS détection. Tracés simulés.';
    PM = Heart.player({ view: 'stim', id: 'pm', foot });
    PM.heart.show(new Set(['gen', 'leadA', 'leadV'])); PM.heart.gen('PM');
    ICD = Heart.player({ view: 'stim', id: 'icd', foot: 'DII, 25 mm/s, 10 mm/mV. VP : stimulation. Tracés simulés.' });
    ICD.heart.show(new Set(['gen', 'leadV', 'coil'])); ICD.heart.gen('DAI');
    E.pmTitle = h('h3', { class: 'ary-title' }); E.icdTitle = h('h3', { class: 'ary-title' }); E.icdRate = h('span', { class: 'pill signal' });
    E.code = h('div'); E.pmSigns = h('p', { class: 'ary-txt' }); E.pmPearl = h('p', { class: 'pearl' }); E.icdSigns = h('p', { class: 'ary-txt' });
    root.append(
      h('div', { class: 'section-head' }, h('div', null, h('h2', null, 'Stimulateur et défibrillateur'),
        h('p', null, 'Boîtier double chambre : trois modes de stimulation. Défibrillateur : stimulation antitachycardique et choc.'))),
      h('h3', { class: 'stim-h' }, 'Stimulateur double chambre'),
      h('div', { class: 'card sim-controls' },
        h('div', { class: 'ctl-group' }, h('span', { class: 'ctl-lab' }, 'Mode'), segGroup(Object.keys(MODES).map(k => [k, k]), S.mode, v => { S.mode = v; paintPM(); }, 'Mode de stimulation')),
        h('div', { class: 'ctl-group' }, h('span', { class: 'ctl-lab' }, 'Patient'), chipGroup(Object.entries(RHYTHMS), S.rh, v => { S.rh = v; paintPM(); }))),
      h('div', { class: 'ary-grid' },
        h('div', { class: 'card ary-heart' }, h('div', { class: 'ary-head' }, E.pmTitle, h('span', { class: 'pill' }, 'Fréquence de base 60/min')), PM.heartWrap, Heart.legend()),
        h('div', { class: 'card ecg-card' }, PM.ecg)),
      h('div', { class: 'sim-bottom ary-bottom' },
        h('div', { class: 'card panel' }, h('h4', null, 'Code du mode'), E.code),
        h('div', { class: 'card panel' }, h('h4', null, 'Sur le tracé'), E.pmSigns),
        h('div', { class: 'card panel answer' }, h('h4', null, 'Indication'), E.pmPearl)),
      h('h3', { class: 'stim-h' }, 'Défibrillateur'),
      h('div', { class: 'card sim-controls' },
        h('div', { class: 'ctl-group' }, h('span', { class: 'ctl-lab' }, 'Situation'), chipGroup(Object.entries(ICDS).map(([k, v]) => [k, v.chip]), S.icd, v => { S.icd = v; paintICD(); }))),
      h('div', { class: 'ary-grid' },
        h('div', { class: 'card ary-heart' }, h('div', { class: 'ary-head' }, E.icdTitle, E.icdRate), ICD.heartWrap, Heart.legend()),
        h('div', { class: 'card ecg-card' }, ICD.ecg)),
      h('div', { class: 'sim-bottom ary-bottom' },
        h('div', { class: 'card panel' }, h('h4', null, 'Détection'), h('p', { class: 'ary-txt' }, 'Le boîtier mesure les intervalles RR. Exemple de programmation : zone TV de 170 à 200/min, stimulation antitachycardique puis choc en cas d’échec ; zone FV au-delà de 200/min, choc d’emblée.')),
        h('div', { class: 'card panel' }, h('h4', null, 'Sur le tracé'), E.icdSigns),
        h('div', { class: 'card panel answer' }, h('h4', null, 'À retenir'), h('p', { class: 'pearl', html: '<b>À retenir. </b>La stimulation antitachycardique est indolore ; le choc est ressenti par le patient conscient. Un aimant posé sur le boîtier suspend les thérapies ; sur la plupart des modèles, la stimulation n’est pas modifiée.' }))));
    paintPM(); paintICD();
  }

  viewHooks.stim = () => { init(); for (const p of [PM, ICD]) { p.heart.measure(); p.resize(); p.refresh(); } };
  viewKeys.stim = e => { if (e.key === ' ') { e.preventDefault(); const v = !PM.P.playing; PM.play(v); ICD.play(v); } };
  return { init, pacemaker, icd };
})();
