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
 * RESETS says when each game's new puzzle comes out: the time zone it follows
 * (leave it out for "your own local time") and the hour on that clock (0 = midnight).
 * Each was checked on the game's own site or in its code in November 2026.
 */
(function () {
  const LOCAL = { hour: 0 };
  const RESETS = {
    krillion: { tz: 'America/New_York', hour: 0 }, // code: day follows New York's date
    farflung: LOCAL, // FAQ: "At midnight, your local time"
    noillirk: LOCAL, // site: "new ones arrive at midnight", by your local date
    eraly: LOCAL, // FAQ: "Every day at midnight, your own time"
    boreen: { tz: 'Europe/Dublin', hour: 0 }, // code: Irish time
    catfishing: LOCAL, // code: puzzle number from your local date
    dartle: { tz: 'UTC', hour: 0 }, // FAQ: "Every day at 00:00 UTC"
    moviedle: LOCAL, // code: "New movie in" counts down to your midnight
    actorle: LOCAL, // code: "New actor in" counts down to your midnight
    semantle: { tz: 'America/New_York', hour: 20 }, // code: new word at 8pm New York time
    worldle: LOCAL, // FAQ: midnight in your device's time zone
    globle: LOCAL, // FAQ: "at midnight in your time zone"
    timeguessr: { tz: 'UTC', hour: 7 }, // its server's countdown ends at 07:00 UTC
    worldguessr: LOCAL, // FAQ: "At midnight, your local time"
    nyt: LOCAL, // Wordle, Connections etc. change at your midnight
    octordle: LOCAL, // code: daily number from your local date
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

  const formatters = {};

  /** The wall-clock date and time in a time zone (undefined = your own), as numbers. */
  function wallClock(tz, date) {
    const key = tz || 'local';
    formatters[key] ??= new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const p = {};
    for (const { type, value } of formatters[key].formatToParts(date)) p[type] = Number(value);
    return p;
  }

  /** How far a time zone's clock is ahead of UTC at a given moment, in ms. */
  function offsetAt(tz, date) {
    const w = wallClock(tz, date);
    return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(date / 1000) * 1000;
  }

  /** Which puzzle day it is right now for a game, e.g. "2026-11-15". */
  function dayKey({ tz, hour }, now = new Date()) {
    const w = wallClock(tz, now);
    // Before the reset hour, it's still the previous day's puzzle.
    const day = new Date(Date.UTC(w.year, w.month - 1, w.day - (w.hour < hour ? 1 : 0)));
    return day.toISOString().slice(0, 10);
  }

  /** When the next puzzle comes out. */
  function nextReset({ tz, hour }, now = new Date()) {
    const w = wallClock(tz, now);
    const wall = Date.UTC(w.year, w.month - 1, w.day + (w.hour >= hour ? 1 : 0), hour);
    // Convert that wall-clock time back to a real moment (checking again in case the clocks change).
    let at = wall - offsetAt(tz, now);
    at = wall - offsetAt(tz, new Date(at));
    return new Date(at);
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
    const mode = RESETS[id] || LOCAL;
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
