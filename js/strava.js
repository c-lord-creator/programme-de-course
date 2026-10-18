// Connexion à Strava : autorisation, jetons, synchronisation des activités
// et association automatique aux séances du programme.

import {
  getState, save, program, sessionDate, isRun, findSession, daysBetween, toISO, addDays, parseDate,
  RUN_SPORTS, RENFO_SPORTS,
} from './store.js';

const API = 'https://www.strava.com/api/v3';
const OAUTH = 'https://www.strava.com/oauth';
const SCOPE = 'read,activity:read_all';
const STATE_TAG = 'elan10k';

export function redirectUri() {
  return `${location.origin}${location.pathname}`;
}

export function isConnected() {
  return !!getState().strava?.refreshToken;
}

export function hasKeys() {
  const s = getState().strava;
  return !!(s?.clientId && s?.clientSecret);
}

export function saveKeys(clientId, clientSecret) {
  const st = getState();
  st.strava = { ...(st.strava || {}), clientId: clientId.trim(), clientSecret: clientSecret.trim() };
  save();
}

export function authorizeUrl() {
  const { clientId } = getState().strava;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    approval_prompt: 'auto',
    scope: SCOPE,
    state: STATE_TAG,
  });
  return `${OAUTH}/authorize?${params}`;
}

// Retour de Strava après autorisation : ?state=elan10k&code=...&scope=...
export function readCallback() {
  const params = new URLSearchParams(location.search);
  if (params.get('state') !== STATE_TAG) return null;
  const result = { code: params.get('code'), error: params.get('error'), scope: params.get('scope') || '' };
  history.replaceState(null, '', redirectUri() + location.hash);
  return result;
}

async function tokenRequest(body) {
  const { clientId, clientSecret } = getState().strava;
  const res = await fetch(`${OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Erreur Strava ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function storeTokens(data) {
  const st = getState();
  st.strava = {
    ...st.strava,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athlete: data.athlete
      ? { id: data.athlete.id, firstname: data.athlete.firstname, lastname: data.athlete.lastname, profile: data.athlete.profile_medium }
      : st.strava.athlete,
  };
  save();
}

export async function exchangeCode(code) {
  storeTokens(await tokenRequest({ code: code.trim(), grant_type: 'authorization_code' }));
}

async function accessToken() {
  const s = getState().strava;
  if (!s?.refreshToken) throw new Error('Strava n\'est pas connecté');
  if (s.accessToken && s.expiresAt - 120 > Date.now() / 1000) return s.accessToken;
  storeTokens(await tokenRequest({ refresh_token: s.refreshToken, grant_type: 'refresh_token' }));
  return getState().strava.accessToken;
}

async function api(path) {
  const token = await accessToken();
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    // Jeton refusé : on force un renouvellement une fois.
    getState().strava.expiresAt = 0;
    const retry = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await accessToken()}` } });
    if (!retry.ok) throw new Error(`Erreur Strava ${retry.status}`);
    return retry.json();
  }
  if (res.status === 429) throw new Error('Strava limite le nombre de demandes, réessaie dans quelques minutes.');
  if (!res.ok) throw new Error(`Erreur Strava ${res.status}`);
  return res.json();
}

