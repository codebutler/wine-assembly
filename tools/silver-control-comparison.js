#!/usr/bin/env node
'use strict';

// Source preparation only until a coordinated runtime grant. See companion recipe.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const http = require('http'), cp = require('child_process'), assert = require('assert/strict');
const ZIP_SHA = '645db1f10f9fd77fcc22f3140648fc154e3d5680a9f88cd7fe8d834268e887ea';
const EXE_SHA = '2301beb5100c6eb73eadcb700a2ce65e7b1221d2390207cbe3f07bc64df73ff8';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const hashFile = p => sha(fs.readFileSync(p));
const read = p => JSON.parse(fs.readFileSync(p));
const save = (out, name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const delay = ms => new Promise(r => setTimeout(r, ms));
const FLAGS = ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling'];
const ROUTE = '/index.html?debug&d3d-renderer=software&d3d9-renderer=software&d3d9-programmable';
const safeName = n => typeof n === 'string' && /^[a-z0-9-]{1,60}$/.test(n);
function secondsFor(c) { const n = c.seconds ?? 300; assert(Number.isInteger(n) && n >= 120 && n <= 600, 'Session limit must be120..600 seconds'); return n; }
function budget(command, deadlineAt, now = Date.now()) {
  assert(now < deadlineAt, 'Controller deadline passed; request not submitted/executed');
  if (command.action === 'mark-world') assert(deadlineAt - now >= 60000, 'Need at least60 seconds remaining for reviewed world comparison');
  if (command.purpose === 'ground') assert(deadlineAt - now >= 25000, 'Need at least25 seconds remaining for ground-input observation');
}
function submit(out, sequence, command, now = Date.now()) {
  assert(Number.isInteger(sequence) && sequence >= 0);
  const state = read(path.join(out, 'control-state.json'));
  assert.equal(state.closing, false, 'Controller already closed');
  assert.equal(proc(state.driver.pid)?.startTicks, state.driver.startTicks, 'Controller is no longer the recorded process');
  budget(command, state.deadlineAt, now);
  const target = path.join(out, `command-${sequence}.json`);
  assert(!fs.existsSync(target), 'Command sequence already exists');
  fs.writeFileSync(target + '.tmp', JSON.stringify(command) + '\n', { flag: 'wx' });
  fs.renameSync(target + '.tmp', target);
  return { submittedAt: new Date(now).toISOString(), sequence, deadlineAt: state.deadlineAt };
}

function fixtureMap(files) {
  const map = new Map();
  for (const f of files) {
    assert(!path.isAbsolute(f.path) && !f.path.split(/[\\/]/).includes('..'));
    const key = f.path.toLowerCase();
    assert(!map.has(key), 'Case-colliding fixture paths');
    map.set(key, f);
  }
  return map;
}
function review(command, out, scene) {
  const r = command.review;
  assert(r && safeName(r.name) && r.scene === scene && typeof r.description === 'string' && r.description.trim(), 'Reviewed scene description required');
  assert.equal(hashFile(path.join(out, r.name + '.png')), r.sha256, 'Review must identify actual captured image');
}
function validate(command, mode, phase, out) {
  assert(['idle', 'input'].includes(mode));
  if (command.action === 'quit') return;
  if (command.action === 'shot') { assert(safeName(command.name)); return; }
  if (command.action === 'mark-world') {
    assert.equal(phase, 'started'); review(command, out, 'world');
    assert(typeof command.readiness === 'string' && command.readiness.trim(), 'Record dialogue/script readiness uncertainty');
    return;
  }
  const menu = phase === 'menu';
  if (menu) {
    assert(['relative', 'left-hold'].includes(command.action));
    review(command, out, 'menu');
    assert.equal(command.purpose, 'start');
    assert.equal(command.x, 320); assert.equal(command.y, 362);
    if (command.action === 'relative') { assert.equal(command.dx, 0); assert.equal(command.dy, 112); }
  } else {
    assert.equal(mode, 'input', 'Idle session rejects world input');
    assert.equal(phase, 'world', 'Mark/review world checkpoint before input');
    assert(['relative', 'left-hold'].includes(command.action));
    review(command, out, 'world');
    assert.equal(command.purpose, 'ground');
  }
  for (const k of ['x', 'y']) assert(Number.isFinite(command[k]) && command[k] >= 0 && command[k] < (k === 'x' ? 640 : 480));
  if (command.action === 'relative') for (const k of ['dx', 'dy']) assert(Number.isFinite(command[k]) && Math.abs(command[k]) <= 640);
  else assert.equal(command.holdMs, 1000, 'Matched one-second normal hold only');
}
function preflight(c) {
  for (const k of ['root', 'fixture', 'zip', 'inventory', 'sourceManifest', 'chrome']) assert(path.isAbsolute(c[k]), k + ' must be absolute');
  assert(/^[a-f0-9]{64}$/.test(c.wasmSha256));
  const inventory = read(c.inventory).files;
  assert.equal(inventory.length, 3147);
  const map = fixtureMap(inventory);
  for (const f of inventory) {
    const p = path.join(c.fixture, f.path);
    assert.equal(fs.statSync(p).size, f.size, f.path); assert.equal(hashFile(p), f.sha256, f.path);
  }
  assert.equal(map.get('silver.exe').sha256, EXE_SHA);
  assert(map.has('mss32.dll') && map.has('smackw32.dll'));
  assert.equal(hashFile(c.zip), ZIP_SHA);
  assert.equal(hashFile(path.join(c.root, 'build/wine-assembly.wasm')), c.wasmSha256);
  const raw = read(c.sourceManifest), source = Array.isArray(raw) ? raw : raw.source;
  assert(Array.isArray(source) && source.length > 0, 'Exact source manifest required');
  for (const f of source) {
    assert(!path.isAbsolute(f.path) && !f.path.split(/[\\/]/).includes('..'));
    assert.equal(hashFile(path.join(c.root, f.path)), f.sha256, f.path);
  }
  const identity = { harnessSha256: hashFile(__filename), wasmSha256: c.wasmSha256, source, inventory, zipSha256: ZIP_SHA, chromeSha256: hashFile(c.chrome), flags: FLAGS, route: ROUTE, viewport: { width: 1000, height: 800 }, seconds: secondsFor(c), worldReserveSeconds: 60 };
  return { at: new Date().toISOString(), fingerprint: sha(JSON.stringify(identity)), ...identity };
}
function eligibleIdle(dir, fingerprint) {
  assert.equal(read(path.join(dir, 'preflight.json')).fingerprint, fingerprint);
  const cleanup = read(path.join(dir, 'cleanup-supervisor.json'));
  assert.equal(cleanup.mode, 'idle'); assert.equal(cleanup.code, 0); assert.equal(cleanup.survivors.length, 0);
  assert.equal(cleanup.postflightPassed, true, 'Idle postflight integrity must pass');
  assert(read(path.join(dir, 'world-checkpoint.json')).readiness);
  assert.equal(read(path.join(dir, 'errors.json')).length, 0);
}
function descendants(rows, owned, rootPid) {
  const current = new Map(rows.map(p => [p.pid, p]));
  let more = true;
  while (more) {
    more = false;
    for (const p of rows) {
      if (owned.has(p.pid)) continue;
      const parent = owned.get(p.ppid);
      const liveParent = current.get(p.ppid);
      if (p.pid === rootPid || (parent && liveParent?.startTicks === parent.startTicks)) {
        owned.set(p.pid, p); more = true;
      }
    }
  }
}
function serverFor(c, map) {
  return http.createServer((req, res) => {
    try {
      const u = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let p;
      if (u === '/SilverDemo.zip') p = c.zip;
      else if (u.startsWith('/fixture/')) { const f = map.get(u.slice(9).toLowerCase()); assert(f); p = path.join(c.fixture, f.path); }
      else {
        assert(!/\/binaries\/dlls\//i.test(u) && !(u.startsWith('/src/') && u !== '/src/api_table.json') && u !== '/lib/watx-compile-worker.js');
        p = path.resolve(c.root, '.' + (u === '/' ? '/index.html' : u)); assert(p.startsWith(c.root + path.sep));
      }
      const stat = fs.statSync(p); assert(stat.isFile());
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin'); res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css' })[path.extname(p)] || 'application/octet-stream');
      res.setHeader('Accept-Ranges', 'bytes');
      let start = 0, end = stat.size - 1;
      if (req.headers.range) {
        const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range); assert(m);
        start = Number(m[1]); end = m[2] ? Math.min(Number(m[2]), end) : end;
        if (start > end || start >= stat.size) { res.writeHead(416); return res.end(); }
        res.statusCode = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      }
      res.setHeader('Content-Length', end - start + 1);
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(p, { start, end }).on('error', () => res.destroy()).pipe(res);
    } catch { res.writeHead(404); res.end(); }
  });
}
async function child(c, out, mode) {
  let browser, server, page, closing = false, timer, phase = 'menu', shots = 0, bytes = 0;
  const commands = [], errors = [], responses = [], pending = new Set();
  const pins = preflight(c); save(out, 'preflight.json', pins);
  const deadlineAt = Date.now() + pins.seconds * 1000;
  const controlState = () => save(out, 'control-state.json', { at: Date.now(), deadlineAt, closing, phase, mode, driver: proc(process.pid), worldReserveSeconds: 60 });
  controlState();
  if (mode === 'input') {
    assert(c.idleRun, 'Completed idle run required');
    eligibleIdle(c.idleRun, pins.fingerprint);
    save(out, 'idle-reference.json', { run: c.idleRun, fingerprint: pins.fingerprint, checkpoint: read(path.join(c.idleRun, 'world-checkpoint.json')) });
  }
  const log = text => {
    const line = JSON.stringify({ at: Date.now(), text }) + '\n'; bytes += Buffer.byteLength(line);
    if (bytes <= 8 * 1024 ** 2) fs.appendFileSync(path.join(out, 'console.jsonl'), line);
    else void close('log-budget');
  };
  async function state() {
    return page.evaluate(() => {
      const w = runningApps.find(a => a.wine)?.wine;
      return { at: Date.now(), running: w?.running, guestWorker: !!w?.guestWorker, hostMouseButtons: w?.renderer?._mouseButtonsMask, audio: { state: w?._audioCtx?.state, time: w?._audioCtx?.currentTime }, backend: w?.hostCtx?.d3d9Bridge?.backend ?? null, legacyRenderer: window.WineD3D?.renderer ?? null, windows: Object.values(w?.renderer?.windows || {}).map(x => ({ hwnd: x.hwnd, title: x.title, x: x.x, y: x.y, w: x.w, h: x.h, visible: x.visible })) };
    });
  }
  async function shot(name) {
    assert(safeName(name)); assert(!fs.existsSync(path.join(out, name + '.png')), 'Never overwrite a checkpoint');
    assert(++shots <= 28, 'Screenshot budget exceeded');
    await page.screenshot({ path: path.join(out, name + '.png') });
    const s = { ...await state(), pngSha256: hashFile(path.join(out, name + '.png')), phase, mode };
    save(out, name + '.json', s); return s;
  }
  async function close(reason) {
    if (closing) return; closing = true; controlState(); clearTimeout(timer);
    try { if (page && shots < 28) await shot('final'); } catch (e) { errors.push(String(e)); }
    try { await browser?.close(); } catch (e) { errors.push(String(e)); }
    await Promise.allSettled([...pending]);
    server?.closeAllConnections(); if (server) await new Promise(r => server.close(r));
    if (!responses.length || responses.some(r => !r.expected)) errors.push('No verified matching loaded WASM response');
    save(out, 'commands.json', commands); save(out, 'errors.json', errors); save(out, 'module-responses.json', responses);
    save(out, 'cleanup-driver.json', { at: new Date().toISOString(), reason, mode, phase, playerControlVerified: false });
    process.exitCode = errors.length ? 1 : 0;
  }
  async function observe(prefix) {
    const start = Date.now();
    for (const seconds of [0, 2, 5, 10, 20]) {
      await delay(Math.max(0, start + seconds * 1000 - Date.now()));
      if (closing) return;
      await shot(`${prefix}-${seconds}s`);
    }
  }
  try {
    timer = setTimeout(() => void close(`${pins.seconds}-second deadline`), Math.max(0, deadlineAt - Date.now()));
    server = serverFor(c, fixtureMap(pins.inventory)); await new Promise(r => server.listen(0, '127.0.0.1', r));
    const puppeteer = require(path.join(c.root, 'node_modules/puppeteer'));
    browser = await puppeteer.launch({ executablePath: c.chrome, headless: true, args: FLAGS, timeout: 30000 });
    save(out, 'pids.json', { driverPid: process.pid, chromePid: browser.process().pid });
    page = await browser.newPage(); await page.setViewport(pins.viewport);
    page.on('console', m => log(m.text())); page.on('pageerror', e => errors.push(String(e)));
    page.on('response', response => {
      if (new URL(response.url()).pathname !== '/build/wine-assembly.wasm') return;
      const job = (async () => { try { const data = await response.buffer(); const h = sha(data); responses.push({ url: response.url(), status: response.status(), bytes: data.length, sha256: h, expected: h === c.wasmSha256 }); if (h !== c.wasmSha256) { errors.push('Loaded module mismatch'); void close('module-mismatch'); } } catch (e) { errors.push(String(e)); } })();
      pending.add(job); void job.finally(() => pending.delete(job));
    });
    await page.evaluateOnNewDocument(() => { window.__waTraceCategories = new Set(); window.__waTraceApiNames = new Set(); });
    await page.goto('http://127.0.0.1:' + server.address().port + ROUTE, { waitUntil: 'load', timeout: 45000 });
    const files = pins.inventory.map(f => ({ url: '/fixture/' + f.path, vfsPath: 'c:\\silver\\' + f.path.replaceAll('/', '\\') }));
    await page.evaluate(files => {
      apps.silver_probe = { exe: '/fixture/silver.exe', exeGuestPath: 'C:\\silver\\silver.exe', dlls: ['/fixture/Mss32.dll', '/fixture/Smackw32.dll'], files, requiredFiles: true };
      shell.launchApp('silver_probe', { beforeRun: async wine => {
        const provider = await window.byteProvider.HttpRangeProvider.open('/SilverDemo.zip');
        await window.ZipMount.mountZip(wine._helpCtx.vfs, provider, { zipPath: 'SilverDemo.zip', root: 'D:/SILVER/' });
      } }).catch(e => console.error('launch', e));
    }, files);
    const browserVersion = await browser.version();
    if (mode === 'input') assert.equal(browserVersion, read(path.join(c.idleRun, 'identity.json')).browser);
    save(out, 'identity.json', { at: new Date().toISOString(), mode, config: c, fingerprint: pins.fingerprint, browser: browserVersion, route: ROUTE, flags: FLAGS, viewport: pins.viewport, sourceHead: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: c.root, encoding: 'utf8' }).trim(), playerControlVerified: false });
    await shot('startup');
    let sequence = 0, lastSample = 0, worldHolds = 0, startMoved = false;
    while (!closing) {
      if (Date.now() - lastSample > 2000) { lastSample = Date.now(); fs.appendFileSync(path.join(out, 'timing.jsonl'), JSON.stringify(await state()) + '\n'); }
      const commandPath = path.join(out, `command-${sequence}.json`);
      if (!fs.existsSync(commandPath)) { await delay(250); continue; }
      const command = read(commandPath); const number = sequence++;
      try {
        budget(command, deadlineAt);
        validate(command, mode, phase, out);
        if (command.action === 'shot') await shot(command.name);
        else if (command.action === 'quit') await close('requested-quit');
        else if (command.action === 'mark-world') {
          phase = 'world'; save(out, 'world-checkpoint.json', { at: Date.now(), ...command });
          if (mode === 'idle') await observe('idle');
        }
        else if (command.action === 'relative') {
          if (phase === 'menu') { assert(!startMoved, 'Exactly one relative Start movement'); startMoved = true; }
          await page.evaluate(c => { const w = runningApps.find(a => a.wine)?.wine; w.renderer.handleMouseMove(c.x, c.y, { relative: true, directDx: c.dx, directDy: c.dy }); }, command);
          await shot(`after-command-${number}`);
        } else {
          if (phase === 'menu') assert(startMoved, 'Review relative Start positioning before button hold');
          if (phase === 'world') assert(++worldHolds <= 2, 'At most two world destinations');
          await shot(`before-hold-${number}`);
          await page.evaluate(c => runningApps.find(a => a.wine).wine.renderer.handleMouseDown(c.x, c.y, 0), command);
          try { await delay(500); save(out, `held-${number}.json`, await state()); await delay(500); }
          finally { if (!page.isClosed()) await page.evaluate(c => runningApps.find(a => a.wine).wine.renderer.handleMouseUp(c.x, c.y, 0), command); }
          if (phase === 'menu') phase = 'started';
          await shot(`after-command-${number}`);
          if (phase === 'world') await observe(`ground-${worldHolds}`);
        }
        commands.push({ at: Date.now(), number, status: 'executed', command });
      } catch (e) { errors.push(String(e)); commands.push({ at: Date.now(), number, status: 'rejected-or-failed', command, error: String(e) }); }
      controlState();
      save(out, 'commands.json', commands);
    }
  } catch (e) { errors.push(String(e.stack || e)); await close('error'); }
}

