// Les écrans de l'application. Chaque fonction renvoie du HTML.

import { TOTAL_WEEKS, TYPE_INFO, PACE_GUIDE, TIPS, PLANS, getRenfo } from './program.js';
import {
  getState, METRIC_INFO, RUN_SPORTS, RENFO_SPORTS,
  parseDate, toISO, todayISO, addDays, mondayOf, isoWeekday, DAY_NAMES, formatDate, formatShort, daysBetween,
  program, planOf, findSession, sessionDate, plannedDate, currentWeek, programStarted, programFinished,
  isRun, allRuns, weekDoneCount, WEEK_TARGET, currentStreak, metrics, sortedRewards, progressOf,
  latestWeight, startWeight, nextSession, predict10k, daily,
} from './store.js';
import { lineChart, barChart } from './chart.js';
import { isConnected, hasKeys, routeSvg, lastSyncText, redirectUri } from './strava.js';
import { ADVICE, MEALS } from './content.js';
import { isSupported as healthSupported, lastImportText } from './health.js';
import {
  ui, esc, num, capitalize, relDay, pace, paceFromSeconds, duration, hours, FEELINGS,
} from './ui.js';

export const BADGE_ICON = { longest: '🏅', total: '📏', weeks: '🔥', sessions: '⭐', renfo: '💪', weight: '⚖️' };

const SPORT_LABEL = {
  Run: 'Course', TrailRun: 'Trail', VirtualRun: 'Tapis', WeightTraining: 'Musculation', Workout: 'Entraînement',
  Crossfit: 'Crossfit', HighIntensityIntervalTraining: 'HIIT', Pilates: 'Pilates', Yoga: 'Yoga',
};

// --- Morceaux réutilisables --------------------------------------------------------------

// Écart affiché avec son signe : "−1,2", "+0,4", "0"
function signed(x) {
  const r = Math.round(x * 10) / 10;
  if (r === 0) return '0';
  return `${r > 0 ? '+' : '−'}${num(Math.abs(r))}`;
}

function dateLong(iso) {
  return capitalize(formatDate(iso));
}

