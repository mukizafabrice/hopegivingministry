import { getStore } from '@netlify/blobs';
import { createHmac, timingSafeEqual } from 'node:crypto';

const ADMIN_USER = 'admin';
const ADMIN_PASSWORDS = new Set(['admin', 'hope2026', 'Hope2026']);
const COOKIE_NAME = 'hgmAdmin';
const COOKIE_TTL_MS = 12 * 60 * 60 * 1000;
const SECRET = process.env.LIVE_STREAM_ADMIN_SECRET || 'hgm-live-stream-secret';
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

const encodePayload = (payload) => Buffer.from(payload, 'utf8').toString('base64url');
const decodePayload = (payload) => Buffer.from(payload, 'base64url').toString('utf8');

const sign = (payload) => createHmac('sha256', SECRET).update(payload).digest('base64url');

const makeToken = () => {
  const payload = encodePayload(JSON.stringify({
    user: ADMIN_USER,
    exp: Date.now() + COOKIE_TTL_MS
  }));
  return `${payload}.${sign(payload)}`;
};

const verifyToken = (token) => {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return false;

  const expected = Buffer.from(sign(payload), 'base64url');
  const actual = Buffer.from(signature, 'base64url');
  if (expected.length !== actual.length) return false;
  if (!timingSafeEqual(expected, actual)) return false;

  try {
    const data = JSON.parse(decodePayload(payload));
    return data.user === ADMIN_USER && Date.now() < Number(data.exp || 0);
  } catch {
    return false;
  }
};

const parseCookies = (header = '') => {
  return header.split(';').reduce((acc, part) => {
    const index = part.indexOf('=');
    if (index === -1) return acc;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
};

const getAuthToken = (request) => {
  const cookies = parseCookies(request.headers.get('cookie') || '');
  return cookies[COOKIE_NAME] || '';
};

const isAuthed = (request) => verifyToken(getAuthToken(request));

const getCookieHeader = (value, maxAgeSeconds) =>
  `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;

const clearCookieHeader = `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

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
      const token = makeToken();
      return json(
        { ok: true },
        {
          status: 200,
          headers: {
            'Set-Cookie': getCookieHeader(token, Math.floor(COOKIE_TTL_MS / 1000))
          }
        }
      );
    }

    return json({ message: 'Invalid username or password.' }, { status: 401 });
  }

  if (action === 'save') {
    if (!isAuthed(request)) {
      return json({ message: 'Admin session expired. Please log in again.' }, { status: 401 });
    }

    const enabled = Boolean(data.enabled);
    let url = '';

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
    return json(
      { ok: true },
      {
        status: 200,
        headers: {
          'Set-Cookie': clearCookieHeader
        }
      }
    );
  }

  return json({ message: 'Unknown action.' }, { status: 400 });
};
