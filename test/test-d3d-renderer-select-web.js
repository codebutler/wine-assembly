#!/usr/bin/env node
'use strict';

// The ?debug toolbar's D3D select picks the Direct3D 8/9 backend for the next
// launch: the page default and ?d3d9-renderer seed it, and the bridge a new
// instance creates must carry whatever it says at launch time.

const assert = require('assert');
const path = require('path');
const puppeteer = require('puppeteer');
const { startStaticServer, closeServer } = require('./static-server');
const { compileSrcWasm } = require('./compile-src');

const root = path.join(__dirname, '..');

(async () => {
  const wasm = compileSrcWasm();
  const server = await startStaticServer({ root, cacheControl: 'no-cache',
    handleRequest(request, response) {
      if (!request.url.startsWith('/build/wine-assembly.wasm')) return false;
      response.writeHead(200, { 'Content-Type': 'application/wasm', 'Content-Length': wasm.length });
      response.end(wasm);
      return true;
    } });
  const browser = await puppeteer.launch({ headless: true,
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-first-run', '--no-default-browser-check'] });
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const open = async query => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(base + query, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('typeof launchApp === "function"');
    return { page, errors };
  };
  const selected = page => page.evaluate(() => ({
    select: document.getElementById('d3d-renderer-select').value,
    renderer: window.WineD3D.renderer,
  }));
  try {
    const plain = await open('?debug');
    assert.deepStrictEqual(await selected(plain.page), { select: 'webgl', renderer: 'webgl' },
      'the toolbar defaults to the WebGL backend');
    await plain.page.evaluate(() => {
      setD3DRenderer('software');
      document.getElementById('app-select').value = 'calc';
      launchApp();
    });
    await plain.page.waitForFunction(() => typeof runningApps !== 'undefined' &&
      runningApps[0] && runningApps[0].wine.running && runningApps[0].wine.hostCtx &&
      runningApps[0].wine.hostCtx.d3d9Bridge, { timeout: 120000 });
    const bridge = await plain.page.evaluate(() => {
      const b = runningApps[0].wine.hostCtx.d3d9Bridge;
      return { backend: b.backend, asyncSoftware: b.asyncSoftware };
    });
    assert.deepStrictEqual(bridge, { backend: 'software', asyncSoftware: true },
      'a launch after choosing Software gets the software bridge on the render Worker');
    assert.deepStrictEqual(plain.errors, [], 'no page errors');
    await plain.page.close();

    const seeded = await open('?debug&d3d9-renderer=software');
    assert.deepStrictEqual(await selected(seeded.page), { select: 'software', renderer: 'software' },
      '?d3d9-renderer seeds the select');
    await seeded.page.close();
    console.log('PASS  D3D select steers the Direct3D 8/9 backend of the next launch');
  } finally {
    await browser.close();
    await closeServer(server);
  }
})().catch(error => { console.error(error); process.exit(1); });
