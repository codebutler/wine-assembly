#!/usr/bin/env node
'use strict';

// Measure browser time-to-first-paint for Launch, comparing WAT compile vs
// prebuilt wasm:
//   node tools/profile-ttfp-web.js
//   APP=notepad RUNS=3 MODES=compile,prebuilt node tools/profile-ttfp-web.js
//
// Requires build/wine-assembly.wasm (run tools/build.sh first).

const http = require('http');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = Math.max(1, parseInt(process.env.PORT || '8770', 10) || 8770);
const DEBUG_PORT = Math.max(1, parseInt(process.env.DEBUG_PORT || '9230', 10) || 9230);
const CHROME = process.env.CHROME ||
  (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' :
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const HEADLESS = process.env.HEADLESS !== '0';
const APP = process.env.APP || 'notepad';
const RUNS = Math.max(1, parseInt(process.env.RUNS || '3', 10) || 3);
const MODES = String(process.env.MODES || 'compile,prebuilt')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);
const TIMEOUT_MS = Math.max(15000, parseInt(process.env.TIMEOUT_MS || '180000', 10) || 180000);
const OUT = process.env.OUTPUT || path.join('/opt/cursor/artifacts', 'ttfp-prebuilt-wasm.json');
const VIEWPORT_WIDTH = Math.max(640, parseInt(process.env.VIEWPORT_WIDTH || '960', 10) || 960);
const VIEWPORT_HEIGHT = Math.max(480, parseInt(process.env.VIEWPORT_HEIGHT || '720', 10) || 720);

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.dll': 'application/octet-stream',
  '.exe': 'application/octet-stream',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.wat': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function round(v) {
  return +((Number(v) || 0).toFixed(3));
}

function mean(arr) {
  if (!arr.length) return null;
  return round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / (arr.length - 1);
  return round(Math.sqrt(v));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => { body += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
      let decoded;
      try { decoded = decodeURIComponent(url.pathname); }
      catch (_) {
        res.writeHead(400); res.end('bad path');
        return;
      }
      const rel = decoded === '/' ? '/index.html' : decoded;
      const file = path.resolve(ROOT, '.' + rel);
      if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
        res.writeHead(403); res.end('forbidden');
        return;
      }
      fs.stat(file, (err, st) => {
        if (err || !st.isFile()) {
          res.writeHead(404); res.end('not found');
          return;
        }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Content-Length': st.size,
          'Cache-Control': 'no-store',
          // SharedArrayBuffer / wasm threads
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cross-Origin-Resource-Policy': 'same-origin',
        });
        if (req.method === 'HEAD') return res.end();
        fs.createReadStream(file).pipe(res);
      });
    });
    server.on('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

function wsConnect(wsUrl) {
  const u = new URL(wsUrl);
  const key = crypto.randomBytes(16).toString('base64');
  const socket = net.connect(Number(u.port), u.hostname);
  let buf = Buffer.alloc(0);
  let ready = false;
  let nextId = 1;
  const pending = new Map();

  function parseFrames() {
    while (buf.length >= 2) {
      const b0 = buf[0];
      const b1 = buf[1];
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        if (buf.readUInt32BE(2)) throw new Error('large websocket frame');
        len = buf.readUInt32BE(6);
        off = 10;
      }
      if (buf.length < off + len) return;
      const payload = buf.subarray(off, off + len);
      buf = buf.subarray(off + len);
      if ((b0 & 0x0f) !== 1) continue;
      const msg = JSON.parse(payload.toString('utf8'));
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
        else p.resolve(msg.result);
      }
    }
  }

  socket.on('data', data => {
    buf = Buffer.concat([buf, data]);
    if (!ready) {
      const s = buf.toString('latin1');
      const idx = s.indexOf('\r\n\r\n');
      if (idx < 0) return;
      ready = true;
      buf = buf.subarray(idx + 4);
    }
    parseFrames();
  });

  const opened = new Promise((resolve, reject) => {
    socket.once('connect', () => {
      socket.write([
        `GET ${u.pathname}${u.search} HTTP/1.1`,
        `Host: ${u.host}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '',
        '',
      ].join('\r\n'));
      const started = Date.now();
      const tick = () => {
        if (ready) resolve();
        else if (Date.now() - started > 5000) reject(new Error('websocket timeout'));
        else setTimeout(tick, 25);
      };
      tick();
    });
    socket.once('error', reject);
  });

  function send(method, params = {}) {
    const id = nextId++;
    const payload = Buffer.from(JSON.stringify({ id, method, params }));
    const header = Buffer.alloc(payload.length < 126 ? 6 : 8);
    header[0] = 0x81;
    if (payload.length < 126) {
      header[1] = 0x80 | payload.length;
      crypto.randomBytes(4).copy(header, 2);
      for (let i = 0; i < payload.length; i++) payload[i] ^= header[2 + (i & 3)];
    } else {
      header[1] = 0x80 | 126;
      header.writeUInt16BE(payload.length, 2);
      crypto.randomBytes(4).copy(header, 4);
      for (let i = 0; i < payload.length; i++) payload[i] ^= header[4 + (i & 3)];
    }
    socket.write(Buffer.concat([header, payload]));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  return { opened, send, close: () => socket.destroy() };
}

async function waitForPage(debugPort, prefix, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const pages = await getJson(`http://127.0.0.1:${debugPort}/json/list`);
      const page = (pages || []).find(p => String(p.url || '').startsWith(prefix));
      if (page && page.webSocketDebuggerUrl) return page;
    } catch (_) {}
    await wait(100);
  }
  throw new Error('CDP page not found for ' + prefix);
}

async function evalExpr(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result ? result.result.value : undefined;
}

async function runOne(mode) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), `wa-ttfp-${mode}-`));
  const pageUrl = `http://127.0.0.1:${PORT}/index.html?debug=1&wasm=${encodeURIComponent(mode)}&app=${encodeURIComponent(APP)}&autolaunch=1&t=${Date.now()}`;
  const chromeArgs = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userData}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    `--window-size=${VIEWPORT_WIDTH},${VIEWPORT_HEIGHT}`,
    pageUrl,
  ];
  if (HEADLESS) chromeArgs.unshift('--headless=new', '--disable-gpu');

  const chrome = spawn(CHROME, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeErr = '';
  chrome.stderr.on('data', d => { chromeErr += d.toString(); });

  try {
    const page = await waitForPage(DEBUG_PORT, `http://127.0.0.1:${PORT}/index.html`, 20000);
    const cdp = wsConnect(page.webSocketDebuggerUrl);
    await cdp.opened;
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    const started = Date.now();
    let summary = null;
    while (Date.now() - started < TIMEOUT_MS) {
      summary = await evalExpr(cdp, `(() => {
        const t = window.__waLaunchTiming;
        if (!t) return null;
        return t.summary ? t.summary() : {
          app: t.app,
          complete: !!t.complete,
          meta: t.meta || {},
          marks: t.marks || {},
          firstCompositeMs: t.marks && t.marks.first_composite != null ? t.marks.first_composite : null,
          wasmReadyMs: t.marks && t.marks.wasm_ready != null ? t.marks.wasm_ready : null,
        };
      })()`);
      if (summary && summary.complete && summary.firstCompositeMs != null) break;
      if (summary && summary.meta && summary.meta.error) {
        throw new Error(summary.meta.error);
      }
      await wait(100);
    }
    cdp.close();
    if (!summary || summary.firstCompositeMs == null) {
      throw new Error(`timeout waiting for first_composite (mode=${mode}); chrome stderr: ${chromeErr.slice(-800)}`);
    }
    return summary;
  } finally {
    try { chrome.kill('SIGKILL'); } catch (_) {}
    try { fs.rmSync(userData, { recursive: true, force: true }); } catch (_) {}
  }
}