function dateShortDay(iso) {
  return capitalize(formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' }));
}

function sessionRow(s) {
  const info = TYPE_INFO[s.type];
  const log = getState().logs[s.id];
  return `
    <a class="session-row ${log ? 'done' : ''}" href="#/seance/${s.id}">
      <span class="session-icon t-${info.color}">${log ? '✓' : info.emoji}</span>
      <span class="session-text">
        <strong>${esc(s.title)}</strong>
        <small>${dateShortDay(sessionDate(s))}${getState().moves[s.id] ? ' (déplacée)' : ''} · ${esc(s.summary)}</small>
      </span>
      ${log?.activityId ? (getState().activities[log.activityId]?.source === 'apple' ? '<span class="strava-dot apple" title="Importé depuis l\'Apple Watch">⌚</span>' : '<span class="strava-dot" title="Synchronisé avec Strava">S</span>') : ''}
      <span class="chev">›</span>
    </a>`;
}

function feelingPicker(value) {
  return `
    <fieldset class="field"><legend>Ressenti</legend>
      <div class="feelings">
        ${FEELINGS.map((f, i) => `<label><input type="radio" name="feeling" value="${i + 1}" ${value === i + 1 ? 'checked' : ''}><span>${f}</span></label>`).join('')}
      </div></fieldset>`;
}

function sourceLogo(source, size = '') {
  return source === 'apple'
    ? `<span class="health-logo ${size}" aria-label="Apple Santé">⌚</span>`
    : `<span class="strava-logo ${size}" aria-label="Strava">S</span>`;
}

function sourceName(a) {
  return a?.source === 'apple' ? 'Apple Watch' : 'Strava';
}

function stravaBar() {
  if (!isConnected()) {
    const last = lastImportText();
    if (last) {
      return `
        <a class="strava-bar" href="#/sante">
          ${sourceLogo('apple')}
          <span>Apple Watch · importé le ${last}</span>
          <span class="btn btn-small btn-outline">Importer</span>
        </a>`;
    }
    return `<a class="card strava-cta" href="#/sante">${sourceLogo('apple')}<span><strong>Importe tes séances Apple Watch</strong><small>Courses, renfo, poids et sommeil depuis l'app Santé.</small></span><span class="chev">›</span></a>`;
  }
  return `
    <div class="strava-bar">
      <span class="strava-logo">S</span>
      <span>${ui.syncing ? 'Synchronisation…' : `Strava · synchronisé ${lastSyncText()}`}</span>
      <button class="btn btn-small btn-outline" data-action="sync" ${ui.syncing ? 'disabled' : ''}>↻</button>
    </div>`;
}

function dailyCard() {
  const p = getState().profile;
  const d = daily();
  const goal = p.waterGoal || 8;
  const drops = Array.from({ length: Math.max(goal, d.water) }, (_, i) => `<i class="${i < d.water ? 'on' : ''}"></i>`).join('');
  return `
    <section class="card daily">
      <div class="card-head"><h3>Aujourd'hui</h3><a class="link" href="#/suivi">Historique ›</a></div>
      <div class="daily-row">
        <div><strong>💧 Eau</strong><small>${d.water}/${goal} verres</small></div>
        <div class="stepper">
          <button class="icon-btn round" data-action="water" data-delta="-1" aria-label="Un verre de moins">−</button>
          <button class="icon-btn round primary" data-action="water" data-delta="1" aria-label="Un verre de plus">＋</button>
        </div>
      </div>
      <div class="drops" aria-hidden="true">${drops}</div>
      <div class="daily-row">
        <div><strong>😴 Sommeil</strong><small>Nuit dernière : ${hours(d.sleep)}</small></div>
        <div class="stepper">
          <button class="icon-btn round" data-action="sleep" data-delta="-0.5" aria-label="30 minutes de moins">−</button>
          <button class="icon-btn round primary" data-action="sleep" data-delta="0.5" aria-label="30 minutes de plus">＋</button>
        </div>
      </div>
    </section>`;
}

function nextRewardCard() {
  const m = metrics();
  const target = sortedRewards().find((r) => !r.unlockedAt && r.reward);
  if (!target) return '';
  const info = METRIC_INFO[target.type];
  const pct = Math.round(progressOf(target, m) * 100);
  return `
    <a class="card reward-next" href="#/recompenses">
      <div class="card-head"><h3>🎁 Prochaine récompense</h3><span class="pill">${pct}%</span></div>
      <p class="reward-title">${esc(target.reward)}</p>
      <p class="muted small">${esc(target.label)} · ${num(Math.min(m[target.type], target.threshold))}/${num(target.threshold)} ${info.unit}</p>
      <div class="bar"><span style="width:${pct}%"></span></div>
    </a>`;
}

// --- Démarrage ------------------------------------------------------------------------------

export function defaultStart() {
  const today = parseDate(todayISO());
  return toISO(isoWeekday(today) === 1 ? today : addDays(mondayOf(today), 7));
}

function planPicker(selected = 'premier10') {
  return `
    <fieldset class="field"><legend>Programme</legend>
      <div class="plan-picker">
        ${Object.entries(PLANS).map(([id, p]) => `
          <label><input type="radio" name="planId" value="${id}" ${id === selected ? 'checked' : ''}>
            <span><strong>${p.name}</strong><small>${p.description}</small></span></label>`).join('')}
      </div></fieldset>`;
}

function startField(value) {
  return `
    <label class="field"><span>Début du programme</span>
      <input type="date" name="startDate" value="${value || defaultStart()}" required>
      <small>Le programme démarre le lundi de la semaine choisie.</small></label>`;
}

export function profileFields(p) {
  const days = p?.days || [1, 3, 5, 7];
  return `
    <label class="field"><span>Ton prénom</span>
      <input name="name" value="${esc(p?.name || '')}" placeholder="Facultatif" autocomplete="given-name"></label>
    <fieldset class="field"><legend>Tes 4 jours d'entraînement</legend>
      <div class="day-picker">
        ${DAY_NAMES.map((d, i) => `<label><input type="checkbox" name="days" value="${i + 1}" ${days.includes(i + 1) ? 'checked' : ''}><span>${d.slice(0, 3)}</span></label>`).join('')}
      </div>
      <small>Ordre de la semaine : footing, fractionné, renfo, sortie longue.</small></fieldset>
    <div class="row">
      <label class="field"><span>Heure des séances</span>
        <input type="time" name="sessionTime" value="${p?.sessionTime || '18:30'}" required></label>
      <label class="field"><span>Rappel</span>
        <select name="alarmMinutes">
          ${[[0, 'À l\'heure'], [15, '15 min avant'], [30, '30 min avant'], [60, '1 h avant'], [120, '2 h avant'], [600, 'Le matin (10 h avant)']]
            .map(([v, l]) => `<option value="${v}" ${(p?.alarmMinutes ?? 60) === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
    </div>
    <div class="row">
      <label class="field"><span>Jour de pesée</span>
        <select name="weighDay">${DAY_NAMES.map((d, i) => `<option value="${i + 1}" ${(p?.weighDay || 1) === i + 1 ? 'selected' : ''}>${capitalize(d)}</option>`).join('')}</select></label>
      <label class="field"><span>Heure de pesée</span>
        <input type="time" name="weighTime" value="${p?.weighTime || '07:30'}" required></label>
    </div>
    <div class="row">
      <label class="field"><span>Poids de départ (kg)</span>
        <input name="startWeight" inputmode="decimal" value="${p?.startWeight ? num(p.startWeight) : ''}" placeholder="ex. 68,5"></label>
      <label class="field"><span>Objectif (kg)</span>
        <input name="goalWeight" inputmode="decimal" value="${p?.goalWeight ? num(p.goalWeight) : ''}" placeholder="ex. 62"></label>
    </div>
    <div class="row">
      <label class="field"><span>Objectif eau (verres/jour)</span>
        <input name="waterGoal" inputmode="numeric" value="${p?.waterGoal || 8}"></label>
      <label class="field"><span>Objectif sommeil (h)</span>
        <input name="sleepGoal" inputmode="decimal" value="${num(p?.sleepGoal || 7.5)}"></label>
    </div>
    <fieldset class="field"><legend>Renfo de préférence</legend>
      <div class="segmented">
        <label><input type="radio" name="renfoPlace" value="maison" ${(p?.renfoPlace || 'maison') === 'maison' ? 'checked' : ''}><span>🏠 Maison</span></label>
        <label><input type="radio" name="renfoPlace" value="salle" ${p?.renfoPlace === 'salle' ? 'checked' : ''}><span>🏋️ Salle</span></label>
      </div>
      <small>Tu pourras changer à chaque séance.</small></fieldset>
    <fieldset class="field"><legend>Apparence</legend>
      <div class="segmented">
        ${[['auto', 'Auto'], ['light', '☀️ Clair'], ['dark', '🌙 Sombre']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}" ${(p?.theme || 'auto') === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
      </div></fieldset>`;
}

export function calendarHelp() {
  return `
    <ol class="steps-help">
      <li>Touche <strong>Ajouter au Calendrier</strong> ci-dessous (depuis Safari).</li>
      <li>iPhone affiche la liste des événements : touche <strong>Tout ajouter</strong>.</li>
      <li>Choisis ton calendrier, c'est fait : 48 séances et 12 pesées avec rappel 🔔</li>
    </ol>
    <p class="muted small">Si rien ne se passe depuis l'icône de l'écran d'accueil, ouvre l'app dans Safari pour cette étape.</p>`;
}

export function viewOnboarding() {
  return `
    <section class="onboarding">
      <div class="hero hero-intro">
        <div class="logo">10K</div>
        <h1>Bienvenue sur Élan 10K</h1>
        <p>12 semaines pour courir 10 km, avec du renfo, tes séances Apple Watch, le suivi de ton poids et de ton sommeil, et des récompenses à chaque palier.</p>
      </div>
      <form class="card" data-form="onboarding">
        <h2>On fait connaissance</h2>
        ${planPicker()}
        ${startField()}
        ${profileFields(null)}
        <button class="btn btn-primary btn-block" type="submit">C'est parti 🚀</button>
      </form>
    </section>`;
}

// --- Accueil --------------------------------------------------------------------------------

export function viewHome() {
  const state = getState();
  const p = state.profile;
  const week = currentWeek();
  const w = program()[week - 1];
  const m = metrics();
  const streak = currentStreak();
  const last = latestWeight();
  const start = startWeight();
  const lost = start && last ? start - last.kg : null;
  const next = nextSession();
  const tip = TIPS[Math.floor(parseDate(todayISO()) / 86400000) % TIPS.length];
  const toClaim = state.rewards.filter((r) => r.unlockedAt && r.reward && !r.claimed).length;

  let hero;
  if (!programStarted()) {
    hero = `
      <div class="hero">
        <p class="eyebrow">Bientôt le départ · ${esc(planOf().name)}</p>
        <h2>Le programme démarre ${formatDate(state.cycle.startDate)}</h2>
        <p>Ajoute tes séances au Calendrier Apple pour ne rien rater.</p>
        <button class="btn btn-light" data-action="calendar">📅 Ajouter au Calendrier</button>
      </div>`;
  } else if (next && !programFinished()) {
    const info = TYPE_INFO[next.type];
    hero = `
      <a class="hero" href="#/seance/${next.id}">
        <p class="eyebrow">Prochaine séance · ${relDay(sessionDate(next))}</p>
        <h2>${info.emoji} ${esc(next.title)}</h2>
        <p>${esc(next.summary)}</p>
        <span class="btn btn-light">Voir la séance</span>
      </a>`;
  } else {
    hero = `
      <div class="hero">
        <p class="eyebrow">Programme terminé</p>
        <h2>Bravo, tu l'as fait ! 🏆</h2>
        <p>Envie d'aller plus loin ? Enchaîne avec un nouveau programme.</p>
        <a class="btn btn-light" href="#/nouveau">Choisir mon prochain programme</a>
      </div>`;
  }

  return `
    <header class="page-head">
      <div>
        <p class="muted">${dateLong(todayISO())}</p>
        <h1>Salut${p.name ? ` ${esc(p.name)}` : ''} 👋</h1>
      </div>
      <div class="head-actions">
        <span class="week-badge">S${week}<small>/${TOTAL_WEEKS}</small></span>
        <a class="icon-btn" href="#/reglages" aria-label="Réglages">⚙️</a>
      </div>
    </header>
    ${stravaBar()}
    ${hero}
    ${toClaim ? `<a class="card claim-banner" href="#/recompenses">🎉 ${toClaim} récompense${toClaim > 1 ? 's' : ''} à t'offrir !</a>` : ''}
    <section class="card">
      <div class="card-head"><h3>Semaine ${week} · ${esc(w.theme)}</h3><span class="pill ${weekDoneCount(week) >= WEEK_TARGET ? 'pill-ok' : ''}">${weekDoneCount(week)}/4</span></div>
      ${w.sessions.map(sessionRow).join('')}
      <p class="muted small">Semaine validée dès ${WEEK_TARGET} séances sur 4.</p>
    </section>
    ${dailyCard()}
    <section class="stats">
      <div class="stat t-orange"><span>${num(m.total)}</span><small>km cumulés</small></div>
      <div class="stat t-violet"><span>${m.sessions}</span><small>séances</small></div>
      <div class="stat t-pink"><span>${streak} 🔥</span><small>semaine${streak > 1 ? 's' : ''} d'affilée</small></div>
      <div class="stat t-teal"><span>${lost !== null ? signed(-lost) : '—'}</span><small>kg ${lost === null || lost >= 0 ? 'perdus' : 'depuis le début'}</small></div>
    </section>
    ${nextRewardCard()}
    <a class="card tip" href="#/conseils">
      <h3>${tip.icon} Le conseil du jour</h3>
      <p>${tip.text}</p>
      <span class="link">Tous les conseils nutrition ›</span>
    </a>
    <a class="btn btn-outline btn-block" href="#/course">＋ Ajouter une course hors programme</a>`;
}

// --- Programme ------------------------------------------------------------------------------

export function viewProgram() {
  const cw = currentWeek();
  const plan = planOf();
  return `
    <header class="page-head"><h1>${esc(plan.name)}</h1></header>
    <section class="card pace">
      <details>
        <summary>🎯 Les allures expliquées</summary>
        ${PACE_GUIDE.map((g) => `<p><strong>${g.name}</strong> — ${g.text}</p>`).join('')}
      </details>
    </section>
    ${program().map((w) => {
      const done = weekDoneCount(w.week);
      return `
      <details class="card week ${w.week === cw ? 'current' : ''}" ${w.week === cw ? 'open' : ''}>
        <summary>
          <span class="week-num">${w.week}</span>
          <span class="week-text"><strong>${esc(w.theme)}</strong>
            <small>${capitalize(formatShort(plannedDate(w.sessions[0])))}${w.recovery ? ' · récup' : ''}${w.week === cw ? ' · en cours' : ''}</small></span>
          <span class="pill ${done >= WEEK_TARGET ? 'pill-ok' : ''}">${done}/4</span>
        </summary>
        ${w.sessions.map(sessionRow).join('')}
      </details>`;
    }).join('')}
    <a class="btn btn-ghost btn-block" href="#/nouveau">Changer de programme ou recommencer</a>`;
}

// --- Séance ---------------------------------------------------------------------------------

function renfoBlock(session) {
  const p = getState().profile;
  const phase = session.renfoPhase;
  const hasGym = phase !== 'D';
  const place = hasGym ? p.renfoPlace : 'maison';
  const r = getRenfo(phase, place);
  const format = (ex) => {
    const amount = ex.seconds ? `${ex.seconds} s${ex.perSide ? ' par côté' : ''}` : ex.reps;
    return r.mode === 'series' ? `${ex.sets} × ${amount}` : amount;
  };
  return `
    ${hasGym ? `
      <div class="segmented" role="group">
        <label><input type="radio" name="place" value="maison" data-action="place" ${place === 'maison' ? 'checked' : ''}><span>🏠 Maison</span></label>
        <label><input type="radio" name="place" value="salle" data-action="place" ${place === 'salle' ? 'checked' : ''}><span>🏋️ Salle</span></label>
      </div>` : ''}
    <p class="muted">${r.mode === 'circuit'
      ? `Circuit : ${r.rounds} tours · ${r.rest} s de repos entre les exercices, ${r.roundRest} s entre les tours.`
      : `En séries · ${r.rest} s de repos entre chaque série.`} Commence par 5 min d'échauffement.</p>
    <ol class="exercise-list">
      ${r.exercises.map((ex) => `
        <li><div><strong>${esc(ex.name)}</strong><small>${esc(ex.tip)}</small></div><span class="pill">${esc(format(ex))}</span></li>`).join('')}
    </ol>
    <button class="btn btn-primary btn-block" data-action="guided" data-id="${session.id}">▶ Lancer la séance guidée</button>
    <p class="muted small center">Minuteur, annonces vocales, bips et vibrations.</p>`;
}

function stravaBlock(activityId) {
  const a = getState().activities[activityId];
  if (!a) return '';
  return `
    <a class="card strava-card" href="#/activite/${a.id}">
      <div class="card-head"><h3>${sourceLogo(a.source, 'small')} ${esc(a.name)}</h3><span class="chev">›</span></div>
      ${a.polyline ? routeSvg(a.polyline, { height: 150 }) : ''}
      <div class="done-stats">
        ${RUN_SPORTS.includes(a.sportType) ? `<span><strong>${num(a.distanceKm, 2)}</strong> km</span><span><strong>${pace(a.movingMin, a.distanceKm)}</strong> /km</span>` : ''}
        <span><strong>${duration(a.movingMin)}</strong></span>
        ${a.avgHr ? `<span><strong>${Math.round(a.avgHr)}</strong> bpm</span>` : ''}
      </div>
    </a>`;
}

function logBlock(session) {
  const state = getState();
  const log = state.logs[session.id];
  const run = isRun(session);
  if (log && !ui.editing) {
    return `
      ${log.activityId ? stravaBlock(log.activityId) : ''}
      <section class="card done-card">
        <h3>✅ Séance faite · ${relDay(log.date)}</h3>
        <div class="done-stats">
          ${run ? `<span><strong>${num(log.distanceKm, 2)}</strong> km</span>` : ''}
          ${log.durationMin ? `<span><strong>${duration(log.durationMin)}</strong></span>` : ''}
          ${run ? `<span><strong>${pace(log.durationMin, log.distanceKm)}</strong> /km</span>` : ''}
          ${log.feeling ? `<span class="feel">${FEELINGS[log.feeling - 1]}</span>` : ''}
        </div>
        ${log.note ? `<p class="note">« ${esc(log.note)} »</p>` : ''}
        ${log.activityId && !log.feeling ? '<p class="muted small">Ajoute ton ressenti avec « Modifier ».</p>' : ''}
        <div class="row">
          <button class="btn btn-outline" data-action="edit-log">Modifier</button>
          <button class="btn btn-ghost" data-action="undo-log" data-id="${session.id}">Annuler</button>
        </div>
      </section>`;
  }
  const planned = sessionDate(session);
  const date = log?.date || (planned <= todayISO() ? planned : todayISO());
  return `
    <form class="card" data-form="log" data-id="${session.id}">
      <h3>${log ? 'Modifier ma séance' : 'J\'ai fait cette séance'}</h3>
      ${!log ? `<p class="muted small">${isConnected() ? 'Avec Strava, ta séance se coche toute seule après la synchronisation.' : 'Avec ton Apple Watch, ta séance se coche toute seule à l\'import Santé.'} Tu peux aussi la noter ici.</p>` : ''}
      <div class="row">
        <label class="field"><span>Date</span><input type="date" name="date" value="${date}" required></label>
        ${run ? `<label class="field"><span>Distance (km)</span><input name="distanceKm" inputmode="decimal" value="${log ? num(log.distanceKm, 2) : session.distanceKm ? num(session.distanceKm) : ''}" placeholder="ex. 5,2" required></label>` : ''}
      </div>
      <label class="field"><span>Durée (min)</span><input name="durationMin" inputmode="decimal" value="${log?.durationMin ?? session.durationMin}"></label>
      ${feelingPicker(log?.feeling)}
      <label class="field"><span>Note</span><input name="note" value="${esc(log?.note || '')}" placeholder="Météo, sensations…"></label>
      <button class="btn btn-primary btn-block" type="submit">Valider ma séance ✓</button>
      ${log ? '<button class="btn btn-ghost btn-block" type="button" data-action="cancel-edit">Annuler la modification</button>' : ''}
    </form>`;
}

export function viewSession(id) {
  const s = findSession(id);
  if (!s) return '<p>Séance introuvable.</p>';
  const info = TYPE_INFO[s.type];
  const state = getState();
  const isCurrent = s.cycleId === state.cycle.id;
  const w = program(isCurrent ? state.cycle : state.pastCycles.find((c) => c.id === s.cycleId))[s.week - 1];
  const date = sessionDate(s);
  const moved = !!state.moves[s.id];
  return `
    <header class="page-head"><a class="back" href="#/programme">‹ Programme</a></header>
    <section class="session-hero t-${info.color}">
      <span class="chip">${info.emoji} ${info.label}</span>
      <h1>${esc(s.title)}</h1>
      <p>${capitalize(relDay(date))} · Semaine ${s.week} · ${esc(w.theme)}</p>
      <div class="session-meta">
        ${s.distanceKm ? `<span>📏 ${num(s.distanceKm)} km</span>` : ''}
        <span>⏱ ~${s.durationMin} min</span>
      </div>
    </section>
    <section class="card">
      ${s.type === 'renfo' ? renfoBlock(s) : `
        <h3>Déroulé</h3>
        <ol class="timeline">
          ${s.steps.map((st) => `<li class="k-${st.kind}"><strong>${esc(st.label)}</strong><small>${esc(st.detail)}</small></li>`).join('')}
        </ol>
        ${s.intervals ? `<button class="btn btn-primary btn-block" data-action="interval-timer" data-id="${s.id}">▶ Minuteur fractionné</button>
          <p class="muted small center">Annonces vocales et bips : garde ton téléphone sur toi, écran allumé.</p>` : ''}`}
    </section>
    ${isCurrent && !state.logs[s.id] ? `
      <details class="card">
        <summary class="link">📆 Changer le jour de cette séance</summary>
        <form class="inline-form" data-form="move" data-id="${s.id}">
          <input type="date" name="date" value="${date}" required aria-label="Nouvelle date">
          <button class="btn btn-primary" type="submit">Déplacer</button>
        </form>
        ${moved ? `<button class="btn btn-ghost btn-small" data-action="unmove" data-id="${s.id}">Revenir au ${formatShort(plannedDate(s))}</button>` : ''}
        <p class="muted small">Pense à ajouter à nouveau le calendrier (Réglages) si tu veux le rappel au bon jour.</p>
      </details>` : ''}
    ${logBlock(s)}`;
}

// --- Courses hors programme -------------------------------------------------------------------

export function viewExtraRun() {
  const runs = [...getState().extraRuns].sort((a, b) => b.date.localeCompare(a.date));
  return `
    <header class="page-head"><a class="back" href="#/journal">‹ Journal</a></header>
    <h1>Course hors programme</h1>
    <form class="card" data-form="extra">
      <div class="row">
        <label class="field"><span>Date</span><input type="date" name="date" value="${todayISO()}" required></label>
        <label class="field"><span>Distance (km)</span><input name="distanceKm" inputmode="decimal" placeholder="ex. 4,5" required></label>
      </div>
      <label class="field"><span>Durée (min)</span><input name="durationMin" inputmode="decimal"></label>
      ${feelingPicker(null)}
      <label class="field"><span>Note</span><input name="note" placeholder="Course entre amis, trail…"></label>
      <button class="btn btn-primary btn-block" type="submit">Ajouter la course</button>
    </form>
    ${runs.length ? `
      <section class="card">
        <h3>Mes courses ajoutées à la main</h3>
        <ul class="history">
          ${runs.map((r) => `<li><span>${capitalize(formatShort(r.date))}</span><strong>${num(r.distanceKm, 2)} km</strong><span>${r.durationMin ? duration(r.durationMin) : ''} ${r.feeling ? FEELINGS[r.feeling - 1] : ''}</span>
            <button class="icon-btn" data-action="del-extra" data-id="${r.id}" aria-label="Supprimer">🗑</button></li>`).join('')}
        </ul>
      </section>` : ''}`;
}

// --- Journal --------------------------------------------------------------------------------

function weeklyVolume() {
  const runs = allRuns();
  const thisMonday = mondayOf(parseDate(todayISO()));
  const items = [];
  for (let i = 11; i >= 0; i--) {
    const start = toISO(addDays(thisMonday, -7 * i));
    const end = toISO(addDays(thisMonday, -7 * i + 6));
    const km = runs.filter((r) => r.date >= start && r.date <= end).reduce((s, r) => s + r.distanceKm, 0);
    items.push({ label: `Semaine du ${formatShort(start)}`, short: formatShort(start).replace('.', ''), value: Math.round(km * 10) / 10, highlight: i === 0 });
  }
  return items;
}

function journalEntries() {
  const state = getState();
  const entries = allRuns().map((r) => ({ ...r, run: true }));
  for (const [id, log] of Object.entries(state.logs)) {
    const s = findSession(id);
    if (s && !isRun(s)) entries.push({ kind: 'session', id, date: log.date, title: s.title, durationMin: log.durationMin, run: false, activityId: log.activityId });
  }
  for (const a of Object.values(state.activities)) {
    if (!a.linkedTo && !a.ignored && RENFO_SPORTS.includes(a.sportType)) {
      entries.push({ kind: 'activity', id: a.id, date: a.date, title: a.name, durationMin: a.movingMin, run: false, activityId: a.id });
    }
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export function viewJournal() {
  const runs = allRuns();
  const totalKm = runs.reduce((s, r) => s + r.distanceKm, 0);
  const totalMin = runs.reduce((s, r) => s + (r.durationMin || 0), 0);
  const longest = runs.reduce((b, r) => (!b || r.distanceKm > b.distanceKm ? r : b), null);
  const fastest = runs.filter((r) => r.distanceKm >= 3 && r.durationMin)
    .reduce((b, r) => (!b || r.durationMin / r.distanceKm < b.durationMin / b.distanceKm ? r : b), null);
  const prediction = predict10k();
  const entries = journalEntries();
  const shown = entries.slice(0, ui.journalLimit);
  const href = (e) => (e.kind === 'activity' ? `#/activite/${e.id}` : e.kind === 'session' ? `#/seance/${e.id}` : '#/course');
  return `
    <header class="page-head"><h1>Journal</h1><a class="btn btn-small btn-outline" href="#/course">＋ Course</a></header>
    ${stravaBar()}
    <section class="stats">
      <div class="stat t-orange"><span>${num(totalKm)}</span><small>km au total</small></div>
      <div class="stat t-violet"><span>${runs.length}</span><small>courses</small></div>
      <div class="stat t-teal"><span>${duration(totalMin)}</span><small>de course</small></div>
      <div class="stat t-pink"><span>${prediction ? duration(prediction.minutes) : '—'}</span><small>estimation 10 km</small></div>
    </section>
    <section class="card">
      <div class="card-head"><h3>📊 Kilomètres par semaine</h3></div>
      ${barChart(weeklyVolume(), { unit: 'km' })}
    </section>
    <section class="card">
      <h3>🏆 Mes records</h3>
      <ul class="records">
        <li><span>Plus longue course</span><strong>${longest ? `${num(longest.distanceKm, 2)} km` : '—'}</strong><small>${longest ? formatShort(longest.date) : ''}</small></li>
        <li><span>Meilleure allure (≥ 3 km)</span><strong>${fastest ? `${pace(fastest.durationMin, fastest.distanceKm)} /km` : '—'}</strong><small>${fastest ? `${num(fastest.distanceKm, 1)} km · ${formatShort(fastest.date)}` : ''}</small></li>
        <li><span>Estimation sur 10 km</span><strong>${prediction ? duration(prediction.minutes) : '—'}</strong><small>${prediction ? `d'après ta course du ${formatShort(prediction.from.date)}` : 'Cours au moins 3 km pour l\'obtenir'}</small></li>
      </ul>
    </section>
    <section class="card">
      <h3>🗒️ Toutes mes activités</h3>
      ${shown.length ? `<ul class="activity-list">
        ${shown.map((e) => `
          <li><a href="${href(e)}">
            <span class="session-icon ${e.run ? 't-orange' : 't-pink'}">${e.run ? '🏃' : '💪'}</span>
            <span class="session-text"><strong>${esc(e.title)}</strong><small>${dateShortDay(e.date)}${e.activityId ? ` · ${sourceName(getState().activities[e.activityId])}` : ''}</small></span>
            <span class="activity-figures">${e.run ? `<strong>${num(e.distanceKm, 2)} km</strong><small>${pace(e.durationMin, e.distanceKm)} /km</small>` : `<strong>${duration(e.durationMin)}</strong>`}</span>
          </a></li>`).join('')}
      </ul>` : '<p class="empty">Tes courses apparaîtront ici.</p>'}
      ${entries.length > shown.length ? '<button class="btn btn-ghost btn-block" data-action="more-journal">Voir plus</button>' : ''}
    </section>`;
}

// --- Activité Strava --------------------------------------------------------------------------

function linkOptions(a) {
  const state = getState();
  const run = RUN_SPORTS.includes(a.sportType);
  const options = [];
  for (const w of program()) {
    for (const s of w.sessions) {
      if (isRun(s) !== run) continue;
      if (Math.abs(daysBetween(sessionDate(s), a.date)) > 10) continue;
      const taken = state.logs[s.id] && state.logs[s.id].activityId !== a.id;
      options.push(`<option value="${s.id}" ${a.linkedTo === s.id ? 'selected' : ''}>S${s.week} · ${esc(s.title)} (${formatShort(sessionDate(s))})${taken ? ' — déjà faite' : ''}</option>`);
    }
  }
  return options.join('');
}

export function viewActivity(id) {
  const a = getState().activities[id];
  if (!a) return '<header class="page-head"><a class="back" href="#/journal">‹ Journal</a></header><p>Activité introuvable.</p>';
  const run = RUN_SPORTS.includes(a.sportType);
  const time = a.startLocal ? a.startLocal.slice(11, 16).replace(':', ' h ') : '';
  const splits = a.splits || [];
  const fastestSplit = splits.filter((sp) => sp.km > 0.5).reduce((m, sp) => Math.min(m, sp.seconds / sp.km), Infinity);
  const slowestSplit = splits.filter((sp) => sp.km > 0.5).reduce((m, sp) => Math.max(m, sp.seconds / sp.km), 0);
  return `
    <header class="page-head"><a class="back" href="#/journal">‹ Journal</a>${a.source === 'apple' ? '' : `<a class="link" href="https://www.strava.com/activities/${a.id}" target="_blank" rel="noopener">Voir sur Strava ↗</a>`}</header>
    <section class="session-hero t-orange">
      <span class="chip">${run ? '🏃' : '💪'} ${SPORT_LABEL[a.sportType] || a.sportType}</span>
      <h1>${esc(a.name)}</h1>
      <p>${dateLong(a.date)}${time ? ` · ${time}` : ''}</p>
    </section>
    ${a.polyline ? `<section class="card route-card">${routeSvg(a.polyline, { height: 220 })}</section>` : ''}
    <section class="stats">
      ${run ? `<div class="stat t-orange"><span>${num(a.distanceKm, 2)}</span><small>km</small></div>
      <div class="stat t-violet"><span>${pace(a.movingMin, a.distanceKm)}</span><small>allure /km</small></div>` : ''}
      <div class="stat t-teal"><span>${duration(a.movingMin)}</span><small>temps en mouvement</small></div>
      ${run ? `<div class="stat t-pink"><span>${Math.round(a.elevation || 0)} m</span><small>dénivelé +</small></div>` : ''}
      ${a.avgHr ? `<div class="stat t-pink"><span>${Math.round(a.avgHr)}</span><small>FC moyenne (bpm)</small></div>` : ''}
      ${a.maxHr ? `<div class="stat t-orange"><span>${Math.round(a.maxHr)}</span><small>FC max (bpm)</small></div>` : ''}
      ${a.calories ? `<div class="stat t-teal"><span>${Math.round(a.calories)}</span><small>kcal</small></div>` : ''}
    </section>
    ${run ? `
      <section class="card">
        <h3>⏱ Temps au kilomètre</h3>
        ${splits.length ? `<ul class="splits">
          ${splits.map((sp, i) => {
            const spk = sp.seconds / sp.km;
            const width = slowestSplit > fastestSplit ? 40 + 60 * ((slowestSplit - spk) / (slowestSplit - fastestSplit)) : 100;
            return `<li><span>${sp.km < 0.95 ? num(sp.km, 1) : i + 1}</span><div class="split-bar"><span style="width:${width}%" class="${spk === fastestSplit ? 'best' : ''}"></span></div><strong>${paceFromSeconds(sp.seconds, sp.km)}</strong><small>${sp.hr ? `${Math.round(sp.hr)} bpm` : ''}</small></li>`;
          }).join('')}
        </ul>` : `<p class="muted">${ui.loadingDetails[a.id] ? 'Chargement…' : a.source === 'apple' ? 'Temps au km disponibles pour les courses avec tracé GPS.' : 'Temps au km indisponibles.'}</p>`}
      </section>` : ''}
    <section class="card">
      <h3>🔗 Dans mon programme</h3>
      <label class="field"><span>Cette activité correspond à</span>
        <select data-action="link-activity" data-id="${a.id}">
          <option value="" ${!a.linkedTo && !a.ignored ? 'selected' : ''}>${run ? 'Course hors programme' : 'Activité hors programme'}</option>
          ${linkOptions(a)}
          <option value="__ignore" ${a.ignored ? 'selected' : ''}>Ne pas compter cette activité</option>
        </select></label>
      <p class="muted small">L'association est automatique, tu peux la corriger ici.</p>
    </section>
    <p class="muted small center">${a.source === 'apple' ? 'Données importées depuis Apple Santé' : 'Données fournies par Strava'}</p>`;
}

// --- Apple Santé --------------------------------------------------------------------------------

export function viewHealth() {
  const h = getState().health;
  const p = ui.importProgress;
  return `
    <header class="page-head"><a class="back" href="#/">‹ Accueil</a></header>
    <h1>Apple Watch · Santé</h1>
    <p class="muted">Tes courses (avec tracé GPS et temps au km), tes séances de renfo, ton poids et ton sommeil, en un seul import.</p>
    ${!healthSupported() ? '<section class="card warn"><p>⚠️ Mets ton iPhone à jour (iOS 16.4 ou plus récent) pour pouvoir lire l\'export Santé.</p></section>' : ''}
    <section class="card">
      <h3>1. Exporte tes données Santé</h3>
      <ol class="steps-help">
        <li>Ouvre l'app <strong>Santé</strong> ❤️.</li>
        <li>Touche ta <strong>photo</strong> en haut à droite.</li>
        <li>Tout en bas : <strong>Exporter toutes les données de santé</strong> → <strong>Exporter</strong>. Patiente une à deux minutes.</li>
        <li>Choisis <strong>Enregistrer dans Fichiers</strong> (par exemple dans « Sur mon iPhone »).</li>
      </ol>
    </section>
    <section class="card">
      <h3>2. Importe le fichier ici</h3>
      ${p !== null && p !== undefined ? `
        <p><strong>Import en cours… ${Math.round(p * 100)} %</strong></p>
        <div class="bar"><span style="width:${Math.round(p * 100)}%"></span></div>
        <p class="muted small">Garde l'app ouverte, ça peut prendre une minute.</p>` : `
        <label class="btn btn-primary btn-block file-btn">⌚ Choisir le fichier exporté (.zip)
          <input type="file" accept=".zip,.xml,application/zip,text/xml" data-action="import-health" hidden></label>
        <p class="muted small">Le fichier s'appelle <code>exportation.zip</code> ou <code>export.zip</code>. Tout est lu sur ton téléphone, rien n'est envoyé ailleurs.</p>`}
      ${h?.lastImport ? `<p class="muted small">Dernier import le ${lastImportText()} · ${h.workouts} séance${h.workouts > 1 ? 's' : ''} trouvée${h.workouts > 1 ? 's' : ''} sur 12 mois.</p>` : ''}
    </section>
    <section class="card">
      <h3>Comment ça marche</h3>
      <ul class="bullets">
        <li>Lance tes séances sur ta montre avec l'app <strong>Exercice</strong> : « Course extérieure » pour courir, « Renforcement musculaire » ou « Entraînement fonctionnel » pour le renfo.</li>
        <li>Chaque course coche la séance prévue le même jour (ou la plus proche dans les 3 jours). Une course en plus devient une course hors programme.</li>
        <li>Tes pesées et tes nuits sont ajoutées à ton suivi (sans écraser ce que tu as noté toi-même).</li>
        <li>Refais l'import quand tu veux, par exemple une fois par semaine après ta sortie longue : rien n'est compté en double.</li>
        <li>Tu peux corriger l'association d'une séance depuis le détail de l'activité, dans le Journal.</li>
      </ul>
    </section>`;
}

// --- Strava -----------------------------------------------------------------------------------

export function viewStrava() {
  const st = getState().strava || {};
  if (isConnected()) {
    const n = Object.keys(getState().activities).length;
    return `
      <header class="page-head"><a class="back" href="#/reglages">‹ Réglages</a></header>
      <h1>Strava</h1>
      <section class="card strava-connected">
        <div class="row-center">
          ${st.athlete?.profile ? `<img class="avatar" src="${esc(st.athlete.profile)}" alt="">` : '<span class="strava-logo big">S</span>'}
          <div><strong>${esc(st.athlete?.firstname || '')} ${esc(st.athlete?.lastname || '')}</strong><small class="muted">Connecté · ${n} activité${n > 1 ? 's' : ''} importée${n > 1 ? 's' : ''}</small></div>
        </div>
        <p>Dernière synchronisation : ${lastSyncText()}. L'app se synchronise toute seule à chaque ouverture.</p>
        <button class="btn btn-primary btn-block" data-action="sync" ${ui.syncing ? 'disabled' : ''}>${ui.syncing ? 'Synchronisation…' : '↻ Synchroniser maintenant'}</button>
        <button class="btn btn-ghost btn-block danger" data-action="strava-disconnect">Déconnecter Strava</button>
      </section>
      <section class="card">
        <h3>Comment ça marche</h3>
        <ul class="bullets">
          <li>Chaque course Strava coche la séance prévue le même jour (ou la plus proche dans les 3 jours).</li>
          <li>Les séances de musculation, Workout, HIIT, Pilates ou Yoga cochent ta séance de renfo.</li>
          <li>Une course sans séance correspondante devient une course hors programme : elle compte pour tes kilomètres et tes paliers.</li>
          <li>Tu peux corriger l'association depuis le détail de chaque activité.</li>
        </ul>
      </section>`;
  }
  const host = location.hostname;
  return `
    <header class="page-head"><a class="back" href="#/reglages">‹ Réglages</a></header>
    <h1>Connecter Strava</h1>
    <p class="muted">À faire une seule fois, environ 5 minutes. C'est gratuit.</p>
    <section class="card">
      <h3>1. Crée ta clé Strava</h3>
      <ol class="steps-help">
        <li>Ouvre <a class="link" href="https://www.strava.com/settings/api" target="_blank" rel="noopener">strava.com/settings/api</a> (connecte-toi si besoin).</li>
        <li>Remplis le formulaire :
          <ul class="copy-list">
            <li><span>Nom de l'application</span><code>Élan 10K</code></li>
            <li><span>Catégorie</span><code>Training</code></li>
            <li><span>Site web</span><code data-copy="${esc(redirectUri())}">${esc(redirectUri())}</code></li>
            <li><span>Domaine de rappel d'autorisation</span><code data-copy="${esc(host)}">${esc(host)}</code></li>
          </ul>
        </li>
        <li>Accepte les conditions, puis ajoute une icône : <a class="link" href="icons/icon-512.png" download="elan10k.png">télécharger l'icône</a>.</li>
        <li>Strava affiche ton <strong>ID client</strong> et ton <strong>Secret client</strong> (touche « Afficher »).</li>
      </ol>
      <p class="muted small">Touche un texte gris pour le copier.</p>
    </section>
    <form class="card" data-form="strava-keys">
      <h3>2. Colle tes identifiants</h3>
      <label class="field"><span>ID client</span><input name="clientId" inputmode="numeric" value="${esc(st.clientId || '')}" placeholder="ex. 123456" required></label>
      <label class="field"><span>Secret client</span><input name="clientSecret" value="${esc(st.clientSecret || '')}" placeholder="40 caractères" autocomplete="off" required></label>
      <p class="muted small">🔒 Ton secret reste uniquement sur ce téléphone. Il n'est envoyé qu'à Strava et jamais inclus dans les sauvegardes.</p>
      <button class="btn btn-primary btn-block" type="submit">3. Connecter Strava</button>
    </form>
    ${hasKeys() ? `
      <details class="card">
        <summary class="link">Strava t'a donné un code de connexion ?</summary>
        <form class="inline-form" data-form="strava-code">
          <input name="code" placeholder="Colle le code ici" required aria-label="Code de connexion">
          <button class="btn btn-primary" type="submit">Valider</button>
        </form>
        <p class="muted small">Sur iPhone, la connexion peut s'ouvrir dans Safari au lieu de l'app : la page affiche alors un code à copier ici.</p>
      </details>` : ''}`;
}

// Page affichée au retour de Strava quand l'app ne retrouve pas les identifiants
// (sur iPhone, Safari et l'icône de l'écran d'accueil ne partagent pas leurs données).
export function viewStravaCode(code) {
  return `
    <section class="onboarding">
      <div class="hero hero-intro">
        <div class="logo">S</div>
        <h1>Presque fini !</h1>
        <p>Copie ce code, retourne dans l'app Élan 10K (icône de l'écran d'accueil), puis Réglages → Strava → « Strava t'a donné un code ».</p>
      </div>
      <section class="card">
        <code class="big-code" data-copy="${esc(code)}">${esc(code)}</code>
        <button class="btn btn-primary btn-block" data-action="copy" data-text="${esc(code)}">Copier le code</button>
        <p class="muted small">Le code n'est valable que quelques minutes.</p>
      </section>
    </section>`;
}

// --- Suivi : poids, mensurations, sommeil, eau ------------------------------------------------

const MEASURES = [
  { key: 'taille', label: 'Taille' },
  { key: 'hanches', label: 'Hanches' },
  { key: 'cuisse', label: 'Cuisse' },
  { key: 'bras', label: 'Bras' },
];

export { MEASURES };

function dailyHistory(key, days = 14) {
  const state = getState();
  const items = [];
  for (let i = days - 1; i >= 0; i--) {
    const iso = toISO(addDays(parseDate(todayISO()), -i));
    const v = state.daily[iso]?.[key] || 0;
    items.push({ label: dateShortDay(iso), short: String(parseDate(iso).getDate()), value: v, highlight: i === 0 });
  }
  return items;
}

function average(items) {
  const vals = items.filter((it) => it.value > 0).map((it) => it.value);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function viewBody() {
  const state = getState();
  const p = state.profile;
  const weights = [...state.weights].sort((a, b) => b.date.localeCompare(a.date));
  const last = weights[0];
  const start = startWeight();
  const lost = start && last ? start - last.kg : null;
  const remaining = p.goalWeight && last ? last.kg - p.goalWeight : null;
  const points = weights.map((w) => ({ date: w.date, value: w.kg }));
  if (p.startWeight && !weights.length) points.push({ date: todayISO(), value: p.startWeight });
  const measures = [...state.measures].sort((a, b) => a.date.localeCompare(b.date));
  const firstM = measures[0];
  const water = dailyHistory('water');
  const sleep = dailyHistory('sleep');
  const waterAvg = average(water.slice(-7));
  const sleepAvg = average(sleep.slice(-7));
  // Rythme : kg perdus par semaine depuis la première pesée
  const oldest = weights[weights.length - 1];
  const weeksSpan = oldest && last ? daysBetween(oldest.date, last.date) / 7 : 0;
  const rate = weeksSpan >= 1 ? (oldest.kg - last.kg) / weeksSpan : null;

  return `
    <header class="page-head"><h1>Mon suivi</h1></header>
    <section class="stats">
      <div class="stat t-violet"><span>${start ? num(start) : '—'}</span><small>kg au départ</small></div>
      <div class="stat t-orange"><span>${last ? num(last.kg) : '—'}</span><small>kg aujourd'hui</small></div>
      <div class="stat t-teal"><span>${lost !== null ? signed(-lost) : '—'}</span><small>kg d'écart</small></div>
      <div class="stat t-pink"><span>${remaining !== null ? (remaining > 0 ? num(remaining) : '🎯') : '—'}</span><small>${remaining !== null && remaining <= 0 ? 'objectif atteint !' : 'kg avant l\'objectif'}</small></div>
    </section>
    <section class="card">
      <div class="card-head"><h3>⚖️ Mon poids</h3>${rate !== null ? `<span class="pill">${rate >= 0 ? '−' : '+'}${num(Math.abs(rate), 2)} kg/sem.</span>` : ''}</div>
      ${lineChart(points, { goal: p.goalWeight })}
      <form class="inline-form" data-form="weight">
        <input type="date" name="date" value="${todayISO()}" required aria-label="Date">
        <input name="kg" inputmode="decimal" placeholder="kg" required aria-label="Poids en kg">
        <button class="btn btn-primary" type="submit">Ajouter</button>
      </form>
      <p class="muted small">${rate !== null && rate > 0.8 ? '⚠️ Tu perds plus de 0,8 kg par semaine : pense à bien manger, surtout les jours de séance.' : 'Pèse-toi une fois par semaine, le matin à jeun : la tendance compte plus qu\'un chiffre isolé.'}</p>
      ${weights.length ? `
        <ul class="history">
          ${weights.slice(0, 8).map((w, i) => {
            const prev = weights[i + 1];
            const diff = prev ? w.kg - prev.kg : null;
            return `<li><span>${capitalize(formatShort(w.date))}</span><strong>${num(w.kg)} kg</strong>
              <span class="${diff < 0 ? 'down' : diff > 0 ? 'up' : ''}">${diff !== null && diff !== 0 ? `${diff > 0 ? '+' : '−'}${num(Math.abs(diff))}` : ''}</span>
              <button class="icon-btn" data-action="del-weight" data-date="${w.date}" aria-label="Supprimer">🗑</button></li>`;
          }).join('')}
        </ul>` : ''}
    </section>
    <section class="card">
      <div class="card-head"><h3>💧 Hydratation</h3><span class="pill">${waterAvg ? `${num(waterAvg)} verres/j` : '—'}</span></div>
      ${barChart(water, { unit: 'verres', goal: p.waterGoal || 8, goalLabel: `Objectif ${p.waterGoal || 8}` })}
    </section>
    <section class="card">
      <div class="card-head"><h3>😴 Sommeil</h3><span class="pill">${sleepAvg ? `${hours(sleepAvg)} /nuit` : '—'}</span></div>
      ${barChart(sleep, { unit: 'h', goal: p.sleepGoal || 7.5, goalLabel: `Objectif ${hours(p.sleepGoal || 7.5)}` })}
      <p class="muted small">Moyennes sur les 7 derniers jours. Tu notes l'eau et le sommeil depuis l'accueil.</p>
      <details>
        <summary class="link">Corriger un autre jour</summary>
        <form data-form="daily" class="stack">
          <label class="field"><span>Date</span><input type="date" name="date" value="${toISO(addDays(parseDate(todayISO()), -1))}" required></label>
          <div class="row">
            <label class="field"><span>Verres d'eau</span><input name="water" inputmode="numeric"></label>
            <label class="field"><span>Sommeil (h)</span><input name="sleep" inputmode="decimal"></label>
          </div>
          <button class="btn btn-primary btn-block" type="submit">Enregistrer</button>
        </form>
      </details>
    </section>
    <section class="card">
      <div class="card-head"><h3>📐 Mes mensurations (cm)</h3></div>
      <form data-form="measure" class="stack">
        <label class="field"><span>Date</span><input type="date" name="date" value="${todayISO()}" required></label>
        <div class="grid-2">
          ${MEASURES.map((mm) => `<label class="field"><span>${mm.label}</span><input name="${mm.key}" inputmode="decimal" placeholder="cm"></label>`).join('')}
        </div>
        <button class="btn btn-primary btn-block" type="submit">Enregistrer</button>
      </form>
      <p class="muted small">Mesure-toi toutes les 2 à 4 semaines : avec le sport, on perd souvent des centimètres avant les kilos.</p>
      ${measures.length ? `
        <div class="table-wrap"><table class="measures">
          <thead><tr><th>Date</th>${MEASURES.map((mm) => `<th>${mm.label}</th>`).join('')}<th></th></tr></thead>
          <tbody>
            ${[...measures].reverse().map((row) => `<tr><td>${formatShort(row.date)}</td>${MEASURES.map((mm) => {
              const v = row[mm.key];
              const d = v && firstM[mm.key] && row !== firstM ? v - firstM[mm.key] : null;
              return `<td>${v ? num(v) : '—'}${d ? `<small class="${d < 0 ? 'down' : 'up'}">${d > 0 ? '+' : '−'}${num(Math.abs(d))}</small>` : ''}</td>`;
            }).join('')}<td><button class="icon-btn" data-action="del-measure" data-id="${row.id}" aria-label="Supprimer">🗑</button></td></tr>`).join('')}
          </tbody>
        </table></div>
        <p class="muted small">Écarts calculés par rapport à ta première mesure.</p>` : ''}
    </section>
    <a class="card tip" href="#/conseils"><h3>🥗 Conseils nutrition et sommeil</h3><span class="link">Voir tous les conseils ›</span></a>`;
}

// --- Conseils -----------------------------------------------------------------------------------

export function viewAdvice() {
  return `
    <header class="page-head"><a class="back" href="#/">‹ Accueil</a></header>
    <h1>Conseils</h1>
    <p class="muted">Simples, sans régime ni calcul de calories.</p>
    ${ADVICE.map((sec) => `
      <details class="card advice" ${sec.id === 'quotidien' ? 'open' : ''}>
        <summary><h3>${sec.icon} ${sec.title}</h3></summary>
        <ul class="bullets">${sec.items.map((it) => `<li>${it}</li>`).join('')}</ul>
      </details>`).join('')}
    <h2 class="section-title">Idées de repas</h2>
    ${MEALS.map((m) => `
      <details class="card advice">
        <summary><h3>${m.icon} ${m.title}</h3></summary>
        <ul class="bullets">${m.items.map((it) => `<li>${it}</li>`).join('')}</ul>
      </details>`).join('')}
    <p class="muted small center">Ces conseils sont généraux. En cas de doute sur ta santé, demande l'avis d'un médecin ou d'une diététicienne.</p>`;
}

// --- Récompenses ----------------------------------------------------------------------------------

function rewardCard(r, m) {
  const info = METRIC_INFO[r.type];
  const pct = Math.round(progressOf(r, m) * 100);
  const unlocked = !!r.unlockedAt;
  return `
    <li class="badge-card ${unlocked ? 'unlocked' : ''} ${r.claimed ? 'claimed' : ''}">
      <span class="badge-icon">${unlocked ? BADGE_ICON[r.type] : '🔒'}</span>
      <div class="badge-body">
        <strong>${esc(r.label)}</strong>
        ${r.reward ? `<span class="badge-reward">🎁 ${esc(r.reward)}</span>` : ''}
        ${unlocked
          ? `<small>Débloqué ${r.unlockedAt === todayISO() ? 'aujourd\'hui' : `le ${formatShort(r.unlockedAt)}`}</small>`
          : `<div class="bar"><span style="width:${pct}%"></span></div><small>${info.icon} ${num(Math.min(m[r.type], r.threshold))}/${num(r.threshold)} ${info.unit}</small>`}
        ${unlocked && r.reward && !r.claimed ? `<button class="btn btn-primary btn-small" data-action="claim" data-id="${r.id}">Récompense reçue ✓</button>` : ''}
        ${r.claimed ? '<small class="ok">Récompense reçue 💝</small>' : ''}
      </div>
      <button class="icon-btn" data-action="edit-reward" data-id="${r.id}" aria-label="Modifier">✏️</button>
    </li>`;
}

export function viewRewards() {
  const state = getState();
  const m = metrics();
  const rewards = sortedRewards();
  const unlocked = rewards.filter((r) => r.unlockedAt);
  const locked = rewards.filter((r) => !r.unlockedAt);
  const streak = currentStreak();
  return `
    <header class="page-head"><h1>Récompenses</h1></header>
    <section class="hero hero-streak">
      <div class="streak-big">${streak}<span>🔥</span></div>
      <div>
        <h2>semaine${streak > 1 ? 's' : ''} validée${streak > 1 ? 's' : ''} d'affilée</h2>
        <p>${unlocked.length}/${state.rewards.length} badges débloqués · une semaine est validée dès ${WEEK_TARGET} séances.</p>
      </div>
    </section>
    ${unlocked.length ? `<h3 class="section-title">Débloqués</h3><ul class="badges">${unlocked.map((r) => rewardCard(r, m)).join('')}</ul>` : ''}
    <h3 class="section-title">À venir</h3>
    <ul class="badges">${locked.map((r) => rewardCard(r, m)).join('') || '<li class="muted">Tout est débloqué, bravo !</li>'}</ul>
    <button class="btn btn-outline btn-block" data-action="new-reward">＋ Créer mon propre palier</button>
    <p class="muted small center">Touche ✏️ pour changer une récompense : c'est toi qui décides !</p>`;
}

export function rewardForm(r) {
  return `
    <form data-form="reward" data-id="${r?.id || ''}" class="stack">
      <h2>${r ? 'Modifier le palier' : 'Nouveau palier'}</h2>
      <label class="field"><span>Nom du palier</span><input name="label" value="${esc(r?.label || '')}" placeholder="ex. Premier 10 km" required></label>
      <div class="row">
        <label class="field"><span>Type</span>
          <select name="type">${Object.entries(METRIC_INFO).map(([k, v]) => `<option value="${k}" ${r?.type === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
        <label class="field"><span>Seuil</span><input name="threshold" inputmode="decimal" value="${r ? num(r.threshold) : ''}" required></label>
      </div>
      <label class="field"><span>Ma récompense</span><input name="reward" value="${esc(r?.reward || '')}" placeholder="ex. Un nouveau livre 📚"></label>
      <button class="btn btn-primary btn-block" type="submit">Enregistrer</button>
      ${r ? `<button class="btn btn-ghost btn-block danger" type="button" data-action="del-reward" data-id="${r.id}">Supprimer ce palier</button>` : ''}
      <button class="btn btn-ghost btn-block" type="button" data-close>Annuler</button>
    </form>`;
}

// --- Nouveau programme ---------------------------------------------------------------------------

export function viewNewCycle() {
  const state = getState();
  const suggested = state.cycle?.planId === 'premier10' && programFinished() ? 'chrono10' : state.cycle?.planId;
  return `
    <header class="page-head"><a class="back" href="#/reglages">‹ Réglages</a></header>
    <h1>Nouveau programme</h1>
    <form class="card" data-form="cycle">
      ${planPicker(suggested)}
      ${startField()}
      <p class="muted small">Ton programme actuel sera archivé. Tes courses, ton suivi et tes badges sont conservés ; les paliers de semaines d'affilée repartent de zéro.</p>
      <button class="btn btn-primary btn-block" type="submit">Démarrer ce programme</button>
    </form>`;
}

// --- Réglages -------------------------------------------------------------------------------------

export function viewSettings() {
  const state = getState();
  const p = state.profile;
  const plan = planOf();
  const alarm = p.alarmMinutes ? `${p.alarmMinutes >= 60 ? `${p.alarmMinutes / 60} h` : `${p.alarmMinutes} min`} avant chaque séance` : 'à l\'heure de chaque séance';
  return `
    <header class="page-head"><a class="back" href="#/">‹ Accueil</a></header>
    <h1>Réglages</h1>
    <a class="card strava-cta" href="#/sante">${sourceLogo('apple')}
      <span><strong>Apple Watch · Santé</strong><small>${lastImportText() ? `Dernier import le ${lastImportText()}` : 'Importer mes séances, mon poids et mon sommeil'}</small></span><span class="chev">›</span></a>
    <a class="card strava-cta" href="#/strava">${sourceLogo('strava')}
      <span><strong>Strava</strong><small>${isConnected() ? `Connecté · synchronisé ${lastSyncText()}` : 'Facultatif · nécessite un abonnement Strava'}</small></span><span class="chev">›</span></a>
    <section class="card">
      <h3>🏃 Mon programme</h3>
      <p><strong>${esc(plan.name)}</strong> · depuis le ${formatDate(state.cycle.startDate, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <button class="btn btn-outline btn-block" data-action="shift-week">Décaler d'une semaine (pause, maladie…)</button>
      <a class="btn btn-ghost btn-block" href="#/nouveau">Changer de programme ou recommencer</a>
    </section>
    <section class="card">
      <h3>📅 Calendrier Apple</h3>
      <p>Toutes tes séances et tes pesées, avec un rappel ${alarm}.</p>
      ${calendarHelp()}
      <button class="btn btn-primary btn-block" data-action="calendar">📅 Ajouter au Calendrier</button>
      <p class="muted small">Tu as changé tes jours, ton heure ou décalé le programme ? Supprime d'abord les anciens événements Élan 10K de ton calendrier, puis ajoute à nouveau le fichier.</p>
    </section>
    <form class="card" data-form="profile">
      <h3>👤 Mes préférences</h3>
      ${profileFields(p)}
      <button class="btn btn-primary btn-block" type="submit">Enregistrer</button>
    </form>
    <section class="card">
      <h3>💾 Mes données</h3>
      <p class="muted">Tes données restent sur ce téléphone. Fais une sauvegarde de temps en temps (dans Fichiers ou iCloud Drive).</p>
      <button class="btn btn-outline btn-block" data-action="export">Exporter une sauvegarde</button>
      <label class="btn btn-outline btn-block file-btn">Importer une sauvegarde<input type="file" accept="application/json,.json" data-action="import" hidden></label>
      <button class="btn btn-ghost btn-block danger" data-action="reset">Tout effacer</button>
    </section>
    <p class="muted small center">Élan 10K · version 2</p>`;
}
