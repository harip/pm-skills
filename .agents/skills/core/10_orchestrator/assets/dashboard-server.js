#!/usr/bin/env node
/**
 * Zero-dependency local HTTP + Persistence Server for PM Skills Dashboard (docs/progress.html)
 * Serves static files from the docs directory AND provides REST endpoints so interactive
 * questionnaires and gate approvals in progress.html save directly to disk:
 *   - GET  /api/discovery-answers -> returns docs/00_DISCOVERY_ANSWERS.json
 *   - POST /api/save-discovery    -> writes docs/00_DISCOVERY_ANSWERS.json & docs/discovery-answers.js
 *   - POST /api/save-gate-decision -> writes docs/00_GATE_DECISION.json
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const DOCS_DIR = path.resolve(process.argv[3] || __dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf8');
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. GET /api/discovery-answers
  if (req.method === 'GET' && pathname === '/api/discovery-answers') {
    const filePath = path.join(DOCS_DIR, '00_DISCOVERY_ANSWERS.json');
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        sendJson(res, 200, JSON.parse(raw));
        return;
      } catch (err) {
        sendJson(res, 200, { saved: false, error: err.message });
        return;
      }
    }
    sendJson(res, 200, { saved: false });
    return;
  }

  // 2. POST /api/save-discovery
  if (req.method === 'POST' && pathname === '/api/save-discovery') {
    try {
      const body = await readRequestBody(req);
      const data = JSON.parse(body || '{}');
      const payload = {
        saved: true,
        savedAt: new Date().toISOString(),
        ...data,
      };
      const jsonPath = path.join(DOCS_DIR, '00_DISCOVERY_ANSWERS.json');
      const jsPath = path.join(DOCS_DIR, 'discovery-answers.js');

      fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
      fs.writeFileSync(
        jsPath,
        `window.PM_DISCOVERY_SAVED = ${JSON.stringify(payload, null, 2)};\n`,
        'utf8'
      );

      sendJson(res, 200, {
        ok: true,
        file: 'docs/00_DISCOVERY_ANSWERS.json',
        savedAt: payload.savedAt,
        action: payload.action || 'proceed',
      });
      return;
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message });
      return;
    }
  }

  // 3. POST /api/save-gate-decision
  if (req.method === 'POST' && pathname === '/api/save-gate-decision') {
    try {
      const body = await readRequestBody(req);
      const data = JSON.parse(body || '{}');
      const payload = {
        saved: true,
        savedAt: new Date().toISOString(),
        ...data,
      };
      const jsonPath = path.join(DOCS_DIR, '00_GATE_DECISION.json');
      fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
      sendJson(res, 200, {
        ok: true,
        file: 'docs/00_GATE_DECISION.json',
        savedAt: payload.savedAt,
      });
      return;
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message });
      return;
    }
  }

  // 4. Static file serving from DOCS_DIR (and parent workspace for ../src or ../tests links)
  let relativeTarget = pathname === '/' ? '/progress.html' : pathname;
  let safePath = path.resolve(DOCS_DIR, '.' + relativeTarget);
  const workspaceRoot = path.resolve(DOCS_DIR, '..');

  if (!safePath.startsWith(workspaceRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(safePath) && fs.statSync(safePath).isDirectory()) {
    const indexHtml = path.join(safePath, 'index.html');
    if (fs.existsSync(indexHtml)) {
      safePath = indexHtml;
    } else {
      // Simple directory listing
      const files = fs.readdirSync(safePath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        `<html><body style="font-family:sans-serif;padding:24px;"><h2>Directory: ${pathname}</h2><ul>` +
          files
            .map((f) => `<li><a href="${path.posix.join(pathname, f)}">${f}</a></li>`)
            .join('') +
          `</ul></body></html>`
      );
      return;
    }
  }

  if (!fs.existsSync(safePath)) {
    // Graceful fallback if discovery-answers.js hasn't been created yet
    if (pathname.endsWith('/discovery-answers.js')) {
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end('window.PM_DISCOVERY_SAVED = null;\n');
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Not found: ${pathname}`);
    return;
  }

  const ext = path.extname(safePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(safePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`PM Dashboard & Discovery Server listening on http://localhost:${PORT}/progress.html`);
});
