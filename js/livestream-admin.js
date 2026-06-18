document.addEventListener('DOMContentLoaded', () => {
  const LIVE_WINDOW_MS = 12 * 60 * 60 * 1000;
  const defaultState = { enabled: false, url: '', updatedAt: 0 };
  const ADMIN_USER = 'admin';
  const ADMIN_PASSWORDS = new Set(['admin', 'hope2026', 'Hope2026']);
  const API_URL = '../api/live-stream.php';

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

  const isAdminSignedIn = () => sessionStorage.getItem('hgmAdmin') === '1';

  const apiRequest = async (action, payload = {}) => {
    const response = await fetch(API_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, ...payload })
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.message || 'Unable to update live stream.');
    }

    return data;
  };

  const loadState = async () => {
    try {
      const response = await fetch(`${API_URL}?t=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Live state unavailable.');
      return { ...defaultState, ...(await response.json()) };
    } catch {
      return defaultState;
    }
  };

  const normalizeInputUrl = (value) => {
    if (!value) return '';
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      return parsed.href;
    } catch {
      throw new Error('Enter a valid http(s) stream URL.');
    }
  };

  const isLive = (state) => Boolean(
    state.enabled &&
    state.url &&
    Date.now() - Number(state.updatedAt || 0) < LIVE_WINDOW_MS
  );

  const toEmbedUrl = (url) => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();

      if (host === 'youtu.be') {
        const id = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
        if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
      }

      if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'youtube-nocookie.com' || host === 'www.youtube-nocookie.com') {
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        const id = parsed.searchParams.get('v') || pathParts[pathParts.length - 1];
        if (id && /^[A-Za-z0-9_-]{6,}$/.test(id)) {
          return `https://www.youtube-nocookie.com/embed/${id}`;
        }
      }

      return parsed.href;
    } catch {
      return url;
    }
  };

  const setBusy = (button, busy) => {
    if (!button) return;
    button.disabled = busy;
    button.style.opacity = busy ? '0.65' : '';
  };

  const showStatus = (message, type = 'ok') => {
    if (!statusMsg) return;
    statusMsg.textContent = message;
    statusMsg.style.display = 'block';
    statusMsg.style.color = type === 'error' ? '#e07a7a' : '#E8C97A';
  };

  const updateNavPill = (active) => {
    document.querySelectorAll('.nav-links a').forEach(link => {
      if (!link.querySelector('.live-badge')) return;
      const item = link.closest('li');
      if (item) item.style.display = active ? '' : 'none';
    });
  };

  const syncAdminFields = (state) => {
    if (liveToggle) liveToggle.checked = Boolean(state.enabled);
    if (urlInput) urlInput.value = state.url || '';
  };

  const updateLiveView = async () => {
    const state = await loadState();
    const active = isLive(state);

    if (offlineView) offlineView.style.display = active ? 'none' : 'flex';

    if (liveView) {
      liveView.replaceChildren();
      liveView.style.display = active ? 'block' : 'none';

      if (active) {
        const iframe = document.createElement('iframe');
        iframe.src = toEmbedUrl(state.url);
        iframe.title = 'Hope Giving Ministry live stream';
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('allowfullscreen', '');
        iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;';
        liveView.appendChild(iframe);
      }
    }

    updateNavPill(active);
    syncAdminFields(state);
  };

  const showLogin = () => {
    loginStep.style.display = 'block';
    manageStep.style.display = 'none';
  };

  const showManage = () => {
    loginStep.style.display = 'none';
    manageStep.style.display = 'block';
  };

  const openModal = async () => {
    if (!modal) return;
    modal.style.display = 'flex';
    if (isAdminSignedIn()) {
      showManage();
    } else {
      showLogin();
    }
    await updateLiveView();
    setTimeout(() => (isAdminSignedIn() ? urlInput : usernameInput)?.focus(), 50);
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
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal?.style.display === 'flex') closeModal();
  });

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const loginButton = loginForm.querySelector('button[type="submit"]');
    setBusy(loginButton, true);
    loginError.style.display = 'none';

    try {
      const valid = usernameInput.value.trim().toLowerCase() === ADMIN_USER && ADMIN_PASSWORDS.has(passwordInput.value);
      if (!valid) throw new Error('Invalid username or password.');
      await apiRequest('login', {
        username: usernameInput.value.trim(),
        password: passwordInput.value
      });
      sessionStorage.setItem('hgmAdmin', '1');
      passwordInput.value = '';
      showManage();
      showStatus('Logged in.', 'ok');
      await updateLiveView();
    } catch (error) {
      loginError.textContent = error.message || 'Invalid username or password.';
      loginError.style.display = 'block';
    } finally {
      setBusy(loginButton, false);
    }
  });

  saveBtn?.addEventListener('click', async () => {
    if (!isAdminSignedIn()) {
      showLogin();
      showStatus('Please log in again before saving.', 'error');
      return;
    }

    let url = '';
    try {
      url = normalizeInputUrl(urlInput.value.trim());
    } catch (error) {
      showStatus(error.message, 'error');
      return;
    }

    if (liveToggle.checked && !url) {
      showStatus('Add a stream URL before turning live on.', 'error');
      return;
    }

    setBusy(saveBtn, true);

    try {
      const result = await apiRequest('save', {
        enabled: liveToggle.checked,
        url,
        updatedAt: Date.now()
      });
      sessionStorage.setItem('hgmAdmin', '1');
      showStatus('Live stream updated and saved to js/live.json.', 'ok');
      await updateLiveView();
      if (result.state) {
        syncAdminFields(result.state);
      }
    } catch (error) {
      showStatus(error.message, 'error');
    } finally {
      setBusy(saveBtn, false);
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    try {
      await apiRequest('logout');
    } catch {
      // If the session is already gone, we still clear the client state.
    } finally {
      sessionStorage.removeItem('hgmAdmin');
      passwordInput.value = '';
      showLogin();
      showStatus('Logged out.', 'ok');
    }
  });

  reminderBtn?.addEventListener('click', () => {
    const subject = encodeURIComponent('Hope Giving Ministry Live Stream Reminder');
    const body = encodeURIComponent('Reminder: join Hope Giving Ministry live online this Sunday.');
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  });

  updateLiveView();
  setInterval(() => {
    if (!document.hidden) updateLiveView();
  }, 30000);
});
