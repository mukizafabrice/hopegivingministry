const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const rootDir = __dirname;
const liveJsonPath = path.join(rootDir, 'js', 'live.json');
const port = Number(process.env.PORT || 3000);
const adminUser = 'admin';
const adminPasswords = new Set(['admin', 'hope2026', 'Hope2026']);
const sessions = new Map();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8'
};

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

const getMimeType = (filePath) => mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';

const send = (res, statusCode, body, headers = {}) => {
  res.writeHead(statusCode, headers);
  res.end(body);
};

const sendJson = (res, statusCode, data, extraHeaders = {}) => {
  send(
    res,
    statusCode,
    JSON.stringify(data, null, 2),
    {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    }
  );
};

const parseCookies = (cookieHeader = '') => {
  return cookieHeader.split(';').reduce((acc, part) => {
    const index = part.indexOf('=');
    if (index === -1) return acc;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
};

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', chunk => {
    chunks.push(chunk);
    if (Buffer.concat(chunks).length > 1_000_000) {
      reject(new Error('Request body too large.'));
      req.destroy();
    }
  });
  req.on('end', () => {
    if (!chunks.length) return resolve({});
    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    } catch {
      reject(new Error('Invalid JSON body.'));
    }
  });
  req.on('error', reject);
});

const readLiveState = async () => {
  try {
    const raw = await fs.readFile(liveJsonPath, 'utf8');
    const data = JSON.parse(raw);
    return {
      enabled: Boolean(data.enabled),
      url: typeof data.url === 'string' ? data.url : '',
      updatedAt: Number(data.updatedAt || 0)
    };
  } catch {
    return defaultState();
  }
};

const writeLiveState = async (state) => {
  await fs.writeFile(liveJsonPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
};

const getSessionId = (req) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const sid = cookies.hgmAdmin;
  return sid && sessions.has(sid) ? sid : null;
};

const setSessionCookie = (res, sessionId) => {
  res.setHeader(
    'Set-Cookie',
    `hgmAdmin=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax`
  );
};

const clearSessionCookie = (res) => {
  res.setHeader('Set-Cookie', 'hgmAdmin=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
};

const serveStatic = async (req, res, pathname) => {
  let filePath = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (filePath === '/' || filePath === '') filePath = 'index.html';
  if (filePath.endsWith('/')) filePath += 'index.html';

  const resolved = path.normalize(path.join(rootDir, filePath));
  if (!resolved.startsWith(rootDir)) {
    send(res, 403, 'Forbidden');
    return;
  }

  try {
    const stat = await fs.stat(resolved);
    if (stat.isDirectory()) {
      const indexPath = path.join(resolved, 'index.html');
      const indexData = await fs.readFile(indexPath);
      send(res, 200, indexData, { 'Content-Type': 'text/html; charset=utf-8' });
      return;
    }

    const data = await fs.readFile(resolved);
    send(res, 200, data, {
      'Content-Type': getMimeType(resolved),
      'Cache-Control': path.basename(resolved) === 'live.json'
        ? 'no-store, no-cache, must-revalidate, max-age=0'
        : 'public, max-age=0'
    });
  } catch {
    send(res, 404, 'Not found');
  }
};

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = requestUrl;

  if (pathname === '/api/live-stream') {
    if (req.method === 'GET') {
      const state = await readLiveState();
      sendJson(res, 200, state);
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { message: 'Method not allowed.' });
      return;
    }

    try {
      const data = await readBody(req);
      const action = String(data.action || '');

      if (action === 'login') {
        const username = String(data.username || '');
        const password = String(data.password || '');

        if (username === adminUser && adminPasswords.has(password)) {
          const sessionId = crypto.randomBytes(24).toString('hex');
          sessions.set(sessionId, { createdAt: Date.now() });
          setSessionCookie(res, sessionId);
          sendJson(res, 200, { ok: true });
          return;
        }

        sendJson(res, 401, { message: 'Invalid username or password.' });
        return;
      }

      if (action === 'save') {
        const sessionId = getSessionId(req);
        if (!sessionId) {
          sendJson(res, 401, { message: 'Admin session expired. Please log in again.' });
          return;
        }

        const enabled = Boolean(data.enabled);
        let url = normalizeUrl(data.url);

        if (enabled && !url) {
          sendJson(res, 400, { message: 'Add a stream URL before turning live on.' });
          return;
        }

        if (!enabled) {
          url = '';
        }

        const state = {
          enabled,
          url,
          updatedAt: Date.now()
        };

        await fs.mkdir(path.dirname(liveJsonPath), { recursive: true });
        await writeLiveState(state);
        sendJson(res, 200, { ok: true, state });
        return;
      }

      if (action === 'logout') {
        const sessionId = getSessionId(req);
        if (sessionId) sessions.delete(sessionId);
        clearSessionCookie(res);
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 400, { message: 'Unknown action.' });
    } catch (error) {
      sendJson(res, 500, { message: error.message || 'Unable to update live stream.' });
    }
    return;
  }

  await serveStatic(req, res, pathname);
});

server.listen(port, () => {
  console.log(`Hope Giving Ministry server running at http://localhost:${port}`);
});
