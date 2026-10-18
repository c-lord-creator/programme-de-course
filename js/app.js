import { PROGRAM, TOTAL_WEEKS, TYPE_INFO, PACE_GUIDE, TIPS, findSession, getRenfo, renfoSteps } from './program.js';
import {
  getState, save, replaceState, resetState, uid, METRIC_INFO,
  parseDate, toISO, todayISO, addDays, mondayOf, isoWeekday, DAY_NAMES, formatDate, formatShort,
  sessionDate, currentWeek, programStarted, isRun, weekDoneCount, WEEK_TARGET, currentStreak,
  metrics, refreshRewards, sortedRewards, progressOf, latestWeight, nextSession,
} from './store.js';
import { lineChart, bindCharts } from './chart.js';
import { downloadCalendar } from './ics.js';
import { startGuidedWorkout } from './timer.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');

// --- Petits utilitaires ---------------------------------------------------------

function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function num(n, digits = 1) {
  return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: digits });
}

function parseNum(value) {
  const n = parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function relDay(iso) {
  const today = todayISO();
  if (iso === today) return 'Aujourd\'hui';
  if (iso === toISO(addDays(parseDate(today), 1))) return 'Demain';
  if (iso === toISO(addDays(parseDate(today), -1))) return 'Hier';
  return formatDate(iso);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const FEELINGS = ['😫', '😕', '🙂', '😀', '🤩'];

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2600);
}

function openModal(html, onBind) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  const close = () => { wrap.remove(); document.body.classList.remove('no-scroll'); };
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-close]')) close();
  });
  if (onBind) onBind(wrap, close);
  return close;
}

// --- Récompenses débloquées -------------------------------------------------------

const BADGE_ICON = { longest: '🏅', total: '📏', weeks: '🔥', sessions: '⭐', renfo: '💪' };

function celebrate(queue) {
  if (!queue.length) return;
  const [r, ...rest] = queue;
  const confetti = Array.from({ length: 36 }, (_, i) =>
    `<i style="left:${Math.random() * 100}%;animation-delay:${Math.random() * 0.6}s;background:var(--c${i % 5})"></i>`).join('');
  openModal(`
    <div class="confetti">${confetti}</div>
    <div class="celebrate">
      <div class="badge-big">${BADGE_ICON[r.type]}</div>
      <p class="eyebrow">Palier débloqué !</p>
      <h2>${esc(r.label)}</h2>
      ${r.reward ? `<div class="reward-box"><span>Ta récompense</span><strong>${esc(r.reward)}</strong></div>` : '<p>Un nouveau badge pour ta collection. Continue comme ça !</p>'}
      <button class="btn btn-primary btn-block" data-close>${rest.length ? 'Suivant' : 'Génial !'}</button>
    </div>`, (wrap) => {
    wrap.querySelector('[data-close]').addEventListener('click', () => setTimeout(() => celebrate(rest), 50));
  });
}

function afterProgress() {
  const fresh = refreshRewards();
  if (fresh.length) render();
  celebrate(fresh);
}

// --- Navigation ---------------------------------------------------------------------

const TABS = [
  { route: '', icon: '🏠', label: 'Accueil' },
  { route: 'programme', icon: '📋', label: 'Programme' },
  { route: 'corps', icon: '⚖️', label: 'Suivi' },
  { route: 'recompenses', icon: '🎁', label: 'Récompenses' },
  { route: 'reglages', icon: '⚙️', label: 'Réglages' },
];

function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [name, param] = hash.split('/');
  return { name: name || '', param };
}

function renderNav(active) {
  const tabFor = { seance: 'programme', course: '' }[active] ?? active;
  nav.innerHTML = TABS.map((t) =>
    `<a href="#/${t.route}" class="${t.route === tabFor ? 'active' : ''}"><span>${t.icon}</span>${t.label}</a>`).join('');
}

function render() {
  const state = getState();
  const route = currentRoute();
  if (!state.profile) {
    nav.hidden = true;
    app.innerHTML = viewOnboarding();
    return;
  }
  nav.hidden = false;
  renderNav(route.name);
  const views = {
    '': viewHome,
    programme: viewProgram,
    seance: () => viewSession(route.param),
    course: viewExtraRun,
    corps: viewBody,
    recompenses: viewRewards,
    reglages: viewSettings,
  };
  app.innerHTML = (views[route.name] || viewHome)();
  bindCharts(app);
}

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

