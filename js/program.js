// Programmes de 12 semaines, 4 séances par semaine : footing, fractionné, renforcement, sortie longue.

export const TYPE_INFO = {
  ef: { label: 'Footing', emoji: '🏃', color: 'teal' },
  frac: { label: 'Fractionné', emoji: '⚡', color: 'violet' },
  renfo: { label: 'Renforcement', emoji: '💪', color: 'pink' },
  long: { label: 'Sortie longue', emoji: '🛣️', color: 'orange' },
  race: { label: 'Objectif 10 km', emoji: '🏁', color: 'yellow' },
};

export const PACE_GUIDE = [
  { name: 'Endurance fondamentale', text: 'Allure facile : tu peux tenir une conversation en courant. C\'est la base de tout, ne cours pas trop vite !' },
  { name: 'Allure 10 km', text: 'Rapide mais tenable : tu ne peux dire que quelques mots. C\'est l\'allure visée le jour J.' },
  { name: 'Rapide', text: 'Plus vite que l\'allure 10 km, sur des efforts courts (1 à 3 min). Soutenu, sans sprinter.' },
  { name: 'Trot', text: 'Récupération en trottinant très lentement (ou en marchant si besoin).' },
];

// frac : reps × on (secondes) à l'allure "pace", récupération off (secondes)
const PREMIER_10 = [
  { theme: 'Mise en route', ef: 30, frac: { reps: 6, on: 60, pace: 'rapide', off: 90 }, long: 5.5 },
  { theme: 'On installe le rythme', ef: 30, frac: { reps: 8, on: 60, pace: 'rapide', off: 60 }, long: 6 },
  { theme: 'Premiers progrès', ef: 35, frac: { reps: 5, on: 120, pace: 'rapide', off: 90 }, long: 6.5 },
  { theme: 'Semaine récup', recovery: true, ef: 30, frac: { strides: 6 }, long: 5 },
  { theme: 'On allonge', ef: 35, frac: { reps: 4, on: 180, pace: 'allure 10 km', off: 120 }, long: 7 },
  { theme: 'Plus d\'endurance', ef: 40, frac: { reps: 5, on: 180, pace: 'allure 10 km', off: 90 }, long: 7.5 },
  { theme: 'Cap des 8 km', ef: 40, frac: { reps: 3, on: 300, pace: 'allure 10 km', off: 120 }, long: 8 },
  { theme: 'Semaine récup', recovery: true, ef: 30, frac: { reps: 4, on: 120, pace: 'allure 10 km', off: 120 }, long: 6 },
  { theme: 'Dernière ligne droite', ef: 40, frac: { reps: 4, on: 300, pace: 'allure 10 km', off: 120 }, long: 8.5 },
  { theme: 'Cap des 9 km', ef: 45, frac: { reps: 3, on: 480, pace: 'allure 10 km', off: 120 }, long: 9 },
  { theme: 'Grosse semaine', ef: 45, frac: { reps: 2, on: 720, pace: 'allure 10 km', off: 180 }, long: 9.5 },
  { theme: 'Semaine du 10 km !', taper: true, ef: 25, frac: { reps: 4, on: 60, pace: 'allure 10 km', off: 90 }, long: 10 },
];

