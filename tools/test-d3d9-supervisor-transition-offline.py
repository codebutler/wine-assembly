#!/usr/bin/env python3
"""Owned-process spawn-transition controls. No browser or GL execution."""
import ctypes
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

sys.dont_write_bytecode = True


def load(source):
    spec = importlib.util.spec_from_file_location('supervisor', source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ready(path, proc=None):
    deadline = time.monotonic() + 3
    while not path.exists():
        assert proc is None or proc.poll() is None
        assert time.monotonic() < deadline, 'Readiness deadline'
        time.sleep(.01)
    return json.loads(path.read_text())


def subreaper():
    assert ctypes.CDLL(None).prctl(36, 1, 0, 0, 0) == 0


if len(sys.argv) > 1 and sys.argv[1] == '--fixture':
    path = Path(sys.argv[2])
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    child = os.fork()
    if child == 0:
        os.setsid()
        path.with_suffix('.child').write_text(str(os.getpid()))
    else:
        deadline = time.monotonic() + 3
        while not path.with_suffix('.child').exists():
            assert time.monotonic() < deadline
            time.sleep(.01)
        path.write_text(json.dumps([os.getpid(), child]))
    while True:
        time.sleep(1)


def driver(source, directory, config, signum):
    subreaper()
    module = load(source)
    original = module.subprocess.Popen
    # Deliver after a real Popen returns to this wrapper but before it returns
    # to supervise. Only the supervisor's transition mask protects this point.
    def transition(*args, **kwargs):
        proc = original(*args, **kwargs)
        ready(directory / 'ready.json', proc)
        os.kill(os.getpid(), signum)
        return proc
    module.subprocess.Popen = transition
    receipt = {}
    try:
        module.supervise([sys.executable, __file__, '--fixture', str(directory / 'ready.json')],
                         directory, config, receipt)
    except RuntimeError as error:
        receipt['failure'] = str(error)
    (directory / 'result.json').write_text(json.dumps(receipt, indent=2) + '\n')


def main():
    root, config_path = map(Path, sys.argv[1:])
    root.mkdir()
    config = json.loads(config_path.read_text())
    subreaper()
    source = Path(__file__).with_name('test-d3d9-clear-real-browser.py')
    anchor = 'signal.pthread_sigmask(signal.SIG_BLOCK, set(previous))'
    text = source.read_text()
    assert text.count(anchor) == 1
    mutant = root / 'no-transition-mask.py'
    mutant.write_text(text.replace(anchor, 'signal.pthread_sigmask(signal.SIG_BLOCK, set())'))
    results = {}
    all_pids = set()
    try:
        for name, variant, signum in [('reject-no-mask', mutant, signal.SIGINT),
                                      ('fixed-INT', source, signal.SIGINT),
                                      ('fixed-TERM', source, signal.SIGTERM)]:
            directory = root / name
            directory.mkdir()
            with (directory / 'driver.log').open('wb') as log:
                proc = subprocess.Popen([sys.executable, __file__, '--driver', str(variant),
                                         str(directory), str(config_path), str(signum)],
                                        stdout=log, stderr=subprocess.STDOUT)
                pids = ready(directory / 'ready.json', proc)
                all_pids.update(pids)
                start = time.monotonic()
                try:
                    proc.wait(timeout=6)
                finally:
                    if proc.poll() is None:
                        proc.kill()
                        proc.wait(timeout=1)
                receipt = json.loads((directory / 'result.json').read_text())
                alive = [pid for pid in pids if Path(f'/proc/{pid}').exists()]
                assert proc.returncode == 0
                if name.startswith('reject'):
                    assert alive == pids and 'childLaunched' not in receipt, receipt
                    receipt['rejectedMutation'] = 'Removing transition mask leaks ordinary and detached children'
                    # The rejecting fixture owns and explicitly reaps its leaks.
                    for pid in alive:
                        os.kill(pid, signal.SIGKILL)
                    for pid in alive:
                        os.waitpid(pid, 0)
                else:
                    assert not alive and receipt['descendantsRemaining'] == [], receipt
                    assert receipt['failure'] == f'Supervisor received {signal.Signals(signum).name}'
                    assert receipt['exit'] == -signal.SIGKILL
                    assert receipt['killAfterTermSeconds'] <= 5
                    assert time.monotonic() - start < 5, receipt
                all_pids.difference_update(pids)
                results[name] = receipt
        module = load(source)
        output = root / 'cpu-conservation'
        output.mkdir()
        # Each ancestor reaps the previous CPU contribution. The final receipt
        # must count the inherited contribution once, rather than omit or sum it
        # again at every ancestor. This uses real CPU, not a mocked /proc table.
        leaf = 'import time\ns=time.process_time()\nwhile time.process_time()-s<.3: pass\n'
        parent = 'import subprocess,sys\nsubprocess.run([sys.executable,"-c",' + repr(leaf) + '],check=True)\n'
        nested = parent.replace(repr(leaf), repr(parent))
        before = time.monotonic()
        receipt = {}
        assert module.supervise([sys.executable, '-c', nested], output, config, receipt) == 0
        assert .29 <= receipt['aggregateCpuSeconds'] < .55, receipt
        assert not receipt['descendantsRemaining'] and time.monotonic() - before < 3
        results['nestedReapedCpuExactlyOnce'] = receipt
    finally:
        for pid in all_pids:
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            try:
                os.waitpid(pid, 0)
            except ChildProcessError:
                pass
    (root / 'result.json').write_text(json.dumps(results, indent=2) + '\n')
    print(json.dumps({'passed': True, 'cases': list(results), 'browserLaunched': False}))


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--driver':
        driver(Path(sys.argv[2]), Path(sys.argv[3]), json.loads(Path(sys.argv[4]).read_text()), int(sys.argv[5]))
    else:
        main()