function proc(pid) {
  try { const s = fs.readFileSync('/proc/' + pid + '/stat', 'utf8'); const t = s.slice(s.lastIndexOf(')') + 2).split(' '); return { pid: Number(pid), ppid: Number(t[1]), state: t[0], startTicks: t[19] }; } catch { return null; }
}
async function supervise(config, out, mode) {
  const c = read(config); assert(!fs.existsSync(out), 'Fresh output directory required'); preflight(c); fs.mkdirSync(out, { recursive: true });
  const log = fs.openSync(path.join(out, 'driver.log'), 'wx');
  const worker = cp.spawn(process.execPath, [__filename, '--child', config, out, mode], { detached: true, stdio: ['ignore', log, log] }); fs.closeSync(log);
  const owned = new Map();
  const census = () => { const rows = fs.readdirSync('/proc').filter(n => /^\d+$/.test(n)).map(proc).filter(Boolean); descendants(rows, owned, worker.pid); save(out, 'owned-pids.json', [...owned.values()]); };
  const signal = name => { census(); for (const old of [...owned.values()].reverse()) { const now = proc(old.pid); if (now?.startTicks === old.startTicks) try { process.kill(old.pid, name); } catch {} } };
  census(); const poll = setInterval(census, 500);
  const seconds = secondsFor(c);
  const deadline = setTimeout(() => signal('SIGTERM'), (seconds + 20) * 1000), kill = setTimeout(() => signal('SIGKILL'), (seconds + 25) * 1000);
  process.on('SIGTERM', () => signal('SIGTERM')); process.on('SIGINT', () => signal('SIGTERM'));
  const result = await new Promise(resolve => { worker.on('error', e => resolve({ code: 1, error: String(e) })); worker.on('close', (code, signal) => resolve({ code, signal })); });
  clearTimeout(deadline); clearTimeout(kill); signal('SIGTERM'); await delay(1000); signal('SIGKILL'); await delay(500); clearInterval(poll);
  const survivors = [...owned.values()].filter(old => proc(old.pid)?.startTicks === old.startTicks);
  let postflightPassed = false; try { save(out, 'postflight.json', preflight(c)); postflightPassed = true; } catch (e) { save(out, 'postflight-error.json', { error: String(e) }); }
  save(out, 'cleanup-supervisor.json', { at: new Date().toISOString(), mode, ...result, owned: [...owned.values()], survivors, postflightPassed });
  process.exitCode = result.code === 0 && !survivors.length && postflightPassed ? 0 : 1;
}
module.exports = { fixtureMap, validate, budget, submit, secondsFor, eligibleIdle, descendants, serverFor, ZIP_SHA, EXE_SHA, ROUTE, FLAGS };
if (require.main === module) {
  const [action, config, output, mode] = process.argv.slice(2);
  if (action === '--submit') {
    console.log(JSON.stringify(submit(path.resolve(config), Number(output), JSON.parse(mode))));
  } else {
  assert(['--child', '--runtime-grant'].includes(action), 'Usage: node tools/silver-control-comparison.js --runtime-grant CONFIG NEW_OUTPUT idle|input; do not run before reservation');
  assert(config && output && ['idle', 'input'].includes(mode));
  const job = action === '--child' ? child(read(config), path.resolve(output), mode) : supervise(path.resolve(config), path.resolve(output), mode);
  job.catch(e => { console.error(e); process.exitCode = 1; });
  }
}
