/* Shows today's Florida Man headline, fetched from /florida-man (functions/florida-man.js). */
(async () => {
  const box = document.getElementById('florida-result');
  const queryText = document.getElementById('florida-query');
  const esc = (text) =>
    String(text ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  try {
    const res = await fetch('/florida-man');
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error);

    queryText.textContent = data.search;
    box.innerHTML = `
      <a class="florida-headline" href="${esc(data.link)}" target="_blank" rel="noopener">${esc(data.title)}</a>
      <p class="florida-meta">
        ${esc(data.source)}${data.year ? ` · ${data.date} ${data.year}` : ''}
      </p>
      <p class="florida-more"><a href="${esc(data.searchUrl)}" target="_blank" rel="noopener">See the rest on Google ↗</a></p>`;
  } catch {
    box.innerHTML = `<p class="florida-loading">Florida Man is lying low today. Check back later.</p>`;
  }
})();
