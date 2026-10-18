// Génère un fichier .ics (Calendrier Apple, Google Agenda…) avec les séances et les pesées.

import { PROGRAM, TYPE_INFO } from './program.js';
import { getState, sessionDate, weekStart, addDays, toISO } from './store.js';

function escapeText(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

// Les lignes ICS ne doivent pas dépasser 75 octets.
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + len > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += len;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function localStamp(iso, time) {
  return `${iso.replace(/-/g, '')}T${time.replace(':', '')}00`;
}

function utcStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  return `${String(hh).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function event({ uid, date, start, durationMin, title, description, alarmMin }) {
  const end = addMinutes(start, durationMin);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}@elan10k`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${localStamp(date, start)}`,
    `DTEND:${localStamp(date, end)}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description)}`,
  ];
  if (alarmMin !== null && alarmMin !== undefined) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(title)}`, `TRIGGER:-PT${alarmMin}M`, 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

export function buildCalendar() {
  const { profile } = getState();
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Elan 10K//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Élan 10K'];

  for (const w of PROGRAM) {
    for (const s of w.sessions) {
      const info = TYPE_INFO[s.type];
      const stepsText = s.steps.length
        ? s.steps.map((st) => `• ${st.label} : ${st.detail}`).join('\n')
        : 'Ouvre l\'app pour lancer la séance guidée avec minuteur.';
      lines.push(...event({
        uid: s.id,
        date: sessionDate(s),
        start: profile.sessionTime,
        durationMin: s.durationMin,
        title: `${info.emoji} ${s.title}`,
        description: `Semaine ${w.week}/12 · ${w.theme}\n${s.summary}\n\n${stepsText}\n\nPense à cocher ta séance dans Élan 10K !`,
        alarmMin: profile.alarmMinutes,
      }));
    }
    const weighDate = toISO(addDays(weekStart(w.week), profile.weighDay - 1));
    lines.push(...event({
      uid: `pesee-w${w.week}`,
      date: weighDate,
      start: profile.weighTime,
      durationMin: 5,
      title: '⚖️ Pesée de la semaine',
      description: 'Le matin, à jeun, avant le petit-déjeuner. Note ton poids dans Élan 10K.',
      alarmMin: 0,
    }));
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadCalendar() {
  const blob = new Blob([buildCalendar()], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'elan-10k-programme.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
