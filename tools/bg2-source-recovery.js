#!/usr/bin/env node
'use strict';

// Source extraction only: never starts the installer or game. Assembly is a
// separate mode based on the inspected original setup.inx and cabinet header.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const REVISION = 'c3d3b68903a90ec53ff7b0a4ae704adc6302814b';
const SOURCES = ['rewise', 'CP1252', 'print', 'reader', 'exefile', 'pkzip',
  'wildcard', 'wisescript', 'wiseoverlay'];

async function digest(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function relative(name) {
  if (!name || path.isAbsolute(name) || name.includes('\\') ||
      name.split('/').some(x => x === '..' || x === '.' || !x)) {
    throw new Error(`Unsafe relative path: ${name}`);
  }
  return name;
}

function files(root, prefix = '') {
  const result = [];
  for (const item of fs.readdirSync(root, { withFileTypes: true })) {
    const name = prefix + item.name;
    if (item.isSymbolicLink()) throw new Error(`Symlink not allowed: ${name}`);
    if (item.isDirectory()) result.push(...files(path.join(root, item.name), name + '/'));
    else if (item.isFile()) result.push(name);
    else throw new Error(`Non-file: ${name}`);
  }
  return result.sort();
}

async function inventory(root) {
  const result = [];
  for (const name of files(root)) result.push({ path: name,
    size: fs.statSync(path.join(root, name)).size,
    sha256: await digest(path.join(root, name)) });
  return result;
}

async function compare(root, expected) {
  const seen = new Set();
  for (const item of expected) {
    relative(item.path);
    const key = item.path.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate expected path: ${item.path}`);
    seen.add(key);
  }
  const actual = await inventory(root);
  const map = new Map();
  for (const item of actual) {
    const key = item.path.toLowerCase();
    if (map.has(key)) throw new Error(`Case collision: ${item.path}`);
    map.set(key, item);
  }
  const errors = [];
  for (const wanted of expected) {
    const got = map.get(wanted.path.toLowerCase());
    if (!got) errors.push({ path: wanted.path, error: 'missing' });
    else if (got.size !== wanted.size || got.sha256 !== wanted.sha256)
      errors.push({ path: wanted.path, error: 'bytes differ', actual: got });
  }
  for (const got of actual) if (!seen.has(got.path.toLowerCase()))
    errors.push({ path: got.path, error: 'unexpected' });
  return { ok: errors.length === 0, expected: expected.length, actual: actual.length, errors };
}

function plan(root) {
  const source = path.join(root, 'REWise');
  const out = path.join(root, 'extraction');
  const binary = path.join(out, 'rewise');
  const joined = path.join(out, 'bg2-joined.exe');
  const outer = path.join(out, 'outer');
  const inner = path.join(out, 'inner');
  const cab = path.join(outer, 'MAINDIR', 'data1.cab');
  return { source, out, binary, joined, outer, inner, cab,
    revision: REVISION, assembly: 'Explicit assemble mode uses inspected original metadata and requires all645 byte comparison',
    compile: ['gcc', '-Wall', '-I' + path.join(source, 'src'),
      ...SOURCES.map(s => path.join(source, 'src', s + '.c')), '-o', binary, '-lz'],
    extractOuter: [binary, '-x', outer, '-p', '-t', path.join(out, 'tmp'), joined],
    listGroups: ['/usr/bin/unshield', 'g', cab],
    extractInner: ['/usr/bin/unshield', '-d', inner, 'x', cab] };
}

async function extract(root, pins) {
  const p = plan(root);
  if (fs.existsSync(p.out)) throw new Error('Extraction directory exists; preserve it and use a fresh root');
  const space = fs.statfsSync(root);
  if (space.bavail * space.bsize < 6 * 1024 ** 3) throw new Error('Requires at least 6 GiB free');
  const revision = cp.execFileSync('git', ['-C', p.source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (revision !== REVISION) throw new Error('REWise revision mismatch');
  if (cp.execFileSync('git', ['-C', p.source, 'status', '--porcelain'], { encoding: 'utf8' }).trim())
    throw new Error('REWise source is not clean');
  const parts = pins.acquisition.parts;
  if (parts.map(x => x.name).join(',') !== 'bg2demogs.EXE,bg2demogs.W02,bg2demogs.W03,bg2demogs.W04,bg2demogs.W05,bg2demogs.W06,bg2demogs.W07')
    throw new Error('Wrong part order');
  for (const part of parts) {
    const file = path.join(root, relative(part.name));
    if (fs.statSync(file).size !== part.size || await digest(file) !== part.sha256)
      throw new Error(`Source mismatch: ${part.name}`);
  }
  if (await digest('/usr/bin/unshield') !== pins.extractors.unshield.sha256)
    throw new Error('unshield binary mismatch');
  fs.mkdirSync(p.out);
  for (const dir of [p.outer, p.inner, path.join(p.out, 'tmp')]) fs.mkdirSync(dir);
  const receipt = { startedAt: new Date().toISOString(), plan: p, steps: [], complete: false };
  const save = () => fs.writeFileSync(path.join(p.out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  const deadline = Date.now() + 1000 * 1200;
  function run(name, command) {
    const log = fs.openSync(path.join(p.out, name + '.log'), 'wx');
    const step = { name, command, startedAt: new Date().toISOString() };
    receipt.steps.push(step); save();
    try {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('Extraction deadline exceeded');
      const result = cp.spawnSync(command[0], command.slice(1), {
        stdio: ['ignore', log, log], timeout: Math.min(remaining, 240000), killSignal: 'SIGKILL' });
      step.status = result.status; step.signal = result.signal;
      if (result.error || result.status !== 0) throw result.error || new Error(`${name} failed: ${result.status}`);
    } finally { fs.closeSync(log); step.finishedAt = new Date().toISOString(); save(); }
  }
  try {
    const output = fs.openSync(p.joined, 'wx');
    // Sequential stream writes preserve exact split-file ordering.
    try {
      for (const part of parts) for await (const chunk of fs.createReadStream(path.join(root, part.name))) {
        let offset = 0;
        while (offset < chunk.length) offset += fs.writeSync(output, chunk, offset, chunk.length - offset);
      }
    } finally { fs.closeSync(output); }
    receipt.joined = { size: fs.statSync(p.joined).size, sha256: await digest(p.joined) }; save();
    run('compile', p.compile);
    receipt.extractorSha256 = await digest(p.binary);
    run('outer', p.extractOuter);
    receipt.outer = await inventory(p.outer); save();
    for (const name of ['data1.cab', 'data1.hdr', 'data2.cab'])
      if (!fs.existsSync(path.join(p.outer, 'MAINDIR', name))) throw new Error(`Missing cabinet sibling ${name}`);
    run('groups', p.listGroups);
    run('inner', p.extractInner);
    receipt.inner = await inventory(p.inner);
    receipt.complete = true;
    receipt.next = 'Inspect setup.inx and inventories; review exact group and Extra mapping before assembly';
  } catch (error) { receipt.error = error.stack; throw error; }
  finally { receipt.finishedAt = new Date().toISOString(); save(); }
  return receipt;
}

// data1.hdr names these destinations explicitly; setup.inx names root docs
// and Extra overlays. CD2 is original outer media retained for CD2: alias.
const GROUPS = { hd0_cab: '', hd0_cache: 'cache', hd0_characters: 'characters',
  hd0_data: 'data', hd0_music: 'music', hd0_override: 'override',
  hd0_scripts: 'scripts', hd0_sounds: 'sounds' };
function destination(root, name) {
  let current = root;
  for (const segment of relative(name).split('/')) {
    const matches = fs.existsSync(current) ? fs.readdirSync(current).filter(n => n.toLowerCase() === segment.toLowerCase()) : [];
    if (matches.length > 1) throw new Error(`Case collision beneath ${current}`);
    current = path.join(current, matches[0] || segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Destination symlink');
  }
  return current;
}
async function assemble(root, expected) {
  const p = plan(root), outer = path.join(p.outer, 'MAINDIR');
  const output = path.join(root, 'installed');
  if (fs.existsSync(output)) throw new Error('Installed output exists; preserve it');
  const checks = {
    'data1.hdr': '1b006399559c55ff08fa517e8b721bfba33825175be9e37562b3c53fd6029c6d',
    'setup.inx': '5acac56439c38e52d506916c9f3ccd7a94b69bb8742e65a700c4220a24172dfd'
  };
  for (const [name, hash] of Object.entries(checks))
    if (await digest(path.join(outer, name)) !== hash) throw new Error(`Installer metadata mismatch: ${name}`);
  const receipt = { startedAt: new Date().toISOString(), output, metadata: checks,
    groups: GROUPS, copies: [], complete: false };
  fs.mkdirSync(output);
  const copy = (from, name) => {
    const to = destination(output, name);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    receipt.copies.push({ source: path.relative(root, from), destination: path.relative(output, to), overwrite: fs.existsSync(to) });
    fs.copyFileSync(from, to);
  };
  const tree = (from, prefix = '') => {
    for (const name of files(from)) copy(path.join(from, name), prefix + name);
  };
  try {
    for (const [group, dest] of Object.entries(GROUPS)) tree(path.join(p.inner, group), dest ? dest + '/' : '');
    for (const name of ['README.TXT', 'LICENSE.TXT', 'Autorun.ini']) copy(path.join(outer, name), name);
    tree(path.join(outer, 'Extra'));
    tree(path.join(outer, 'CD2'), 'CD2/');
    const aliases = '[Alias]\r\nHD0:=C:\\\r\nCD1:=C:\\CD1\\\r\nCD2:=C:\\CD2\\\r\nCD3:=C:\\CD3\\\r\nCD4:=C:\\CD4\\\r\n';
    fs.writeFileSync(destination(output, 'baldur.ini'), aliases);
    receipt.reconstructedAliases = aliases;
    receipt.comparison = await compare(output, expected);
    if (!receipt.comparison.ok) throw new Error('Assembled tree differs from retained fixture');
    receipt.complete = true;
  } catch (error) { receipt.error = error.stack; throw error; }
  finally {
    receipt.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(root, 'assembly.json'), JSON.stringify(receipt, null, 2) + '\n');
  }
  return receipt;
}

async function main() {
  const [mode = 'plan', root, argument] = process.argv.slice(2);
  if (!root) throw new Error('Usage: bg2-source-recovery.js plan ROOT | recover ROOT | extract ROOT PINS.json | assemble ROOT INVENTORY.json | compare INSTALLED INVENTORY.json | verify-installed INSTALLED INVENTORY.json');
  if (mode === 'plan') console.log(JSON.stringify(plan(path.resolve(root)), null, 2));
  else if (mode === 'extract') await extract(path.resolve(root), JSON.parse(fs.readFileSync(argument)));
  else if (mode === 'assemble') await assemble(path.resolve(root), JSON.parse(fs.readFileSync(argument)).files);
  else if (mode === 'recover') {
    const sourceRoot = path.resolve(root);
    const source = path.join(sourceRoot, 'REWise');
    if (fs.existsSync(source)) throw new Error('Fresh recover requires no existing REWise checkout');
    cp.execFileSync('git', ['clone', '--filter=blob:none', '--no-checkout',
      'https://codeberg.org/CYBERDEV/REWise', source], { stdio: 'inherit', timeout: 120000 });
    cp.execFileSync('git', ['-C', source, 'checkout', '--detach', REVISION], { stdio: 'inherit', timeout: 60000 });
    const pins = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/bg2-recovery-20261015.json')));
    const expected = JSON.parse(fs.readFileSync(path.join(__dirname, '../test/candidate-corpus/baldurs-gate2-demo-files.json')));
    await extract(sourceRoot, pins);
    await assemble(sourceRoot, expected.files);
  }
  else if (mode === 'compare' || mode === 'verify-installed') {
    const result = await compare(path.resolve(root), JSON.parse(fs.readFileSync(argument)).files);
    if (mode === 'verify-installed') {
      result.errors = result.errors.filter(error => error.error !== 'unexpected');
      result.ok = result.errors.length === 0;
    }
    console.log(JSON.stringify(result, null, 2)); if (!result.ok) process.exitCode = 1;
  } else throw new Error(`Unknown mode: ${mode}`);
}
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = { compare, inventory, plan, relative, destination };