export function disconnect() {
  const st = getState();
  const token = st.strava?.accessToken;
  if (token) {
    fetch(`${OAUTH}/deauthorize`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }
  st.strava = { clientId: st.strava?.clientId, clientSecret: st.strava?.clientSecret };
  save();
}

function toActivity(a, previous) {
  return {
    ...previous,
    id: String(a.id),
    name: a.name,
    sportType: a.sport_type || a.type,
    date: a.start_date_local.slice(0, 10),
    startLocal: a.start_date_local,
    distanceKm: Math.round(a.distance / 10) / 100,
    movingMin: Math.round(a.moving_time / 6) / 10,
    elapsedMin: Math.round(a.elapsed_time / 6) / 10,
    elevation: a.total_elevation_gain,
    avgHr: a.average_heartrate || null,
    maxHr: a.max_heartrate || null,
    avgSpeed: a.average_speed,
    polyline: a.map?.summary_polyline || '',
  };
}

// Récupère les activités récentes et les associe aux séances.
export async function sync() {
  const st = getState();
  const s = st.strava;
  const first = !s.lastSync;
  const fromDate = first
    ? addDays(parseDate(st.cycle.startDate), -14)
    : new Date((s.lastSync - 3 * 86400) * 1000);
  const after = Math.floor(fromDate.getTime() / 1000);
  let page = 1;
  let added = 0;
  for (;;) {
    const list = await api(`/athlete/activities?after=${after}&per_page=100&page=${page}`);
    for (const a of list) {
      const id = String(a.id);
      if (!st.activities[id]) added++;
      st.activities[id] = toActivity(a, st.activities[id]);
    }
    if (list.length < 100) break;
    page++;
  }
  s.lastSync = Math.floor(Date.now() / 1000);
  const linked = linkActivities();
  save();
  return { added, linked };
}

export async function fetchDetails(id) {
  const st = getState();
  const a = st.activities[id];
  if (a?.splits) return a;
  const d = await api(`/activities/${id}`);
  st.activities[id] = {
    ...toActivity(d, a),
    calories: d.calories || null,
    splits: (d.splits_metric || []).map((sp) => ({
      km: Math.round(sp.distance / 10) / 100,
      seconds: sp.moving_time,
      hr: sp.average_heartrate || null,
      elevation: sp.elevation_difference,
    })),
  };
  save();
  return st.activities[id];
}

// --- Association activités ↔ séances -----------------------------------------------------

function candidates(activity, kindIsRun) {
  const st = getState();
  if (!st.cycle) return [];
  const out = [];
  for (const w of program()) {
    for (const s of w.sessions) {
      if (isRun(s) !== kindIsRun) continue;
      const log = st.logs[s.id];
      if (log && (log.activityId || log.date !== activity.date)) continue;
      const gap = Math.abs(daysBetween(sessionDate(s), activity.date));
      if (gap > 3) continue;
      out.push({ s, gap, manual: !!log });
    }
  }
  return out;
}

function pickSession(activity, kindIsRun) {
  const list = candidates(activity, kindIsRun);
  if (!list.length) return null;
  list.sort((a, b) => {
    if (a.manual !== b.manual) return a.manual ? -1 : 1; // séance déjà notée à la main le même jour
    if (kindIsRun) {
      const aLong = (a.s.distanceKm || 0) * 0.75 <= activity.distanceKm && a.s.distanceKm ? 1 : 0;
      const bLong = (b.s.distanceKm || 0) * 0.75 <= activity.distanceKm && b.s.distanceKm ? 1 : 0;
      if (a.gap === b.gap && aLong !== bLong) return bLong - aLong;
    }
    return a.gap - b.gap;
  });
  return list[0].s;
}

export function linkTo(activityId, sessionId) {
  const st = getState();
  const a = st.activities[activityId];
  unlink(activityId, false);
  a.ignored = false;
  if (!sessionId) {
    a.manualUnlink = true;
    save();
    return;
  }
  const s = findSession(sessionId);
  const prev = st.logs[sessionId];
  if (prev?.activityId && prev.activityId !== activityId) unlink(prev.activityId, true);
  st.logs[sessionId] = {
    date: a.date,
    distanceKm: isRun(s) ? a.distanceKm : null,
    durationMin: a.movingMin,
    feeling: prev?.feeling || null,
    note: prev?.note || '',
    activityId,
  };
  a.linkedTo = sessionId;
  a.manualUnlink = false;
  save();
}

export function unlink(activityId, manual = true) {
  const st = getState();
  const a = st.activities[activityId];
  if (!a?.linkedTo) return;
  const log = st.logs[a.linkedTo];
  if (log?.activityId === activityId) delete st.logs[a.linkedTo];
  a.linkedTo = null;
  if (manual) a.manualUnlink = true;
  save();
}

export function linkActivities() {
  const st = getState();
  let linked = 0;
  const list = Object.values(st.activities).sort((a, b) => a.startLocal.localeCompare(b.startLocal));
  for (const a of list) {
    if (a.linkedTo || a.manualUnlink || a.ignored) continue;
    const run = RUN_SPORTS.includes(a.sportType);
    const renfo = RENFO_SPORTS.includes(a.sportType);
    if (!run && !renfo) continue;
    if (st.cycle && a.date < st.cycle.startDate) continue;
    const s = pickSession(a, run);
    if (s) {
      linkTo(a.id, s.id);
      linked++;
    }
  }
  return linked;
}

// --- Tracé GPS ---------------------------------------------------------------------------

export function decodePolyline(str) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < str.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte;
      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

export function routeSvg(polyline, { size = 300, height = 200, cls = 'route' } = {}) {
  const pts = decodePolyline(polyline);
  if (pts.length < 2) return '';
  const meanLat = pts.reduce((m, p) => m + p[0], 0) / pts.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const xy = pts.map(([la, ln]) => [ln * k, -la]);
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX || 1e-6;
  const h = Math.max(...ys) - minY || 1e-6;
  const pad = 12;
  const scale = Math.min((size - pad * 2) / w, (height - pad * 2) / h);
  const ox = (size - w * scale) / 2;
  const oy = (height - h * scale) / 2;
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${(ox + (x - minX) * scale).toFixed(1)},${(oy + (y - minY) * scale).toFixed(1)}`).join('');
  const [sx, sy] = [ox + (xy[0][0] - minX) * scale, oy + (xy[0][1] - minY) * scale];
  const last = xy[xy.length - 1];
  const [ex, ey] = [ox + (last[0] - minX) * scale, oy + (last[1] - minY) * scale];
  return `<svg class="${cls}" viewBox="0 0 ${size} ${height}" role="img" aria-label="Tracé du parcours">
    <path d="${d}" class="route-line"/>
    <circle cx="${sx}" cy="${sy}" r="5" class="route-start"/>
    <circle cx="${ex}" cy="${ey}" r="5" class="route-end"/>
  </svg>`;
}

export function lastSyncText() {
  const t = getState().strava?.lastSync;
  if (!t) return 'jamais';
  const d = new Date(t * 1000);
  const today = toISO(new Date());
  const day = toISO(d) === today ? 'aujourd\'hui' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `${day} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}
