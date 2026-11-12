#!/usr/bin/env python3
"""Independent offline acceptance: entry defaults and loss of terminal-latch storage.

Uses the real CLI main and real HTTP server; no guest. The independent terminal
writer publishes by rename while a durable command intent is already on disk.
"""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import socket
import types
import unittest
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
def load(path,name):
    s=importlib.util.spec_from_file_location(name,path)
    m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
legacy=load(ROOT/'test/test-alien-control-sequence.py','independent_legacy')

class Independent(legacy.Case):
    def test_default_off_never_constructs_transport_or_ledger(self):
        e=load(ROOT/'test/alien-gameplay-sequence.py','independent_default_entry')
        def forbidden(*a,**k):self.fail('disabled CLI constructed control')
        e.control.HttpTransport=forbidden;e.control.Controller=forbidden
        plan=self.home/'plan';plan.write_text('{"commands":[{"action":"snapshot"}]}')
        argv=['--plan',str(plan),'--ledger',str(self.ledger),'--run-id','disabled',
              '--endpoint','http://127.0.0.1:1/ctl','--terminal-file',str(self.terminal)]
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as error:e.main(argv)
        self.assertEqual(error.exception.code,2)
        self.assertFalse(self.ledger.exists());self.assertFalse(self.ledger.with_suffix('.json.lock').exists())
        with contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(e.main(['--collect',str(plan)]),0)
        self.assertEqual(json.loads(out.getvalue())[0]['bytes'],plan.stat().st_size)

    def challenge_latch_storage_loss(self,mutate=False):
        e=load(ROOT/'test/alien-gameplay-sequence.py','independent_boundary_entry')
        if mutate:
            source=(ROOT/'test/helpers/alien-control-sequence.py').read_text()
            needle='                before_send()\n                return super().send(data)'
            self.assertEqual(source.count(needle),1)
            m=types.ModuleType('mutated_final_guard');m.__file__=str(ROOT/'test/helpers/alien-control-sequence.py')
            exec(compile(source.replace(needle,'                return super().send(data)'),m.__file__,'exec'),m.__dict__)
            e.control=m
        endpoint,sends=self.server([dict(value=legacy.snapshot(4650))])
        plan=self.home/'plan';plan.write_text('{"commands":[{"action":"snapshot"}]}')
        argv=['--allow-control','--plan',str(plan),'--ledger',str(self.ledger),'--run-id','latch-loss',
              '--endpoint',endpoint,'--terminal-file',str(self.terminal)]
        request=urllib.request.Request;store=e.control.Controller._store;sendall=socket.socket.sendall
        wire=[];events=[]
        def published(*a,**kw):
            r=request(*a,**kw)
            state=self.state()
            self.assertEqual(state['status'],'uncertain')
            self.assertEqual(state['pending'],dict(index=0,command=dict(action='snapshot')))
            temporary=self.terminal.with_suffix('.new')
            with temporary.open('w') as f:
                json.dump(dict(reason='ended-after-intent',batch=4754,returncode=0),f);f.flush();os.fsync(f.fileno())
            os.replace(temporary,self.terminal)
            d=os.open(self.home,os.O_RDONLY|os.O_DIRECTORY)
            try:os.fsync(d)
            finally:os.close(d)
            events.append('terminal-rename-directory-fsynced')
            return r
        def fail_latch(controller,state):
            if state['status']=='terminal':
                events.append('terminal-latch-storage-failed');raise OSError('independent latch storage loss')
            return store(controller,state)
        def observe_wire(sock,data,*a,**kw):
            wire.append(bytes(data));return sendall(sock,data,*a,**kw)
        urllib.request.Request=published;e.control.Controller._store=fail_latch;socket.socket.sendall=observe_wire
        try:
            with contextlib.redirect_stdout(io.StringIO()):rc=e.main(argv)
        finally:
            urllib.request.Request=request;e.control.Controller._store=store;socket.socket.sendall=sendall
        before=self.ledger.read_bytes();state=self.state()
        self.terminal.unlink() # Restart refusal must derive from retained WAL, not receipt existence.
        with contextlib.redirect_stdout(io.StringIO()):restart=e.main(argv)
        observed=[json.loads(x) for x in sends.read_text().splitlines()] if sends.exists() else []
        receipt=dict(mutation=mutate,cliReturn=rc,restartReturn=restart,wireBytes=sum(map(len,wire)),commands=observed,events=events,ledger=state,restartLedgerUnchanged=self.ledger.read_bytes()==before,guestAcceptance='unqualified')
        (Path(os.environ['TMPDIR'])/('independent-latch-'+('mutant' if mutate else 'positive')+'.json')).write_text(json.dumps(receipt,indent=2)+'\n')
        self.assertEqual(observed,[],'terminal observation must refuse command callback')
        self.assertEqual(wire,[],'terminal observed before headers must refuse HTTP bytes')
        self.assertEqual(rc,1);self.assertEqual(restart,1)
        self.assertEqual(state['status'],'uncertain');self.assertEqual(state['next'],0)
        self.assertEqual(state['receipts'],[])
        self.assertEqual(state['pending'],dict(index=0,command=dict(action='snapshot')))
        self.assertEqual(self.ledger.read_bytes(),before)
        self.assertEqual(events,['terminal-rename-directory-fsynced','terminal-latch-storage-failed'])

    def test_atomic_receipt_and_failed_latch_keep_intent_without_wire_or_replay(self):
        self.challenge_latch_storage_loss()

    def test_independent_oracle_rejects_missing_final_guard(self):
        with self.assertRaisesRegex(AssertionError,'terminal observation must refuse command callback'):
            self.challenge_latch_storage_loss(mutate=True)

if __name__=='__main__':unittest.main(verbosity=2)
