document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'hgmLiveStream';
  const LIVE_WINDOW_MS = 12 * 60 * 60 * 1000;
  const ADMIN_USER = 'admin';
  const ADMIN_PASSWORDS = new Set(['admin', 'hope2026', 'Hope2026']);

  const modal = document.getElementById('admin-modal');
  const trigger = document.getElementById('admin-trigger');
  const closeBtn = document.getElementById('admin-modal-close');
  const loginStep = document.getElementById('admin-login-step');
  const manageStep = document.getElementById('admin-manage-step');
  const loginForm = document.getElementById('admin-login-form');
  const usernameInput = document.getElementById('admin-username');
  const passwordInput = document.getElementById('admin-password');
  const loginError = document.getElementById('admin-login-error');
  const liveToggle = document.getElementById('live-toggle');
  const urlInput = document.getElementById('live-url-input');
  const statusMsg = document.getElementById('admin-status-msg');
  const saveBtn = document.getElementById('admin-save-btn');
  const logoutBtn = document.getElementById('admin-logout-btn');
  const offlineView = document.getElementById('stream-offline-view');
  const liveView = document.getElementById('stream-live-view');
  const reminderBtn = document.getElementById('reminder-btn');

  const readState = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  };

  const writeState = (state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  const isLive = (state) => Boolean(state.url && state.enabled && Date.now() - Number(state.updatedAt || 0) < LIVE_WINDOW_MS);

  const toEmbedUrl = (url) => {
    try {
      const parsed = new URL(url);
      let id = '';
      if (parsed.hostname.includes('youtu.be')) id = parsed.pathname.replace('/', '');
      if (parsed.hostname.includes('youtube.com')) id = parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
      if (!id) return url;
      return `https://www.youtube-nocookie.com/embed/${id}`;
    } catch {
      return url;
    }
  };

  const updateLiveView = () => {
    const state = readState();
    const active = isLive(state);

    if (offlineView) offlineView.style.display = active ? 'none' : 'flex';
    if (liveView) {
      liveView.style.display = active ? 'block' : 'none';
      liveView.innerHTML = active
        ? `<iframe src="${toEmbedUrl(state.url)}" title="Hope Giving Ministry live stream" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0;"></iframe>`
        : '';
    }

    document.querySelectorAll('.nav-links a').forEach(link => {
      if (!link.querySelector('.live-badge')) return;
      const item = link.closest('li');
      if (item) item.style.display = active ? '' : 'none';
    });

    if (liveToggle) liveToggle.checked = Boolean(state.enabled);
    if (urlInput) urlInput.value = state.url || '';
  };

  const openModal = () => {
    if (!modal) return;
    modal.style.display = 'flex';
    loginStep.style.display = sessionStorage.getItem('hgmAdmin') === '1' ? 'none' : 'block';
    manageStep.style.display = sessionStorage.getItem('hgmAdmin') === '1' ? 'block' : 'none';
    updateLiveView();
    setTimeout(() => (sessionStorage.getItem('hgmAdmin') === '1' ? urlInput : usernameInput)?.focus(), 50);
  };

  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };

  trigger?.addEventListener('click', (event) => {
    event.preventDefault();
    openModal();
  });

  closeBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  loginForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const valid = usernameInput.value.trim().toLowerCase() === ADMIN_USER && ADMIN_PASSWORDS.has(passwordInput.value);
    if (!valid) {
      loginError.textContent = 'Invalid username or password.';
      loginError.style.display = 'block';
      return;
    }
    sessionStorage.setItem('hgmAdmin', '1');
    loginError.style.display = 'none';
    loginStep.style.display = 'none';
    manageStep.style.display = 'block';
    updateLiveView();
  });

  saveBtn?.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (liveToggle.checked && !url) {
      statusMsg.textContent = 'Add a stream URL before turning live on.';
      statusMsg.style.display = 'block';
      statusMsg.style.color = '#e07a7a';
      return;
    }

    writeState({
      enabled: liveToggle.checked,
      url,
      updatedAt: Date.now()
    });

    statusMsg.textContent = liveToggle.checked
      ? 'Live stream updated. The Live nav pill will show for 12 hours.'
      : 'Live stream turned off.';
    statusMsg.style.display = 'block';
    statusMsg.style.color = '#E8C97A';
    updateLiveView();
  });

  logoutBtn?.addEventListener('click', () => {
    sessionStorage.removeItem('hgmAdmin');
    passwordInput.value = '';
    loginStep.style.display = 'block';
    manageStep.style.display = 'none';
  });

  reminderBtn?.addEventListener('click', () => {
    const subject = encodeURIComponent('Hope Giving Ministry Live Stream Reminder');
    const body = encodeURIComponent('Reminder: join Hope Giving Ministry live online this Sunday.');
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  });

  updateLiveView();
});
