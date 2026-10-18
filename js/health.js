// Import de l'export de l'app Santé (Apple Watch / iPhone) :
// séances (courses avec tracé GPS, renfo), poids et sommeil.
// Le fichier .zip est lu en continu, sans le charger en entier en mémoire.

import { getState, save, todayISO, toISO, addDays } from './store.js';
import { linkActivities } from './strava.js';

const RUN = { HKWorkoutActivityTypeRunning: 'Course' };
const RENFO = {
  HKWorkoutActivityTypeTraditionalStrengthTraining: ['WeightTraining', 'Renforcement musculaire'],
  HKWorkoutActivityTypeFunctionalStrengthTraining: ['WeightTraining', 'Renforcement fonctionnel'],
  HKWorkoutActivityTypeHighIntensityIntervalTraining: ['HighIntensityIntervalTraining', 'HIIT'],
  HKWorkoutActivityTypeCoreTraining: ['Workout', 'Gainage'],
  HKWorkoutActivityTypeCrossTraining: ['Workout', 'Cross training'],
  HKWorkoutActivityTypeMixedCardio: ['Workout', 'Cardio'],
  HKWorkoutActivityTypePilates: ['Pilates', 'Pilates'],
  HKWorkoutActivityTypeYoga: ['Yoga', 'Yoga'],
};

export function isSupported() {
  return typeof DecompressionStream !== 'undefined' && typeof TextDecoderStream !== 'undefined';
}

// --- Lecture du .zip ------------------------------------------------------------------------

function u64(view, offset) {
  return Number(view.getBigUint64(offset, true));
}

async function readZipEntries(file) {
  const tailSize = Math.min(file.size, 65536 + 22);
  const tail = new DataView(await file.slice(file.size - tailSize).arrayBuffer());
  let eocd = -1;
  for (let i = tailSize - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Ce fichier n\'est pas un .zip valide.');
  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOffset = tail.getUint32(eocd + 16, true);
  if (cdOffset === 0xffffffff && eocd >= 20 && tail.getUint32(eocd - 20, true) === 0x07064b50) {
    const z64Offset = u64(tail, eocd - 12);
    const z64 = new DataView(await file.slice(z64Offset, z64Offset + 56).arrayBuffer());
    cdSize = u64(z64, 40);
    cdOffset = u64(z64, 48);
  }
  const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
  const decoder = new TextDecoder();
  const entries = [];
  let p = 0;
  while (p + 46 <= cd.byteLength && cd.getUint32(p, true) === 0x02014b50) {
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    const entry = {
      method: cd.getUint16(p + 10, true),
      compSize: cd.getUint32(p + 20, true),
      size: cd.getUint32(p + 24, true),
      offset: cd.getUint32(p + 42, true),
      name: decoder.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen)),
    };
    // Champs zip64 pour les très gros fichiers
    let e = p + 46 + nameLen;
    const end = e + extraLen;
    while (e + 4 <= end) {
      const id = cd.getUint16(e, true);
      const len = cd.getUint16(e + 2, true);
      if (id === 0x0001) {
        let q = e + 4;
        if (entry.size === 0xffffffff) { entry.size = u64(cd, q); q += 8; }
        if (entry.compSize === 0xffffffff) { entry.compSize = u64(cd, q); q += 8; }
        if (entry.offset === 0xffffffff) { entry.offset = u64(cd, q); }
      }
      e += 4 + len;
    }
    entries.push(entry);
    p = end + commentLen;
  }
  return entries;
}

async function entryStream(file, entry, onBytes) {
  const lh = new DataView(await file.slice(entry.offset, entry.offset + 30).arrayBuffer());
  const start = entry.offset + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
  let stream = file.slice(start, start + entry.compSize).stream();
  if (onBytes) {
    stream = stream.pipeThrough(new TransformStream({
      transform(chunk, ctrl) { onBytes(chunk.byteLength); ctrl.enqueue(chunk); },
    }));
  }
  if (entry.method === 8) stream = stream.pipeThrough(new DecompressionStream('deflate-raw'));
  else if (entry.method !== 0) throw new Error('Format de compression non pris en charge.');
  return stream;
}

