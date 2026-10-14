#!/usr/bin/env node
'use strict';

// Unpack an early InstallShield 5 cabinet set (data1.cab, data2.cab, ...)
// that unshield cannot: the Heretic II demo (1998) is one. The Pharaoh demo
// (1999) has the same version; unshield happens to read it, but this needs no
// host install.
//
//   node tools/is5-extract.js data1.cab [--list] [--out=DIR]
//
// These cabs carry common-header version 0x01000004, which unshield treats as
// major version 5. Their file descriptors set flag 2 ("obfuscated") on data
// that is NOT obfuscated, so unshield's de-obfuscation corrupts every file
// ("Decompression failed with code -3"), and its -O old-compression path
// crashes. The data is the ordinary IS5 layout: each file is a run of
// [u16 length][raw deflate block] chunks. Each file must expand to exactly
// the size its descriptor records, so a wrong guess about the format fails.
//
// Header layout (offsets as unshield reads them for major version 5):
//   common header (0x14): signature 'ISc(', version, volume_info,
//     cab_descriptor_offset, cab_descriptor_size
//   cab descriptor: +0x0c file_table_offset, +0x1c directory_count,
//     +0x28 file_count; the file table is u32 offsets (directories, then
//     files) relative to cab_descriptor_offset + file_table_offset
//   file descriptor: name_offset u32, directory u16, (2), flags u16,
//     expanded u32, compressed u32, (0x14), data_offset u32 -- 0x2a bytes,
//     with no MD5 (later IS5 descriptors append one; these are packed 0x2a
//     apart, so reading one there would read the next descriptor)
//   volume header (after each cab's common header): data_offset, (4),
//     first/last file index, first file offset/expanded/compressed,
//     last file offset/expanded/compressed -- a file split across two cabs is
//     the last file of one and the first file of the next.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const FILE_SPLIT = 1;
const FILE_COMPRESSED = 4;
const FILE_INVALID = 8;

function cString(buf, at) {
  let end = at;
  while (end < buf.length && buf[end] !== 0) end++;
  return buf.toString('latin1', at, end);
}

function readCommon(buf, what) {
  if (buf.readUInt32LE(0) !== 0x28635349) throw new Error(`${what}: not an InstallShield cabinet`);
  return {
    version: buf.readUInt32LE(4),
    cabDescriptorOffset: buf.readUInt32LE(12),
    cabDescriptorSize: buf.readUInt32LE(16),
  };
}

function volumePath(first, n) {
  const dir = path.dirname(first);
  const want = path.basename(first).replace(/1(\.cab)$/i, `${n}$1`).toLowerCase();
  const hit = fs.readdirSync(dir).find(name => name.toLowerCase() === want);
  return hit ? path.join(dir, hit) : null;
}

// The cab's .hdr beside it, matched case-insensitively like volumePath: a CD
// image names it DATA1.HDR, and on a case-sensitive filesystem the guess
// "DATA1.hdr" missed it, so the 209 MB DATA1.CAB was read as its own header
// and the file table pointed far outside it (Baldur's Gate demo, ERR_OUT_OF_RANGE).
function headerPath(cab) {
  const dir = path.dirname(cab);
  const want = path.basename(cab).replace(/\.cab$/i, '.hdr').toLowerCase();
  const hit = fs.readdirSync(dir).find(name => name.toLowerCase() === want);
  return hit ? path.join(dir, hit) : null;
}

function readVolumes(first) {
  const volumes = [];
  for (let n = 1; ; n++) {
    const file = n === 1 ? first : volumePath(first, n);
    if (!file) break;
    const buf = fs.readFileSync(file);
    readCommon(buf, file);
    volumes.push({
      n, file, buf,
      firstIndex: buf.readUInt32LE(0x14 + 8),
      lastIndex: buf.readUInt32LE(0x14 + 12),
      firstOffset: buf.readUInt32LE(0x14 + 16),
      firstCompressed: buf.readUInt32LE(0x14 + 24),
      lastOffset: buf.readUInt32LE(0x14 + 28),
      lastCompressed: buf.readUInt32LE(0x14 + 36),
    });
  }
  return volumes;
}

function readCatalog(headerBuf) {
  const common = readCommon(headerBuf, 'header');
  if (common.version >>> 24 !== 1 || ((common.version >>> 12) & 0xf) > 5) {
    throw new Error(`version 0x${common.version.toString(16)} is not an early IS5 cab; use unshield`);
  }
  const cd = common.cabDescriptorOffset;
  const fileTableOffset = headerBuf.readUInt32LE(cd + 0x0c);
  const dirCount = headerBuf.readUInt32LE(cd + 0x1c);
  const fileCount = headerBuf.readUInt32LE(cd + 0x28);
  const base = cd + fileTableOffset;
  const table = i => headerBuf.readUInt32LE(base + i * 4);
  const dirs = [];
  for (let i = 0; i < dirCount; i++) dirs.push(cString(headerBuf, base + table(i)));
  const files = [];
  for (let i = 0; i < fileCount; i++) {
    const p = base + table(dirCount + i);
    files.push({
      index: i,
      name: cString(headerBuf, base + headerBuf.readUInt32LE(p)),
      dir: dirs[headerBuf.readUInt16LE(p + 4)] || '',
      flags: headerBuf.readUInt16LE(p + 8),
      expanded: headerBuf.readUInt32LE(p + 10),
      compressed: headerBuf.readUInt32LE(p + 14),
      dataOffset: headerBuf.readUInt32LE(p + 0x26),
    });
  }
  return files;
}

