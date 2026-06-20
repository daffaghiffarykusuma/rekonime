(() => {
  const root = document.documentElement;
  let shouldShow = true;

  try {
    const status = localStorage.getItem('rekonime.onboarding');
    shouldShow = status !== 'completed' && status !== 'skipped';
  } catch {
    // Show onboarding when storage is unavailable.
  }

  root.toggleAttribute('data-onboarding-pending', shouldShow);

  const initializeShell = () => {
    const shell = document.getElementById('onboarding-modal');
    if (!shell) return;

    shell.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    if (!shouldShow) return;

    shell.querySelectorAll('[data-shell-dismiss]').forEach((element) => {
      element.addEventListener('click', () => {
        try {
          localStorage.setItem('rekonime.onboarding', 'skipped');
        } catch {
          // Hiding the shell still works when storage is unavailable.
        }
        root.removeAttribute('data-onboarding-pending');
        shell.remove();
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeShell, { once: true });
  } else {
    initializeShell();
  }
})();
