// Données de l'utilisatrice, enregistrées sur le téléphone (localStorage).

import { buildPlan, PLANS, TOTAL_WEEKS } from './program.js';

const KEY = 'elan10k-v1';
const VERSION = 2;

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
  weight: { label: 'Kilos perdus', unit: 'kg', icon: '⚖️' },
};

export const RUN_SPORTS = ['Run', 'TrailRun', 'VirtualRun'];
export const RENFO_SPORTS = ['WeightTraining', 'Workout', 'Crossfit', 'HighIntensityIntervalTraining', 'Pilates', 'Yoga'];

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function blankState() {
  return {
    version: VERSION,
    profile: null,
    cycle: null, // { id, planId, startDate }
    pastCycles: [],
    logs: {}, // "c1:w3-s2" -> { date, distanceKm, durationMin, feeling, note, activityId? }
    moves: {}, // "c1:w3-s2" -> date choisie à la place de la date prévue
    extraRuns: [],
    activities: {}, // activités Strava par id
    strava: null,
    weights: [],
    measures: [],
    daily: {}, // "2026-10-18" -> { water, sleep }
    rewards: DEFAULT_REWARDS.map((r) => ({ id: uid(), ...r, unlockedAt: null, claimed: false })),
  };
}

function migrate(data) {
  const s = { ...blankState(), ...data };
  // Version 1 : pas de cycles, date de début dans le profil, séances "w1-s1".
  if (s.profile && !s.cycle) {
    s.cycle = { id: 'c1', planId: 'premier10', startDate: s.profile.startDate };
    const logs = {};
    for (const [k, v] of Object.entries(s.logs)) logs[k.includes(':') ? k : `c1:${k}`] = v;
    s.logs = logs;
  }
  s.version = VERSION;
  return s;
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
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
  const keepStrava = state.strava;
  state = migrate(next);
  if (!state.strava) state.strava = keepStrava;
  save();
}

export function resetState() {
  state = blankState();
  save();
}

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

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
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

// --- Programme et cycles -----------------------------------------------------------

function findCycle(id) {
  if (state.cycle?.id === id) return state.cycle;
  return state.pastCycles.find((c) => c.id === id) || null;
}

function withIds(cycle, week) {
  return { ...week, sessions: week.sessions.map((s) => ({ ...s, id: `${cycle.id}:${s.key}`, cycleId: cycle.id })) };
}

// Semaines du programme en cours, avec les identifiants de séance du cycle.
export function program(cycle = state.cycle) {
  return buildPlan(cycle.planId).map((w) => withIds(cycle, w));
}

export function planOf(cycle = state.cycle) {
  return PLANS[cycle.planId];
}

export function findSession(id) {
  const [cycleId, key] = id.split(':');
  const cycle = findCycle(cycleId);
  if (!cycle) return null;
  for (const w of buildPlan(cycle.planId)) {
    const s = w.sessions.find((x) => x.key === key);
    if (s) return { ...s, id, cycleId };
  }
  return null;
}

export function weekStart(week, cycle = state.cycle) {
  return addDays(parseDate(cycle.startDate), (week - 1) * 7);
}

export function plannedDate(session) {
  const cycle = findCycle(session.cycleId);
  const days = [...state.profile.days].sort((a, b) => a - b);
  return toISO(addDays(weekStart(session.week, cycle), days[session.slot] - 1));
}

export function sessionDate(session) {
  return state.moves[session.id] || plannedDate(session);
}

export function currentWeek() {
  if (!state.cycle) return 1;
  const diff = daysBetween(state.cycle.startDate, todayISO());
  return Math.min(Math.max(Math.floor(diff / 7) + 1, 1), TOTAL_WEEKS);
}

export function programStarted() {
  return state.cycle && todayISO() >= state.cycle.startDate;
}

export function programFinished() {
  return state.cycle && daysBetween(state.cycle.startDate, todayISO()) >= TOTAL_WEEKS * 7;
}

export function startNewCycle(planId, startDate) {
  if (state.cycle) state.pastCycles.push({ ...state.cycle, endedAt: todayISO() });
  const n = [state.cycle, ...state.pastCycles].filter(Boolean).length + 1;
  state.cycle = { id: `c${n}`, planId, startDate };
  // Les paliers de régularité repartent pour le nouveau cycle.
  for (const r of state.rewards) {
    if (r.type === 'weeks') { r.unlockedAt = null; r.claimed = false; }
  }
  save();
}

