#!/usr/bin/env node
'use strict';

// Darkstone's Load a Game lists dsave\games\game*.sav, and its character
// screen reads dsave\characters\. The browser keeps only an app's
// persistFiles across reloads, and darkstone_demo had none: a game saved in
// one visit was gone in the next and Load a Game came up empty (user report,
// 2026-10-11). Measured on a boat, one save is 3,204,264 bytes and the
// character file 1,342,076: past localStorage's 2 MB file cap and Safari's
// ~5 MB origin quota, so the app persists through IndexedDB.

const assert = require('assert');
const { APPS } = require('../lib/apps');
const { VirtualFS } = require('../lib/filesystem');
const VfsPersistence = require('../lib/vfs-persistence');

// An in-memory stand-in for the IndexedDB object store, shared across "page
// loads" the way the real database is.
class MemoryIdb {
  constructor() { this.rows = new Map(); this.writes = 0; }
  async getAll() { return Array.from(this.rows.entries()); }
  async put(key, value) { this.rows.set(key, value); this.writes++; }
  async delete(key) { this.rows.delete(key); }
}

const SAVE_BYTES = 3204264, CHARACTER_BYTES = 1342076;
const pattern = (n, seed) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) & 0xFF);

async function launch(idb, app) {
  const storage = await VfsPersistence.createIndexedDbStorage({ adapter: idb });
  const vfs = new VirtualFS();
  const persistence = VfsPersistence.attach(vfs, {
    appId: 'darkstone_demo', patterns: app.persistFiles, storage,
    maxFileBytes: app.persistMaxBytes,
  });
  return { vfs, persistence, storage };
}

function write(vfs, path, bytes) {
  vfs.ensureParentDirs(path.toLowerCase());
  const h = vfs.createFile(path, 0x40000000, 2);
  assert(h && h !== 0xFFFFFFFF, `create ${path}`);
  vfs.writeFile(h, bytes, bytes.length);
}

async function run() {
  const app = APPS.darkstone_demo;
  assert.deepStrictEqual(app.persistFiles, ['c:\\dsave\\*']);
  assert.strictEqual(app.persistStore, 'indexeddb');
  assert(app.persistMaxBytes >= SAVE_BYTES, 'the per-file cap admits a real save');

  const idb = new MemoryIdb();
  const first = await launch(idb, app);
  write(first.vfs, 'C:\\dsave\\games\\game641d_3753cbab.sav', pattern(SAVE_BYTES, 1));
  write(first.vfs, 'C:\\dsave\\characters\\characters.lpl', pattern(CHARACTER_BYTES, 2));
  write(first.vfs, 'C:\\dtemp\\m641d\\m4714.sav', pattern(4100, 3));
  await Promise.resolve();
  first.persistence.flush();
  await first.storage.settled();
  assert.strictEqual(idb.rows.size, 2, 'the save and the character persist; dtemp scratch does not');

  // A reload: a fresh page, a fresh VFS, the same database.
  const second = await launch(idb, app);
  assert.strictEqual(second.persistence.restored, 2);
  const save = second.vfs.files.get('c:\\dsave\\games\\game641d_3753cbab.sav');
  assert(save && save.data.length === SAVE_BYTES, 'the 3.2 MB save is restored whole');
  assert.deepStrictEqual(save.data.subarray(0, 8), pattern(SAVE_BYTES, 1).subarray(0, 8));
  assert(!second.vfs.files.has('c:\\dtemp\\m641d\\m4714.sav'));

  // What Load a Game asks for finds the restored save.
  const find = second.vfs.findFirstFile('dsave\\games\\game*.sav');
  assert(find && find.entry && find.entry.name.toLowerCase() === 'game641d_3753cbab.sav',
    'FindFirstFile(dsave\\games\\game*.sav) sees the restored save');

  // Deleting a save in the game deletes the stored copy.
  assert(second.vfs.deleteFile('C:\\dsave\\games\\game641d_3753cbab.sav'));
  await Promise.resolve();
  second.persistence.flush();
  await second.storage.settled();
  assert.strictEqual(idb.rows.size, 1, 'a deleted save leaves IndexedDB');

  // The old localStorage path would have dropped the save: that is the bug.
  class MemoryStorage {
    constructor() { this.values = new Map(); }
    get length() { return this.values.size; }
    key(i) { return Array.from(this.values.keys())[i] || null; }
    getItem(k) { return this.values.has(k) ? this.values.get(k) : null; }
    setItem(k, v) { this.values.set(k, String(v)); }
    removeItem(k) { this.values.delete(k); }
  }
  const local = new MemoryStorage();
  const lsVfs = new VirtualFS();
  const ls = VfsPersistence.attach(lsVfs, { appId: 'darkstone_demo', patterns: app.persistFiles, storage: local });
  write(lsVfs, 'C:\\dsave\\games\\game1_2.sav', pattern(SAVE_BYTES, 4));
  await Promise.resolve();
  ls.flush();
  assert.strictEqual(local.length, 0, 'localStorage persistence skips a 3.2 MB save');

  console.log('PASS  Darkstone saves persist through IndexedDB across a browser reload');
}

run().catch(error => { console.error(error.stack || error); process.exit(1); });
