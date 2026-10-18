import { renfoSteps, intervalSteps } from './program.js';
import {
  getState, save, replaceState, resetState, uid, parseDate, toISO, todayISO, addDays, mondayOf,
  findSession, isRun, refreshRewards, startNewCycle, daily, setDaily,
} from './store.js';
import { bindCharts } from './chart.js';
import { downloadCalendar } from './ics.js';
import { startGuidedWorkout } from './timer.js';
import * as strava from './strava.js';
import { importHealthFile } from './health.js';
import * as V from './views.js';
import { ui, esc, parseNum, toast, openModal, closeModal } from './ui.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');

// --- Récompenses débloquées -------------------------------------------------------

function celebrate(queue) {
  if (!queue.length) return;
  const [r, ...rest] = queue;
  const confetti = Array.from({ length: 36 }, (_, i) =>
    `<i style="left:${Math.random() * 100}%;animation-delay:${Math.random() * 0.6}s;background:var(--c${i % 5})"></i>`).join('');
  openModal(`
    <div class="confetti">${confetti}</div>
    <div class="celebrate">
      <div class="badge-big">${V.BADGE_ICON[r.type]}</div>
      <p class="eyebrow">Palier débloqué !</p>
      <h2>${esc(r.label)}</h2>
      ${r.reward ? `<div class="reward-box"><span>Ta récompense</span><strong>${esc(r.reward)}</strong></div>` : '<p>Un nouveau badge pour ta collection. Continue comme ça !</p>'}
      <button class="btn btn-primary btn-block" data-close>${rest.length ? 'Suivant' : 'Génial !'}</button>
    </div>`, (wrap) => {
    wrap.querySelector('[data-close]').addEventListener('click', () => setTimeout(() => celebrate(rest), 50));
  });
  if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
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
  { route: 'journal', icon: '🗒️', label: 'Journal' },
  { route: 'suivi', icon: '⚖️', label: 'Suivi' },
  { route: 'recompenses', icon: '🎁', label: 'Récompenses' },
];

const TAB_OF = { seance: 'programme', nouveau: 'programme', course: 'journal', activite: 'journal', conseils: '', reglages: '', strava: '', sante: '' };

function currentRoute() {
  const hash = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [name, ...rest] = hash.split('/');
  return { name: name || '', param: rest.join('/') };
}

function renderNav(active) {
  const tab = TAB_OF[active] ?? active;
  nav.innerHTML = TABS.map((t) =>
    `<a href="#/${t.route}" class="${t.route === tab ? 'active' : ''}"><span>${t.icon}</span>${t.label}</a>`).join('');
}