const CHRONO_10 = [
  { theme: 'Reprise', ef: 40, frac: { reps: 8, on: 60, pace: 'rapide', off: 60 }, long: 8 },
  { theme: 'On monte le volume', ef: 40, frac: { reps: 5, on: 180, pace: 'allure 10 km', off: 90 }, long: 8.5 },
  { theme: 'Travail au seuil', ef: 45, frac: { reps: 3, on: 360, pace: 'allure 10 km', off: 120 }, long: 9 },
  { theme: 'Semaine récup', recovery: true, ef: 35, frac: { strides: 6 }, long: 7 },
  { theme: 'Vitesse', ef: 45, frac: { reps: 10, on: 60, pace: 'rapide', off: 60 }, long: 10 },
  { theme: 'Seuil long', ef: 45, frac: { reps: 3, on: 480, pace: 'allure 10 km', off: 120 }, long: 10 },
  { theme: 'Allure spécifique', ef: 50, frac: { reps: 4, on: 420, pace: 'allure 10 km', off: 120 }, long: 11 },
  { theme: 'Semaine récup', recovery: true, ef: 35, frac: { reps: 5, on: 120, pace: 'allure 10 km', off: 120 }, long: 8 },
  { theme: 'VMA', ef: 50, frac: { reps: 6, on: 180, pace: 'rapide', off: 120 }, long: 11 },
  { theme: 'Bloc spécifique', ef: 50, frac: { reps: 2, on: 900, pace: 'allure 10 km', off: 180 }, long: 12 },
  { theme: 'Dernier gros bloc', ef: 45, frac: { reps: 3, on: 600, pace: 'allure 10 km', off: 120 }, long: 10 },
  { theme: 'Semaine du chrono !', taper: true, ef: 30, frac: { reps: 5, on: 60, pace: 'allure 10 km', off: 90 }, long: 10 },
];

export const PLANS = {
  premier10: {
    name: 'Mon premier 10 km',
    short: 'Premier 10 km',
    description: 'De 5 km à 10 km en 12 semaines, à ton rythme.',
    weeks: PREMIER_10,
    renfo: (w) => (w <= 4 ? 'A' : w <= 8 ? 'B' : w <= 11 ? 'C' : 'D'),
    race: {
      title: 'Ton premier 10 km 🎉',
      summary: '10 km à ton rythme, profite !',
      finish: 'Pense à ta récompense 📚',
    },
  },
  chrono10: {
    name: '10 km plus vite',
    short: '10 km chrono',
    description: 'Tu cours déjà 10 km ? 12 semaines pour améliorer ton temps.',
    weeks: CHRONO_10,
    renfo: (w) => (w <= 4 ? 'B' : w <= 11 ? 'C' : 'D'),
    race: {
      title: 'Ton 10 km chrono ⏱',
      summary: '10 km pour battre ton record !',
      finish: 'Tout donner, ton record t\'attend',
    },
  },
};

export const TOTAL_WEEKS = 12;

