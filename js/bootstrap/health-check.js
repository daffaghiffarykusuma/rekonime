const updateStatus = (element, status, title, detail, meta) => {
  if (!element) return;
  element.dataset.status = status;

  const pill = element.querySelector('.status-pill');
  if (pill) {
    pill.className = `status-pill ${status}`;
    pill.textContent = title;
  }

  const detailNode = element.querySelector('.status-detail');
  if (detailNode && detail) {
    detailNode.textContent = detail;
  }

  const metaNode = element.querySelector('[data-meta]');
  if (metaNode) {
    metaNode.textContent = meta || '--';
  }
};

const formatTime = (date) => {
  if (!date) return '--';
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
};

const checkHealth = async () => {
  const now = new Date();
  const lastCheck = document.getElementById('last-check');
  if (lastCheck) {
    lastCheck.textContent = `Last check: ${formatTime(now)}`;
  }

  const dataStatus = document.getElementById('data-status');
  try {
    const response = await fetch('/data/anime.full.index.json', { method: 'HEAD', cache: 'no-store' });
    updateStatus(
      dataStatus,
      response.ok ? 'healthy' : 'degraded',
      response.ok ? 'Healthy' : 'Degraded',
      response.ok ? 'Catalog data reachable.' : 'Catalog data returned an error.',
      `Status ${response.status}`
    );
  } catch {
    updateStatus(dataStatus, 'down', 'Down', 'Catalog data unavailable.', 'Network error');
  }

  const apiStatus = document.getElementById('api-status');
  try {
    const response = await fetch('https://api.jikan.moe/v4/health', { cache: 'no-store' });
    updateStatus(
      apiStatus,
      response.ok ? 'healthy' : 'degraded',
      response.ok ? 'Healthy' : 'Degraded',
      response.ok ? 'Jikan API is responding.' : 'Jikan API responded with issues.',
      `Status ${response.status}`
    );
  } catch {
    updateStatus(apiStatus, 'down', 'Down', 'Jikan API unreachable.', 'Network error');
  }

  const swStatus = document.getElementById('sw-status');
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      updateStatus(
        swStatus,
        registration ? 'healthy' : 'degraded',
        registration ? 'Healthy' : 'Degraded',
        registration ? 'Service worker registered.' : 'Service worker not registered.',
        registration ? `Scope: ${registration.scope}` : 'No registration found'
      );
    } catch {
      updateStatus(swStatus, 'degraded', 'Degraded', 'Unable to check service worker.', 'Check failed');
    }
  } else {
    updateStatus(swStatus, 'degraded', 'Degraded', 'Service workers not supported.', 'Unsupported');
  }
};

checkHealth();
setInterval(checkHealth, 30000);