function applyTheme() {
  const theme = getState().profile?.theme;
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

let codeScreen = null;

function render() {
  const state = getState();
  applyTheme();
  if (codeScreen) {
    nav.hidden = true;
    app.innerHTML = V.viewStravaCode(codeScreen);
    return;
  }
  if (!state.profile || !state.cycle) {
    nav.hidden = true;
    app.innerHTML = V.viewOnboarding();
    return;
  }
  const route = currentRoute();
  nav.hidden = false;
  renderNav(route.name);
  const views = {
    '': V.viewHome,
    programme: V.viewProgram,
    seance: () => V.viewSession(route.param),
    journal: V.viewJournal,
    activite: () => V.viewActivity(route.param),
    course: V.viewExtraRun,
    suivi: V.viewBody,
    conseils: V.viewAdvice,
    recompenses: V.viewRewards,
    reglages: V.viewSettings,
    strava: V.viewStrava,
    sante: V.viewHealth,
    nouveau: V.viewNewCycle,
  };
  app.innerHTML = (views[route.name] || V.viewHome)();
  bindCharts(app);
  if (route.name === 'activite') loadActivityDetails(route.param);
}

window.addEventListener('hashchange', () => {
  ui.editing = false;
  closeModal();
  render();
  window.scrollTo(0, 0);
});

// --- Strava -------------------------------------------------------------------------

async function runSync({ silent = false } = {}) {
  if (ui.syncing || !strava.isConnected() || !getState().cycle) return;
  ui.syncing = true;
  render();
  try {
    const { added, linked } = await strava.sync();
    if (!silent || added) {
      toast(added ? `${added} nouvelle${added > 1 ? 's' : ''} activité${added > 1 ? 's' : ''} Strava${linked ? ` · ${linked} séance${linked > 1 ? 's' : ''} cochée${linked > 1 ? 's' : ''}` : ''} ✓` : 'Strava est à jour ✓');
    }
  } catch (e) {
    if (!silent) toast(`Strava : ${e.message}`);
    console.warn(e);
  } finally {
    ui.syncing = false;
    render();
    afterProgress();
  }
}

async function loadActivityDetails(id) {
  const a = getState().activities[id];
  if (!a || a.splits || ui.loadingDetails[id] || !strava.isConnected()) return;
  if (!['Run', 'TrailRun', 'VirtualRun'].includes(a.sportType)) return;
  ui.loadingDetails[id] = true;
  try {
    await strava.fetchDetails(id);
  } catch (e) {
    console.warn(e);
  }
  ui.loadingDetails[id] = false;
  if (currentRoute().param === id) render();
}

async function handleStravaCallback() {
  const cb = strava.readCallback();
  if (!cb) return;
  if (cb.error || !cb.code) {
    toast('Connexion Strava annulée');
    return;
  }
  if (!strava.hasKeys()) {
    codeScreen = cb.code;
    return;
  }
  if (!cb.scope.includes('activity:read')) {
    toast('Coche bien l\'accès à tes activités sur la page Strava, puis réessaie.');
    location.hash = '#/strava';
    return;
  }
  try {
    await strava.exchangeCode(cb.code);
    toast('Strava est connecté 🎉');
    location.hash = '#/journal';
    await runSync({ silent: true });
  } catch (e) {
    toast(`Connexion Strava impossible : ${e.message}`);
    location.hash = '#/strava';
  }
}

// --- Formulaires -------------------------------------------------------------------------

function readProfile(form, previous = {}) {
  const fd = new FormData(form);
  const days = fd.getAll('days').map(Number);
  if (days.length !== 4) {
    toast('Choisis exactement 4 jours 🙏');
    return null;
  }
  return {
    ...previous,
    name: fd.get('name').trim(),
    days,
    sessionTime: fd.get('sessionTime'),
    alarmMinutes: Number(fd.get('alarmMinutes')),
    weighDay: Number(fd.get('weighDay')),
    weighTime: fd.get('weighTime'),
    startWeight: parseNum(fd.get('startWeight')),
    goalWeight: parseNum(fd.get('goalWeight')),
    waterGoal: Math.max(Math.round(parseNum(fd.get('waterGoal')) || 8), 1),
    sleepGoal: parseNum(fd.get('sleepGoal')) || 7.5,
    renfoPlace: fd.get('renfoPlace'),
    theme: fd.get('theme') || 'auto',
  };
}

function cycleStart(form) {
  return toISO(mondayOf(parseDate(new FormData(form).get('startDate'))));
}

const forms = {
  onboarding(form, fd) {
    const profile = readProfile(form);
    if (!profile) return;
    const state = getState();
    state.profile = profile;
    startNewCycle(fd.get('planId'), cycleStart(form));
    if (profile.startWeight && !state.weights.length) {
      state.weights.push({ date: todayISO(), kg: profile.startWeight, source: 'profile' });
    }
    save();
    history.replaceState(null, '', '#/');
    render();
    openModal(`
      <div class="celebrate">
        <div class="badge-big">📅</div>
        <h2>Tout est prêt !</h2>
        <p>Ajoute tes 48 séances et tes pesées à ton Calendrier Apple pour recevoir les rappels.</p>
        ${V.calendarHelp()}
        <button class="btn btn-primary btn-block" data-action="calendar">📅 Ajouter au Calendrier</button>
        <a class="btn btn-outline btn-block" href="#/sante">⌚ Importer mes séances Apple Watch</a>
        <button class="btn btn-ghost btn-block" data-close>Plus tard</button>
      </div>`);
  },

  profile(form) {
    const profile = readProfile(form, getState().profile);
    if (!profile) return;
    getState().profile = profile;
    save();
    toast('Préférences enregistrées ✓');
    render();
  },

  cycle(form, fd) {
    if (!confirm('Démarrer ce nouveau programme ?')) return;
    startNewCycle(fd.get('planId'), cycleStart(form));
    location.hash = '#/';
    toast('Nouveau programme lancé 🚀');
    render();
    if (strava.isConnected()) strava.linkActivities();
  },

  log(form, fd) {
    const state = getState();
    const id = form.dataset.id;
    const session = findSession(id);
    const distance = isRun(session) ? parseNum(fd.get('distanceKm')) : null;
    if (isRun(session) && !distance) { toast('Indique la distance 🙏'); return; }
    const prev = state.logs[id];
    state.logs[id] = {
      ...prev,
      date: fd.get('date'),
      distanceKm: distance,
      durationMin: parseNum(fd.get('durationMin')),
      feeling: Number(fd.get('feeling')) || null,
      note: fd.get('note').trim(),
    };
    ui.editing = false;
    save();
    render();
    toast(prev ? 'Séance mise à jour ✓' : 'Séance enregistrée, bravo ! 💪');
    afterProgress();
  },

  move(form, fd) {
    const date = fd.get('date');
    getState().moves[form.dataset.id] = date;
    save();
    render();
    toast(`Séance déplacée au ${parseDate(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`);
  },

  extra(form, fd) {
    const distance = parseNum(fd.get('distanceKm'));
    if (!distance) { toast('Indique la distance 🙏'); return; }
    getState().extraRuns.push({
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
  },

  weight(form, fd) {
    const state = getState();
    const kg = parseNum(fd.get('kg'));
    if (!kg || kg < 25 || kg > 300) { toast('Poids invalide'); return; }
    const date = fd.get('date');
    state.weights = state.weights.filter((w) => w.date !== date);
    state.weights.push({ date, kg });
    save();
    render();
    toast('Pesée enregistrée ✓');
    afterProgress();
  },

  measure(form, fd) {
    const row = { id: uid(), date: fd.get('date') };
    let any = false;
    for (const mm of V.MEASURES) {
      const v = parseNum(fd.get(mm.key));
      if (v) { row[mm.key] = v; any = true; }
    }
    if (!any) { toast('Ajoute au moins une mesure'); return; }
    getState().measures.push(row);
    save();
    render();
    toast('Mensurations enregistrées ✓');
  },

  daily(form, fd) {
    const patch = {};
    const water = parseNum(fd.get('water'));
    const sleep = parseNum(fd.get('sleep'));
    if (water !== null) patch.water = Math.max(Math.round(water), 0);
    if (sleep !== null) patch.sleep = Math.min(Math.max(sleep, 0), 24);
    if (!Object.keys(patch).length) { toast('Indique l\'eau ou le sommeil'); return; }
    setDaily(fd.get('date'), patch);
    render();
    toast('Enregistré ✓');
  },

  reward(form, fd) {
    const state = getState();
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
    closeModal();
    render();
    afterProgress();
  },

  'strava-keys': (form, fd) => {
    const clientId = fd.get('clientId').trim();
    const clientSecret = fd.get('clientSecret').trim();
    if (!/^\d+$/.test(clientId)) { toast('L\'ID client est un nombre'); return; }
    if (clientSecret.length < 20) { toast('Le secret client semble incomplet'); return; }
    strava.saveKeys(clientId, clientSecret);
    location.href = strava.authorizeUrl();
  },

  async 'strava-code'(form, fd) {
    try {
      await strava.exchangeCode(fd.get('code'));
      toast('Strava est connecté 🎉');
      location.hash = '#/journal';
      await runSync({ silent: true });
    } catch (e) {
      toast(`Code refusé : ${e.message}. Recommence la connexion.`);
    }
  },
};

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const handler = forms[form.dataset.form];
  if (handler) handler(form, new FormData(form));
});

// --- Boutons -------------------------------------------------------------------------------

function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast('Copié ✓')).catch(() => toast(text));
  } else {
    toast(text);
  }
}

