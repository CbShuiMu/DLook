const DLookPlayTheme = (() => {
  const key = 'dlook-play-theme';
  const themes = ['blue', 'pink'];
  const listeners = new Set();

  function read() {
    try {
      const value = localStorage.getItem(key);
      return themes.includes(value) ? value : 'blue';
    } catch {
      return 'blue';
    }
  }

  function apply(theme) {
    // Blue is the default token set, so it needs no attribute.
    if (theme === 'blue') document.documentElement.removeAttribute('data-dlook-theme');
    else document.documentElement.setAttribute('data-dlook-theme', theme);
    for (const listener of listeners) listener(theme);
  }

  function current() {
    return document.documentElement.getAttribute('data-dlook-theme') ?? 'blue';
  }

  function toggle() {
    const next = themes[(themes.indexOf(current()) + 1) % themes.length];
    try {
      localStorage.setItem(key, next);
    } catch {}
    apply(next);
    return next;
  }

  // Applied at document_start so the first paint already uses the saved colors.
  apply(read());
  window.addEventListener('storage', event => {
    if (event.key === key) apply(read());
  });

  return { current, toggle, onChange: listener => listeners.add(listener) };
})();
