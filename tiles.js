/*
 * Opens and closes the two top tiles (Florida Man and audidiot) together.
 * They start closed: just the Florida Man title bar, and audidiot's title with its Spin button.
 * Either "Show" button opens both; either "Hide" button closes both.
 */
(() => {
  const hero = document.getElementById('hero');
  const toggles = hero.querySelectorAll('.tile-toggle');

  function setOpen(open) {
    hero.classList.toggle('collapsed', !open);
    for (const button of toggles) {
      button.setAttribute('aria-expanded', String(open));
      button.textContent = open ? 'Hide' : 'Show';
    }
  }

  for (const button of toggles) {
    button.addEventListener('click', () => setOpen(hero.classList.contains('collapsed')));
  }

  // Spin while closed: open the tiles first so you see the wheel turn, then it spins as normal
  // with the default "Any" genre and decade. (Listening on the way down, so this runs before the spin.)
  document.querySelector('.audidiot').addEventListener(
    'click',
    (e) => {
      if (e.target.closest('#aud-spin') && hero.classList.contains('collapsed')) setOpen(true);
    },
    true,
  );

  setOpen(!hero.classList.contains('collapsed'));
})();
