#!/usr/bin/env python3
"""SETATTR production serve accounting; local wire tests, no mounted claim."""
import contextlib
import copy
import errno
import hashlib
import io
import json
import os
import pathlib
import tempfile
import types
import unittest
from unittest import mock
import test_namespace_wire as ns

production = ns.production
MAX = ns.MAX
COUNTERS = ('live', 'peak', 'written', 'inodes', 'openHandles')


class ShortDirectory:
    # Keep sockaddr_un short even in a deeply nested owned checkout. Materialized
    # bytes stay in the original task directory and remain charged to that owner.
    original = tempfile.TemporaryDirectory

    def __init__(self, *args, **kwargs):
        self.temp = self.original(*args, **kwargs)
        self.fd = os.open(self.temp.name, os.O_RDONLY | os.O_DIRECTORY)
        self.name = '/proc/self/fd/' + str(self.fd)

    def cleanup(self):
        self.temp.cleanup()
        os.close(self.fd)


@contextlib.contextmanager
def wire(limit=0, *, module=production, explicit=True, **options):
    kw = dict(setattr_evidence_limit=limit) if explicit else {}
    backend = module.Backend('/unused-private', 32768, 65536, 8192, **kw, **options)
    with mock.patch.object(tempfile, 'TemporaryDirectory', ShortDirectory):
        w = ns.transport.Wire(backend)
    try:
        yield w
    finally:
        w.close()


def counters(state):
    return {k: state[k] for k in COUNTERS}


def resize(w, ino, size, flags=8):
    return w.call(4, ino, production.pack('2I2Q', flags, 0, 0, size))


