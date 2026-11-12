#!/usr/bin/env python3
"""Independent opcode4 acceptance. Local production serve, no kernel mount."""
import contextlib
import copy
import errno
import hashlib
import json
import os
import pathlib
import socket
import struct
import tempfile
import threading
import types
import unittest
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parent
SOURCE = HERE / 'fuse_backend.py'
SHA = 'ae6c1e2619a300edf97164ae208167d9f5e6fbf32fcb4685c365aa54685de1e4'
MAX = (1 << 64) - 1
KEYS = ('live', 'peak', 'written', 'inodes', 'openHandles')
def pack(fmt, *v): return struct.pack('<'+fmt, *v)
def load(path, name):
    m = types.ModuleType(name)
    m.__file__ = str(path)
    exec(compile(path.read_bytes(), str(path), 'exec', dont_inherit=True), m.__dict__)
    return m
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SHA
production = load(SOURCE, 'independent_production')

class OSProxy:
    def __getattr__(self, name): return getattr(os, name)
    def write(self, fd, data):
        if fd == self.w.backend.fd:
            # Snapshot synchronously at the actual reply syscall boundary.
            self.w.reply_states.append(copy.deepcopy(self.w.backend.state()))
        return os.write(fd, data)

class Wire:
    def __init__(self, module=production, limit=64):
        kw = {} if limit is None else dict(setattr_evidence_limit=limit)
        self.backend = module.Backend('/private-root-N4,hidden', 32768, 65536, 8192, **kw)
        if not limit:
            assert not hasattr(self.backend, 'setattr_callbacks'), 'default/off evidence leak'
            assert not hasattr(self.backend, 'setattr_evidence'), 'default/off evidence leak'
        self.temp = tempfile.TemporaryDirectory(prefix='independent-', dir=HERE)
        self.dirfd = os.open(self.temp.name, os.O_RDONLY | os.O_DIRECTORY)
        self.status = '/proc/self/fd/%d/status' % self.dirfd
        server, self.client = socket.socketpair(socket.AF_UNIX, socket.SOCK_SEQPACKET)
        self.client.settimeout(2)
        self.backend.fd = server.detach()
        self.reply_states = []
        self.errors = []
        proxy = OSProxy(); proxy.w = self
        self.old_os = module.os
        module.os = proxy
        def run():
            try: self.backend.serve(self.status)
            except BaseException as e: self.errors.append(e)
        self.module = module
        self.thread = threading.Thread(target=run)
        self.thread.start()
        self.call(26, 1, pack('4I', 7, 31, 0, 0), uid=1)
    def call(self, op, ino, data=b'', uid=37):
        self.client.sendall(pack('2I2Q4I', 40+len(data), op, uid, ino, 932123, 912321, 981234, 0)+data)
        raw = self.client.recv(131072)
        length, error, unique = struct.unpack_from('<IiQ', raw)
        assert (length, unique) == (len(raw), uid), 'wire reply identity'
        return error, raw[16:]
    def state(self):
        with socket.socket(socket.AF_UNIX) as conn:
            conn.settimeout(2); conn.connect(self.status)
            b = b''
            while True:
                chunk = conn.recv(8192)
                if not chunk: return json.loads(b)
                b += chunk
                assert len(b) < 65536, 'status bound'
    def close(self):
        self.client.shutdown(socket.SHUT_WR)
        self.thread.join(3)
        self.client.close()
        self.module.os = self.old_os
        self.temp.cleanup(); os.close(self.dirfd)
        assert not self.thread.is_alive() and not self.errors, repr(self.errors)

@contextlib.contextmanager
def wire(module=production, limit=64):
    w = Wire(module, limit)
    try: yield w
    finally: w.close()

def counters(live, peak, written, inodes=2, handles=1):
    return dict(zip(KEYS, (live, peak, written, inodes, handles)))
def resize(w, ino, size, uid):
    return w.call(4, ino, pack('2I2Q', 8, 0, 0, size), uid=uid)
