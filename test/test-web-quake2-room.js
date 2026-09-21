#!/usr/bin/env node

// Quake II's star room, between two browsers: one hosts, the other is offered
// the match on the Join card and lands in it.
//
//   node test/test-web-quake2-room.js [--timeout=540] [--headful]
//
// Everything lib/vlan-room.js and lib/vlan-star.js do is covered in Node by
// test-vlan-star.js, and the probe against the real game by
// test-quake2-host-probe.js. What neither can see is the page: that the
// host's first socket() opens a room without asking anything, that its probe
// marks the room hosting in presence, that a second browser opening the game
// is shown the card before its game starts, and that Join launches it with
// +connect to the owner's seat over WebRTC. Each browser context is its own
// cookie, so its own signaling user, as two people are.
//
// A third browser says "Not now", starts at the game's menu, and joins from
// the toast the shell shows it later. That join reaches a game already past
// its command line, so it goes through lan.join.inGame typing into Quake's
// console. It is also the three-player room where an unread UDP socket used
// to stall the wire.

'use strict';

const fs = require('fs');
const path = require('path');
const { createServer } = require('../tools/dev-server');
const H = require('./hearts-web-helper');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'test', 'binaries', 'candidates', 'quake-2-demo-installer',
  'installed-extracted', 'Install', 'Data', 'quake2.exe');
const OUT = path.join(ROOT, 'test', 'output', 'web-quake2-room');

const arg = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : dflt;
};
const flag = name => process.argv.includes(`--${name}`);