// --- Courses et calculs -------------------------------------------------------------

export function isRun(session) {
  return session.type !== 'renfo';
}

// Toutes les courses : séances du programme, courses ajoutées à la main et activités Strava non associées.
export function allRuns() {
  const runs = [];
  for (const [id, log] of Object.entries(state.logs)) {
    const s = findSession(id);
    if (s && isRun(s) && log.distanceKm) {
      runs.push({ kind: 'session', id, date: log.date, distanceKm: log.distanceKm, durationMin: log.durationMin, title: s.title, activityId: log.activityId });
    }
  }
  for (const r of state.extraRuns) {
    runs.push({ kind: 'extra', id: r.id, date: r.date, distanceKm: r.distanceKm, durationMin: r.durationMin, title: r.note || 'Course libre' });
  }
  for (const a of Object.values(state.activities)) {
    if (!a.linkedTo && !a.ignored && RUN_SPORTS.includes(a.sportType)) {
      runs.push({ kind: 'activity', id: a.id, date: a.date, distanceKm: a.distanceKm, durationMin: a.movingMin, title: a.name, activityId: a.id });
    }
  }
  return runs.sort((a, b) => b.date.localeCompare(a.date));
}

export function weekDoneCount(week) {
  return program()[week - 1].sessions.filter((s) => state.logs[s.id]).length;
}

// Une semaine est validée avec au moins 3 séances sur 4.
export const WEEK_TARGET = 3;

export function weekValidated(week) {
  return weekDoneCount(week) >= WEEK_TARGET;
}

// Série en cours : semaines validées d'affilée jusqu'à aujourd'hui.
// La semaine en cours ne casse pas la série tant qu'elle n'est pas terminée.
export function currentStreak() {
  if (!state.cycle || !programStarted()) return 0;
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
  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    run = weekValidated(w) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function latestWeight() {
  const sorted = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[sorted.length - 1] || null;
}

export function startWeight() {
  if (state.profile?.startWeight) return state.profile.startWeight;
  const sorted = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[0]?.kg ?? null;
}

export function metrics() {
  const runs = allRuns();
  const ids = Object.keys(state.logs);
  const last = latestWeight();
  const start = startWeight();
  return {
    longest: runs.reduce((m, r) => Math.max(m, r.distanceKm), 0),
    total: runs.reduce((m, r) => m + r.distanceKm, 0),
    weeks: state.cycle ? bestStreak() : 0,
    sessions: ids.length + runs.filter((r) => r.kind !== 'session').length,
    renfo: ids.filter((id) => findSession(id)?.type === 'renfo').length,
    weight: start && last ? Math.max(start - last.kg, 0) : 0,
  };
}

// Met à jour les paliers débloqués. Renvoie ceux qui viennent de l'être.
export function refreshRewards() {
  const m = metrics();
  const fresh = [];
  for (const r of state.rewards) {
    if (m[r.type] >= r.threshold && !r.unlockedAt) {
      r.unlockedAt = todayISO();
      fresh.push(r);
    }
  }
  if (fresh.length) save();
  return fresh;
}

export function progressOf(reward, m = metrics()) {
  return Math.min(m[reward.type] / reward.threshold, 1);
}

export function sortedRewards() {
  const m = metrics();
  return [...state.rewards].sort((a, b) => progressOf(b, m) - progressOf(a, m) || a.threshold - b.threshold);
}

export function nextSession() {
  for (const w of program()) {
    for (const s of w.sessions) {
      if (!state.logs[s.id] && sessionDate(s) >= todayISO()) return s;
    }
  }
  return null;
}

// Estimation du temps sur 10 km (formule de Riegel) à partir de la meilleure course récente de 3 km ou plus.
export function predict10k() {
  const since = toISO(addDays(new Date(), -56));
  let best = null;
  for (const r of allRuns()) {
    if (r.date < since || r.distanceKm < 3 || !r.durationMin) continue;
    const t10 = r.durationMin * (10 / r.distanceKm) ** 1.06;
    if (!best || t10 < best.minutes) best = { minutes: t10, from: r };
  }
  return best;
}

export function daily(date = todayISO()) {
  return state.daily[date] || { water: 0, sleep: null };
}

export function setDaily(date, patch) {
  state.daily[date] = { ...daily(date), ...patch };
  save();
}
