// Petits utilitaires d'affichage partagés par les vues.

import { parseDate, toISO, addDays, todayISO, formatDate } from './store.js';

// État d'interface non enregistré (filtres, chargements…).
export const ui = {
  editing: false,
  journalLimit: 20,
  syncing: false,
  loadingDetails: {},
  importProgress: null,
};

export function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function num(n, digits = 1) {
  return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: digits });
}

export function parseNum(value) {
  const n = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function relDay(iso) {
  const today = todayISO();
  if (iso === today) return 'aujourd\'hui';
  if (iso === toISO(addDays(parseDate(today), 1))) return 'demain';
  if (iso === toISO(addDays(parseDate(today), -1))) return 'hier';
  return formatDate(iso);
}

// Allure en min/km : "6'12"
export function pace(minutes, km) {
  if (!minutes || !km) return '—';
  const secPerKm = Math.round((minutes * 60) / km);
  return `${Math.floor(secPerKm / 60)}'${String(secPerKm % 60).padStart(2, '0')}`;
}

export function paceFromSeconds(seconds, km) {
  return pace(seconds / 60, km);
}

// Durée lisible : "47 min", "1 h 05"
export function duration(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')}`;
}

export function hours(h) {
  if (h === null || h === undefined) return '—';
  const whole = Math.floor(h);
  const min = Math.round((h - whole) * 60);
  return min ? `${whole} h ${String(min).padStart(2, '0')}` : `${whole} h`;
}

export const FEELINGS = ['😫', '😕', '🙂', '😀', '🤩'];

export function toast(message) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2800);
}

export function closeModal() {
  document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
  document.body.classList.remove('no-scroll');
}

export function openModal(html, onBind) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-close]')) closeModal();
  });
  if (onBind) onBind(wrap);
}
