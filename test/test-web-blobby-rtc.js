#!/usr/bin/env node

// Blobby Volley between two browsers, introduced by the lobby and joined over
// WebRTC -- the path two people on two devices take.
//
//   node test/test-web-blobby-rtc.js [--timeout=420] [--headful] [--keep]
//
// test-web-blobby-lan.js is the same match on one tab's LoopbackSegment. This
// one puts each player in its own browser context (its own cookie, so its own
// signaling user), has one of them pick the other in the lobby, and plays over
// the data channel lib/vlan-rtc.js sets up. A failure here alone is the RTC
// wire's or the lobby's; one that also fails in the tab test is DirectPlay's.

'use strict';

const fs = require('fs');
const path = require('path');
const { createServer } = require('../tools/dev-server');
const H = require('./hearts-web-helper');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'packages', 'freeware', 'blobby-volley', 'volley.exe');
const OUT = path.join(ROOT, 'test', 'output', 'web-blobby-rtc');

const arg = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : dflt;
};
const flag = name => process.argv.includes(`--${name}`);
const MILESTONE_MS = arg('milestone-timeout', 120) * 1000;
const MENU_MS = arg('menu-wait', 20) * 1000;
// Two people are never two identical machines. The guest's browser is slowed
// by this factor, because the failure this test exists to catch only happens
// when one side consumes the other's records more slowly than they arrive:
// a phone, or simply a window that is not in front (Chrome throttles a
// background tab's timers to about 1Hz, which is the same thing but worse).
const THROTTLE = arg('throttle', 4);

