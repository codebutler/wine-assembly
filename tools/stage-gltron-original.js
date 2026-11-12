'use strict';

// Copy an already extracted, verified original 0.70 Win32 app directory.
// No installer, archive extraction, network access, or guest execution.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { APPS } = require('../lib/apps');

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function contained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function stageGltron(sourceDirectory, destination) {
  const source = fs.realpathSync(sourceDirectory);
  const target = path.resolve(destination);
  if (contained(source, target) || contained(target, source)) throw new Error('Source and destination must be separate trees');
  // Refuse existing destinations, including dangling symlinks. Resolve every
  // existing ancestor before creating anything; no implicit shared-tree writes.
  for (let ancestor = target; ; ancestor = path.dirname(ancestor)) {
    if (fs.existsSync(ancestor) || (() => { try { fs.lstatSync(ancestor); return true; } catch { return false; } })()) {
      if (fs.realpathSync(ancestor) !== ancestor) throw new Error('Destination contains a symlink');
      break;
    }
    if (path.dirname(ancestor) === ancestor) break;
  }
  try { fs.lstatSync(target); throw new Error('Destination already exists'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const prefix = 'binaries/gltron-0.70/';
  const files = APPS.gltron.files;
  // Verify the complete accepted inventory before the first destination write.
  for (const file of files) {
    if (!file.url.startsWith(prefix)) throw new Error('Unexpected GLTron URL');
    const relative = file.url.slice(prefix.length);
    const input = path.resolve(source, relative);
    if (!contained(source, input) || !contained(source, fs.realpathSync(input))) throw new Error('Source escapes payload');
    const stat = fs.statSync(input);
    if (!stat.isFile() || stat.size !== file.size || sha256(fs.readFileSync(input)) !== file.sha256) {
      throw new Error('Original GLTron input mismatch: ' + relative);
    }
  }
  fs.mkdirSync(target, { recursive: true });
  try {
    for (const file of files) {
      const relative = file.url.slice(prefix.length);
      const output = path.join(target, relative);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.copyFileSync(path.join(source, relative), output, fs.constants.COPYFILE_EXCL);
      if (sha256(fs.readFileSync(output)) !== file.sha256) throw new Error('Staged GLTron mismatch: ' + relative);
    }
    return { files: files.length, bytes: files.reduce((sum, file) => sum + file.size, 0), destination: target };
  } catch (error) {
    fs.rmSync(target, { recursive: true, force: true });
    throw error;
  }
}

if (require.main === module) {
  if (process.argv.length !== 4) {
    console.error('Usage: node tools/stage-gltron-original.js EXTRACTED_APP_DIRECTORY DESTINATION');
    process.exitCode = 2;
  } else {
    try { console.log(JSON.stringify(stageGltron(process.argv[2], process.argv[3]))); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}

module.exports = { stageGltron, sha256 };
