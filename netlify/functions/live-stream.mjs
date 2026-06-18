import { getStore } from '@netlify/blobs';

const ADMIN_USER = 'admin';
const ADMIN_PASSWORDS = new Set(['admin', 'hope2026', 'Hope2026']);
const store = getStore('live-stream');
const stateKey = 'state';

const defaultState = () => ({
  enabled: false,
  url: '',
  updatedAt: 0
});

const normalizeUrl = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const parsed = new URL(trimmed);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Enter a valid http(s) stream URL.');
  }

  return parsed.href;
};

const readBody = async (request) => {
  try {
    return await request.json();
  } catch {
    return {};
  }
};

const readState = async () => {
  try {
    const raw = await store.get(stateKey);
    if (!raw) return defaultState();

    const text = typeof raw === 'string'
      ? raw
      : typeof raw.text === 'function'
        ? await raw.text()
        : String(raw);

    const parsed = JSON.parse(text);
    return {
      enabled: Boolean(parsed.enabled),
      url: typeof parsed.url === 'string' ? parsed.url : '',
      updatedAt: Number(parsed.updatedAt || 0)
    };
  } catch {
    return defaultState();
  }
};

const writeState = async (state) => {
  await store.set(stateKey, `${JSON.stringify(state, null, 2)}\n`);
};

const json = (body, init = {}) =>
  new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      ...(init.headers || {})
    }
  });

export default async (request) => {
  if (request.method === 'GET') {
    return json(await readState());
  }

  if (request.method !== 'POST') {
    return json({ message: 'Method not allowed.' }, { status: 405 });
  }

  const data = await readBody(request);
  const action = String(data.action || '');

  if (action === 'login') {
    const username = String(data.username || '');
    const password = String(data.password || '');

    if (username === ADMIN_USER && ADMIN_PASSWORDS.has(password)) {
      return json({ ok: true });
    }

    return json({ message: 'Invalid username or password.' }, { status: 401 });
  }

  if (action === 'save') {
    const username = String(data.username || '');
    const password = String(data.password || '');
    const enabled = Boolean(data.enabled);
    let url = '';

    if (username !== ADMIN_USER || !ADMIN_PASSWORDS.has(password)) {
      return json({ message: 'Invalid username or password.' }, { status: 401 });
    }

    try {
      url = normalizeUrl(data.url);
    } catch (error) {
      return json({ message: error.message || 'Enter a valid http(s) stream URL.' }, { status: 400 });
    }

    if (enabled && !url) {
      return json({ message: 'Add a stream URL before turning live on.' }, { status: 400 });
    }

    if (!enabled) {
      url = '';
    }

    const state = {
      enabled,
      url,
      updatedAt: Date.now()
    };

    await writeState(state);
    return json({ ok: true, state });
  }

  if (action === 'logout') {
    return json({ ok: true });
  }

  return json({ message: 'Unknown action.' }, { status: 400 });
};