let passed = 0;
let failed = 0;
function check(what, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail && !ok ? ` -- ${detail}` : ''}`);
  ok ? passed++ : failed++;
}

let puppeteer = null;
try { puppeteer = require('puppeteer'); } catch (_) {}
const CHROME = H.findChrome();
if (!fs.existsSync(EXE)) {
  console.log('SKIP  volley.exe not found');
  process.exit(0);
}
if (!puppeteer || !CHROME) {
  console.log('SKIP  no Chrome or no puppeteer (set CHROME=)');
  process.exit(0);
}
H.budget(arg('timeout', 420) * 1000);
fs.mkdirSync(OUT, { recursive: true });
H.clearPngs(OUT);

const DOWN = 40, UP = 38, ENTER = 13;

const wireOf = () => {
  const w = runningApps[0] && runningApps[0].wine.vlanWire;
  return w ? { sent: w.sentFrames, recv: w.recvFrames } : null;
};

// The game's largest visible window, off its own back-canvas; `lit` is the
// share of pixels that are not near-black (menus are dim, the court is not).
const snapWindow = () => {
  const win = Object.values(sharedRenderer.windows || {})
    .filter(w => w && w.visible && !w.isChild)
    .sort((a, b) => b.w * b.h - a.w * a.h)[0];
  if (!win) return null;
  const surface = sharedRenderer.getWindowCanvas(win.hwnd);
  if (!surface || !surface.canvas) return null;
  const c = surface.canvas;
  const d = surface.ctx.getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) lit++;
  const copy = document.createElement('canvas');
  copy.width = c.width;
  copy.height = c.height;
  copy.getContext('2d').drawImage(c, 0, 0);
  return { lit: lit / (d.length / 4), png: copy.toDataURL('image/png') };
};

async function keys(page, list) {
  for (const vk of list) {
    await page.evaluate(k => sharedRenderer.handleKeyDown(k), vk);
    await H.sleep(150);
    await page.evaluate(k => sharedRenderer.handleKeyUp(k), vk);
    await H.sleep(900);
  }
}

async function snap(p, name) {
  const s = await p.page.evaluate(snapWindow);
  H.savePng(OUT, name, s && s.png);
  return s;
}

// Is the picture still moving? A frozen match and a running one are the same
// screenshot -- sand, two blobs, a ball -- so the only difference is between
// two of them taken a moment apart. Sampling every 97th byte is enough: a
// ball crossing the court changes thousands.
const frameHash = () => {
  const win = Object.values(sharedRenderer.windows || {})
    .filter(w => w && w.visible && !w.isChild)
    .sort((a, b) => b.w * b.h - a.w * a.h)[0];
  if (!win) return 0;
  const surface = sharedRenderer.getWindowCanvas(win.hwnd);
  if (!surface || !surface.canvas) return 0;
  const c = surface.canvas;
  const d = surface.ctx.getImageData(0, 0, c.width, c.height).data;
  let h = 2166136261;
  for (let i = 0; i < d.length; i += 97) h = Math.imul(h ^ d[i], 16777619);
  return h >>> 0;
};

(async () => {
  const server = createServer({ quiet: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({
    headless: !flag('headful'),
    executablePath: CHROME,
    args: ['--no-sandbox', '--no-first-run', '--no-default-browser-check'],
  });

  try {
    const open = async (label) => {
      const ctx = browser.createBrowserContext
        ? await browser.createBrowserContext()
        : await browser.createIncognitoBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 1000, height: 760, deviceScaleFactor: 1 });
      const problems = [];
      page.on('pageerror', e => problems.push(String(e)));
      page.on('console', m => {
        const t = m.text();
        if (/UNIMPLEMENTED API:|RuntimeError|LinkError|crashed|FATAL:/i.test(t)) {
          problems.push(t.slice(0, 300));
        }
      });
      await page.goto(`${base}/index.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction('typeof launchApp === "function"', { timeout: 60000 });
      await page.evaluate(() => {
        document.getElementById('app-select').value = 'blobby_volley';
        window.__launching = launchApp();
      });
      const cdp = await page.createCDPSession();
      return { label, page, problems, cdp };
    };

    const host = await open('host');
    const guest = await open('guest');

    const started = ({ page, label }) => H.until(page, `${label}: never booted`,
      () => runningApps.length > 0, null, MILESTONE_MS);
    check('both browsers booted Blobby straight into the game',
      !!(await started(host)) && !!(await started(guest)));

    const lobbyUp = ({ page }) => page.evaluate(
      () => document.querySelectorAll('.vln-lobby').length > 0);
    check('neither browser was asked anything before the game needed the room',
      !(await lobbyUp(host)) && !(await lobbyUp(guest)));

    // Each side walks its own copy into network play; that call is what opens
    // the lobby, and it parks until the lobby answers.
    await H.sleep(MENU_MS);
    await snap(host, 'host-menu');
    await keys(host.page, [DOWN, ENTER, ENTER, DOWN, DOWN, ENTER]);
    await keys(guest.page, [DOWN, ENTER, DOWN, ENTER, DOWN, DOWN, ENTER]);

    const peerRows = ({ page }) => page.evaluate(
      () => document.querySelectorAll('.vln-peer').length);
    for (let i = 0; i < 60 && !(await peerRows(host) && await peerRows(guest)); i++) {
      await H.sleep(1000);
    }
    check('each browser saw the other in the lobby',
      (await peerRows(host)) === 1 && (await peerRows(guest)) === 1);

    // Only one side clicks; the other connects on the invite.
    await host.page.evaluate(() => document.querySelector('.vln-peer button').click());
    const wired = ({ page, label }) => H.until(page, `${label}: never got a wire`,
      () => runningApps.length > 0 && !!runningApps[0].wine.vlanWire, null, MILESTONE_MS);
    check('the inviting browser connected', !!(await wired(host)));
    check('the invited browser connected without clicking', !!(await wired(guest)));
    await H.sleep(3000);
    await snap(host, 'host-waiting');

    const found = await H.until(guest.page, 'the search got no answer',
      () => { const w = (runningApps[0] && runningApps[0].wine.vlanWire); return w && w.recvFrames > 0; },
      null, MILESTONE_MS);
    check('the guest\'s search was answered over the data channel', !!found,
      JSON.stringify(await guest.page.evaluate(wireOf)));
    await H.sleep(3000);
    await snap(guest, 'guest-found');
    await keys(guest.page, [UP, ENTER]);

    await H.sleep(8000);
    const a = [await host.page.evaluate(wireOf), await guest.page.evaluate(wireOf)];
    await H.sleep(5000);
    const b = [await host.page.evaluate(wireOf), await guest.page.evaluate(wireOf)];
    const flowing = [0, 1].every(i => a[i] && b[i]
      && b[i].sent - a[i].sent > 10 && b[i].recv - a[i].recv > 10);
    check('game records stream both ways (the match is running)', flowing,
      JSON.stringify({ a, b }));

    // ---- the two machines are not the same machine -----------------------
    //
    // Everything above ran two windows of one browser on one box, which is
    // the one pairing real people never have. Slow the guest down and play
    // on: what has to survive is not the frame rate but the match, and a
    // side that stops consuming its peer's records as fast as they arrive is
    // where a lockstep game stops dead with the court still on the screen.
    if (THROTTLE > 1) {
      await guest.cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    }
    await H.sleep(5000);
    const moving = async (p) => {
      const seen = new Set();
      for (let i = 0; i < 4; i++) {
        seen.add(await p.page.evaluate(frameHash));
        await H.sleep(4000);
      }
      return seen;
    };
    const [hostFrames, guestFrames] = await Promise.all([moving(host), moving(guest)]);
    check(`the host's match kept moving with a ${THROTTLE}x slower peer `
      + `(${hostFrames.size}/4 distinct frames)`, hostFrames.size >= 3);
    check(`the slow guest's match kept moving (${guestFrames.size}/4 distinct frames)`,
      guestFrames.size >= 3);
    const after = [await host.page.evaluate(wireOf), await guest.page.evaluate(wireOf)];
    check('records still crossing after the slowdown',
      [0, 1].every(i => after[i] && after[i].recv - b[i].recv > 10),
      JSON.stringify({ b, after }));

    // ---- and one of the windows goes behind ------------------------------
    //
    // Two people on two devices never keep both windows in front; picking up
    // the phone puts the other one behind by definition. A guest that stops
    // stepping there stops sending, and its peer -- which is waiting on those
    // records -- shows a court that never moves again. Somebody hosting a
    // game is the plainest case of a window that should keep working while
    // nobody is looking at it.
    await host.page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      Object.defineProperty(document, 'visibilityState',
        { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await H.sleep(3000);
    const [hiddenHost, watchingGuest] = await Promise.all([moving(host), moving(guest)]);
    check(`the hidden host kept playing (${hiddenHost.size}/4 distinct frames)`,
      hiddenHost.size >= 3);
    check(`its peer never froze while it was behind (${watchingGuest.size}/4)`,
      watchingGuest.size >= 3);
    const behind = [await host.page.evaluate(wireOf), await guest.page.evaluate(wireOf)];
    check('records still crossing with a window in the background',
      [0, 1].every(i => behind[i] && behind[i].recv - after[i].recv > 10),
      JSON.stringify({ after, behind }));

    const hp = await snap(host, 'host-match');
    const gp = await snap(guest, 'guest-match');
    check(`both browsers show the court (${hp ? (hp.lit * 100).toFixed(0) : 0}% / ${
      gp ? (gp.lit * 100).toFixed(0) : 0}% lit)`,
      !!hp && !!gp && hp.lit > 0.5 && gp.lit > 0.5);

    const problems = [...host.problems, ...guest.problems];
    check('neither page reported an error', problems.length === 0, problems.join(' | '));
    console.log(`Screenshots: ${OUT}`);
  } finally {
    if (!flag('keep')) await browser.close();
    server.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(error => {
  console.error(error.stack || error);
  console.log(`\n${passed} passed, ${failed + 1} failed`);
  process.exit(1);
});
