/*
 * Daily puzzle tracker for the game cards.
 *
 * Every card with data-daily="<name>" gets a small status line:
 *   "✓ Played today" or "Not played yet today", and "New puzzle in 5h 12m".
 *
 * A game counts as played when you click its picture or Play button, or press
 * "Mark as played". This is remembered only in your own browser (localStorage),
 * and it clears itself when that game's next puzzle comes out.
 *
 * RESETS says when each game's new puzzle comes out:
 *   'local' = midnight where you are, 'utc' = midnight UTC (= midnight in Ireland in winter).
 * Games not listed use 'local'.
 */
(function () {
  const RESETS = {
    semantle: 'utc', // Semantle's rules: a new word at midnight UTC
  };

  const STORE_KEY = 'sa-daily-played';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function save(data) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch {
      /* storage blocked: the status just won't be remembered */
    }
  }

  const pad = (n) => String(n).padStart(2, '0');

  /** Which puzzle day it is right now for a game, e.g. "2026-11-15". */
  function dayKey(mode, now = new Date()) {
    if (mode === 'utc') return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  /** When the next puzzle comes out. */
  function nextReset(mode, now = new Date()) {
    if (mode === 'utc') return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }

  function countdown(ms) {
    const mins = Math.ceil(ms / 60000);
    if (mins <= 1) return 'under a minute';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h ? `${h}h ${pad(m)}m` : `${m}m`;
  }

  const cards = [...document.querySelectorAll('[data-daily]')].map((card) => {
    const id = card.dataset.daily;
    const mode = RESETS[id] || 'local';
    const box = document.createElement('div');
    box.className = 'daily';
    box.innerHTML =
      '<span class="daily-state"></span>' +
      '<span class="daily-timer"></span>' +
      '<button class="daily-toggle" type="button"></button>';
    const button = card.querySelector('.button');
    button.parentNode.insertBefore(box, button);

    const setPlayed = (played) => {
      const data = load();
      if (played) data[id] = dayKey(mode);
      else delete data[id];
      save(data);
      render();
    };

    // Opening the game counts as playing it.
    card.querySelectorAll('a[href]').forEach((a) => a.addEventListener('click', () => setPlayed(true)));
    box.querySelector('.daily-toggle').addEventListener('click', () => {
      setPlayed(load()[id] !== dayKey(mode));
    });

    return { id, mode, box };
  });

  function render() {
    const data = load();
    const now = new Date();
    for (const { id, mode, box } of cards) {
      const played = data[id] === dayKey(mode, now);
      box.dataset.state = played ? 'played' : 'todo';
      box.querySelector('.daily-state').textContent = played ? '✓ Played today' : 'Not played yet today';
      box.querySelector('.daily-timer').textContent = `New puzzle in ${countdown(nextReset(mode, now) - now)}`;
      const toggle = box.querySelector('.daily-toggle');
      toggle.textContent = played ? 'Undo' : 'Mark as played';
      toggle.setAttribute('aria-label', played ? 'Mark as not played today' : 'Mark as played today');
    }
  }

  render();
  setInterval(render, 15000);
  // Refresh straight away when you come back to the tab (e.g. after playing a game).
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) render();
  });
  window.addEventListener('storage', render);
})();
