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
// The host's walk through EINSTELLUNGEN and the two held keys cost about a
// minute between them on top of the lobby and the slowdown phases.
H.budget(arg('timeout', 600) * 1000);
fs.mkdirSync(OUT, { recursive: true });
H.clearPngs(OUT);

const DOWN = 40, UP = 38, ENTER = 13, ESC = 27, LEFT = 37, RIGHT = 39;
const A = 65, D = 68, W = 87;

// Player one is the host and player two is the client (Instructions.txt 3.4),
// and volley.exe's OWN default makes player one the COMPUTER on a keyboard
// layout that is not A/D/W -- so a hosting human has no controls at all and
// its blob only twitches when the AI reacts to the ball, which looks exactly
// like a broken network game. We now mount a settings.dat (the game's own
// save file, written by walking this same menu once) that puts player one on
// A/D/W, so nobody has to do this by hand. The walk is kept for a profile
// whose own saved settings override the mounted copy:
//   settings -> STEUERUNG 1 -> TASTATUR -> TASTEN DEFINIEREN -> six keys
//   -> ESC lands back on the main menu with EINSTELLUNGEN still selected
const HOST_SETUP = [
  DOWN, DOWN, DOWN, ENTER,
  DOWN, DOWN, ENTER, ENTER, ENTER,
  DOWN, DOWN, DOWN, ENTER,
  A, D, W, LEFT, RIGHT, UP,
  ESC,
];

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

// Real DOM key events, not sharedRenderer.handleKeyDown().
//
// Driving the renderer directly skips the page's own key listener, which is
// the half a person's fingers actually use -- so a test that calls it proves
// the emulator can move a blob and says nothing about whether the browser
// can. Everything here goes through page.keyboard for that reason.
const KEYNAME = {
  40: 'ArrowDown', 38: 'ArrowUp', 37: 'ArrowLeft', 39: 'ArrowRight',
  13: 'Enter', 27: 'Escape', 65: 'KeyA', 68: 'KeyD', 87: 'KeyW',
};
const keyName = (vk) => {
  const name = KEYNAME[vk];
  if (!name) throw new Error(`no DOM key name for VK ${vk}`);
  return name;
};

