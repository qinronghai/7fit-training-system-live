(function () {
  const key = '7fit-theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  let preference;
  let toggle;

  try {
    const saved = window.localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch {
    // Storage may be disabled. The toggle still works during this visit.
  }

  function updateTheme() {
    const theme = preference || (system.matches ? 'dark' : 'light');
    root.dataset.theme = theme;
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(theme === 'dark'));
      toggle.title = theme === 'dark' ? '切换到浅色模式' : '切换到深色模式';
    }
  }

  // This script runs before the stylesheets so the first paint uses the saved theme.
  updateTheme();
  system.addEventListener('change', updateTheme);

  document.addEventListener('DOMContentLoaded', () => {
    toggle = document.getElementById('theme-toggle');
    updateTheme();
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      updateTheme();
      try {
        window.localStorage.setItem(key, preference);
      } catch {
        // Keep the in-memory preference when storage is unavailable.
      }
    });
  });
})();
