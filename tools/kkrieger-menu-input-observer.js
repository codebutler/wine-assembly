#!/usr/bin/env node
'use strict';

// Attach only after the runtime owner has visually confirmed the menu. Uses
// ordinary browser input and read-only diagnostics; never extends its owner.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.env.WA_TEST_ROOT || path.join(__dirname, '..'));
const run = path.resolve(process.env.WA_MENU_RUN || '');
const out = path.resolve(process.env.WA_MENU_OUT || '');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  if (!process.env.WA_MENU_RUN || !process.env.WA_MENU_OUT || process.env.WA_MENU_CONFIRMED !== '1')
    throw Error('Set WA_MENU_RUN, exclusive WA_MENU_OUT, WA_MENU_CONFIRMED=1 after inspecting the live menu');
  const deadline = Date.parse(process.env.WA_MENU_OWNER_DEADLINE || '');
  if (!Number.isFinite(deadline) || deadline - Date.now() < 60000)
    throw Error('WA_MENU_OWNER_DEADLINE must leave at least60s inside the existing owner bound');
  const x = Number(process.env.WA_MENU_START_X), y = Number(process.env.WA_MENU_START_Y);
  const action = process.env.WA_MENU_ACTION || 'keys';
  const holdMs = Number(process.env.WA_MENU_HOLD_MS || 250);
  if (!Number.isInteger(holdMs) || holdMs < 250 || holdMs > 5000) throw Error('WA_MENU_HOLD_MS must be250..5000');
  if (!['keys', 'enter', 'click'].includes(action)) throw Error('WA_MENU_ACTION must be keys, enter or click');
  if (action === 'click' && (!Number.isFinite(x) || !Number.isFinite(y)))
    throw Error('Set WA_MENU_START_X/Y from the reviewed live Start label center, in page pixels');
  fs.mkdirSync(out, {recursive: false});
  const endpoint = JSON.parse(fs.readFileSync(path.join(run, 'browser-endpoint.json')));
  const puppeteer = require(path.join(root, 'node_modules/puppeteer'));
  let browser, page;
  const events = [];
  // Hard observer bound: disconnects only. The owner retains browser lifetime.
  const timer = setTimeout(() => { browser?.disconnect(); }, 45000);
  try {
    browser = await puppeteer.connect({browserWSEndpoint: endpoint.wsEndpoint, defaultViewport: null,
      protocolTimeout: 5000});
    page = (await browser.pages()).find(p => /[?&]app=kkrieger_beta(?:&|$)/.test(p.url()));
    if (!page) throw Error('Original registered page missing');
    await page.evaluate(() => {
      const w = window.wineShell?.currentWine, e = w?.instance?.exports;
      if (!w?.running || w.guestWorker || !e?.set_trace_eip_range) throw Error('Expected cooperative live original');
      if (window.__kkriegerMenuCleanup) throw Error('Probe already installed');
      const read = (a, n) => Array.from({length: n}, (_, i) => {
        const p = e.guest_to_wasm((a + i * 4) >>> 0) >>> 0;
        if (p === 0xf0 || p + 4 > w.memory.buffer.byteLength) throw Error('Unmapped probe read');
        return new DataView(w.memory.buffer).getUint32(p, true);
      });
      // Historical disassembly is a lead: require the actual entry opcodes.
      for (const address of [0x803af6, 0x81e8cb]) {
        const p = e.guest_to_wasm(address) >>> 0;
        if (p === 0xf0 || new DataView(w.memory.buffer).getUint8(p) !== 0x55)
          throw Error('Unexpected guest entry bytes');
      }
      const state = window.__kkriegerMenuProbe = {records: [], errors: [],
        code: [0x803af6, 0x803b87, 0x803bba, 0x8053a1, 0x8053d1, 0x81e8cb]
          .map(address => ({address, words: read(address, 8)}))};
      const previous = window.__waProfileEipHit;
      window.__waProfileEipHit = (ip, tid) => {
        if (previous) previous(ip, tid);
        if (tid || state.records.length >= 64 || ![0x803af6, 0x8053a1, 0x8053d1, 0x81e8cb].includes(ip)) return;
        try {
          const regs = Object.fromEntries(['eax','ecx','edx','esp','ebp','esi'].map(k => [k,e['get_' + k]() >>> 0]));
          if (ip === 0x81e8cb && regs.ecx !== 3) return;
          const msg = ip === 0x8053a1 && regs.eax ? read(regs.ebp - 0x20, 6) : null;
          if (ip === 0x8053a1 && (!msg || msg[1] < 0x100 || msg[1] > 0x202)) return;
          const args = ip === 0x803af6 ? read(regs.esp + 4, 4) : null;
          if (args && (args[1] < 0x100 || args[1] > 0x202)) return;
          const object = read(0x83f868, 1)[0];
          if (!object) throw Error('Null guest input object');
          const count = read(object + 0x238, 1)[0];
          state.records.push({at: performance.now(), ip, regs, msg, args, object, count,
            queue: read(object + 0x23c, Math.min(count, 32)),
            keyTranslation: args && args[2] < 256 ? read(0x821138 + args[2] * 4, 1)[0] : null,
            focus: e.get_focus_hwnd ? e.get_focus_hwnd() >>> 0 : null});
        } catch (error) { if (state.errors.length < 8) state.errors.push(String(error)); }
      };
      // Trace only this short input experiment, never procedural generation.
      e.set_trace_eip_range(1, 0x803af6, 0x81e8cc);
      window.__kkriegerMenuCleanup = () => {
        e.set_trace_eip_range(0, 0, 0);
        window.__waProfileEipHit = previous;
        delete window.__kkriegerMenuCleanup;
      };
    });
    const shot = async label => {
      await page.screenshot({path: path.join(out, label + '.png')});
      const state = await page.evaluate(() => {
        const e = window.wineShell?.currentWine?.instance?.exports;
        return {at: new Date().toISOString(),
        viewport: {width: innerWidth, height: innerHeight},
        active: {tag: document.activeElement?.tagName, id: document.activeElement?.id},
        focus: e?.get_focus_hwnd ? e.get_focus_hwnd() >>> 0 : null,
        mainHwnd: e?.get_main_hwnd ? e.get_main_hwnd() >>> 0 : null,
        probe: window.__kkriegerMenuProbe};
      });
      fs.writeFileSync(path.join(out, label + '.json'), JSON.stringify(state));
    };
    const key = async name => {
      events.push({at: new Date().toISOString(), action: 'key', name, holdMs});
      await page.keyboard.down(name);
      try { await delay(holdMs); } finally { await page.keyboard.up(name); }
      await delay(1500);
      await shot(name);
    };
    await shot('before');
    await delay(3000);
    await shot('idle-control');
    if (action === 'keys') {
      await key('ArrowDown');
      await key('ArrowUp');
      await key('Enter');
    } else if (action === 'enter') {
      await key('Enter');
    } else {
      const viewport = await page.evaluate(() => ({width: innerWidth, height: innerHeight}));
      if (x < 0 || y < 0 || x >= viewport.width || y >= viewport.height) throw Error('Click outside viewport');
      events.push({at: new Date().toISOString(), action: 'click', x, y, holdMs: 250});
      await page.mouse.click(x, y, {delay: 250});
    }
    await delay(4000);
    await shot('after-' + action);
    // Inspect after-keys.png before invoking the separate click mode.
  } finally {
    clearTimeout(timer);
    if (page) await page.evaluate(() => window.__kkriegerMenuCleanup?.()).catch(() => {});
    fs.writeFileSync(path.join(out, 'events.json'), JSON.stringify(events, null, 2));
    if (browser) await browser.disconnect();
  }
}
if (require.main === module) main().catch(error => {console.error(error); process.exitCode = 1;});