function printTable(resultsByMode) {
  const keys = [
    'wasm_ready',
    'instantiated',
    'pe_loaded',
    'dlls_ready',
    'run_start',
    'show_window',
    'first_composite',
  ];
  console.log('\n=== TTFP before/after prebuilt wasm ===');
  console.log(`app=${APP} runs=${RUNS} modes=${MODES.join(',')}`);
  for (const mode of MODES) {
    const runs = resultsByMode[mode] || [];
    const sources = runs.map(r => r.meta && r.meta.wasmSource).filter(Boolean);
    console.log(`\n[${mode}] wasmSource=${sources[0] || '?'} n=${runs.length}`);
    for (const key of keys) {
      const vals = runs.map(r => r.marks && r.marks[key]).filter(v => v != null);
      if (!vals.length) continue;
      console.log(`  ${key.padEnd(18)} mean=${String(mean(vals)).padStart(8)} ms  sd=${String(stddev(vals)).padStart(7)}  raw=[${vals.map(round).join(', ')}]`);
    }
  }
  if (MODES.includes('compile') && MODES.includes('prebuilt')) {
    const a = resultsByMode.compile || [];
    const b = resultsByMode.prebuilt || [];
    const aVals = a.map(r => r.firstCompositeMs).filter(v => v != null);
    const bVals = b.map(r => r.firstCompositeMs).filter(v => v != null);
    const aWasm = a.map(r => r.wasmReadyMs).filter(v => v != null);
    const bWasm = b.map(r => r.wasmReadyMs).filter(v => v != null);
    if (aVals.length && bVals.length) {
      const dPaint = mean(bVals) - mean(aVals);
      const dWasm = mean(bWasm) - mean(aWasm);
      console.log('\nDelta prebuilt - compile:');
      console.log(`  wasm_ready       ${dWasm >= 0 ? '+' : ''}${round(dWasm)} ms`);
      console.log(`  first_composite  ${dPaint >= 0 ? '+' : ''}${round(dPaint)} ms`);
    }
  }
  console.log('');
}

async function main() {
  for (const mode of MODES) {
    if (mode === 'prebuilt' || mode === 'auto') {
      const wasmPath = path.join(ROOT, 'build', 'wine-assembly.wasm');
      if (!fs.existsSync(wasmPath)) {
        throw new Error('Missing build/wine-assembly.wasm — run: bash tools/build.sh');
      }
    }
  }

  const server = await startStaticServer();
  const resultsByMode = {};
  try {
    for (const mode of MODES) {
      resultsByMode[mode] = [];
      for (let i = 0; i < RUNS; i++) {
        process.stderr.write(`[ttfp] mode=${mode} run=${i + 1}/${RUNS}\n`);
        const summary = await runOne(mode);
        resultsByMode[mode].push(summary);
        process.stderr.write(
          `[ttfp]   first_composite=${summary.firstCompositeMs}ms wasm_ready=${summary.wasmReadyMs}ms source=${summary.meta && summary.meta.wasmSource}\n`
        );
      }
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  const out = {
    app: APP,
    runs: RUNS,
    modes: MODES,
    chrome: CHROME,
    headless: HEADLESS,
    createdAt: new Date().toISOString(),
    results: resultsByMode,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  printTable(resultsByMode);
  console.log('Wrote ' + OUT);
}

main().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
