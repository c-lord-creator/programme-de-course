// Courbe d'évolution (poids) en SVG, avec ligne d'objectif et info-bulle au toucher.

import { parseDate, formatShort } from './store.js';

const W = 340;
const H = 190;
const PAD = { top: 16, right: 14, bottom: 26, left: 36 };

function fmt(n) {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

export function lineChart(points, { goal = null, unit = 'kg' } = {}) {
  if (points.length === 0) {
    return '<p class="empty">Ajoute ta première pesée pour voir ta courbe.</p>';
  }
  const data = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const xs = data.map((p) => parseDate(p.date).getTime());
  const values = data.map((p) => p.value);
  const all = goal ? [...values, goal] : values;
  let min = Math.min(...all);
  let max = Math.max(...all);
  const margin = Math.max((max - min) * 0.15, 0.5);
  const ticks = 4;
  min = Math.floor(min - margin);
  const step = Math.max(1, Math.ceil((Math.ceil(max + margin) - min) / ticks));
  max = min + step * ticks;
  const x0 = xs[0];
  const x1 = xs.length > 1 ? xs[xs.length - 1] : x0 + 86400000;
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const sx = (t) => PAD.left + (xs.length > 1 ? ((t - x0) / (x1 - x0)) * iw : iw / 2);
  const sy = (v) => PAD.top + (1 - (v - min) / (max - min)) * ih;

  let grid = '';
  for (let i = 0; i <= ticks; i++) {
    const v = min + ((max - min) * i) / ticks;
    const y = sy(v);
    grid += `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${y}" y2="${y}" class="grid"/>`;
    grid += `<text x="${PAD.left - 6}" y="${y + 4}" class="axis" text-anchor="end">${fmt(v)}</text>`;
  }
  const labelIdx = data.length > 1 ? [0, data.length - 1] : [0];
  const xLabels = labelIdx
    .map((i) => `<text x="${sx(xs[i])}" y="${H - 6}" class="axis" text-anchor="${i === 0 && data.length > 1 ? 'start' : data.length > 1 ? 'end' : 'middle'}">${formatShort(data[i].date)}</text>`)
    .join('');

  const goalLine = goal
    ? `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${sy(goal)}" y2="${sy(goal)}" class="goal"/>
       <text x="${W - PAD.right}" y="${sy(goal) - 5}" class="goal-label" text-anchor="end">Objectif ${fmt(goal)} ${unit}</text>`
    : '';

  const path = data.map((p, i) => `${i ? 'L' : 'M'}${sx(xs[i]).toFixed(1)},${sy(p.value).toFixed(1)}`).join(' ');
  const area = data.length > 1
    ? `<path d="${path} L${sx(xs[xs.length - 1]).toFixed(1)},${PAD.top + ih} L${sx(xs[0]).toFixed(1)},${PAD.top + ih} Z" class="area"/>`
    : '';
  const dots = data
    .map((p, i) => `<circle cx="${sx(xs[i])}" cy="${sy(p.value)}" r="4" class="dot" data-i="${i}"/>`)
    .join('');
  const json = encodeURIComponent(JSON.stringify(data.map((p, i) => ({ x: sx(xs[i]), y: sy(p.value), v: p.value, d: p.date }))));

  return `
    <div class="chart" data-points="${json}" data-unit="${unit}">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du poids">
        <defs>
          <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="var(--accent)" stop-opacity="0.28"/>
            <stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${grid}${goalLine}${area}
        <path d="${path}" class="line"/>
        ${dots}
        ${xLabels}
        <line class="cross" y1="${PAD.top}" y2="${PAD.top + ih}" x1="0" x2="0" visibility="hidden"/>
      </svg>
      <div class="tooltip" hidden></div>
    </div>`;
}

// Info-bulle : on suit le doigt et on affiche le point le plus proche.
export function bindCharts(root) {
  root.querySelectorAll('.chart').forEach((el) => {
    const pts = JSON.parse(decodeURIComponent(el.dataset.points));
    const unit = el.dataset.unit;
    const svg = el.querySelector('svg');
    const tip = el.querySelector('.tooltip');
    const cross = el.querySelector('.cross');
    const dots = el.querySelectorAll('.dot');
    const show = (evt) => {
      const rect = svg.getBoundingClientRect();
      const x = ((evt.clientX - rect.left) / rect.width) * W;
      let best = 0;
      pts.forEach((p, i) => {
        if (Math.abs(p.x - x) < Math.abs(pts[best].x - x)) best = i;
      });
      const p = pts[best];
      cross.setAttribute('x1', p.x);
      cross.setAttribute('x2', p.x);
      cross.setAttribute('visibility', 'visible');
      dots.forEach((d, i) => d.classList.toggle('active', i === best));
      tip.hidden = false;
      tip.innerHTML = `<strong>${fmt(p.v)} ${unit}</strong><span>${formatShort(p.d)}</span>`;
      const left = (p.x / W) * rect.width;
      tip.style.left = `${Math.min(Math.max(left, 50), rect.width - 50)}px`;
      tip.style.top = `${(p.y / H) * rect.height - 52}px`;
    };
    const hide = () => {
      tip.hidden = true;
      cross.setAttribute('visibility', 'hidden');
      dots.forEach((d) => d.classList.remove('active'));
    };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', hide);
  });
}