async function entryText(file, entry) {
  return new Response(await entryStream(file, entry)).text();
}

// --- Lecture du XML ligne par ligne ----------------------------------------------------------

async function forEachLine(stream, onLine) {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let rest = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const text = rest + value;
    let start = 0;
    let idx;
    while ((idx = text.indexOf('\n', start)) !== -1) {
      onLine(text.slice(start, idx));
      start = idx + 1;
    }
    rest = text.slice(start);
  }
  if (rest) onLine(rest);
}

function attrs(line) {
  const out = {};
  const re = /([\w:]+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(line))) out[m[1]] = m[2];
  return out;
}

// "2026-10-05 18:42:10 +0200" -> heure locale de l'enregistrement
function localStamp(s) {
  return s ? s.slice(0, 19).replace(' ', 'T') : '';
}

function toKm(value, unit) {
  const v = parseFloat(value);
  if (!Number.isFinite(v)) return null;
  if (unit === 'mi') return v * 1.609344;
  if (unit === 'm') return v / 1000;
  return v;
}

function toMinutes(value, unit) {
  const v = parseFloat(value);
  if (!Number.isFinite(v)) return null;
  if (unit === 's') return v / 60;
  if (unit === 'h' || unit === 'hr') return v * 60;
  return v;
}

function minutesBetween(a, b) {
  return (new Date(localStamp(b)) - new Date(localStamp(a))) / 60000;
}

function parseExport(stream, cutoff) {
  const workouts = [];
  const weights = {};
  const sleep = {}; // date de réveil -> { source -> minutes }
  let current = null;

  const finish = (w) => {
    if (w.date >= cutoff) workouts.push(w);
  };

  return forEachLine(stream, (raw) => {
    const t = raw.trimStart();
    if (current) {
      if (t.startsWith('<WorkoutStatistics')) {
        const a = attrs(t);
        if (a.type === 'HKQuantityTypeIdentifierDistanceWalkingRunning' && a.sum) current.distanceKm = current.distanceKm || toKm(a.sum, a.unit);
        if (a.type === 'HKQuantityTypeIdentifierHeartRate') {
          current.avgHr = parseFloat(a.average) || null;
          current.maxHr = parseFloat(a.maximum) || null;
        }
        if (a.type === 'HKQuantityTypeIdentifierActiveEnergyBurned' && a.sum) current.calories = parseFloat(a.sum);
      } else if (t.startsWith('<MetadataEntry')) {
        const a = attrs(t);
        if (a.key === 'HKIndoorWorkout') current.indoor = a.value === '1';
        if (a.key === 'HKElevationAscended') {
          const v = parseFloat(a.value);
          current.elevation = /cm/.test(a.value) ? v / 100 : v;
        }
      } else if (t.startsWith('<FileReference')) {
        current.route = attrs(t).path;
      } else if (t.startsWith('</Workout>')) {
        finish(current);
        current = null;
      }
      return;
    }
    if (t.startsWith('<Workout ')) {
      const a = attrs(t);
      const type = a.workoutActivityType;
      if (!RUN[type] && !RENFO[type]) {
        current = t.endsWith('/>') ? null : { skip: true, date: '' };
        return;
      }
      current = {
        type,
        start: localStamp(a.startDate),
        date: a.startDate.slice(0, 10),
        durationMin: toMinutes(a.duration, a.durationUnit) ?? minutesBetween(a.startDate, a.endDate),
        distanceKm: a.totalDistance ? toKm(a.totalDistance, a.totalDistanceUnit) : null,
        calories: a.totalEnergyBurned ? parseFloat(a.totalEnergyBurned) : null,
        source: a.sourceName || '',
      };
      if (t.endsWith('/>')) { finish(current); current = null; }
      return;
    }
    if (t.startsWith('<Record type="HKQuantityTypeIdentifierBodyMass"')) {
      const a = attrs(t);
      const kg = a.unit === 'lb' ? parseFloat(a.value) * 0.45359237 : parseFloat(a.value);
      const date = a.startDate.slice(0, 10);
      if (date >= cutoff && kg > 25 && kg < 300) weights[date] = Math.round(kg * 10) / 10;
      return;
    }
    if (t.startsWith('<Record type="HKCategoryTypeIdentifierSleepAnalysis"')) {
      const a = attrs(t);
      if (!/Asleep/.test(a.value || '')) return;
      const date = a.endDate.slice(0, 10);
      if (date < cutoff) return;
      const night = (sleep[date] = sleep[date] || {});
      night[a.sourceName] = (night[a.sourceName] || 0) + minutesBetween(a.startDate, a.endDate);
    }
  }).then(() => ({ workouts: workouts.filter((w) => !w.skip), weights, sleep }));
}