// --- Formulaire de profil (accueil et réglages) ----------------------------------------

function defaultStart() {
  const today = parseDate(todayISO());
  return toISO(isoWeekday(today) === 1 ? today : addDays(mondayOf(today), 7));
}

function profileFields(p) {
  const days = p?.days || [1, 3, 5, 7];
  return `
    <label class="field"><span>Ton prénom</span>
      <input name="name" value="${esc(p?.name || '')}" placeholder="Facultatif" autocomplete="given-name"></label>
    <label class="field"><span>Début du programme</span>
      <input type="date" name="startDate" value="${p?.startDate || defaultStart()}" required>
      <small>Le programme démarre le lundi de la semaine choisie.</small></label>
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
      <label class="field"><span>Poids actuel (kg)</span>
        <input name="startWeight" inputmode="decimal" value="${p?.startWeight ? num(p.startWeight) : ''}" placeholder="ex. 68,5"></label>
      <label class="field"><span>Objectif (kg)</span>
        <input name="goalWeight" inputmode="decimal" value="${p?.goalWeight ? num(p.goalWeight) : ''}" placeholder="ex. 62"></label>
    </div>
    <fieldset class="field"><legend>Renfo de préférence</legend>
      <div class="segmented">
        <label><input type="radio" name="renfoPlace" value="maison" ${(p?.renfoPlace || 'maison') === 'maison' ? 'checked' : ''}><span>🏠 Maison</span></label>
        <label><input type="radio" name="renfoPlace" value="salle" ${p?.renfoPlace === 'salle' ? 'checked' : ''}><span>🏋️ Salle</span></label>
      </div>
      <small>Tu pourras changer à chaque séance.</small></fieldset>`;
}

function readProfile(form) {
  const fd = new FormData(form);
  const days = fd.getAll('days').map(Number);
  if (days.length !== 4) {
    toast('Choisis exactement 4 jours 🙏');
    return null;
  }
  const start = fd.get('startDate');
  return {
    name: fd.get('name').trim(),
    startDate: toISO(mondayOf(parseDate(start))),
    days,
    sessionTime: fd.get('sessionTime'),
    alarmMinutes: Number(fd.get('alarmMinutes')),
    weighDay: Number(fd.get('weighDay')),
    weighTime: fd.get('weighTime'),
    startWeight: parseNum(fd.get('startWeight')),
    goalWeight: parseNum(fd.get('goalWeight')),
    renfoPlace: fd.get('renfoPlace'),
  };
}

function calendarHelp() {
  return `
    <ol class="steps-help">
      <li>Touche <strong>Ajouter au Calendrier</strong> ci-dessous (depuis Safari).</li>
      <li>iPhone affiche la liste des événements : touche <strong>Tout ajouter</strong>.</li>
      <li>Choisis ton calendrier, c'est fait : 48 séances et 12 pesées avec rappel 🔔</li>
    </ol>
    <p class="muted small">Si rien ne se passe depuis l'icône de l'écran d'accueil, ouvre l'app dans Safari pour cette étape.</p>`;
}

// --- Vues -------------------------------------------------------------------------------

function viewOnboarding() {
  return `
    <section class="onboarding">
      <div class="hero hero-intro">
        <div class="logo">10K</div>
        <h1>Bienvenue sur Élan 10K</h1>
        <p>12 semaines pour passer de 5 à 10 km, avec du renfo, un suivi de ton poids et des récompenses à chaque palier.</p>
      </div>
      <form class="card" data-form="onboarding">
        <h2>On fait connaissance</h2>
        ${profileFields(null)}
        <button class="btn btn-primary btn-block" type="submit">C'est parti 🚀</button>
      </form>
    </section>`;
}

function sessionChip(s) {
  const info = TYPE_INFO[s.type];
  const done = !!getState().logs[s.id];
  return `
    <a class="session-row ${done ? 'done' : ''}" href="#/seance/${s.id}">
      <span class="session-icon t-${info.color}">${done ? '✓' : info.emoji}</span>
      <span class="session-text">
        <strong>${esc(s.title)}</strong>
        <small>${capitalize(formatDate(sessionDate(s), { weekday: 'short', day: 'numeric', month: 'short' }))} · ${esc(s.summary)}</small>
      </span>
      <span class="chev">›</span>
    </a>`;
}

