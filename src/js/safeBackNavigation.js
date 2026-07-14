function setupSafeBackNavigation() {
  document.querySelectorAll('[data-safe-back]').forEach((link) => {
    link.addEventListener('click', (event) => {
      let referrer;

      try {
        referrer = document.referrer ? new URL(document.referrer) : null;
      } catch {
        referrer = null;
      }

      if (referrer?.origin === window.location.origin && window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupSafeBackNavigation, { once: true });
} else {
  setupSafeBackNavigation();
}