async function keys(page, list) {
  for (const vk of list) {
    await page.keyboard.down(keyName(vk));
    await H.sleep(150);
    await page.keyboard.up(keyName(vk));
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

// Where each player's blob is, as a fraction of the court's width.
//
// frameHash above answers "is anything moving", and that is not the same
// question: the ball keeps moving while a player is stuck, so a match with
// one dead blob passes every frame-hash check in this file. This one names
// the players separately. Red is player one (the host), green is player two
// (the client). The band is a fraction of the canvas rather than pixels
// because the CLI renders 640x480 and the browser 800x600; it starts below
// the palms, which are exactly as green as player two, and below the score,
// which is exactly as red as player one.
const blobsAt = (band) => {
  const win = Object.values(sharedRenderer.windows || {})
    .filter(w => w && w.visible && !w.isChild)
    .sort((a, b) => b.w * b.h - a.w * a.h)[0];
  if (!win) return null;
  const surface = sharedRenderer.getWindowCanvas(win.hwnd);
  if (!surface || !surface.canvas) return null;
  const c = surface.canvas;
  const y0 = Math.floor(c.height * band[0]);
  const y1 = Math.floor(c.height * band[1]);
  const d = surface.ctx.getImageData(0, y0, c.width, y1 - y0).data;
  const near = (i, r, g, b) => Math.abs(d[i] - r) <= 70
    && Math.abs(d[i + 1] - g) <= 70 && Math.abs(d[i + 2] - b) <= 70;
  const acc = { red: { n: 0, x: 0 }, green: { n: 0, x: 0 } };
  for (let i = 0; i < d.length; i += 4) {
    const x = (i / 4) % c.width;
    if (near(i, 200, 30, 30)) { acc.red.n++; acc.red.x += x; }
    else if (near(i, 30, 210, 30)) { acc.green.n++; acc.green.x += x; }
  }
  const of = (a) => (a.n < 100 ? null : a.x / a.n / c.width);
  return { red: of(acc.red), green: of(acc.green) };
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
    // --host-setup walks EINSTELLUNGEN first and is now only for a profile
    // carrying its own saved settings.dat in localStorage; the mounted one
    // already puts player one on the keyboard, and the gameplay checks below
    // are what proves it, since the host cannot move at all without it.
    if (flag('host-setup')) {
      await keys(host.page, HOST_SETUP);
      await snap(host, 'host-settings');
    }
    // NETZWERKSPIEL is one down from the top of an untouched main menu; ESC
    // out of the settings screen instead leaves EINSTELLUNGEN selected, two up.
    const toNetwork = flag('host-setup') ? [UP, UP] : [DOWN];
    await keys(host.page, [...toNetwork, ENTER, ENTER, DOWN, DOWN, ENTER]);
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

    // ---- both players can actually play ----------------------------------
    //
    // Frames crossing is not a match, and neither is a moving picture: the
    // ball keeps moving while a player is stuck, which is what a real pair of
    // testers hit -- one blob answered the keyboard and the other did not.
    // So drive each side from its OWN keyboard and read the two blobs apart
    // on BOTH screens. A player is played across the wire when the machine
    // that never saw the key agrees about where that blob went.
    const BAND = [0.64, 0.98];
    const read = p => p.page.evaluate(blobsAt, BAND);
    const hold = async (p, vk, ms) => {
      await p.page.keyboard.down(keyName(vk));
      await H.sleep(ms);
      const seen = { host: await read(host), guest: await read(guest) };
      await p.page.keyboard.up(keyName(vk));
      await H.sleep(1500);
      return seen;
    };
    // Held, not tapped, and photographed with the key still down: a released
    // blob drifts, and two machines sampled mid-drift disagree about time
    // rather than about the game.
    const rest = { host: await read(host), guest: await read(guest) };
    const pushed = await hold(host, A, 3000);      // host drives player one
    const pulled = await hold(guest, RIGHT, 3000); // guest drives player two

    const MOVED = 0.04;   // a blob is about 0.08 of the court wide
    const AGREE = 0.03;
    const shift = (from, to, who) => (from && to && from[who] !== null
      && to[who] !== null) ? to[who] - from[who] : null;
    const fmt = v => (v === null || v === undefined ? 'gone' : v.toFixed(3));
    console.log(`  player one (host's own): ${fmt(rest.host.red)} ->`
      + ` ${fmt(pushed.host.red)} on its own screen, ${fmt(pushed.guest.red)} on its peer's`);
    console.log(`  player two (guest's own): ${fmt(rest.guest.green)} ->`
      + ` ${fmt(pulled.guest.green)} on its own screen, ${fmt(pulled.host.green)} on its peer's`);

    const oneHere = shift(rest.host, pushed.host, 'red');
    const oneThere = shift(rest.guest, pushed.guest, 'red');
    check('the HOST can move its own player (the half that was stuck)',
      oneHere !== null && oneHere < -MOVED, `moved ${fmt(oneHere)}`);
    check('and the peer that never saw that key saw it move the same way',
      oneThere !== null && oneThere < -MOVED, `moved ${fmt(oneThere)}`);
    check('both screens agree where player one is',
      pushed.host.red !== null && pushed.guest.red !== null
        && Math.abs(pushed.host.red - pushed.guest.red) < AGREE);

    const twoHere = shift(pushed.guest, pulled.guest, 'green');
    const twoThere = shift(pushed.host, pulled.host, 'green');
    check('the GUEST can move its own player', twoHere !== null && twoHere > MOVED,
      `moved ${fmt(twoHere)}`);
    check('and its peer saw that one move too', twoThere !== null && twoThere > MOVED,
      `moved ${fmt(twoThere)}`);
    check('both screens agree where player two is',
      pulled.host.green !== null && pulled.guest.green !== null
        && Math.abs(pulled.host.green - pulled.guest.green) < AGREE);
    await snap(host, 'host-played');
    await snap(guest, 'guest-played');

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