function nextRewardCard() {
  const target = sortedRewards().find((r) => !r.unlockedAt && r.reward);
  if (!target) return '';
  const m = metrics();
  const info = METRIC_INFO[target.type];
  const pct = Math.round(progressOf(target) * 100);
  return `
    <a class="card reward-next" href="#/recompenses">
      <div class="card-head"><h3>🎁 Prochaine récompense</h3><span class="pill">${pct}%</span></div>
      <p class="reward-title">${esc(target.reward)}</p>
      <p class="muted small">${esc(target.label)} · ${num(m[target.type])}/${num(target.threshold)} ${info.unit}</p>
      <div class="bar"><span style="width:${pct}%"></span></div>
    </a>`;
}

function viewHome() {
  const state = getState();
  const p = state.profile;
  const week = currentWeek();
  const w = PROGRAM[week - 1];
  const m = metrics();
  const streak = currentStreak();
  const last = latestWeight();
  const lost = p.startWeight && last ? p.startWeight - last.kg : null;
  const next = nextSession();
  const tip = TIPS[Math.floor(parseDate(todayISO()) / 86400000) % TIPS.length];
  const toClaim = state.rewards.filter((r) => r.unlockedAt && r.reward && !r.claimed).length;

  let hero;
  if (!programStarted()) {
    hero = `
      <div class="hero">
        <p class="eyebrow">Bientôt le départ</p>
        <h2>Le programme démarre ${formatDate(p.startDate)}</h2>
        <p>Ajoute tes séances au Calendrier Apple pour ne rien rater.</p>
        <button class="btn btn-light" data-action="calendar">📅 Ajouter au Calendrier</button>
      </div>`;
  } else if (next) {
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
        <p>Continue à noter tes courses pour faire grimper tes kilomètres.</p>
      </div>`;
  }

  return `
    <header class="page-head">
      <div>
        <p class="muted">${capitalize(formatDate(todayISO()))}</p>
        <h1>Salut${p.name ? ` ${esc(p.name)}` : ''} 👋</h1>
      </div>
      <span class="week-badge">S${week}<small>/${TOTAL_WEEKS}</small></span>
    </header>
    ${hero}
    ${toClaim ? `<a class="card claim-banner" href="#/recompenses">🎉 ${toClaim} récompense${toClaim > 1 ? 's' : ''} à t'offrir !</a>` : ''}
    <section class="card">
      <div class="card-head"><h3>Semaine ${week} · ${esc(w.theme)}</h3><span class="pill">${weekDoneCount(week)}/4</span></div>
      ${w.sessions.map(sessionChip).join('')}
      <p class="muted small">Semaine validée dès ${WEEK_TARGET} séances sur 4.</p>
    </section>
    <section class="stats">
      <div class="stat t-orange"><span>${num(m.total)}</span><small>km cumulés</small></div>
      <div class="stat t-violet"><span>${m.sessions}</span><small>séances</small></div>
      <div class="stat t-pink"><span>${streak} 🔥</span><small>semaine${streak > 1 ? 's' : ''} d'affilée</small></div>
      <div class="stat t-teal"><span>${lost !== null ? `${lost >= 0 ? '−' : '+'}${num(Math.abs(lost))}` : '—'}</span><small>kg ${lost === null || lost >= 0 ? 'perdus' : 'depuis le début'}</small></div>
    </section>
    ${nextRewardCard()}
    <section class="card tip">
      <h3>${tip.icon} Le conseil du jour</h3>
      <p>${tip.text}</p>
    </section>
    <a class="btn btn-outline btn-block" href="#/course">＋ Ajouter une course hors programme</a>`;
}

function viewProgram() {
  const cw = currentWeek();
  return `
    <header class="page-head"><h1>Programme 10 km</h1></header>
    <section class="card pace">
      <details>
        <summary>🎯 Les allures expliquées</summary>
        ${PACE_GUIDE.map((g) => `<p><strong>${g.name}</strong> — ${g.text}</p>`).join('')}
      </details>
    </section>
    ${PROGRAM.map((w) => {
      const done = weekDoneCount(w.week);
      return `
      <details class="card week ${w.week === cw ? 'current' : ''}" ${w.week === cw ? 'open' : ''}>
        <summary>
          <span class="week-num">${w.week}</span>
          <span class="week-text"><strong>${esc(w.theme)}</strong>
            <small>${capitalize(formatShort(sessionDate(w.sessions[0])))}${w.recovery ? ' · récup' : ''}${w.week === cw ? ' · en cours' : ''}</small></span>
          <span class="pill ${done >= WEEK_TARGET ? 'pill-ok' : ''}">${done}/4</span>
        </summary>
        ${w.sessions.map(sessionChip).join('')}
      </details>`;
    }).join('')}`;
}

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
    <p class="muted small center">Minuteur, bips et vibrations : laisse-toi guider.</p>`;
}

function logForm(session) {
  const state = getState();
  const log = state.logs[session.id];
  const planned = sessionDate(session);
  const run = isRun(session);
  if (log && !state.editing) {
    return `
      <section class="card done-card">
        <h3>✅ Séance faite · ${relDay(log.date)}</h3>
        <div class="done-stats">
          ${run ? `<span><strong>${num(log.distanceKm, 2)}</strong> km</span>` : ''}
          ${log.durationMin ? `<span><strong>${num(log.durationMin, 0)}</strong> min</span>` : ''}
          ${run && log.distanceKm && log.durationMin ? `<span><strong>${pace(log.durationMin, log.distanceKm)}</strong> /km</span>` : ''}
          ${log.feeling ? `<span class="feel">${FEELINGS[log.feeling - 1]}</span>` : ''}
        </div>
        ${log.note ? `<p class="note">« ${esc(log.note)} »</p>` : ''}
        <div class="row">
          <button class="btn btn-outline" data-action="edit-log">Modifier</button>
          <button class="btn btn-ghost" data-action="undo-log" data-id="${session.id}">Annuler</button>
        </div>
      </section>`;
  }
  const date = log?.date || (planned <= todayISO() ? planned : todayISO());
  return `
    <form class="card" data-form="log" data-id="${session.id}">
      <h3>${log ? 'Modifier ma séance' : 'J\'ai fait cette séance'}</h3>
      <div class="row">
        <label class="field"><span>Date</span><input type="date" name="date" value="${date}" required></label>
        ${run ? `<label class="field"><span>Distance (km)</span><input name="distanceKm" inputmode="decimal" value="${log ? num(log.distanceKm, 2) : session.distanceKm ? num(session.distanceKm) : ''}" placeholder="ex. 5,2" required></label>` : ''}
      </div>
      <label class="field"><span>Durée (min)</span><input name="durationMin" inputmode="numeric" value="${log?.durationMin ?? session.durationMin}"></label>
      ${feelingPicker(log?.feeling)}
      <label class="field"><span>Note</span><input name="note" value="${esc(log?.note || '')}" placeholder="Météo, sensations…"></label>
      ${run ? '<p class="muted small">Bientôt : tes courses Strava arriveront automatiquement ici.</p>' : ''}
      <button class="btn btn-primary btn-block" type="submit">Valider ma séance ✓</button>
    </form>`;
}

function feelingPicker(value) {
  return `
    <fieldset class="field"><legend>Ressenti</legend>
      <div class="feelings">
        ${FEELINGS.map((f, i) => `<label><input type="radio" name="feeling" value="${i + 1}" ${value === i + 1 ? 'checked' : ''}><span>${f}</span></label>`).join('')}
      </div></fieldset>`;
}

function pace(minutes, km) {
  const secPerKm = Math.round((minutes * 60) / km);
  return `${Math.floor(secPerKm / 60)}'${String(secPerKm % 60).padStart(2, '0')}`;
}

function viewSession(id) {
  const s = findSession(id);
  if (!s) return '<p>Séance introuvable.</p>';
  const info = TYPE_INFO[s.type];
  const w = PROGRAM[s.week - 1];
  return `
    <header class="page-head"><a class="back" href="#/programme">‹ Programme</a></header>
    <section class="session-hero t-${info.color}">
      <span class="chip">${info.emoji} ${info.label}</span>
      <h1>${esc(s.title)}</h1>
      <p>${capitalize(relDay(sessionDate(s)))} · Semaine ${s.week} · ${esc(w.theme)}</p>
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
        </ol>`}
    </section>
    ${logForm(s)}`;
}

function viewExtraRun() {
  const runs = [...getState().extraRuns].sort((a, b) => b.date.localeCompare(a.date));
  return `
    <header class="page-head"><a class="back" href="#/">‹ Accueil</a></header>
    <h1>Course hors programme</h1>
    <form class="card" data-form="extra">
      <div class="row">
        <label class="field"><span>Date</span><input type="date" name="date" value="${todayISO()}" required></label>
        <label class="field"><span>Distance (km)</span><input name="distanceKm" inputmode="decimal" placeholder="ex. 4,5" required></label>
      </div>
      <label class="field"><span>Durée (min)</span><input name="durationMin" inputmode="numeric"></label>
      ${feelingPicker(null)}
      <label class="field"><span>Note</span><input name="note" placeholder="Course entre amis, trail…"></label>
      <button class="btn btn-primary btn-block" type="submit">Ajouter la course</button>
    </form>
    ${runs.length ? `
      <section class="card">
        <h3>Mes courses hors programme</h3>
        <ul class="history">
          ${runs.map((r) => `<li><span>${capitalize(formatShort(r.date))}</span><strong>${num(r.distanceKm, 2)} km</strong><span>${r.durationMin ? `${r.durationMin} min` : ''} ${r.feeling ? FEELINGS[r.feeling - 1] : ''}</span>
            <button class="icon-btn" data-action="del-extra" data-id="${r.id}" aria-label="Supprimer">🗑</button></li>`).join('')}
        </ul>
      </section>` : ''}`;
}

const MEASURES = [
  { key: 'taille', label: 'Taille' },
  { key: 'hanches', label: 'Hanches' },
  { key: 'cuisse', label: 'Cuisse' },
  { key: 'bras', label: 'Bras' },
];

function viewBody() {
  const state = getState();
  const p = state.profile;
  const weights = [...state.weights].sort((a, b) => b.date.localeCompare(a.date));
  const last = weights[0];
  const start = p.startWeight ?? weights[weights.length - 1]?.kg;
  const lost = start && last ? start - last.kg : null;
  const remaining = p.goalWeight && last ? last.kg - p.goalWeight : null;
  const points = weights.map((w) => ({ date: w.date, value: w.kg }));
  if (p.startWeight && !weights.some((w) => w.date <= p.startDate)) {
    points.push({ date: p.startDate, value: p.startWeight });
  }
  const measures = [...state.measures].sort((a, b) => a.date.localeCompare(b.date));
  const firstM = measures[0];

  return `
    <header class="page-head"><h1>Mon suivi</h1></header>
    <section class="stats">
      <div class="stat t-violet"><span>${start ? num(start) : '—'}</span><small>kg au départ</small></div>
      <div class="stat t-orange"><span>${last ? num(last.kg) : '—'}</span><small>kg aujourd'hui</small></div>
      <div class="stat t-teal"><span>${lost !== null ? `${lost >= 0 ? '−' : '+'}${num(Math.abs(lost))}` : '—'}</span><small>kg d'écart</small></div>
      <div class="stat t-pink"><span>${remaining !== null ? (remaining > 0 ? num(remaining) : '🎯') : '—'}</span><small>${remaining !== null && remaining <= 0 ? 'objectif atteint !' : 'kg avant l\'objectif'}</small></div>
    </section>
    <section class="card">
      <div class="card-head"><h3>⚖️ Mon poids</h3></div>
      ${lineChart(points, { goal: p.goalWeight })}
      <form class="inline-form" data-form="weight">
        <input type="date" name="date" value="${todayISO()}" required aria-label="Date">
        <input name="kg" inputmode="decimal" placeholder="kg" required aria-label="Poids en kg">
        <button class="btn btn-primary" type="submit">Ajouter</button>
      </form>
      <p class="muted small">Pèse-toi une fois par semaine, le matin à jeun : la tendance compte plus qu'un chiffre isolé.</p>
      ${weights.length ? `
        <ul class="history">
          ${weights.slice(0, 8).map((w, i) => {
            const prev = weights[i + 1];
            const diff = prev ? w.kg - prev.kg : null;
            return `<li><span>${capitalize(formatShort(w.date))}</span><strong>${num(w.kg)} kg</strong>
              <span class="${diff < 0 ? 'down' : diff > 0 ? 'up' : ''}">${diff !== null ? `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${num(Math.abs(diff))}` : ''}</span>
              <button class="icon-btn" data-action="del-weight" data-date="${w.date}" aria-label="Supprimer">🗑</button></li>`;
          }).join('')}
        </ul>` : ''}
    </section>
    <section class="card">
      <div class="card-head"><h3>📐 Mes mensurations (cm)</h3></div>
      <form data-form="measure">
        <label class="field"><span>Date</span><input type="date" name="date" value="${todayISO()}" required></label>
        <div class="grid-4">
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
    </section>`;
}

function rewardCard(r) {
  const m = metrics();
  const info = METRIC_INFO[r.type];
  const pct = Math.round(progressOf(r) * 100);
  const unlocked = !!r.unlockedAt;
  return `
    <li class="badge-card ${unlocked ? 'unlocked' : ''} ${r.claimed ? 'claimed' : ''}">
      <span class="badge-icon">${unlocked ? BADGE_ICON[r.type] : '🔒'}</span>
      <div class="badge-body">
        <strong>${esc(r.label)}</strong>
        ${r.reward ? `<span class="badge-reward">🎁 ${esc(r.reward)}</span>` : ''}
        ${unlocked
          ? `<small>Débloqué ${relDay(r.unlockedAt).toLowerCase() === 'aujourd\'hui' ? 'aujourd\'hui' : `le ${formatShort(r.unlockedAt)}`}</small>`
          : `<div class="bar"><span style="width:${pct}%"></span></div><small>${info.icon} ${num(Math.min(m[r.type], r.threshold))}/${num(r.threshold)} ${info.unit}</small>`}
        ${unlocked && r.reward && !r.claimed ? `<button class="btn btn-primary btn-small" data-action="claim" data-id="${r.id}">Récompense reçue ✓</button>` : ''}
        ${r.claimed ? '<small class="ok">Récompense reçue 💝</small>' : ''}
      </div>
      <button class="icon-btn" data-action="edit-reward" data-id="${r.id}" aria-label="Modifier">✏️</button>
    </li>`;
}

function viewRewards() {
  const state = getState();
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
    ${unlocked.length ? `<h3 class="section-title">Débloqués</h3><ul class="badges">${unlocked.map(rewardCard).join('')}</ul>` : ''}
    <h3 class="section-title">À venir</h3>
    <ul class="badges">${locked.map(rewardCard).join('') || '<li class="muted">Tout est débloqué, bravo !</li>'}</ul>
    <button class="btn btn-outline btn-block" data-action="new-reward">＋ Créer mon propre palier</button>
    <p class="muted small center">Touche ✏️ pour changer une récompense : c'est toi qui décides !</p>`;
}

