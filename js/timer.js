// Minuteur guidé pour les séances de renforcement.

let audioCtx = null;

function beep(freq = 880, duration = 0.15) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // pas de son disponible
  }
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function speak(text) {
  try {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    window.speechSynthesis.speak(u);
  } catch (e) {
    // synthèse vocale indisponible
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function startGuidedWorkout({ title, steps, onFinish, doneText = 'Bravo, ton corps te remerciera au prochain kilomètre.' }) {
  const root = document.createElement('div');
  root.className = 'timer-overlay';
  document.body.appendChild(root);
  document.body.classList.add('no-scroll');

  let index = 0;
  let remaining = steps[0].seconds || 0;
  let deadline = Date.now() + remaining * 1000;
  let paused = false;
  let voice = true;
  let interval = null;
  let wakeLock = null;

  if (navigator.wakeLock) {
    navigator.wakeLock.request('screen').then((l) => { wakeLock = l; }).catch(() => {});
  }

  function close() {
    clearInterval(interval);
    if (wakeLock) wakeLock.release().catch(() => {});
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    root.remove();
    document.body.classList.remove('no-scroll');
  }

  function goTo(i) {
    if (i >= steps.length) {
      finish();
      return;
    }
    index = Math.max(i, 0);
    remaining = steps[index].seconds || 0;
    deadline = Date.now() + remaining * 1000;
    if (voice) speak(steps[index].say || (steps[index].kind === 'rest' ? steps[index].name : `${steps[index].name}${steps[index].reps ? `, ${steps[index].reps}` : ''}`));
    render();
  }

  function tick() {
    if (paused) return;
    const step = steps[index];
    if (!step || !step.seconds) return;
    // Basé sur l'heure réelle : reste juste même si le téléphone ralentit l'app.
    const left = Math.max(Math.ceil((deadline - Date.now()) / 1000), 0);
    if (left === remaining) return;
    remaining = left;
    if (remaining > 0 && remaining <= 3) beep(660, 0.1);
    if (remaining <= 0) {
      beep(990, 0.3);
      vibrate([200, 100, 200]);
      goTo(index + 1);
      return;
    }
    const el = root.querySelector('.timer-count');
    if (el) el.textContent = formatTime(remaining);
    const ring = root.querySelector('.timer-ring-fg');
    if (ring) ring.style.strokeDashoffset = String(565 * (1 - remaining / step.seconds));
  }

  function finish() {
    clearInterval(interval);
    if (voice) speak('Séance terminée, bravo !');
    beep(1046, 0.4);
    vibrate([300, 100, 300]);
    root.innerHTML = `
      <div class="timer-card timer-done">
        <div class="big-emoji">🎉</div>
        <h2>Séance terminée !</h2>
        <p>${doneText}</p>
        <button class="btn btn-primary btn-block" data-t="save">Enregistrer la séance</button>
        <button class="btn btn-ghost btn-block" data-t="close">Fermer sans enregistrer</button>
      </div>`;
    root.querySelector('[data-t="save"]').onclick = () => { close(); onFinish && onFinish(); };
    root.querySelector('[data-t="close"]').onclick = close;
  }

  function render() {
    const step = steps[index];
    const next = steps[index + 1];
    const timed = !!step.seconds;
    const pct = Math.round((index / steps.length) * 100);
    root.innerHTML = `
      <div class="timer-card ${step.kind === 'rest' ? 'is-rest' : 'is-work'}">
        <div class="timer-top">
          <button class="icon-btn" data-t="quit" aria-label="Quitter">✕</button>
          <span class="timer-title">${title}</span>
          <button class="icon-btn" data-t="voice" aria-label="${voice ? 'Couper la voix' : 'Activer la voix'}">${voice ? '🔊' : '🔇'}</button>
        </div>
        <div class="timer-progress"><span style="width:${pct}%"></span></div>
        <span class="timer-step">Étape ${index + 1}/${steps.length}</span>
        <div class="timer-kind">${step.badge || (step.kind === 'rest' ? '😮‍💨 Repos' : '🔥 C\'est parti')}</div>
        <h2 class="timer-name">${step.name}</h2>
        ${timed ? `
          <div class="timer-ring">
            <svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="90" class="timer-ring-bg"/>
              <circle cx="100" cy="100" r="90" class="timer-ring-fg" style="stroke-dashoffset:0"/></svg>
            <span class="timer-count">${formatTime(remaining)}</span>
          </div>` : `
          <div class="timer-reps"><span>${step.reps}</span><small>répétitions</small></div>`}
        ${step.tip ? `<p class="timer-tip">💡 ${step.tip}</p>` : ''}
        <div class="timer-controls">
          <button class="icon-btn big" data-t="prev" aria-label="Étape précédente" ${index === 0 ? 'disabled' : ''}>⏮</button>
          ${timed ? `<button class="icon-btn big primary" data-t="pause" aria-label="Pause">${paused ? '▶' : '⏸'}</button>` : `<button class="btn btn-primary" data-t="next">C'est fait ✓</button>`}
          <button class="icon-btn big" data-t="next" aria-label="Étape suivante">⏭</button>
        </div>
        ${next ? `<p class="timer-next">Ensuite : <strong>${next.name}</strong>${next.seconds ? ` · ${formatTime(next.seconds)}` : next.reps ? ` · ${next.reps}` : ''}</p>` : '<p class="timer-next">Dernière étape !</p>'}
      </div>`;
    root.querySelector('[data-t="quit"]').onclick = () => {
      if (confirm('Arrêter la séance ?')) close();
    };
    root.querySelector('[data-t="prev"]').onclick = () => goTo(index - 1);
    root.querySelectorAll('[data-t="next"]').forEach((b) => { b.onclick = () => goTo(index + 1); });
    const pause = root.querySelector('[data-t="pause"]');
    if (pause) pause.onclick = () => {
      paused = !paused;
      if (!paused) deadline = Date.now() + remaining * 1000;
      render();
    };
    root.querySelector('[data-t="voice"]').onclick = () => { voice = !voice; render(); };
  }

  beep(880, 0.01); // débloque le son sur iPhone (doit suivre un toucher)
  goTo(0);
  interval = setInterval(tick, 250);
}
