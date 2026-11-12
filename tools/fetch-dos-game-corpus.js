#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { spawnSync } = require('child_process');
const { pipeline } = require('stream/promises');

const ROOT = path.join(__dirname, '..');
const manifest = require('../test/dos-game-corpus/manifest.json');
const assetRoot = path.resolve(ROOT, manifest.assetRoot);
const force = process.argv.includes('--force');
const idArg = process.argv.find(argument => argument.startsWith('--id='));
const selected = idArg ? new Set(idArg.slice(5).split(',').filter(Boolean)) : null;

function digest(file, algorithm) {
  return crypto.createHash(algorithm).update(fs.readFileSync(file)).digest('hex');
}

function download(url, destination, redirects = 8) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'http:' ? http : https;
    const request = client.get(parsed, {
      headers: { 'User-Agent': 'WineAssemblyDosGameCorpus/1.0' },
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        if (!redirects) return reject(new Error(`too many redirects for ${url}`));
        return download(new URL(response.headers.location, parsed).href, destination, redirects - 1)
          .then(resolve, reject);
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`HTTP ${response.statusCode} for ${url}`));
      }
      const output = fs.createWriteStream(destination, { flags: 'wx' });
      pipeline(response, output).then(resolve, reject);
    });
    request.on('error', reject);
  });
}

function verifyArchive(game, archive) {
  if (fs.statSync(archive).size !== game.package.size ||
      digest(archive, 'sha1') !== game.package.sha1 ||
      digest(archive, 'sha256') !== game.package.sha256) {
    throw new Error(`${game.id}: downloaded archive does not match the pinned package`);
  }
}

function extract(archive, directory) {
  const result = spawnSync('unzip', ['-oq', archive, '-d', directory], {
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`unzip failed\n${result.error || ''}${result.stdout}${result.stderr}`);
}

async function recover(game, options = {}) {
  const root = options.assetRoot || assetRoot;
  const forced = options.force ?? force;
  const fetchArchive = options.download || download;
  const unpack = options.extract || extract;
  const rename = options.rename || fs.renameSync;
  fs.mkdirSync(root, { recursive: true });
  const directory = path.join(root, game.id);
  const archive = path.join(directory, game.package.file);
  const executable = path.join(directory, game.executable);
  if (!forced && fs.existsSync(archive)) {
    verifyArchive(game, archive);
    if (fs.existsSync(executable)) return executable;
  }

  // Stage on the same filesystem. Failed acquisition/extraction never touches
  // the existing tree. Publication uses two renames, not a crash-atomic swap;
  // callers must serialize recovery for each game.
  const staging = fs.mkdtempSync(path.join(root, `.${game.id}-recovery-`));
  const tree = path.join(staging, 'tree');
  const backup = path.join(staging, 'previous');
  fs.mkdirSync(tree);
  let retainBackup = false;
  try {
    // Non-forced repair preserves local files just as the former in-place
    // extraction did. Only an explicit --force starts from a clean tree.
    if (!forced && fs.existsSync(directory)) fs.cpSync(directory, tree, { recursive: true });
    const stagedArchive = path.join(tree, game.package.file);
    if (!forced && fs.existsSync(archive)) fs.copyFileSync(archive, stagedArchive);
    else {
      console.log(`GET   ${game.id} ${game.package.url}`);
      await fetchArchive(game.package.url, stagedArchive);
    }
    verifyArchive(game, stagedArchive);
    await unpack(stagedArchive, tree);
    if (!fs.existsSync(path.join(tree, game.executable))) {
      throw new Error(`${game.id}: missing ${game.executable}`);
    }
    const hadPrevious = fs.existsSync(directory);
    if (hadPrevious) rename(directory, backup);
    try {
      rename(tree, directory);
    } catch (error) {
      if (hadPrevious) {
        try { rename(backup, directory); }
        catch (rollbackError) {
          retainBackup = true;
          throw new Error(`${game.id}: publish failed (${error.message}); rollback failed (${rollbackError.message}); previous tree retained at ${backup}`);
        }
      }
      throw error;
    }
    return executable;
  } finally {
    if (!retainBackup) fs.rmSync(staging, { recursive: true, force: true });
  }
}

async function main() {
  const known = new Set(manifest.games.map(game => game.id));
  if (selected) {
    const unknown = [...selected].filter(id => !known.has(id));
    if (unknown.length) throw new Error(`unknown DOS game IDs: ${unknown.join(', ')}`);
  }
  fs.mkdirSync(assetRoot, { recursive: true });
  for (const game of manifest.games.filter(item => !selected || selected.has(item.id))) {
    const executable = await recover(game);
    console.log(`READY ${game.id} ${path.relative(ROOT, executable)}`);
  }
}

module.exports = { recover, download };

if (require.main === module) main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
