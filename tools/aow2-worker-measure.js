'use strict';
// Attach to the already-running ordinary route. No navigation, guest reads,
// guest mutation, API substitution, or new browser is performed here.
const fs = require('node:fs');
const path = require('node:path');
const {installArcanumPresentationCounter} = require('./arcanum-presentation-counter');
const {validateSoftwareSamples} = require('./arcanum-software-samples');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2]);
const hwnd = Number(process.argv[3]);
const width = Number(process.argv[4]), height = Number(process.argv[5]);
const save = (name, value) => fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(value, null, 2) + '\n');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const identity = JSON.parse(fs.readFileSync(path.join(out, 'identity.json')));
  if (Date.now() + 45000 >= Date.parse(identity.deadline)) throw Error('outer deadline reserve');
  if (fs.existsSync(path.join(out, 'worker-owner.json'))) throw Error('fresh observer invocation required');
  const endpoint = fs.readFileSync(path.join(identity.profile, 'DevToolsActivePort'), 'utf8').trim().split('\n');
  const puppeteer = require(path.join(root, 'runtime/node_modules/puppeteer'));
  const browser = await puppeteer.connect({browserWSEndpoint: 'ws://127.0.0.1:' + endpoint[0] + endpoint[1]});
  let page, active = false;
  try {
    const pages = (await browser.pages()).filter(p => p.url().includes('app=age_of_wonders2_demo'));
    if (pages.length !== 1) throw Error('unique registered page required');
    page = pages[0];
    const owner = await page.evaluate(({hwnd}) => {
      const apps = runningApps.filter(a => a.name === 'age_of_wonders2_demo');
      const w = apps[0]?.wine, r = w?.renderer, win = r?.windows[hwnd];
      const layer = win?._dxFrameLayer || win?._dxOwnerCanvas?._waCanonicalPresentation;
      const canvas = win?._dxFrameLayer?.canvas || win?._dxOwnerCanvas;
      return {appCount: apps.length, running: w?.running, guestWorker: !!w?.guestWorker,
        threadBackend: w?.threadManager?.backend, hwnd,
        rendererShared: runningApps.filter(a => a.wine?.renderer === r).length,
        backend: window.WineD3D?.renderer, gpuFlag: window.WINE_D3DIM_GPU,
        selectedWindow: win ? {title: win.title, visible: win.visible, minimized: !!win.minimized} : null,
        layerKind: win?._dxFrameLayer ? 'overlay' : 'canonical', writeSeq: layer?.writeSeq,
        canvas: canvas ? {width: canvas.width, height: canvas.height, type: canvas.constructor.name} : null,
        contextPrototypes: [...new Set([r?.ctx, canvas?.getContext('2d'), r?.presentationFilter?.ctx]
          .filter(Boolean).map(c => Object.getPrototypeOf(c).constructor.name))]};
    }, {hwnd});
    save('worker-owner', owner);
    if (owner.appCount !== 1 || !owner.running || !owner.guestWorker || owner.threadBackend !== 'worker' ||
        owner.rendererShared !== 1 || owner.backend !== 'software' || owner.gpuFlag !== false ||
        !owner.selectedWindow?.visible || owner.selectedWindow.minimized ||
        owner.canvas?.width !== width || owner.canvas?.height !== height || !Number.isInteger(owner.writeSeq)) {
      throw Error('worker software owner attribution failed');
    }
    for (const [name, seconds, min, max] of [['worker-gate', 5, 4, 8], ['worker-full', 25, 20, 30]]) {
      await page.screenshot({path: path.join(out, name + '-before.png')});
      await page.evaluate(installArcanumPresentationCounter.toString() +
        `;globalThis.__aow2Observer=installArcanumPresentationCounter(runningApps.find(a=>a.name==='age_of_wonders2_demo').wine.renderer,${hwnd},${width},${height});`);
      active = true;
      for (let i = 0; i < seconds; i++) {
        await pause(1000);
        await page.evaluate(() => globalThis.__aow2Observer.sample());
      }
      const samples = await page.evaluate(() => globalThis.__aow2Observer.stop());
      active = false;
      save(name + '-samples', samples);
      const validation = validateSoftwareSamples(samples, min, max);
      save(name + '-validation', validation);
      await page.screenshot({path: path.join(out, name + '-after.png')});
      if (!validation.ok) throw Error(name + ': ' + validation.reasons.join('; '));
      console.log(JSON.stringify({name, validation}));
    }
  } finally {
    if (active) save('worker-interrupted', await page.evaluate(() => globalThis.__aow2Observer.stop()));
    browser.disconnect();
  }
}
main().catch(error => { save('worker-measure-error', {error: String(error), stack: error.stack}); process.exitCode = 1; });