class SetattrEvidenceTests(unittest.TestCase):
    def boundary(self, module=production, limit=64, explicit=True):
        with wire(limit, module=module, explicit=explicit) as w:
            ino = w.create(b'private-size,atomic')
            payload = b'private-content-Q7z!' * 215 + b'x' * 11
            payload = payload[:4096]
            self.assertEqual(len(payload), 4096)
            self.assertEqual(w.call(16, ino, production.pack('2QI', ino, 0, 4096)+b'\0'*20+payload)[0], 0)
            observations = []
            expected = []
            for size, err, live, written in ((8193, errno.ENOSPC, 12288, 4096),
                                            (1024, 0, 12288, 4096),
                                            (8192, 0, 16384, 11264)):
                before = counters(w.state())
                nodes = copy.deepcopy(w.backend.nodes)
                error, answer = resize(w, ino, size)
                self.assertEqual(error, -err)
                after = counters(w.state())
                if err:
                    self.assertEqual(before, after, 'rejected resize mutated accounting')
                    self.assertEqual(nodes, w.backend.nodes)
                self.assertEqual((after['live'], after['written']), (live, written))
                expected.append(dict(opcode=4, unique=w.unique, inode=ino, errno=err,
                                     callbackCount=len(expected)+1, before=before, after=after))
                state = w.state()
                if limit:
                    self.assertEqual(state.pop('setattrEvidence'), dict(limit=limit,
                        callbackCount=len(expected), countSaturated=False, records=expected[-limit:]),
                        'SETATTR serve outcome/accounting mismatch')
                else:
                    self.assertNotIn('setattrEvidence', state)
                    self.assertFalse(hasattr(w.backend, 'setattr_callbacks'))
                    self.assertFalse(hasattr(w.backend, 'setattr_evidence'))
                content = w.call(15, ino, production.pack('2QI', ino, 0, 16384))[1]
                wanted = payload if err else payload[:1024] if size == 1024 else payload[:1024]+b'\0'*7168
                self.assertEqual(content, wanted)
                observations.append((error, answer, state, content))
            self.assertEqual(w.call(18, ino, production.pack('Q', ino))[0], 0)
            self.assertEqual(w.call(10, 1, b'private-size,atomic\0')[0], 0)
            self.assertEqual(counters(w.state()), dict(live=4096, peak=16384, written=11264, inodes=1, openHandles=0))
            if limit:
                ev = w.state()['setattrEvidence']
                self.assertEqual(ev['records'], expected[-limit:])
                encoded = json.dumps(ev)
                for secret in ('private-', 'Q7z!', '987654', '876543', '765432', 'filesystem'):
                    self.assertNotIn(secret, encoded)
                for record in ev['records']:
                    self.assertEqual(set(record), {'opcode','unique','inode','errno','callbackCount','before','after'})
                    for key, value in record.items():
                        if key in ('before','after'):
                            self.assertEqual(set(value), set(COUNTERS))
                            self.assertTrue(all(type(v) is int and v >= 0 for v in value.values()))
                        else:
                            self.assertTrue(type(value) is int and 0 <= value <= MAX)
                ev['records'][0]['before']['live'] = 999
                self.assertEqual(w.state()['setattrEvidence']['records'], expected[-limit:])
            return observations

    def test_00_production_serve_reject_success(self):
        self.boundary()

    def test_default_off_compatibility(self):
        self.assertEqual(self.boundary(limit=0, explicit=False), self.boundary(limit=0))
        self.assertEqual(self.boundary(limit=0), self.boundary())

    def test_bounded_eviction_saturation_identity_and_errors(self):
        for limit in range(1,65):
            with self.subTest(limit=limit), wire(limit) as w:
                ino = w.create(b'private-file')
                expected = []
                for count in range(1,limit+3):
                    w.unique = (MAX if count % 2 else 0)-1
                    before = counters(w.state())
                    self.assertEqual(resize(w, ino, 0, flags=0x80000000)[0], -errno.EOPNOTSUPP)
                    expected.append(dict(opcode=4,unique=w.unique,inode=ino,errno=errno.EOPNOTSUPP,
                        callbackCount=count,before=before,after=before))
                    ev = w.state()['setattrEvidence']
                    self.assertEqual(ev['records'], expected[-limit:])
                    self.assertEqual(ev['callbackCount'], count)
                before = w.state()['setattrEvidence']
                w.unique = 0
                self.assertEqual(w.call(3, ino)[0], 0)
                self.assertEqual(w.state()['setattrEvidence'], before)
                w.backend.setattr_callbacks = MAX-1
                for _ in range(3):
                    # Real malformed dispatch must record translated EIO, not success.
                    self.assertEqual(w.call(4, ino, b'')[0], -errno.EIO)
                    ev = w.state()['setattrEvidence']
                    self.assertEqual(ev['records'][-1]['errno'], errno.EIO)
                    self.assertEqual(ev['callbackCount'], MAX)
                    self.assertTrue(ev['countSaturated'])

    def test_reject_accounting_and_fabricated_outcome_controls(self):
        source = ns.SOURCE.read_text()
        controls = {
            'rejected-accounting': ("if size>self.file_limit:self.reject('filesystem per-file limit')",
                "if size>self.file_limit:self.live+=4096;self.reject('filesystem per-file limit')"),
            'fabricated-errno': ('self.record_setattr_callback(op,unique,ino,error,before)',
                'self.record_setattr_callback(op,unique,ino,0,before)'),
            'fabricated-identity': ('self.record_setattr_callback(op,unique,ino,error,before)',
                'self.record_setattr_callback(op,unique+1,ino,error,before)'),
            'post-as-pre': ('self.record_setattr_callback(op,unique,ino,error,before)',
                'self.record_setattr_callback(op,unique,ino,error,self.accounting_counters())'),
            'removed': ('self.record_setattr_callback(op,unique,ino,error,before)', 'pass # removed'),
        }
        for name,(old,new) in controls.items():
            with self.subTest(control=name):
                self.assertEqual(source.count(old), 1)
                module = types.ModuleType(name)
                exec(compile(source.replace(old,new,1),str(ns.SOURCE),'exec'),module.__dict__)
                with self.assertRaises(AssertionError):
                    self.boundary(module=module)

    def test_combined_status_receipt_bound(self):
        with wire(64, namespace_evidence_limit=64, rename_evidence_limit=64) as w:
            for _ in range(66):
                self.assertEqual(w.call(9, MAX, production.pack('2I',0o700,0)+b'private\0')[0], -errno.ENOENT)
                self.assertEqual(w.rename(b'private-missing', b'private-other'), -errno.ENOENT)
                self.assertEqual(resize(w, 1, 0, flags=0x80000000)[0], -errno.EOPNOTSUPP)
            state=w.state()
            for key in ('renameEvidence','namespaceEvidence','setattrEvidence'):
                self.assertEqual(len(state[key]['records']),64)
            self.assertLess(len(json.dumps(state).encode()),65536)

    def test_exact_pins_and_option_wiring(self):
        adapter = ns.load(ns.SOURCE.with_name('supervise_accounted.py'), 'adapter')
        caller = ns.load(ns.SOURCE.parents[1]/'toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py','caller')
        self.assertTrue(callable(caller.load_backend()))
        for rel,pin in caller.BACKEND_PINS.items():
            self.assertEqual(hashlib.sha256((caller.ROOT/'test'/rel).read_bytes()).hexdigest(),pin)
        for bad in (True,False,-1,65,1.0,'1',None):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError): production.Backend('/unused',setattr_evidence_limit=bad)
                with mock.patch.object(adapter.subprocess,'Popen') as spawn:
                    with self.assertRaises(ValueError): adapter.supervise_accounted([], '/unused',setattr_evidence=bad)
                    spawn.assert_not_called()
                result=caller.qualify(domain='tiny-fixture',receipt='unused',command=[],work='unused',setattr_evidence=bad)
                self.assertIn('setattr evidence limit',result['error'])
        for n in (0,1,64):
            with mock.patch.object(adapter.subprocess,'Popen',side_effect=RuntimeError('captured')) as spawn:
                with self.assertRaisesRegex(RuntimeError,'captured'):adapter.supervise_accounted([], '/unused',setattr_evidence=n)
                argv=spawn.call_args.args[0]
                self.assertEqual('--setattr-evidence' in argv, bool(n))
                if n:self.assertEqual(argv[-2:],['--setattr-evidence',str(n)])
            with ShortDirectory.original(dir=ns.SOURCE.parents[3]) as temp:
                backend=mock.Mock(return_value={})
                with mock.patch.object(caller,'validate_receipt'),mock.patch.object(caller,'load_backend',return_value=backend),mock.patch.object(caller,'evaluate',return_value={}):
                    caller.qualify(domain='tiny-fixture',receipt='unused',command=['/bin/true'],work=temp,setattr_evidence=n,**caller.MAX_LIMITS)
                self.assertEqual(backend.call_args.kwargs.get('setattr_evidence',0),n)
            with mock.patch.object(production.Backend,'mount'),mock.patch.object(production.Backend,'serve') as serve:
                production.main(['/unused','/unused/status','--setattr-evidence',str(n)])
                self.assertEqual(serve.call_args.args,('/unused/status',))
        for arg in ('-1','65','true','1.0'):
            with contextlib.redirect_stderr(io.StringIO()),self.assertRaises(SystemExit):
                production.main(['/unused','/unused/status','--setattr-evidence',arg])
        with mock.patch.object(caller,'qualify',return_value={'accepted':True}) as q:
            argv=['--domain','tiny-fixture','--receipt','unused','--work','unused','--setattr-evidence','64']
            for k,v in caller.MAX_LIMITS.items():argv+=['--'+k.replace('_','-'),str(v)]
            with contextlib.redirect_stdout(io.StringIO()):self.assertEqual(caller.main(argv+['--','/bin/true']),0)
            self.assertEqual(q.call_args.kwargs['setattr_evidence'],64)


if __name__ == '__main__':
    unittest.main(verbosity=2)