// --- Tracés GPX : parcours, temps au km, dénivelé -------------------------------------------

function encodeValue(delta) {
  let n = delta;
  n = n < 0 ? ~(n << 1) : n << 1;
  let s = '';
  while (n >= 0x20) {
    s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  return s + String.fromCharCode(n + 63);
}

function encodePolyline(points) {
  let lat = 0;
  let lng = 0;
  let out = '';
  for (const p of points) {
    const iLat = Math.round(p.lat * 1e5);
    const iLng = Math.round(p.lon * 1e5);
    out += encodeValue(iLat - lat) + encodeValue(iLng - lng);
    lat = iLat;
    lng = iLng;
  }
  return out;
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function analyseGpx(text) {
  const points = [];
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g;
  let m;
  while ((m = re.exec(text))) {
    const a = attrs(m[1]);
    const ele = /<ele>([^<]+)<\/ele>/.exec(m[2]);
    const time = /<time>([^<]+)<\/time>/.exec(m[2]);
    points.push({ lat: parseFloat(a.lat), lon: parseFloat(a.lon), ele: ele ? parseFloat(ele[1]) : null, t: time ? Date.parse(time[1]) : null });
  }
  if (points.length < 2) return null;
  let dist = 0;
  let gain = 0;
  let lastEle = points[0].ele;
  const splits = [];
  let splitStart = { dist: 0, t: points[0].t };
  for (let i = 1; i < points.length; i++) {
    dist += haversineKm(points[i - 1], points[i]);
    const e = points[i].ele;
    if (e !== null && lastEle !== null) {
      if (e - lastEle > 1) { gain += e - lastEle; lastEle = e; } else if (lastEle - e > 1) lastEle = e;
    }
    if (dist - splitStart.dist >= 1 && points[i].t) {
      splits.push({ km: 1, seconds: Math.round((points[i].t - splitStart.t) / 1000), hr: null, elevation: null });
      splitStart = { dist: splitStart.dist + 1, t: points[i].t };
    }
  }
  const last = points[points.length - 1];
  const remaining = dist - splitStart.dist;
  if (remaining > 0.05 && last.t && splitStart.t) {
    splits.push({ km: Math.round(remaining * 100) / 100, seconds: Math.round((last.t - splitStart.t) / 1000), hr: null, elevation: null });
  }
  const step = Math.max(1, Math.ceil(points.length / 400));
  const sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  return { polyline: encodePolyline(sampled), splits, distanceKm: dist, elevation: Math.round(gain) };
}

// --- Import ------------------------------------------------------------------------------------

function activityName(w) {
  if (RUN[w.type]) return w.indoor ? 'Course en intérieur' : 'Course';
  return RENFO[w.type][1];
}

function toActivity(w, gpx) {
  const run = !!RUN[w.type];
  const distanceKm = w.distanceKm || gpx?.distanceKm || 0;
  return {
    id: `ah-${w.start.replace(/\D/g, '')}`,
    source: 'apple',
    name: activityName(w),
    sportType: run ? (w.indoor ? 'VirtualRun' : 'Run') : RENFO[w.type][0],
    date: w.date,
    startLocal: w.start,
    distanceKm: Math.round(distanceKm * 100) / 100,
    movingMin: Math.round(w.durationMin * 10) / 10,
    elapsedMin: Math.round(w.durationMin * 10) / 10,
    elevation: w.elevation ?? gpx?.elevation ?? null,
    avgHr: w.avgHr || null,
    maxHr: w.maxHr || null,
    calories: w.calories ? Math.round(w.calories) : null,
    polyline: gpx?.polyline || '',
    splits: gpx?.splits?.length ? gpx.splits : undefined,
  };
}

export async function importHealthFile(file, onProgress = () => {}) {
  if (!isSupported()) throw new Error('Ton iPhone doit être à jour (iOS 16.4 ou plus récent) pour lire l\'export Santé.');
  const cutoff = toISO(addDays(new Date(), -365));
  let entries = null;
  let xmlStream;
  let total = file.size;
  let read = 0;
  const onBytes = (n) => {
    read += n;
    onProgress(Math.min(read / total, 1));
  };

  if (/\.xml$/i.test(file.name)) {
    xmlStream = file.stream().pipeThrough(new TransformStream({ transform(c, ctrl) { onBytes(c.byteLength); ctrl.enqueue(c); } }));
  } else {
    entries = await readZipEntries(file);
    const xml = entries
      .filter((e) => /\.xml$/i.test(e.name) && !/cda/i.test(e.name) && !/__MACOSX/.test(e.name))
      .sort((a, b) => b.size - a.size)[0];
    if (!xml) throw new Error('Aucun fichier Santé trouvé dans ce .zip. Choisis le fichier exporté depuis l\'app Santé.');
    total = xml.compSize;
    xmlStream = await entryStream(file, xml, onBytes);
  }

  const { workouts, weights, sleep } = await parseExport(xmlStream, cutoff);
  onProgress(1);

  const st = getState();
  let added = 0;
  for (const w of workouts) {
    let gpx = null;
    if (entries && w.route) {
      const entry = entries.find((e) => e.name.endsWith(w.route));
      if (entry) {
        try { gpx = analyseGpx(await entryText(file, entry)); } catch (e) { console.warn('Tracé illisible', e); }
      }
    }
    const a = toActivity(w, gpx);
    // Même séance déjà importée depuis Strava : on ne la compte pas deux fois.
    const twin = Object.values(st.activities).find((x) => x.source !== 'apple' && x.date === a.date
      && Math.abs(new Date(x.startLocal) - new Date(a.startLocal)) < 10 * 60000);
    if (twin) continue;
    if (!st.activities[a.id]) added++;
    const prev = st.activities[a.id] || {};
    st.activities[a.id] = { ...prev, ...a, splits: a.splits || prev.splits };
  }

  let weightsAdded = 0;
  for (const [date, kg] of Object.entries(weights)) {
    // Une pesée notée à la main est conservée ; celle du formulaire de départ est remplacée.
    const existing = st.weights.find((x) => x.date === date);
    if (existing && existing.source !== 'profile') continue;
    if (existing) st.weights.splice(st.weights.indexOf(existing), 1);
    st.weights.push({ date, kg, source: 'apple' });
    weightsAdded++;
  }

  let nights = 0;
  for (const [date, bySource] of Object.entries(sleep)) {
    const minutes = Math.max(...Object.values(bySource));
    if (minutes < 60) continue;
    const day = st.daily[date] || { water: 0, sleep: null };
    if (day.sleep === null || day.sleep === undefined) {
      st.daily[date] = { ...day, sleep: Math.round((minutes / 60) * 4) / 4 };
      nights++;
    }
  }

  const linked = linkActivities();
  st.health = { lastImport: new Date().toISOString(), lastImportDay: todayISO(), workouts: workouts.length };
  save();
  return { workouts: workouts.length, added, linked, weights: weightsAdded, nights };
}

export function lastImportText() {
  const h = getState().health;
  if (!h?.lastImport) return null;
  const d = new Date(h.lastImport);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
