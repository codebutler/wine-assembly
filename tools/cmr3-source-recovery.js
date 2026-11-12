#!/usr/bin/env node
'use strict';
// Original installer recovery only. Does not install, register or run the game.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const plan = require('../docs/cmr3-recovery-20261015.json');
const { requireCapacity } = require('./cmr3-recovery-guards');
const sha = p => new Promise((resolve, reject) => {
  const h = crypto.createHash('sha256');
  fs.createReadStream(p).on('error', reject).on('data', b => h.update(b)).on('end', () => resolve(h.digest('hex')));
});
async function recover(root) {
  if (!path.isAbsolute(root || '')) throw Error('Usage: cmr3-source-recovery.js ABSOLUTE_FRESH_OUTPUT');
  requireCapacity(path.dirname(root));
  fs.mkdirSync(root); // Fail closed on existing output; retain partial failures.
  const save = (name, data) => fs.writeFileSync(path.join(root, name), JSON.stringify(data, null, 2) + '\n');
  const startedAt = new Date().toISOString();
  try {
    requireCapacity(root);
    const part = path.join(root, 'installer.exe.part');
    const args = ['--fail', '--location', '--max-time', '300', '--max-filesize', String(plan.source.memberBytes),
      '--output', part, '--dump-header', path.join(root, 'download-headers.txt'), plan.source.memberUrl];
    const result = cp.spawnSync('curl', args, { encoding: 'utf8', timeout: 310000, maxBuffer: 2 * 1024 ** 2 });
    save('download.json', { startedAt, finishedAt: new Date().toISOString(), args, status: result.status,
      signal: result.signal, error: result.error?.message, stdout: result.stdout, stderr: result.stderr });
    if (result.status !== 0) throw Error('Original download failed; partial source retained');
    const bytes = fs.statSync(part).size, hash = await sha(part);
    save('source.json', { url: plan.source.memberUrl, bytes, sha256: hash });
    if (bytes !== plan.source.memberBytes || hash !== plan.source.expectedMemberSha256) throw Error('Original source identity mismatch');
    const source = path.join(root, 'installer.exe');
    fs.renameSync(part, source);
    const cab = path.join(root, 'cabinet');
    fs.mkdirSync(cab);
    const carved = [];
    for (const r of plan.historicalExtraction.rangesHalfOpen) {
      const target = path.join(cab, r.output);
      await pipeline(fs.createReadStream(source, { start: r.start, end: r.end - 1 }), fs.createWriteStream(target, { flags: 'wx' }));
      const row = { path: r.output, bytes: fs.statSync(target).size, sha256: await sha(target) };
      if (row.bytes !== r.end - r.start) throw Error('Incomplete carved range: ' + r.output);
      carved.push(row);
    }
    save('carved.json', carved);
    if (carved.find(r => r.path === 'Rally_3PC.exe').sha256 !== plan.historicalExtraction.expectedExeSha256) throw Error('Original EXE identity mismatch');
    save('result.json', { startedAt, finishedAt: new Date().toISOString(), success: true,
      stage: 'verified installer and carved originals; cabinet extraction and installation remain separate', carved });
  } catch (e) {
    save('failure.json', { startedAt, finishedAt: new Date().toISOString(), error: String(e.stack || e) });
    throw e;
  }
}
if (require.main === module) recover(process.argv[2]).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { recover };
