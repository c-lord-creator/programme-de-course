// Données de l'utilisatrice, enregistrées sur le téléphone (localStorage).

import { PROGRAM, findSession } from './program.js';

const KEY = 'elan10k-v1';

export const DEFAULT_REWARDS = [
  { type: 'sessions', threshold: 1, label: 'Première séance', reward: 'Une nouvelle playlist de course 🎧' },
  { type: 'longest', threshold: 6, label: 'Premier 6 km', reward: '' },
  { type: 'weeks', threshold: 2, label: '2 semaines d\'affilée', reward: 'Un smoothie ou un jus frais 🥤' },
  { type: 'longest', threshold: 7, label: 'Premier 7 km', reward: 'Un bon petit-déj au café ☕' },
  { type: 'total', threshold: 25, label: '25 km au compteur', reward: 'Des chaussettes de running techniques 🧦' },
  { type: 'renfo', threshold: 4, label: '4 séances de renfo', reward: '' },
  { type: 'weeks', threshold: 4, label: '1 mois sans lâcher', reward: 'Un massage 💆' },
  { type: 'longest', threshold: 8, label: 'Premier 8 km', reward: '' },
  { type: 'total', threshold: 50, label: '50 km au compteur', reward: 'Une sortie ciné 🎬' },
  { type: 'longest', threshold: 9, label: 'Premier 9 km', reward: '' },
  { type: 'weeks', threshold: 8, label: '8 semaines d\'affilée', reward: 'Une nouvelle tenue de sport 👕' },
  { type: 'renfo', threshold: 10, label: '10 séances de renfo', reward: '' },
  { type: 'longest', threshold: 10, label: 'Premier 10 km !', reward: 'Un nouveau livre 📚' },
  { type: 'total', threshold: 100, label: '100 km au compteur', reward: 'Un resto avec qui tu veux 🍽️' },
  { type: 'weeks', threshold: 12, label: 'Programme complet', reward: 'De nouvelles chaussures de course 👟' },
];

export const METRIC_INFO = {
  longest: { label: 'Plus longue course', unit: 'km', icon: '🛣️' },
  total: { label: 'Kilomètres cumulés', unit: 'km', icon: '📏' },
  weeks: { label: 'Semaines validées d\'affilée', unit: 'sem.', icon: '🔥' },
  sessions: { label: 'Séances réalisées', unit: 'séances', icon: '✅' },
  renfo: { label: 'Séances de renfo', unit: 'séances', icon: '💪' },
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function blankState() {
  return {
    version: 1,
    profile: null,
    logs: {},
    extraRuns: [],
    weights: [],
    measures: [],
    rewards: DEFAULT_REWARDS.map((r) => ({ id: uid(), ...r, unlockedAt: null, claimed: false })),
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...blankState(), ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Lecture impossible', e);
  }
  return blankState();
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Enregistrement impossible', e);
  }
}

export function getState() {
  return state;
}

export function replaceState(next) {
  state = { ...blankState(), ...next };
  save();
}

export function resetState() {
  state = blankState();
  save();
}

export { uid };

// --- Dates ---------------------------------------------------------------------

export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Jour ISO : 1 = lundi … 7 = dimanche
export function isoWeekday(date) {
  return ((date.getDay() + 6) % 7) + 1;
}

export function mondayOf(date) {
  return addDays(date, 1 - isoWeekday(date));
}

export const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export function formatDate(iso, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return parseDate(iso).toLocaleDateString('fr-FR', opts);
}

export function formatShort(iso) {
  return parseDate(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function weekStart(week) {
  return addDays(parseDate(state.profile.startDate), (week - 1) * 7);
}

export function sessionDate(session) {
  const days = [...state.profile.days].sort((a, b) => a - b);
  return toISO(addDays(weekStart(session.week), days[session.slot] - 1));
}

export function currentWeek() {
  if (!state.profile) return 1;
  const diff = Math.floor((parseDate(todayISO()) - parseDate(state.profile.startDate)) / 86400000);
  return Math.min(Math.max(Math.floor(diff / 7) + 1, 1), PROGRAM.length);
}

export function programStarted() {
  return state.profile && todayISO() >= state.profile.startDate;
}

// --- Calculs ---------------------------------------------------------------------

export function isRun(session) {
  return session.type !== 'renfo';
}

export function allRuns() {
  const runs = [];
  for (const [id, log] of Object.entries(state.logs)) {
    const s = findSession(id);
    if (s && isRun(s) && log.distanceKm) runs.push({ date: log.date, distanceKm: log.distanceKm });
  }
  for (const r of state.extraRuns) runs.push({ date: r.date, distanceKm: r.distanceKm });
  return runs;
}

export function weekDoneCount(week) {
  return PROGRAM[week - 1].sessions.filter((s) => state.logs[s.id]).length;
}

// Une semaine est validée avec au moins 3 séances sur 4.
export const WEEK_TARGET = 3;

export function weekValidated(week) {
  return weekDoneCount(week) >= WEEK_TARGET;
}

// Série en cours : semaines validées d'affilée jusqu'à aujourd'hui.
// La semaine en cours ne casse pas la série tant qu'elle n'est pas terminée.
export function currentStreak() {
  if (!state.profile) return 0;
  const cw = currentWeek();
  let streak = 0;
  let w = weekValidated(cw) ? cw : cw - 1;
  while (w >= 1 && weekValidated(w)) {
    streak++;
    w--;
  }
  return streak;
}

export function bestStreak() {
  let best = 0;
  let run = 0;
  for (let w = 1; w <= PROGRAM.length; w++) {
    run = weekValidated(w) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function metrics() {
  const runs = allRuns();
  const ids = Object.keys(state.logs);
  return {
    longest: runs.reduce((m, r) => Math.max(m, r.distanceKm), 0),
    total: runs.reduce((m, r) => m + r.distanceKm, 0),
    weeks: bestStreak(),
    sessions: ids.length + state.extraRuns.length,
    renfo: ids.filter((id) => findSession(id)?.type === 'renfo').length,
  };
}

// Met à jour les paliers débloqués. Renvoie ceux qui viennent de l'être.
export function refreshRewards() {
  const m = metrics();
  const fresh = [];
  for (const r of state.rewards) {
    const reached = m[r.type] >= r.threshold;
    if (reached && !r.unlockedAt) {
      r.unlockedAt = todayISO();
      fresh.push(r);
    }
  }
  if (fresh.length) save();
  return fresh;
}

export function sortedRewards() {
  return [...state.rewards].sort((a, b) => progressOf(b) - progressOf(a) || a.threshold - b.threshold);
}

export function progressOf(reward) {
  const m = metrics();
  return Math.min(m[reward.type] / reward.threshold, 1);
}

export function latestWeight() {
  const sorted = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[sorted.length - 1] || null;
}

export function nextSession() {
  for (const w of PROGRAM) {
    for (const s of w.sessions) {
      if (!state.logs[s.id] && sessionDate(s) >= todayISO()) return s;
    }
  }
  return null;
}