def evidence(state, expected, limit, count):
    if not limit:
        assert 'setattrEvidence' not in state, 'default/off evidence leak'
        return
    ev = state['setattrEvidence']
    assert ev == dict(limit=limit, callbackCount=count, countSaturated=count==MAX,
                      records=expected[-limit:]), 'callback identity/counters/timing/schema'
    for r in ev['records']:
        assert set(r) == {'opcode','unique','inode','errno','callbackCount','before','after'}, 'privacy schema'
        for k,v in r.items():
            if k in ('before','after'):
                assert set(v)==set(KEYS), 'private counter keys'
                assert all(type(x) is int and 0 <= x <= MAX for x in v.values()), 'numeric counters'
            else: assert type(v) is int and 0 <= v <= MAX, 'numeric identity'

def sequence(module=production, limit=64):
    with wire(module, limit) as w:
        e, answer = w.call(35, 1, pack('4I',0,0o600,0,0)+b'private-name-N4,hidden\0')
        assert e==0
        ino = struct.unpack_from('<Q',answer)[0]
        payload = (bytes(range(256))*16)
        assert w.call(16,ino,pack('2QI',ino,0,4096)+b'\0'*20+payload)[0]==0
        base = counters(12288,12288,4096)
        expected = []
        # Nonmonotonic, extreme unique IDs ensure identity is read from each header.
        steps = [(8193,MAX,28,base,payload),
                 (1024,0,0,base,payload[:1024]),
                 (8192,196,0,counters(16384,16384,11264),payload[:1024]+b'\0'*7168),
                 (0,17,0,counters(8192,16384,11264),b''),
                 (1,206,0,counters(12288,16384,11265),b'\0')]
        prior = base
        for count,(size,unique,error,after,content) in enumerate(steps,1):
            nodes = copy.deepcopy(w.backend.nodes)
            reply = resize(w,ino,size,unique)
            assert reply[0]==-error, 'wire errno'
            r = dict(opcode=4,unique=unique,inode=ino,errno=error,
                     callbackCount=count,before=prior,after=after)
            expected.append(r)
            assert {k:w.reply_states[-1][k] for k in KEYS}==after, 'reply counters'
            evidence(w.reply_states[-1],expected,limit,count)
            state = w.state()
            evidence(state,expected,limit,count)
            assert {k:state[k] for k in KEYS}==after, 'external counters'
            if error: assert w.backend.nodes==nodes, 'rejected content changed'
            assert w.call(15,ino,pack('2QI',ino,0,16384))[1]==content, 'content / zero fill'
            assert 'private-' not in json.dumps(state) and '932123' not in json.dumps(state), 'privacy leak'
            if not error:
                # Successful attr reply must expose actual size, not just a fabricated event.
                assert struct.unpack_from('<Q',reply[1],24)[0]==size, 'attr size'
            prior=after
        if limit:
            copied = w.backend.state()
            copied['setattrEvidence']['records'][0]['before']['live'] = 999
            evidence(w.state(),expected,limit,5)
        assert w.call(18,ino,pack('Q',ino))[0]==0
        assert w.call(10,1,b'private-name-N4,hidden\0')[0]==0
        final=w.state()
        assert {k:final[k] for k in KEYS}==counters(4096,16384,11265,1,0), 'cleanup'
        evidence(final,expected,limit,5)
        return final

