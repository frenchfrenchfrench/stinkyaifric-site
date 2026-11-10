/*
 * audidiot: pick a genre and/or decade, spin the wheel, get a random album to listen to.
 * The albums live in albums.js. Album art comes from Apple's free iTunes search (no key needed).
 */
(() => {
  const ALBUMS = window.ALBUMS.map(([artist, title, year, tags]) => ({ artist, title, year, tags }));
  const GENRES = window.GENRES;
  const SEGMENTS = 12;
  const SPIN_MS = 4500;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (id) => document.getElementById(id);
  const wheel = $('wheel');
  const genreSelect = $('aud-genre');
  const decadeSelect = $('aud-decade');
  const countText = $('aud-count');
  const spinButton = $('aud-spin');
  const picker = $('aud-picker');
  const result = $('aud-result');

  let rotation = 0;
  let spinning = false;
  let wheelItems = [];
  const recent = []; // avoid repeating the last few picks

  /* ---------- Filters ---------- */

  for (const [code, name] of Object.entries(GENRES)) genreSelect.add(new Option(name, code));
  const decades = [...new Set(ALBUMS.map((a) => Math.floor(a.year / 10) * 10))].sort();
  for (const d of decades) decadeSelect.add(new Option(`${d}s`, d));

  function pool() {
    const g = genreSelect.value;
    const d = decadeSelect.value;
    return ALBUMS.filter((a) => (!g || a.tags.includes(g)) && (!d || Math.floor(a.year / 10) * 10 === Number(d)));
  }

  function updateCount() {
    const n = pool().length;
    countText.textContent = n
      ? `${n} album${n === 1 ? '' : 's'} in the pot`
      : 'Nothing in the pot for that combination. Try another decade or genre.';
    spinButton.disabled = n === 0 || spinning;
    if (!spinning && n) drawWheel(sample(pool(), SEGMENTS));
  }
  genreSelect.addEventListener('change', updateCount);
  decadeSelect.addEventListener('change', updateCount);

  /* ---------- Wheel ---------- */

  const random = (n) => Math.floor(Math.random() * n);

  /** n random albums from the list (repeats only if the list is shorter than n). */
  function sample(list, n) {
    const copy = [...list];
    const out = [];
    while (out.length < n) {
      if (copy.length === 0) copy.push(...list);
      out.push(copy.splice(random(copy.length), 1)[0]);
    }
    return out;
  }

  const point = (deg, r) => {
    const rad = (deg * Math.PI) / 180;
    return `${(r * Math.sin(rad)).toFixed(3)} ${(-r * Math.cos(rad)).toFixed(3)}`;
  };
  const short = (text, max = 18) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
  const esc = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function drawWheel(items) {
    wheelItems = items;
    const step = 360 / items.length;
    const parts = items.map((album, i) => {
      const a0 = i * step;
      const a1 = a0 + step;
      const tone = i % 2 === 0 ? 'seg-bright' : i % 4 === 1 ? 'seg-dark' : 'seg-deep';
      const mid = a0 + step / 2;
      return `
        <path class="${tone}" d="M0 0 L${point(a0, 96)} A96 96 0 0 1 ${point(a1, 96)} Z" />
        <text class="${tone}-text" transform="rotate(${mid - 90})" x="88" y="2.6" text-anchor="end">${esc(short(album.title))}</text>`;
    });
    wheel.innerHTML = `
      <g id="wheel-spin" style="transform: rotate(${rotation}deg)">
        <circle r="99" class="wheel-rim" />
        ${parts.join('')}
        <circle r="96" class="wheel-edge" />
      </g>
      <circle r="17" class="wheel-hub" />
      <text class="wheel-hub-text" y="3.2" text-anchor="middle">${spinning ? '…' : 'SPIN'}</text>`;
  }

  /* ---------- Spinning ---------- */

  function choose(list) {
    const fresh = list.filter((a) => !recent.includes(a));
    const pick = (fresh.length ? fresh : list)[random((fresh.length ? fresh : list).length)];
    recent.push(pick);
    if (recent.length > 15) recent.shift();
    return pick;
  }

  function spin() {
    if (spinning) return;
    const list = pool();
    if (!list.length) return;
    const chosen = choose(list);
    const items = sample(
      list.filter((a) => a !== chosen),
      SEGMENTS,
    );
    const k = random(SEGMENTS);
    items[k] = chosen;

    spinning = true;
    spinButton.disabled = true;
    spinButton.textContent = 'Spinning…';
    picker.hidden = false;
    result.hidden = true;
    drawWheel(items);
    const art = findArt(chosen); // start looking up the cover while the wheel spins

    // Land segment k under the pointer at the top, somewhere inside the segment.
    const step = 360 / SEGMENTS;
    const offset = (k + 0.5 + (Math.random() - 0.5) * 0.7) * step;
    const current = ((rotation % 360) + 360) % 360;
    const turns = reduced ? 1 : 6;
    rotation += turns * 360 + ((360 - offset - current + 720) % 360);

    const group = $('wheel-spin');
    const duration = reduced ? 300 : SPIN_MS;
    group.getBoundingClientRect(); // apply the starting angle before animating
    group.style.transition = `transform ${duration}ms cubic-bezier(0.12, 0.6, 0.12, 1)`;
    group.style.transform = `rotate(${rotation}deg)`;

    setTimeout(async () => {
      spinning = false;
      spinButton.textContent = 'Spin';
      spinButton.disabled = false;
      drawWheel(wheelItems);
      showResult(chosen, await art);
    }, duration + 150);
  }

  spinButton.addEventListener('click', spin);
  wheel.addEventListener('click', spin);

  /* ---------- Result ---------- */

  const normal = (text) =>
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  /**
   * Finds the cover art: first on iTunes (which also gives an Apple Music link), then on
   * MusicBrainz's Cover Art Archive. Only accepts a result whose title really matches, so a
   * wrong cover is never shown. Resolves to {} if nothing is found.
   */
  async function findArt(album) {
    const fromItunes = await itunesArt(album);
    if (fromItunes.art) return fromItunes;
    const art = await coverArchiveArt(album);
    return { ...fromItunes, ...(art ? { art } : {}) };
  }

  async function itunesArt(album) {
    try {
      const term = encodeURIComponent(`${album.artist} ${album.title}`.slice(0, 100));
      const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=album&limit=25`);
      const { results = [] } = await res.json();
      const title = normal(album.title);
      const artist = normal(album.artist).slice(0, 5);
      const matches = results.filter((r) => normal(r.collectionName).startsWith(title));
      const best = matches.find((r) => normal(r.artistName).includes(artist)) ?? matches[0];
      if (!best) return {};
      return { art: best.artworkUrl100?.replace('100x100bb', '600x600bb'), link: best.collectionViewUrl };
    } catch {
      return {};
    }
  }

  async function coverArchiveArt(album) {
    try {
      const quote = (s) => `"${s.replace(/["\\]/g, ' ')}"`;
      const query = `releasegroup:${quote(album.title)} AND artist:${quote(album.artist)}`;
      const res = await fetch(
        `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=5`,
      );
      const groups = (await res.json())['release-groups'] ?? [];
      const group = groups.find((g) => normal(g.title) === normal(album.title));
      if (!group) return null;
      const url = `https://coverartarchive.org/release-group/${group.id}/front-500`;
      // Check the image exists before using it.
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      return url;
    } catch {
      return null;
    }
  }

  function showResult(album, found) {
    const query = encodeURIComponent(`${album.artist} ${album.title}`);
    const genres = [...album.tags].map((t) => GENRES[t]).join(' · ');
    result.innerHTML = `
      <div class="aud-album">
        ${
          found.art
            ? `<img class="aud-cover" src="${esc(found.art)}" alt="Cover of ${esc(album.title)}" width="600" height="600" />`
            : `<div class="aud-cover aud-cover-missing" aria-hidden="true">♪</div>`
        }
        <div class="aud-info">
          <p class="aud-name">${esc(album.title)}</p>
          <p class="aud-artist">${esc(album.artist)}</p>
          <p class="aud-meta">${album.year} · ${esc(genres)}</p>
          <p class="aud-links">
            <a href="https://open.spotify.com/search/${query}" target="_blank" rel="noopener">Spotify ↗</a>
            ${found.link ? `<a href="${esc(found.link)}" target="_blank" rel="noopener">Apple Music ↗</a>` : ''}
            <a href="https://music.youtube.com/search?q=${query}" target="_blank" rel="noopener">YouTube ↗</a>
          </p>
        </div>
      </div>
      <div class="aud-sign" id="aud-sign">
        <button class="aud-button" type="button" data-act="happy">Sásta?</button>
        <button class="aud-button ghost" type="button" data-act="again">Spin again?</button>
      </div>`;
    picker.hidden = true;
    result.hidden = false;
  }

  result.addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'again') spin();
    if (act === 'happy') {
      $('aud-sign').innerHTML = `
        <p class="aud-happy">Sásta! Enjoy the listen.</p>
        <button class="aud-button ghost" type="button" data-act="again">Spin again?</button>
        <button class="aud-button ghost" type="button" data-act="filters">Change filters</button>`;
    }
    if (act === 'filters') {
      result.hidden = true;
      picker.hidden = false;
    }
  });

  updateCount();
})();