function rewardForm(r) {
  return `
    <form data-form="reward" data-id="${r?.id || ''}">
      <h2>${r ? 'Modifier le palier' : 'Nouveau palier'}</h2>
      <label class="field"><span>Nom du palier</span><input name="label" value="${esc(r?.label || '')}" placeholder="ex. Premier 10 km" required></label>
      <div class="row">
        <label class="field"><span>Type</span>
          <select name="type">${Object.entries(METRIC_INFO).map(([k, v]) => `<option value="${k}" ${r?.type === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
        <label class="field"><span>Seuil</span><input name="threshold" inputmode="decimal" value="${r ? num(r.threshold) : ''}" required></label>
      </div>
      <label class="field"><span>Ma récompense</span><input name="reward" value="${esc(r?.reward || '')}" placeholder="ex. Un nouveau livre 📚"></label>
      <button class="btn btn-primary btn-block" type="submit">Enregistrer</button>
      ${r ? `<button class="btn btn-ghost btn-block" type="button" data-action="del-reward" data-id="${r.id}">Supprimer ce palier</button>` : ''}
      <button class="btn btn-ghost btn-block" type="button" data-close>Annuler</button>
    </form>`;
}

function viewSettings() {
  const p = getState().profile;
  return `
    <header class="page-head"><h1>Réglages</h1></header>
    <section class="card">
      <h3>📅 Calendrier Apple</h3>
      <p>Toutes tes séances et tes pesées, avec un rappel ${p.alarmMinutes ? `${p.alarmMinutes >= 60 ? `${p.alarmMinutes / 60} h` : `${p.alarmMinutes} min`} avant chaque séance` : 'à l\'heure de chaque séance'}.</p>
      ${calendarHelp()}
      <button class="btn btn-primary btn-block" data-action="calendar">📅 Ajouter au Calendrier</button>
      <p class="muted small">Tu as changé tes jours ou ton heure ? Supprime d'abord les anciens événements Élan 10K de ton calendrier, puis ajoute à nouveau le fichier.</p>
    </section>
    <form class="card" data-form="profile">
      <h3>👤 Mon programme</h3>
      ${profileFields(p)}
      <button class="btn btn-primary btn-block" type="submit">Enregistrer</button>
    </form>
    <section class="card">
      <h3>💾 Mes données</h3>
      <p class="muted">Tes données restent sur ce téléphone. Fais une sauvegarde de temps en temps.</p>
      <button class="btn btn-outline btn-block" data-action="export">Exporter une sauvegarde</button>
      <label class="btn btn-outline btn-block file-btn">Importer une sauvegarde<input type="file" accept="application/json,.json" data-action="import" hidden></label>
      <button class="btn btn-ghost btn-block danger" data-action="reset">Tout effacer</button>
    </section>
    <p class="muted small center">Élan 10K · version 1</p>`;
}

// --- Actions ------------------------------------------------------------------------------

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const state = getState();
  const fd = new FormData(form);
  const kind = form.dataset.form;

  if (kind === 'onboarding' || kind === 'profile') {
    const profile = readProfile(form);
    if (!profile) return;
    const first = !state.profile;
    state.profile = profile;
    save();
    if (first) {
      location.hash = '#/';
      render();
      openModal(`
        <div class="celebrate">
          <div class="badge-big">📅</div>
          <h2>Tout est prêt !</h2>
          <p>Ajoute tes 48 séances et tes pesées à ton Calendrier Apple pour recevoir les rappels.</p>
          ${calendarHelp()}
          <button class="btn btn-primary btn-block" data-action="calendar">📅 Ajouter au Calendrier</button>
          <button class="btn btn-ghost btn-block" data-close>Plus tard</button>
        </div>`);
    } else {
      toast('Réglages enregistrés ✓');
      render();
    }
    return;
  }

  if (kind === 'log') {
    const id = form.dataset.id;
    const session = findSession(id);
    const distance = isRun(session) ? parseNum(fd.get('distanceKm')) : null;
    if (isRun(session) && !distance) { toast('Indique la distance 🙏'); return; }
    state.logs[id] = {
      date: fd.get('date'),
      distanceKm: distance,
      durationMin: parseNum(fd.get('durationMin')),
      feeling: Number(fd.get('feeling')) || null,
      note: fd.get('note').trim(),
    };
    state.editing = false;
    save();
    render();
    toast('Séance enregistrée, bravo ! 💪');
    afterProgress();
    return;
  }

  if (kind === 'extra') {
    const distance = parseNum(fd.get('distanceKm'));
    if (!distance) { toast('Indique la distance 🙏'); return; }
    state.extraRuns.push({
      id: uid(),
      date: fd.get('date'),
      distanceKm: distance,
      durationMin: parseNum(fd.get('durationMin')),
      feeling: Number(fd.get('feeling')) || null,
      note: fd.get('note').trim(),
    });
    save();
    render();
    toast('Course ajoutée 🏃');
    afterProgress();
    return;
  }

  if (kind === 'weight') {
    const kg = parseNum(fd.get('kg'));
    if (!kg || kg < 25 || kg > 300) { toast('Poids invalide'); return; }
    const date = fd.get('date');
    state.weights = state.weights.filter((w) => w.date !== date);
    state.weights.push({ date, kg });
    save();
    render();
    toast('Pesée enregistrée ✓');
    return;
  }

  if (kind === 'measure') {
    const row = { id: uid(), date: fd.get('date') };
    let any = false;
    for (const mm of MEASURES) {
      const v = parseNum(fd.get(mm.key));
      if (v) { row[mm.key] = v; any = true; }
    }
    if (!any) { toast('Ajoute au moins une mesure'); return; }
    state.measures.push(row);
    save();
    render();
    toast('Mensurations enregistrées ✓');
    return;
  }

  if (kind === 'reward') {
    const threshold = parseNum(fd.get('threshold'));
    if (!threshold || threshold <= 0) { toast('Seuil invalide'); return; }
    const data = { label: fd.get('label').trim(), type: fd.get('type'), threshold, reward: fd.get('reward').trim() };
    const existing = state.rewards.find((r) => r.id === form.dataset.id);
    if (existing) {
      const changedGoal = existing.type !== data.type || existing.threshold !== data.threshold;
      Object.assign(existing, data);
      if (changedGoal) { existing.unlockedAt = null; existing.claimed = false; }
    } else {
      state.rewards.push({ id: uid(), ...data, unlockedAt: null, claimed: false });
    }
    save();
    document.querySelector('.modal-backdrop')?.remove();
    document.body.classList.remove('no-scroll');
    render();
    afterProgress();
  }
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'INPUT') return;
  const state = getState();
  const action = el.dataset.action;

  switch (action) {
    case 'calendar':
      downloadCalendar();
      break;
    case 'guided': {
      const s = findSession(el.dataset.id);
      const place = s.renfoPhase === 'D' ? 'maison' : state.profile.renfoPlace;
      startGuidedWorkout({
        title: s.title,
        steps: renfoSteps(s.renfoPhase, place),
        onFinish: () => {
          state.logs[s.id] = { date: todayISO(), distanceKm: null, durationMin: s.durationMin, feeling: null, note: '' };
          save();
          render();
          toast('Séance de renfo enregistrée 💪');
          afterProgress();
        },
      });
      break;
    }
    case 'edit-log':
      state.editing = true;
      render();
      state.editing = false;
      break;
    case 'undo-log':
      if (confirm('Annuler cette séance ?')) {
        delete state.logs[el.dataset.id];
        save();
        render();
      }
      break;
    case 'del-extra':
      if (confirm('Supprimer cette course ?')) {
        state.extraRuns = state.extraRuns.filter((r) => r.id !== el.dataset.id);
        save();
        render();
      }
      break;
    case 'del-weight':
      state.weights = state.weights.filter((w) => w.date !== el.dataset.date);
      save();
      render();
      break;
    case 'del-measure':
      state.measures = state.measures.filter((m) => m.id !== el.dataset.id);
      save();
      render();
      break;
    case 'claim': {
      const r = state.rewards.find((x) => x.id === el.dataset.id);
      r.claimed = true;
      save();
      render();
      toast('Profite bien, tu l\'as mérité ! 💝');
      break;
    }
    case 'edit-reward':
      openModal(rewardForm(state.rewards.find((x) => x.id === el.dataset.id)));
      break;
    case 'new-reward':
      openModal(rewardForm(null));
      break;
    case 'del-reward':
      if (confirm('Supprimer ce palier ?')) {
        state.rewards = state.rewards.filter((x) => x.id !== el.dataset.id);
        save();
        document.querySelector('.modal-backdrop')?.remove();
        document.body.classList.remove('no-scroll');
        render();
      }
      break;
    case 'export': {
      const { editing, ...data } = state;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `elan-10k-sauvegarde-${todayISO()}.json`;
      a.click();
      break;
    }
    case 'reset':
      if (confirm('Effacer toutes tes données ? Cette action est définitive.')) {
        resetState();
        location.hash = '#/';
        render();
      }
      break;
    default:
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.action === 'place') {
    getState().profile.renfoPlace = el.value;
    save();
    render();
  }
  if (el.dataset.action === 'import' && el.files[0]) {
    el.files[0].text().then((text) => {
      try {
        const data = JSON.parse(text);
        if (!data.profile || !data.logs) throw new Error('format');
        if (!confirm('Remplacer tes données actuelles par cette sauvegarde ?')) return;
        replaceState(data);
        render();
        toast('Sauvegarde importée ✓');
      } catch (err) {
        toast('Fichier de sauvegarde invalide');
      }
    });
  }
});

// --- Démarrage ----------------------------------------------------------------------------

render();
if (getState().profile) afterProgress();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
