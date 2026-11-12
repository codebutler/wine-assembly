#!/usr/bin/env node
'use strict';
// Audit registered assets against real file sizes. --write-sizes repairs only
// absent manifest lengths, preserving routes, registry state and load overrides.
const fs = require('fs'), path = require('path');
const root = fs.realpathSync(path.resolve(process.argv.find(a => a.startsWith('--root='))?.slice(7) || path.join(__dirname, '..')));
const write = process.argv.includes('--write-sizes');
const { APPS } = require(path.join(root, 'lib/apps'));
const { normalizeLazyFiles, mergeLocalManifestFiles } = require(path.join(root, 'lib/app-files'));
const report = { root, apps: [], missingManifests: [], repaired: [], errors: [] };
const resolved = url => {
  if (typeof url !== 'string' || /^(?:[a-z]+:|\/)/i.test(url)) throw Error('non-local asset: ' + url);
  const p = path.resolve(root, url);
  if (!p.startsWith(root + path.sep)) throw Error('asset outside checkout: ' + url);
  return p;
};
const sized = file => {
  const row = typeof file === 'string' ? { url: file } : file;
  const full = resolved(row.url), real = fs.realpathSync(full);
  if (!real.startsWith(root + path.sep)) throw Error('asset resolves outside checkout: ' + row.url);
  const stat = fs.statSync(real);
  if (!stat.isFile()) throw Error('not a file: ' + row.url);
  return { ...row, size: stat.size };
};
for (const [id, app] of Object.entries(APPS)) {
  try {
    let files = app.files || [], manifest, manifestPath, changed = 0;
    if (app.localFileManifest) {
      manifestPath = resolved(app.localFileManifest);
      if (!fs.existsSync(manifestPath)) { report.missingManifests.push(id); continue; }
      if (fs.realpathSync(manifestPath) !== manifestPath) throw Error('manifest must not be a symlink');
      manifest = JSON.parse(fs.readFileSync(manifestPath));
      if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files)) throw Error('invalid manifest');
      const originalCount = manifest.files.length;
      manifest.files = manifest.files.filter(row =>
        path.posix.normalize(path.posix.join(path.posix.dirname(app.localFileManifest), row.url)) !== app.localFileManifest);
      changed += originalCount - manifest.files.length;
      const local = manifest.files.map(row => ({...row, url:path.posix.normalize(path.posix.join(path.posix.dirname(app.localFileManifest), row.url))}));
      // Verify every source before allowing a manifest mutation.
      local.forEach((row, i) => {
        const actual = sized(row).size;
        if (row.size !== undefined && row.size !== actual) throw Error('stale declared size: ' + row.url);
        if (row.size === undefined) { manifest.files[i] = {...manifest.files[i], size:actual}; changed++; }
      });
      files = mergeLocalManifestFiles(files, local);
    }
    const actual = files.map(sized);
    let isWin16 = false;
    try {
      const fd = fs.openSync(resolved(app.exe), 'r');
      try { const h=Buffer.alloc(64);fs.readSync(fd,h,0,64,0);const sig=Buffer.alloc(2);fs.readSync(fd,sig,0,2,h.readUInt32LE(60));isWin16=sig.toString()==='NE'; }
      finally { fs.closeSync(fd); }
    } catch { /* Unavailable main image is listed separately by Ops. */ }
    const before = normalizeLazyFiles(app, files, {isWin16});
    const after = normalizeLazyFiles(app, actual, {isWin16});
    const eager = after.files.filter(f => !(f.httpRange === true && f.loadMode !== 'required') && !['lazy','background'].includes(f.loadMode));
    report.apps.push({id, files:files.length, isWin16, synchronousFaultReads:!!app.reservedPageFaults, missingSizes:before.summary.unknownSizes, before:before.summary, sizedPolicy:after.summary,
      largestEager:eager.filter(f=>f.size>=1024*1024).sort((a,b)=>b.size-a.size).slice(0,5),
      largest:actual.slice().sort((a,b)=>b.size-a.size).slice(0,3)});
    if (write && changed) {
      const backup=manifestPath+'.before-size-audit-20261019';
      if (!fs.existsSync(backup)) fs.copyFileSync(manifestPath,backup,fs.constants.COPYFILE_EXCL);
      fs.writeFileSync(manifestPath+'.size-audit.tmp',JSON.stringify(manifest,null,2)+'\n');
      fs.renameSync(manifestPath+'.size-audit.tmp',manifestPath);
      report.repaired.push({id, entries:changed});
    }
  } catch (e) { report.errors.push({id,error:e.message}); }
}
report.apps.sort((a,b)=>b.sizedPolicy.lazyBytes-a.sizedPolicy.lazyBytes);
console.log(JSON.stringify(report,null,2));