const STARTED = Date.now();
let passed = 0;
let failed = 0;
function check(what, ok, detail) {
  const at = ((Date.now() - STARTED) / 1000).toFixed(0).padStart(4);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${at}s  ${what}${detail && !ok ? ` -- ${detail}` : ''}`);
  ok ? passed++ : failed++;
}

let puppeteer = null;
try { puppeteer = require('puppeteer'); } catch (_) {}
const CHROME = H.findChrome();
if (!fs.existsSync(EXE)) {
  console.log('SKIP  Quake II demo not installed at', EXE);
  process.exit(0);
}
if (!puppeteer || !CHROME) {
  console.log('SKIP  no Chrome or no puppeteer (set CHROME=)');
  process.exit(0);
}
H.budget(arg('timeout', 540) * 1000);
fs.mkdirSync(OUT, { recursive: true });
H.clearPngs(OUT);

// The software renderer: headless Chrome's WebGL is not what this is about,
// and ref_soft is the renderer the CLI gameplay gate uses.
const HOST_ARGS = '+set vid_ref soft +set deathmatch 1 +set maxclients 4 +map demo1';
const JOIN_ARGS = '+set vid_ref soft +menu_main';

const chipText = () => {
  const chip = document.getElementById('wine-lan-chip');
  return chip ? chip.textContent : '';
};
const cardText = () => {
  const card = document.getElementById('wine-lan-card');
  return card ? card.textContent : '';
};
const wireOf = () => {
  const w = runningApps[0] && runningApps[0].wine.vlanWire;
  return w ? {
    address: w.address, sent: w.sentFrames, recv: w.recvFrames,
    members: w.memberCount === undefined ? null : w.memberCount,
    forwarded: w.forwardedFrames === undefined ? null : w.forwardedFrames,
  } : null;
};
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
  const colours = new Set();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
    if ((i & 0xfc) === 0) colours.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
  }
  // The back-canvas may be an OffscreenCanvas, which has no toDataURL.
  const copy = document.createElement('canvas');
  copy.width = c.width;
  copy.height = c.height;
  copy.getContext('2d').drawImage(c, 0, 0);
  return { lit: lit / (d.length / 4), colours: colours.size, png: copy.toDataURL('image/png') };
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

  const open = async (label, args) => {
    const ctx = browser.createBrowserContext
      ? await browser.createBrowserContext()
      : await browser.createIncognitoBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1000, height: 760, deviceScaleFactor: 1 });
    const problems = [];
    const lanLog = [];
    page.on('pageerror', e => problems.push(String(e)));
    page.on('console', m => {
      const t = m.text();
      if (/UNIMPLEMENTED API:|RuntimeError|LinkError|crashed|FATAL:/i.test(t)) {
        problems.push(t.slice(0, 300));
      }
    });
    await page.goto(`${base}/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('typeof launchApp === "function"', { timeout: 60000 });
    await page.evaluate(a => {
      window.wineApps.APPS.quake2_demo.args = a;
      document.getElementById('app-select').value = 'quake2_demo';
      window.__launching = launchApp();
    }, args);
    return { label, page, problems, lanLog, ctx };
  };
  const snap = async (side, name) => {
    const s = await side.page.evaluate(snapWindow);
    H.savePng(OUT, name, s && s.png);
    return s;
  };
  const debugLog = side => side.page.evaluate(() => {
    const pane = document.getElementById('log') || document.getElementById('debug-log');
    return pane ? pane.textContent.split('\n').filter(l => /LAN/.test(l)).join('\n') : '';
  });

  try {
    // ---- the host: a server, which goes online by itself ------------------
    const host = await open('host', HOST_ARGS);
    const hostChip = await H.until(host.page, 'host: never showed it was hosting',
      () => {
        const chip = document.getElementById('wine-lan-chip');
        const t = chip ? chip.textContent : '';
        return /hosting/.test(t) ? t : null;
      }, null, 300000);
    check('the host went online without being asked anything, and its room says it is hosting',
      !!hostChip, `chip: ${await host.page.evaluate(chipText)}`);
    if (hostChip) console.log(`  host chip: ${hostChip}`);
    check('the host is the room owner at 10.0.0.1',
      (await host.page.evaluate(wireOf) || {}).address === '10.0.0.1',
      JSON.stringify(await host.page.evaluate(wireOf)));
    if (!hostChip) {
      console.log(await debugLog(host));
      await snap(host, 'host-not-hosting');
      throw new Error('no hosting room to offer');
    }

    // ---- the joiner: offered the match before its game starts -------------
    const guest = await open('guest', JOIN_ARGS);
    const card = await H.until(guest.page, 'guest: no Join card',
      () => {
        const c = document.getElementById('wine-lan-card');
        return c ? c.textContent : null;
      }, null, 60000);
    check(`the second browser was offered the match before launching (${card ? JSON.stringify(card) : 'no card'})`,
      !!card && /is hosting Quake II/.test(card) && /demo1/.test(card));
    check('and its game was not started behind the card',
      await guest.page.evaluate(() => runningApps.length === 0));
    await guest.page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#wine-lan-card button'))
        .find(x => /^Join /.test(x.textContent));
      b.click();
    });

    const joined = await H.until(guest.page, 'guest: never wired',
      () => { const w = runningApps[0] && runningApps[0].wine.vlanWire; return w ? w.address : null; },
      null, 60000);
    check(`Join put the guest in the room at a member seat (${joined})`, joined === '10.0.0.2');
    const args = await guest.page.evaluate(() => runningApps[0] && runningApps[0].wine._extraArgs);
    check(`Join launched straight at the owner, with no menu over the match (${args})`,
      /\+connect 10\.0\.0\.1\b/.test(args || '') && !/\+menu_main/.test(args || ''));

    // The client is in the game once usercmds flow both ways for a while.
    const flowing = await H.until(guest.page, 'guest: no traffic from the server',
      () => { const w = runningApps[0] && runningApps[0].wine.vlanWire; return w && w.recvFrames > 300 ? w.recvFrames : null; },
      null, 240000);
    const hw = await host.page.evaluate(wireOf);
    const gw = await guest.page.evaluate(wireOf);
    console.log(`  host wire ${JSON.stringify(hw)}\n  guest wire ${JSON.stringify(gw)}`);
    check(`the server's frames reach the joiner (${flowing || 0} received)`, !!flowing);
    check('the owner counts one member', hw && hw.members === 1);
    check('the joiner talks to the server too', gw && gw.sent > 50);

    await H.sleep(8000);
    const hp = await snap(host, 'host-match');
    const gp = await snap(guest, 'guest-match');
    const pct = s => (s ? `${(s.lit * 100).toFixed(0)}% lit, ${s.colours} colours` : 'no picture');
    check(`the joiner is in the level (${pct(gp)})`, !!gp && gp.lit > 0.3 && gp.colours > 40);
    console.log(`  host picture: ${pct(hp)}`);

    // ---- a third player, already playing when they take the offer --------
    //
    // "Not now" on the card, so the game starts at its own menu with no room.
    // The shell keeps looking, offers the same host again as a toast, and a
    // Join there has to reach a game that is past its command line: the
    // recipe types `connect 10.0.0.1 into its console. Three players is also
    // the room the unread-UDP stall used to freeze.
    const third = await open('third', JOIN_ARGS);
    const offered = await H.until(third.page, 'third: no Join card',
      () => !!document.getElementById('wine-lan-card'), null, 60000);
    if (offered) {
      await third.page.evaluate(() => {
        Array.from(document.querySelectorAll('#wine-lan-card button'))
          .find(x => x.textContent === 'Not now').click();
      });
    }
    const running = await H.until(third.page, 'third: game never started',
      () => runningApps.length > 0 && !runningApps[0].wine.vlanWire, null, 60000);
    check('"Not now" starts the game with no room', !!running);
    const toast = await H.until(third.page, 'third: no toast',
      () => { const c = document.getElementById('wine-lan-card'); return c ? c.textContent : null; },
      null, 90000);
    check(`the running game was offered the host as a toast (${toast ? JSON.stringify(toast) : 'none'})`,
      !!toast && /is hosting Quake II/.test(toast));
    if (toast) {
      await third.page.evaluate(() => {
        Array.from(document.querySelectorAll('#wine-lan-card button'))
          .find(x => /^Join /.test(x.textContent)).click();
      });
    }
    const thirdSeat = await H.until(third.page, 'third: never wired',
      () => { const w = runningApps[0] && runningApps[0].wine.vlanWire; return w ? w.address : null; },
      null, 60000);
    check(`the toast put the third player at the next seat (${thirdSeat})`, thirdSeat === '10.0.0.3');
    const thirdIn = await H.until(third.page, 'third: no traffic from the server',
      () => { const w = runningApps[0] && runningApps[0].wine.vlanWire; return w && w.recvFrames > 300 ? w.recvFrames : null; },
      null, 240000);
    check(`the typed connect reached the server (${thirdIn || 0} frames received)`, !!thirdIn);
    const threeUp = await H.until(host.page, 'host: never counted three',
      () => {
        const pane = document.getElementById('log');
        return pane && /hosting noname demo1 3\/4/.test(pane.textContent);
      }, null, 60000);
    check('the server counts three players', !!threeUp);
    const before = await guest.page.evaluate(wireOf);
    await H.sleep(6000);
    const after = await guest.page.evaluate(wireOf);
    check(`the first joiner kept receiving with three in the room (${before && after ? after.recv - before.recv : 0} frames in 6s)`,
      !!before && !!after && after.recv - before.recv > 20);
    const hw3 = await host.page.evaluate(wireOf);
    check('the owner counts two members', hw3 && hw3.members === 2, JSON.stringify(hw3));
    await H.sleep(4000);
    const tp = await snap(third, 'third-match');
    check(`the third player is in the level (${pct(tp)})`, !!tp && tp.lit > 0.3 && tp.colours > 40);

    for (const side of [host, guest, third]) {
      check(`${side.label}: no page errors`, side.problems.length === 0, side.problems.slice(0, 3).join(' | '));
    }
    console.log(`--- host LAN log\n${await debugLog(host)}\n--- guest LAN log\n${await debugLog(guest)}`
      + `\n--- third LAN log\n${await debugLog(third)}`);
  } catch (e) {
    check('the run completed', false, String(e && e.stack || e).split('\n').slice(0, 3).join(' '));
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
  console.log(`test-web-quake2-room: ${passed} passed, ${failed} failed (captures in ${OUT})`);
  process.exit(failed ? 1 : 0);
})();
