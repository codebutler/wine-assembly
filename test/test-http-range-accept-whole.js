#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { HttpRangeProvider, HttpByteRangeProvider, ChunkCache } = require('../lib/byte-provider');
const body = Uint8Array.from({ length: 1000 }, (_, i) => i & 255);
const response = (status, bytes) => ({ status, arrayBuffer: async () => bytes.buffer });
(async () => {
  const calls = [];
  const fetch = async (url, init = {}) => {
    assert(!init.method || init.method === 'GET');
    assert(!new Headers(init.headers).has('Range'), 'never send HTTP Range');
    calls.push(url);
    await new Promise(r => setTimeout(r, 5));
    return response(200, body);
  };
  const p = new HttpRangeProvider('file', body.length, { fetch });
  assert.strictEqual(p.readRangeSync(0, 1), null);
  const results = await Promise.all([p.readRange(5, 3), p.readRange(998, 8)]);
  assert.deepStrictEqual([...results[0]], [5, 6, 7]);
  assert.deepStrictEqual([...results[1]], [230, 231]);
  assert.strictEqual(calls.length, 1, 'concurrent readers share one whole download');
  const cache = new ChunkCache(p, { chunkSize: 100, maxChunks: 1, readAhead: 0, prefetch: 0 });
  await cache.fill(0, 1); await cache.fill(800, 1); await cache.fill(0, 1);
  assert.strictEqual(calls.length, 1, 'chunk eviction does not refetch source bytes');
  results[0][0] = 99;
  assert.strictEqual(p.readRangeSync(5, 1)[0], 5);
  const opened = await HttpRangeProvider.open('unknown', { fetch });
  assert.strictEqual(opened.size, 1000, 'discover decoded size from body, not HEAD');
  await opened.readRange(9, 2);
  assert.strictEqual(calls.length, 2);
  const parts = [], routes = new Map([['f.part0', body.slice(0, 400)], ['f.part1', body.slice(400, 800)], ['f.part2', body.slice(800)]]);
  let fail = true;
  const split = new HttpRangeProvider('f', 1000, { partSize: 400, partUrl: (u, i) => u + '.part' + i,
    fetch: async (url, init) => {
      assert(!new Headers(init.headers).has('Range')); parts.push(url);
      if (url === 'f') return response(404, new Uint8Array());
      if (url === 'f.part1' && fail) { fail = false; return response(503, new Uint8Array()); }
      return response(200, routes.get(url));
    } });
  await assert.rejects(split.readRange(399, 3), /503/);
  assert.deepStrictEqual([...await split.readRange(399, 3)], [...body.slice(399, 402)]);
  assert(!parts.includes('f.part2'), 'untouched parts stay unloaded');
  await split.readRange(990, 20); await split.readRange(0, 1000);
  assert.strictEqual(parts.filter(x => x === 'f').length, 1);
  assert.strictEqual(parts.filter(x => x === 'f.part0').length, 1);
  assert.strictEqual(parts.filter(x => x === 'f.part1').length, 2, 'failed part is retryable');
  assert.strictEqual(parts.filter(x => x === 'f.part2').length, 1);
  const short = new HttpRangeProvider('short', 1000, { fetch: async () => response(200, body.slice(0, 999)) });
  await assert.rejects(short.readRange(0, 1), /999 decoded bytes, expected 1000/);
  const partial = new HttpRangeProvider('partial', 1000, { fetch: async () => response(206, body) });
  await assert.rejects(partial.readRange(0, 1), /206/);
  let release;
  const closing = new HttpRangeProvider('closing', 1000, { fetch: () => new Promise(r => { release = r; }) });
  const pending = closing.readRange(0, 1); closing.close(); release(response(200, body));
  await assert.rejects(pending, /closed/);
  assert.strictEqual(closing._whole, null, 'late response cannot resurrect closed cache');
  split.close(); assert.strictEqual(split._parts.size, 0);
  const ranges = [];
  const ranged = new HttpByteRangeProvider('archive', body.length, { fetch: async (url, init) => {
    const range = new Headers(init.headers).get('Range'); ranges.push(range);
    const [, a, b] = /^bytes=(\d+)-(\d+)$/.exec(range);
    const bytes = body.slice(Number(a), Number(b) + 1);
    return { ...response(206, bytes), headers: new Headers({ 'Content-Range': `bytes ${a}-${b}/${body.length}` }) };
  }});
  const rangedCache = new ChunkCache(ranged, {chunkSize:100,maxChunks:1,readAhead:0,prefetch:0});
  await rangedCache.fill(805, 3);
  assert.deepStrictEqual(ranges, ['bytes=800-899'], 'only requested archive section downloaded');
  assert.strictEqual(ranged._whole, null, 'partial reads never retain whole archives');
  await rangedCache.fill(5, 2);
  assert.deepStrictEqual(ranges, ['bytes=800-899','bytes=0-99']);
  const fallbackCalls = [];
  const fallback = new HttpByteRangeProvider('ignores-range',body.length,{fetch:async (u,i)=>{
    fallbackCalls.push(i); await new Promise(r=>setTimeout(r,5)); return response(200,body);
  }});
  const fallbackReads=await Promise.all([fallback.readRange(2,3),fallback.readRange(900,2)]);
  assert.strictEqual(fallbackCalls.length,1,'concurrent probe shares complete-body fallback');
  assert.deepStrictEqual([...fallbackReads[1]],[...body.slice(900,902)]);
  for (const [header, bytes, encoding] of [
    ['bytes 1-3/1000',body.slice(0,3),null], ['bytes 0-2/999',body.slice(0,3),null],
    ['bytes 0-2/1000',body.slice(0,2),null], ['bytes 0-2/1000',body.slice(0,3),'gzip'],
  ]) {
    const bad=new HttpByteRangeProvider('bad',1000,{fetch:async()=>({...response(206,bytes),headers:new Headers({
      'Content-Range':header,...(encoding?{'Content-Encoding':encoding}:{})})})});
    await assert.rejects(bad.readRange(0,3),/invalid partial|expected/);
  }
  const aborted = new AbortController(); let finishRange;
  const cancelRange = new HttpByteRangeProvider('cancel',1000,{signal:aborted.signal,fetch:()=>new Promise(r=>{finishRange=r;})});
  const cancelled=cancelRange.readRange(0,3);aborted.abort();
  await assert.rejects(cancelled,/abort/i);finishRange(response(200,body));
  await new Promise(r=>setTimeout(r,0));assert.strictEqual(cancelRange._whole,null);
  ranged.close();assert.strictEqual(ranged._firstRange,null);
  console.log('PASS bounded HTTP sections: partial bytes, whole fallback, concurrent discovery, malformed responses and cancellation');
  console.log('PASS whole HTTP files/parts: deduplication, eviction, cross-part reads, retries, decoded sizes, close');
})().catch(e => { console.error(e); process.exitCode = 1; });