const actions = {
  calendar: () => downloadCalendar(),
  sync: () => runSync(),

  guided(el) {
    const s = findSession(el.dataset.id);
    const place = s.renfoPhase === 'D' ? 'maison' : getState().profile.renfoPlace;
    startGuidedWorkout({
      title: s.title,
      steps: renfoSteps(s.renfoPhase, place),
      onFinish: () => {
        const state = getState();
        state.logs[s.id] = { ...state.logs[s.id], date: todayISO(), distanceKm: null, durationMin: s.durationMin, feeling: null, note: '' };
        save();
        render();
        toast('Séance de renfo enregistrée 💪');
        afterProgress();
      },
    });
  },

  'interval-timer'(el) {
    const s = findSession(el.dataset.id);
    startGuidedWorkout({
      title: s.title,
      steps: intervalSteps(s),
      doneText: strava.isConnected() ? 'Ta course arrivera depuis Strava à la prochaine synchronisation.' : 'Pense à noter ta distance pour valider la séance.',
      onFinish: () => {
        location.hash = `#/seance/${s.id}`;
        if (strava.isConnected()) runSync();
      },
    });
  },

  'edit-log': () => { ui.editing = true; render(); },
  'cancel-edit': () => { ui.editing = false; render(); },

  'undo-log'(el) {
    if (!confirm('Annuler cette séance ?')) return;
    const state = getState();
    const log = state.logs[el.dataset.id];
    if (log?.activityId) strava.unlink(log.activityId, true);
    delete state.logs[el.dataset.id];
    save();
    render();
  },

  unmove(el) {
    delete getState().moves[el.dataset.id];
    save();
    render();
  },

  'del-extra'(el) {
    if (!confirm('Supprimer cette course ?')) return;
    const state = getState();
    state.extraRuns = state.extraRuns.filter((r) => r.id !== el.dataset.id);
    save();
    render();
  },

  'del-weight'(el) {
    const state = getState();
    state.weights = state.weights.filter((w) => w.date !== el.dataset.date);
    save();
    render();
  },

  'del-measure'(el) {
    const state = getState();
    state.measures = state.measures.filter((m) => m.id !== el.dataset.id);
    save();
    render();
  },

  water(el) {
    const d = daily();
    setDaily(todayISO(), { water: Math.max(d.water + Number(el.dataset.delta), 0) });
    render();
    const goal = getState().profile.waterGoal || 8;
    if (Number(el.dataset.delta) > 0 && daily().water === goal) toast('Objectif hydratation atteint 💧');
  },

  sleep(el) {
    const d = daily();
    const base = d.sleep ?? (getState().profile.sleepGoal || 7.5) - Number(el.dataset.delta);
    setDaily(todayISO(), { sleep: Math.min(Math.max(base + Number(el.dataset.delta), 0), 14) });
    render();
  },

  claim(el) {
    const r = getState().rewards.find((x) => x.id === el.dataset.id);
    r.claimed = true;
    save();
    render();
    toast('Profite bien, tu l\'as mérité ! 💝');
  },

  'edit-reward': (el) => openModal(V.rewardForm(getState().rewards.find((x) => x.id === el.dataset.id))),
  'new-reward': () => openModal(V.rewardForm(null)),

  'del-reward'(el) {
    if (!confirm('Supprimer ce palier ?')) return;
    const state = getState();
    state.rewards = state.rewards.filter((x) => x.id !== el.dataset.id);
    save();
    closeModal();
    render();
  },

  'more-journal': () => { ui.journalLimit += 20; render(); },

  'shift-week'() {
    if (!confirm('Décaler tout le programme d\'une semaine ? Les séances déjà faites restent cochées.')) return;
    const c = getState().cycle;
    c.startDate = toISO(addDays(parseDate(c.startDate), 7));
    save();
    render();
    toast('Programme décalé d\'une semaine. Pense à mettre à jour ton calendrier.');
  },

  'strava-disconnect'() {
    if (!confirm('Déconnecter Strava ? Les activités déjà importées sont conservées.')) return;
    strava.disconnect();
    render();
  },

  copy: (el) => copyText(el.dataset.text),

  export() {
    const { strava: _secret, ...data } = getState();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `elan-10k-sauvegarde-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  reset() {
    if (!confirm('Effacer toutes tes données ? Cette action est définitive.')) return;
    resetState();
    location.hash = '#/';
    render();
  },
};

document.addEventListener('click', (e) => {
  const copy = e.target.closest('code[data-copy]');
  if (copy) { copyText(copy.dataset.copy); return; }
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el);
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.action === 'place') {
    getState().profile.renfoPlace = el.value;
    save();
    render();
  }
  if (el.dataset.action === 'link-activity') {
    const a = getState().activities[el.dataset.id];
    if (el.value === '__ignore') {
      strava.unlink(a.id, true);
      a.ignored = true;
      save();
    } else {
      strava.linkTo(a.id, el.value || null);
    }
    render();
    toast('Association mise à jour ✓');
    afterProgress();
  }
  if (el.dataset.action === 'import-health' && el.files[0]) {
    runHealthImport(el.files[0]);
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

// --- Import Apple Santé ---------------------------------------------------------------------

async function runHealthImport(file) {
  ui.importProgress = 0;
  render();
  let lastPaint = 0;
  try {
    const r = await importHealthFile(file, (p) => {
      ui.importProgress = p;
      // On ne redessine pas à chaque morceau lu : 4 fois par seconde suffit.
      if (Date.now() - lastPaint > 250) {
        lastPaint = Date.now();
        const label = document.querySelector('.card strong');
        if (currentRoute().name === 'sante') render();
        else if (label) label.textContent = `Import en cours… ${Math.round(p * 100)} %`;
      }
    });
    ui.importProgress = null;
    render();
    const parts = [
      `${r.added} nouvelle${r.added > 1 ? 's' : ''} séance${r.added > 1 ? 's' : ''}`,
      r.linked ? `${r.linked} cochée${r.linked > 1 ? 's' : ''} dans le programme` : null,
      r.weights ? `${r.weights} pesée${r.weights > 1 ? 's' : ''}` : null,
      r.nights ? `${r.nights} nuit${r.nights > 1 ? 's' : ''} de sommeil` : null,
    ].filter(Boolean);
    openModal(`
      <div class="celebrate">
        <div class="badge-big">⌚</div>
        <h2>Import terminé</h2>
        <ul class="bullets left">${parts.map((x) => `<li>${x}</li>`).join('')}</ul>
        ${r.workouts === 0 ? '<p class="muted">Aucune course ni séance de renfo trouvée sur les 12 derniers mois.</p>' : ''}
        <a class="btn btn-primary btn-block" href="#/journal">Voir mon journal</a>
        <button class="btn btn-ghost btn-block" data-close>Fermer</button>
      </div>`, (wrap) => {
      wrap.querySelector('[data-close]').addEventListener('click', () => setTimeout(afterProgress, 50));
      wrap.querySelector('a').addEventListener('click', () => setTimeout(afterProgress, 300));
    });
  } catch (e) {
    console.warn(e);
    ui.importProgress = null;
    render();
    toast(`Import impossible : ${e.message}`);
  }
}

// --- Démarrage ----------------------------------------------------------------------------

async function boot() {
  await handleStravaCallback();
  render();
  if (getState().cycle) afterProgress();
  const s = getState().strava;
  if (s?.refreshToken && (!s.lastSync || Date.now() / 1000 - s.lastSync > 600)) runSync({ silent: true });
}

document.addEventListener('visibilitychange', () => {
  const s = getState().strava;
  if (document.visibilityState === 'visible' && s?.refreshToken && Date.now() / 1000 - (s.lastSync || 0) > 600) {
    runSync({ silent: true });
  }
});

boot();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
