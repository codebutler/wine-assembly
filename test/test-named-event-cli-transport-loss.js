'use strict';
// Drop actual authority replies AFTER the mutation/status turn, through a
// separate socket Worker. No mock replacement of the reservation algorithm.
const assert = require('node:assert/strict');
const { Worker } = require('node:worker_threads');
const { NamedEventAuthority, NamedEventClient } = require('../lib/named-event-authority');
const { ThreadManager } = require('../lib/thread-manager');
const path = require('node:path');
const delay = ms => new Promise(r => setTimeout(r, ms));
async function probe(op) {
  const corrupt = op === 'clockAck';
  const authority = new NamedEventAuthority();
  const proxyPath = path.join(authority.directory, 'proxy');
  const counters = new SharedArrayBuffer(8), words = new Int32Array(counters);
  const proxy = new Worker(`
    const {workerData:d}=require('node:worker_threads'),net=require('node:net');
    const words=new Int32Array(d.counters);
    function lines(s,fn){let buf='';s.on('data',c=>{buf+=c;let n;while((n=buf.indexOf('\\n'))>=0){const line=buf.slice(0,n);buf=buf.slice(n+1);fn(line);}});}
    net.createServer(down=>{
      const up=net.connect(d.endpoint.path),ops=[];
      up.on('error',()=>down.destroy());down.on('error',()=>up.destroy());
      down.on('close',()=>up.destroy());up.on('close',()=>down.destroy());
      lines(down,line=>{const r=JSON.parse(line);ops.push(r.op);if(r.op===d.op)Atomics.add(words,1,1);up.write(line+'\\n');});
      lines(up,line=>{const op=ops.shift();if(op===d.op){
        if(d.corrupt){const reply=JSON.parse(line);delete reply.value.callerClock;down.write(JSON.stringify(reply)+'\\n');}
        else{up.destroy();down.destroy();}
      }else down.write(line+'\\n');});
    }).listen(d.path,()=>{Atomics.store(words,0,1);Atomics.notify(words,0);});
  `, { eval: true, workerData: { endpoint: authority.endpoint, path: proxyPath, counters, op: corrupt ? 'waitClock' : op, corrupt } });
  assert.notEqual(Atomics.wait(words, 0, 0, 3000), 'timed-out');
  const client = new NamedEventClient({ ...authority.endpoint, path: proxyPath }, { timeoutMs: 200 });
  const observer = new NamedEventClient(authority.endpoint);
  const memory = new WebAssembly.Memory({ initial: 2, maximum: 2, shared: true });
  const tm = new ThreadManager({}, memory, { exports: { get_sync_table: () => 0 } }, () => ({ host: {} }));
  tm._log = () => {}; tm.enableNamedEventAuthority(); tm._namedEventClient = client;
  try {
    const h = tm.createEvent(false, op === 'forgetWait' || corrupt, 'loss') & 0x7fffffff;
    const other = observer.open('loss');
    if (corrupt) {
      assert.throws(() => tm.waitSingle(h, 1000, 2), { code: 'ECLOCKSCOPE' });
      assert.equal(client.closed, false, 'known clock rejection does not poison');
      assert.equal(observer.acquire(other.handle), true, 'missing clock acknowledgment never falls back or consumes');
      console.log('PASS missing authority clock acknowledgment rejects before registration');
      return;
    }
    let action;
    if (op === 'registerWait' || op === 'forgetWait') action = () => tm.waitSingle(h, 1000, 2);
    else {
      assert.equal(tm.waitSingle(h, 1000, 2), 65535);
      if (op === 'waitStatus') {
        observer.set(other.handle); observer.reset(other.handle);
        action = () => tm._resolveAuthorityWait(h, 1000, 2);
      } else {
        const thread = { tid: 1, state: 'active' };
        action = () => {
          try { tm._markThreadExited(123, thread, 0, 'lost-cancel'); }
          finally { assert.equal(thread.state, 'exited', 'transport failure cannot skip thread retirement'); }
        };
      }
    }
    assert.throws(action, e => ['ECONNECTION', 'ETIMEDOUT'].includes(e.code), 'unknown result must trap');
    assert.equal(client.closed, true);
    assert.equal(Atomics.load(words, 1), 1, 'one request, no mutation replay');
    if (op === 'waitStatus') assert.throws(action, { code: 'ECLOSED' });
    await delay(30); // let socket-close ownership cleanup run
    observer.set(other.handle);
    assert.throws(() => client.acquire('anything'), { code: 'ECLOSED' });
    assert.equal(observer.acquire(other.handle), true, 'new signal survives poisoned-client reuse');
    assert.equal(Atomics.load(words, 1), 1);
    assert.equal(tm._namedEventClient, client, 'no replacement session');
    console.log('PASS lost', op, 'reply: fatal ambiguity, no replay, owner cleanup');
  } finally {
    try { tm.closeNamedEventAuthority(); } catch (e) { assert.equal(e.code, 'ECLOSED'); }
    observer.shutdown(); client.shutdown(); await proxy.terminate(); await authority.close();
  }
}
(async () => { for (const op of ['registerWait', 'waitStatus', 'cancelWait', 'forgetWait', 'clockAck']) await probe(op); })()
  .catch(e => { console.error(e); process.exitCode = 1; });