export function formatSeconds(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${String(s).padStart(2, '0')}` : `${m} min`;
}

function kmText(km) {
  return String(km).replace('.', ',');
}

function efSession(week, w) {
  const strides = week >= 3 && !w.recovery && !w.taper;
  const run = w.ef - 5 - (strides ? 4 : 0);
  const steps = [
    { kind: 'warm', label: 'Échauffement', detail: '5 min en trottinant très tranquillement' },
    { kind: 'run', label: `${run} min en endurance fondamentale`, detail: 'Allure conversation' },
  ];
  if (strides) steps.push({ kind: 'fast', label: '4 lignes droites de 20 s', detail: 'Accélère progressivement, récupère en marchant 40 s' });
  if (w.taper) steps.push({ kind: 'fast', label: '4 lignes droites de 15 s', detail: 'Juste pour réveiller les jambes' });
  return {
    type: 'ef',
    title: w.taper ? 'Footing léger' : `Footing ${w.ef} min`,
    summary: `${w.ef} min tranquille${strides ? ' + lignes droites' : ''}`,
    durationMin: w.ef,
    steps,
  };
}

function fracSession(week, w) {
  const f = w.frac;
  if (f.strides) {
    return {
      type: 'frac',
      title: 'Footing + accélérations',
      summary: `30 min avec ${f.strides} accélérations`,
      durationMin: 30,
      steps: [
        { kind: 'warm', label: 'Échauffement', detail: '10 min tranquille' },
        { kind: 'run', label: '15 min en endurance fondamentale', detail: `Glisse ${f.strides} accélérations de 20 s, 1 min de trot entre chaque` },
        { kind: 'cool', label: 'Retour au calme', detail: '5 min très lent' },
      ],
    };
  }
  const warm = w.taper ? 600 : 900;
  const cool = w.taper ? 300 : 600;
  const total = Math.round((warm + cool + f.reps * f.on + (f.reps - 1) * f.off) / 60);
  return {
    type: 'frac',
    title: `${f.reps} × ${formatSeconds(f.on)}`,
    summary: `${f.reps} × ${formatSeconds(f.on)} ${f.pace}, récup ${formatSeconds(f.off)}`,
    durationMin: total,
    intervals: { ...f, warm, cool },
    steps: [
      { kind: 'warm', label: 'Échauffement', detail: `${warm / 60} min tranquille + 3 accélérations progressives` },
      { kind: 'fast', label: `${f.reps} × ${formatSeconds(f.on)} ${f.pace}`, detail: `Récupération : ${formatSeconds(f.off)} de trot entre chaque` },
      { kind: 'cool', label: 'Retour au calme', detail: `${cool / 60} min très lent puis étirements doux` },
    ],
  };
}

function longSession(week, w, plan) {
  if (w.taper) {
    return {
      type: 'race',
      title: plan.race.title,
      summary: plan.race.summary,
      distanceKm: 10,
      durationMin: 70,
      steps: [
        { kind: 'warm', label: 'Échauffement', detail: '10 min de trot + quelques accélérations' },
        { kind: 'run', label: 'Km 1 à 3 : pars prudemment', detail: 'Un peu plus lent que ce que tu crois pouvoir faire' },
        { kind: 'fast', label: 'Km 4 à 8 : allure 10 km', detail: 'Installe ton rythme, respire' },
        { kind: 'fast', label: 'Km 9 et 10 : tout ce qu\'il reste !', detail: plan.race.finish },
      ],
    };
  }
  const km = w.long;
  const minutes = Math.round(km * 7.5);
  return {
    type: 'long',
    title: `Sortie longue ${kmText(km)} km`,
    summary: `${kmText(km)} km tranquille (~${minutes} min)`,
    distanceKm: km,
    durationMin: minutes,
    steps: [
      { kind: 'warm', label: 'Départ très tranquille', detail: 'Les 10 premières minutes encore plus lentement' },
      { kind: 'run', label: `${kmText(km)} km en endurance fondamentale`, detail: 'L\'objectif est la distance, pas la vitesse. Marcher 1 min est autorisé !' },
      { kind: 'cool', label: 'Étirements', detail: '5 min de marche puis étirements doux' },
    ],
  };
}

function renfoSession(phase) {
  return {
    type: 'renfo',
    title: phase === 'D' ? 'Renfo léger & mobilité' : `Renfo niveau ${phase}`,
    summary: phase === 'D' ? 'Séance courte pour garder de la fraîcheur' : 'Jambes, fessiers et gainage',
    durationMin: phase === 'D' ? 20 : 35,
    renfoPhase: phase,
    steps: [],
  };
}

const planCache = {};

// Semaines d'un programme. Chaque séance a une clé "w3-s2" (semaine 3, séance 2).
export function buildPlan(planId) {
  if (planCache[planId]) return planCache[planId];
  const plan = PLANS[planId];
  planCache[planId] = plan.weeks.map((w, i) => {
    const week = i + 1;
    const sessions = [efSession(week, w), fracSession(week, w), renfoSession(plan.renfo(week)), longSession(week, w, plan)]
      .map((s, slot) => ({ ...s, key: `w${week}-s${slot + 1}`, week, slot }));
    return { week, theme: w.theme, recovery: !!w.recovery, taper: !!w.taper, sessions };
  });
  return planCache[planId];
}

// Étapes du minuteur pour une séance de fractionné.
export function intervalSteps(session) {
  const f = session.intervals;
  const steps = [{ kind: 'rest', name: 'Échauffement', seconds: f.warm, tip: 'Trottine tranquillement, termine par 3 accélérations progressives.', say: 'Échauffement', badge: '🔥 Échauffement' }];
  for (let i = 1; i <= f.reps; i++) {
    steps.push({ kind: 'work', name: `Accélère · ${i}/${f.reps}`, seconds: f.on, tip: `Allure : ${f.pace}`, say: i === f.reps ? 'Dernière accélération, allez !' : `Accélère, ${f.pace}`, badge: '⚡ Accélère' });
    if (i < f.reps) steps.push({ kind: 'rest', name: 'Récupère en trottinant', seconds: f.off, tip: 'Respire, relâche les épaules.', say: 'Récupère', badge: '😮‍💨 Récupère' });
  }
  steps.push({ kind: 'rest', name: 'Retour au calme', seconds: f.cool, tip: 'Très lentement, puis quelques étirements.', say: 'Bravo ! Retour au calme', badge: '🧘 Retour au calme' });
  return steps;
}

// --- Renforcement musculaire -------------------------------------------------
// mode "circuit" : on enchaîne les exercices, X tours.
// mode "series" : chaque exercice en plusieurs séries avec repos.

const WARMUP = { name: 'Échauffement', seconds: 300, tip: 'Jumping jacks, montées de genoux, cercles de hanches et de bras.' };

export const RENFO = {
  A: {
    maison: {
      mode: 'circuit', rounds: 3, rest: 30, roundRest: 90,
      exercises: [
        { name: 'Squats', reps: '15', tip: 'Pieds largeur d\'épaules, fesses en arrière, dos droit.' },
        { name: 'Fentes avant alternées', reps: '10 par jambe', tip: 'Genou avant au-dessus de la cheville.' },
        { name: 'Pont fessier', reps: '15', tip: 'Serre les fessiers en haut, 1 s de pause.' },
        { name: 'Planche', seconds: 30, tip: 'Corps aligné, ventre rentré, ne creuse pas le dos.' },
        { name: 'Planche latérale', seconds: 20, perSide: true, tip: 'Hanches hautes, épaule au-dessus du coude.' },
        { name: 'Montées sur pointes', reps: '20', tip: 'Sur une marche si possible, descends lentement.' },
      ],
    },
    salle: {
      mode: 'series', rest: 75,
      exercises: [
        { name: 'Presse à cuisses', sets: 3, reps: '12', tip: 'Ne verrouille pas les genoux en haut.' },
        { name: 'Hip thrust (barre ou machine)', sets: 3, reps: '12', tip: 'Menton rentré, pousse avec les talons.' },
        { name: 'Leg curl', sets: 3, reps: '12', tip: 'Contrôle la descente.' },
        { name: 'Mollets debout (machine)', sets: 3, reps: '15', tip: 'Amplitude complète, pause en haut.' },
        { name: 'Rowing poulie assis', sets: 3, reps: '12', tip: 'Omoplates serrées : bon pour la posture en course.' },
        { name: 'Planche', sets: 3, seconds: 30, tip: 'Corps aligné, ventre rentré.' },
      ],
    },
  },
  B: {
    maison: {
      mode: 'circuit', rounds: 3, rest: 30, roundRest: 90,
      exercises: [
        { name: 'Squats sautés', reps: '10', tip: 'Réception souple, genoux dans l\'axe.' },
        { name: 'Fentes arrière', reps: '12 par jambe', tip: 'Buste droit, descends le genou près du sol.' },
        { name: 'Pont fessier sur une jambe', reps: '10 par jambe', tip: 'Le bassin reste bien horizontal.' },
        { name: 'Planche', seconds: 40, tip: 'Respire normalement.' },
        { name: 'Planche latérale', seconds: 30, perSide: true, tip: 'Hanches hautes.' },
        { name: 'Mountain climbers', seconds: 30, tip: 'Genoux vers la poitrine, bassin bas.' },
        { name: 'Montées sur pointes sur une jambe', reps: '12 par jambe', tip: 'Tiens-toi au mur pour l\'équilibre.' },
      ],
    },
    salle: {
      mode: 'series', rest: 75,
      exercises: [
        { name: 'Squat goblet (haltère)', sets: 3, reps: '10', tip: 'Haltère contre la poitrine, coudes entre les genoux.' },
        { name: 'Fentes marchées avec haltères', sets: 3, reps: '10 par jambe', tip: 'Grands pas, buste droit.' },
        { name: 'Soulevé de terre jambes tendues', sets: 3, reps: '10', tip: 'Dos plat, haltères le long des jambes.' },
        { name: 'Step-up sur banc', sets: 3, reps: '10 par jambe', tip: 'Pousse avec la jambe du haut, pas avec celle du bas.' },
        { name: 'Mollets debout', sets: 3, reps: '15', tip: 'Lent à la descente.' },
        { name: 'Pallof press (poulie)', sets: 3, reps: '10 par côté', tip: 'Résiste à la rotation, gainage anti-rotation.' },
        { name: 'Planche', sets: 3, seconds: 45, tip: 'Corps aligné.' },
      ],
    },
  },
  C: {
    maison: {
      mode: 'circuit', rounds: 4, rest: 30, roundRest: 90,
      exercises: [
        { name: 'Squats sautés', reps: '12', tip: 'Explosif en montée, souple en réception.' },
        { name: 'Fentes sautées', reps: '8 par jambe', tip: 'Ou fentes arrière si c\'est trop dur.' },
        { name: 'Pont fessier sur une jambe', reps: '12 par jambe', tip: 'Pause 2 s en haut.' },
        { name: 'Planche avec touches d\'épaule', seconds: 40, tip: 'Le bassin ne bouge pas.' },
        { name: 'Planche latérale', seconds: 35, perSide: true, tip: 'Lève la jambe du dessus si c\'est facile.' },
        { name: 'Mountain climbers', seconds: 40, tip: 'Garde le rythme.' },
        { name: 'Montées sur pointes sur une jambe', reps: '15 par jambe', tip: 'Sur une marche, amplitude complète.' },
      ],
    },
    salle: {
      mode: 'series', rest: 90,
      exercises: [
        { name: 'Squat barre (ou Smith)', sets: 4, reps: '8', tip: 'Charge qui te laisse 2 répétitions en réserve.' },
        { name: 'Hip thrust', sets: 4, reps: '10', tip: 'Monte la charge par rapport au niveau A.' },
        { name: 'Fentes bulgares', sets: 3, reps: '8 par jambe', tip: 'Pied arrière sur le banc, buste légèrement penché.' },
        { name: 'Leg curl', sets: 3, reps: '10', tip: 'Contrôle la descente.' },
        { name: 'Mollets debout', sets: 4, reps: '12', tip: 'Plus lourd, toujours en contrôle.' },
        { name: 'Planche latérale', sets: 3, seconds: 35, perSide: true, tip: 'Hanches hautes.' },
      ],
    },
  },
  D: {
    maison: {
      mode: 'circuit', rounds: 2, rest: 30, roundRest: 60,
      exercises: [
        { name: 'Squats', reps: '12', tip: 'Tranquille, juste pour activer.' },
        { name: 'Pont fessier', reps: '15', tip: 'Serre les fessiers en haut.' },
        { name: 'Planche', seconds: 30, tip: 'Corps aligné.' },
        { name: 'Planche latérale', seconds: 20, perSide: true, tip: 'Hanches hautes.' },
        { name: 'Montées sur pointes', reps: '15', tip: 'Sans forcer.' },
        { name: 'Étirements hanches et mollets', seconds: 120, tip: 'Respire profondément.' },
      ],
    },
  },
};

export function getRenfo(phase, place) {
  const p = RENFO[phase];
  return p[place] || p.maison;
}

// Transforme une séance de renfo en suite d'étapes pour le minuteur guidé.
export function renfoSteps(phase, place) {
  const r = getRenfo(phase, place);
  const steps = [{ ...WARMUP, kind: 'work', say: 'Échauffement, 5 minutes' }];
  const pushExercise = (ex, suffix) => {
    if (ex.seconds && ex.perSide) {
      steps.push({ kind: 'work', name: `${ex.name} · côté gauche${suffix}`, seconds: ex.seconds, tip: ex.tip, say: `${ex.name}, côté gauche` });
      steps.push({ kind: 'work', name: `${ex.name} · côté droit${suffix}`, seconds: ex.seconds, tip: ex.tip, say: 'Côté droit' });
    } else {
      steps.push({ kind: 'work', name: `${ex.name}${suffix}`, seconds: ex.seconds, reps: ex.reps, tip: ex.tip, say: ex.reps ? `${ex.name}, ${ex.reps}` : `${ex.name}, ${ex.seconds} secondes` });
    }
  };
  if (r.mode === 'circuit') {
    for (let round = 1; round <= r.rounds; round++) {
      r.exercises.forEach((ex, i) => {
        pushExercise(ex, ` · tour ${round}/${r.rounds}`);
        const last = i === r.exercises.length - 1;
        if (last && round === r.rounds) return;
        steps.push({ kind: 'rest', name: last ? 'Récupération entre les tours' : 'Repos', seconds: last ? r.roundRest : r.rest, say: last ? `Fin du tour ${round}, récupère` : 'Repos' });
      });
    }
  } else {
    r.exercises.forEach((ex, i) => {
      for (let set = 1; set <= ex.sets; set++) {
        pushExercise(ex, ` · série ${set}/${ex.sets}`);
        const lastAll = i === r.exercises.length - 1 && set === ex.sets;
        if (!lastAll) steps.push({ kind: 'rest', name: 'Repos', seconds: r.rest, say: 'Repos' });
      }
    });
  }
  return steps;
}

export const TIPS = [
  { icon: '🥤', text: 'Bois un grand verre d\'eau au réveil et un autre avant chaque séance.' },
  { icon: '🍌', text: 'Avant une séance du soir, une banane ou une poignée d\'amandes vers 16 h évite le coup de barre.' },
  { icon: '🍳', text: 'Après l\'effort, associe protéines et glucides : yaourt + fruits, œufs + pain complet…' },
  { icon: '🥗', text: 'Remplis la moitié de ton assiette de légumes : rassasiant et léger.' },
  { icon: '😴', text: 'Le sommeil fait partie de l\'entraînement : vise 7 à 8 h, surtout après les grosses séances.' },
  { icon: '🐢', text: 'En footing, si tu ne peux plus parler, ralentis. Courir lentement te rend plus rapide !' },
  { icon: '👟', text: 'Change de chaussures de course tous les 600 à 800 km environ.' },
  { icon: '⚖️', text: 'Pèse-toi le même jour, le matin, à jeun : le poids varie beaucoup d\'un jour à l\'autre.' },
  { icon: '🍽️', text: 'Pas besoin de « manger moins » les jours de grosse séance : écoute ta faim et privilégie les aliments simples.' },
  { icon: '🧂', text: 'Après une sortie longue où tu as beaucoup transpiré, un peu de sel (bouillon, pain) aide à récupérer.' },
  { icon: '🍫', text: 'Aucun aliment n\'est interdit : la régularité compte plus que la perfection.' },
  { icon: '🧘', text: 'Une séance ratée n\'est pas grave. Ne cherche pas à la rattraper en doublant le lendemain.' },
  { icon: '☕', text: 'Attention aux boissons sucrées et aux « boissons d\'effort » pour des séances de moins d\'1 h : l\'eau suffit.' },
  { icon: '🦵', text: 'Le renfo protège tes genoux et tes chevilles : c\'est ton assurance anti-blessure.' },
  { icon: '🌙', text: 'Un dîner léger mais complet aide à mieux dormir : légumes, protéines, féculents en quantité raisonnable.' },
];