class Acceptance(unittest.TestCase):
    def test_00_independent_production_wire(self): sequence()
    def test_off_and_single_record(self):
        enabled = sequence(limit=1)
        enabled.pop('setattrEvidence')
        self.assertEqual(enabled, sequence(limit=0))
        self.assertEqual(enabled, sequence(limit=None))
    def test_error_and_count_saturation(self):
        with wire(limit=1) as w:
            w.backend.setattr_callbacks=MAX-1
            for uid,data,error in [(MAX,b'',errno.EIO),(0,pack('I',0x80000000),errno.EOPNOTSUPP)]:
                before={k:w.state()[k] for k in KEYS}
                assert w.call(4,1,data,uid=uid)[0]==-error
                r=dict(opcode=4,unique=uid,inode=1,errno=error,callbackCount=MAX,before=before,after=before)
                evidence(w.reply_states[-1],[r],1,MAX)
            state=w.state()['setattrEvidence']
            assert w.call(3,1)[0]==0
            assert w.state()['setattrEvidence']==state, 'unrelated opcode recorded'
    def test_distinguishing_mutants(self):
        source=SOURCE.read_text()
        hook='self.record_setattr_callback(op,unique,ino,error,before)'
        controls={
            'post_as_pre': (hook,'self.record_setattr_callback(op,unique,ino,error,self.accounting_counters())',64,'callback identity/counters/timing/schema'),
            'pre_as_post': ('before=before,after=self.accounting_counters()', 'before=before,after=before',64,'callback identity/counters/timing/schema'),
            'dropped_record': (hook,'pass # dropped',64,'callback identity/counters/timing/schema'),
            'after_reply': (hook,'pass # delayed',64,'callback identity/counters/timing/schema'),
            'leaked_content': ('before=before,after=self.accounting_counters()', "before=before,after=self.accounting_counters(),content='private-secret'",64,'callback identity/counters/timing/schema'),
            'default_on': ('setattr_evidence_limit=0):','setattr_evidence_limit=1):',None,'default/off evidence leak'),
            'wrong_unique': (hook,'self.record_setattr_callback(op,unique^1,ino,error,before)',64,'callback identity/counters/timing/schema'),
            'reject_changes_counter': ("if size>self.file_limit:self.reject('filesystem per-file limit')", "if size>self.file_limit:self.written+=1;self.reject('filesystem per-file limit')",64,'reply counters'),
        }
        for name,(old,new,limit,reason) in controls.items():
            with self.subTest(mutant=name):
                assert source.count(old)==1
                changed=source.replace(old,new,1)
                if name=='after_reply':
                    needle="                        if answer is not None:os.write(self.fd,pack('IiQ',16+len(answer),error,unique)+answer)"
                    assert changed.count(needle)==1
                    changed=changed.replace(needle,needle+'\n                        '+hook)
                m=types.ModuleType(name)
                exec(compile(changed,str(SOURCE),'exec'),m.__dict__)
                with self.assertRaisesRegex(AssertionError,reason):
                    sequence(m,limit)
                print('MUTANT_REJECTED',name,reason)
    def test_arguments_and_pins(self):
        adapter=load(HERE/'supervise_accounted.py','adapter')
        caller=load(HERE.parent/'toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py','caller')
        assert callable(caller.load_backend())
        for rel,pin in caller.BACKEND_PINS.items():
            assert hashlib.sha256((caller.ROOT/'test'/rel).read_bytes()).hexdigest()==pin
            altered=dict(caller.BACKEND_PINS);altered[rel]='0'*64
            with mock.patch.object(caller,'BACKEND_PINS',altered):
                with self.assertRaisesRegex(RuntimeError,'identity mismatch'):caller.load_backend()
        for n in range(65): production.Backend('/unused',setattr_evidence_limit=n)
        for bad in (True,False,-1,65,1.0,'1',None,MAX):
            with self.assertRaises(ValueError):production.Backend('/unused',setattr_evidence_limit=bad)
            with mock.patch.object(adapter.subprocess,'Popen') as spawn:
                with self.assertRaises(ValueError):adapter.supervise_accounted([], '/unused',setattr_evidence=bad)
                spawn.assert_not_called()
            result=caller.qualify(domain='tiny-fixture',receipt='unused',command=[],work='unused',setattr_evidence=bad)
            assert 'setattr evidence limit' in result['error']

if __name__=='__main__': unittest.main(verbosity=2)
