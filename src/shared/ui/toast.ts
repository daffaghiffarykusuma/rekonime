// @ts-nocheck
const timers = new Map();

const dismissToast = (toastId) => {
  const toast = document.getElementById(toastId);
  if (!toast) return;
  const timeoutId = timers.get(toastId);
  if (timeoutId) clearTimeout(timeoutId);
  timers.delete(toastId);
  toast.classList.remove('is-visible');
  window.setTimeout(() => {
    toast.remove();
    const region = document.getElementById('toast-region');
    if (region && region.childElementCount === 0) region.remove();
  }, 250);
};

const showToast = (message, { action = null, actions = null, type = 'info', duration = 4500, key = '' } = {}) => {
  if (typeof document === 'undefined' || !message) return '';
  let region = document.getElementById('toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.className = 'toast-region';
    region.setAttribute('role', 'region');
    region.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(region);
  }

  const previous = key
    ? Array.from(region.children).find(toast => toast.dataset.toastKey === key)
    : null;
  if (previous) {
    const timeoutId = timers.get(previous.id);
    if (timeoutId) clearTimeout(timeoutId);
    timers.delete(previous.id);
    previous.remove();
  }

  const toastId = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const toast = document.createElement('div');
  toast.id = toastId;
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  toast.setAttribute('aria-atomic', 'true');
  if (key) toast.dataset.toastKey = key;

  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);
  const toastActions = (Array.isArray(actions) ? actions : [action]).filter(Boolean);
  for (const item of toastActions) {
    if (typeof item.onClick === 'function' && item.label) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'toast-action';
      button.textContent = item.label;
      button.addEventListener('click', () => item.onClick(toastId));
      toast.appendChild(button);
    } else if (item.href && item.label) {
      const link = document.createElement('a');
      link.className = 'toast-action';
      link.href = item.href;
      link.textContent = item.label;
      toast.appendChild(link);
    }
  }

  region.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  if (duration > 0) timers.set(toastId, window.setTimeout(() => dismissToast(toastId), duration));
  return toastId;
};

// Toast options for Watchlist feedback ({ message, action?, undo? }): Undo comes
// first and gets a longer duration so there is time to reach it.
const feedbackToastOptions = (feedback) => {
  const undo = typeof feedback?.undo === 'function'
    ? { label: 'Undo', onClick: (toastId) => { dismissToast(toastId); feedback.undo(); } }
    : null;
  return {
    actions: [undo, feedback?.action || null],
    ...(undo ? { duration: 8000 } : {})
  };
};

export { dismissToast, feedbackToastOptions, showToast };
