'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'wa-loading-audit-'));
try {
 fs.mkdirSync(path.join(root,'lib'));fs.mkdirSync(path.join(root,'game'));
 fs.copyFileSync(path.join(__dirname,'../lib/app-files.js'),path.join(root,'lib/app-files.js'));
 fs.writeFileSync(path.join(root,'lib/apps.js'),`exports.APPS={sample:{exe:'game/game.exe',files:[],localFileManifest:'game/manifest.json'}};`);
 fs.writeFileSync(path.join(root,'game/game.exe'),Buffer.alloc(64));
 fs.writeFileSync(path.join(root,'game/data.bin'),Buffer.alloc(17*1024*1024));
 fs.writeFileSync(path.join(root,'game/native.dll'),Buffer.alloc(8));
 const manifest=path.join(root,'game/manifest.json');
 const original=JSON.stringify({schemaVersion:1,registry:{preserved:true},files:[{url:'data.bin',vfsPath:'c:\\data.bin'},{url:'native.dll',eager:true},{url:'manifest.json',size:1}]});fs.writeFileSync(manifest,original);
 const run=(...flags)=>JSON.parse(cp.execFileSync(process.execPath,[path.join(__dirname,'../tools/audit-app-loading.js'),'--root='+root,...flags],{encoding:'utf8'}));
 const audit=run();assert.equal(audit.apps[0].sizedPolicy.lazyFiles,1);assert.equal(fs.readFileSync(manifest,'utf8'),original,'audit is read only');
 const repair=run('--write-sizes');assert.equal(repair.repaired.length,1);
 const result=JSON.parse(fs.readFileSync(manifest));assert.equal(result.files.length,2,'metadata must not recursively include itself');assert.equal(result.files[0].size,17*1024*1024);assert.equal(result.files[1].eager,true);assert.deepEqual(result.registry,{preserved:true});assert.equal(fs.readFileSync(manifest+'.before-size-audit-20261019','utf8'),original);
 assert.equal(run('--write-sizes').repaired.length,0,'idempotent');
 result.files[0].size=1;fs.writeFileSync(manifest,JSON.stringify(result));const stale=fs.readFileSync(manifest,'utf8');assert.match(run('--write-sizes').errors[0].error,/stale declared size/);assert.equal(fs.readFileSync(manifest,'utf8'),stale,'stale size is reported, never silently rewritten');
 console.log('PASS loading audit: read-only prediction, missing-size repair, metadata exclusion, backups, overrides, stale size rejection');
} finally {fs.rmSync(root,{recursive:true,force:true});}