// File groups, as unshield reads them for major version 5: 71 list heads at
// cab descriptor + 0x3e, each a chain of { name_offset, descriptor_offset,
// next_offset }; a descriptor holds its name offset and, 0x48 bytes on, the
// first and last file index. Offsets are relative to the cab descriptor.
function readGroups(headerBuf) {
  const cd = readCommon(headerBuf, 'header').cabDescriptorOffset;
  const groups = [];
  const seen = new Set();
  for (let i = 0; i < 71; i++) {
    let next = headerBuf.readUInt32LE(cd + 0x3e + i * 4);
    while (next && !seen.has(next) && cd + next + 12 <= headerBuf.length) {
      seen.add(next);
      const descriptor = headerBuf.readUInt32LE(cd + next + 4);
      const p = cd + descriptor;
      groups.push({
        name: cString(headerBuf, cd + headerBuf.readUInt32LE(p)),
        first: headerBuf.readUInt32LE(p + 4 + 0x48),
        last: headerBuf.readUInt32LE(p + 8 + 0x48),
      });
      next = headerBuf.readUInt32LE(cd + next + 8);
    }
  }
  return groups;
}

// unshield -g GROUP writes <out>/<group>/<directory>/<file>, with the group
// and directory path's spaces and <>[] turned into '_' (file names keep
// theirs). Candidate manifests are written against that layout, so the
// --group extraction reproduces it and can stand in for unshield.
function unshieldPath(out, group, dir, name) {
  const rel = [group, ...dir.split(/[\\/]/).filter(Boolean)].join('/')
    .replace(/[ <>[\]]/g, '_').replace(/[^\x20-\x7e]/g, '_');
  return path.join(out, ...rel.split('/'), name);
}

// The compressed bytes of one file, joined across a volume boundary.
function compressedBytes(file, volumes) {
  const v = volumes.findIndex(vol => file.index >= vol.firstIndex && file.index <= vol.lastIndex);
  if (v < 0) throw new Error(`${file.name}: no volume holds file ${file.index}`);
  const vol = volumes[v];
  const next = volumes[v + 1];
  if ((file.flags & FILE_SPLIT) && file.index === vol.lastIndex && next && next.firstIndex === file.index) {
    return Buffer.concat([
      vol.buf.subarray(vol.lastOffset, vol.lastOffset + vol.lastCompressed),
      next.buf.subarray(next.firstOffset, next.firstOffset + next.firstCompressed),
    ]);
  }
  return vol.buf.subarray(file.dataOffset, file.dataOffset + file.compressed);
}

function inflateChunks(data, name) {
  const out = [];
  let p = 0;
  while (p + 2 <= data.length) {
    const len = data.readUInt16LE(p);
    p += 2;
    if (p + len > data.length) throw new Error(`${name}: chunk runs past the file's data`);
    out.push(zlib.inflateRawSync(data.subarray(p, p + len), { finishFlush: zlib.constants.Z_SYNC_FLUSH }));
    p += len;
  }
  return Buffer.concat(out);
}

function extractFile(file, volumes) {
  const data = compressedBytes(file, volumes);
  const bytes = (file.flags & FILE_COMPRESSED) ? inflateChunks(data, file.name) : Buffer.from(data);
  if (bytes.length !== file.expanded) {
    throw new Error(`${file.name}: expanded to ${bytes.length} bytes, descriptor says ${file.expanded}`);
  }
  return bytes;
}

function main() {
  const args = process.argv.slice(2);
  const cab = args.find(a => !a.startsWith('--'));
  if (!cab) {
    console.error('usage: is5-extract.js data1.cab [--list | --list-groups] [--group=NAME] [--out=DIR]');
    process.exit(2);
  }
  const outArg = args.find(a => a.startsWith('--out='));
  const groupArg = args.find(a => a.startsWith('--group='));
  const hdr = headerPath(cab);
  const headerBuf = fs.readFileSync(hdr || cab);
  const files = readCatalog(headerBuf);
  if (args.includes('--list-groups')) {
    for (const g of readGroups(headerBuf)) console.log(`${g.first}-${g.last}  ${g.name}`);
    return;
  }
  if (args.includes('--list')) {
    for (const f of files) console.log(`${String(f.expanded).padStart(10)}  ${f.dir ? f.dir + '\\' : ''}${f.name}`);
    return;
  }
  const out = outArg ? outArg.slice(6) : '.';
  let selected = files;
  let place = f => path.join(out, ...f.dir.split(/[\\/]/).filter(Boolean), f.name);
  if (groupArg) {
    const name = groupArg.slice(8);
    const group = readGroups(headerBuf).find(g => g.name === name);
    if (!group) throw new Error(`no file group named "${name}"`);
    selected = files.filter(f => f.index >= group.first && f.index <= group.last);
    place = f => unshieldPath(out, group.name, f.dir, f.name);
  }
  const volumes = readVolumes(cab);
  let count = 0, bytes = 0;
  for (const f of selected) {
    if ((f.flags & FILE_INVALID) || !f.name) continue;
    const data = extractFile(f, volumes);
    const dest = place(f);
    if (!path.resolve(dest).startsWith(path.resolve(out) + path.sep)) throw new Error(`${f.name}: path escapes --out`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data);
    count++;
    bytes += data.length;
  }
  console.log(`extracted ${count} files, ${bytes} bytes, from ${volumes.length} volume(s)`);
}

if (require.main === module) main();
module.exports = { readCatalog, readGroups, readVolumes, extractFile, inflateChunks, unshieldPath, headerPath };
