#!/usr/bin/env python3
"""Harmless owned-child tests. No browser admission change or Chrome launch."""
import ast
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


def load(path):
    spec = importlib.util.spec_from_file_location('supervisor', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def wait_file(path, proc):
    deadline = time.monotonic() + 5
    while not path.exists():
        assert proc.poll() is None, 'Fixture exited before readiness'
        assert time.monotonic() < deadline, 'Fixture readiness timeout'
        time.sleep(.02)
    return json.loads(path.read_text())


if len(sys.argv) > 1 and sys.argv[1] == '--fixture':
    ready = Path(sys.argv[2])
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    child = os.fork()
    if child == 0:
        os.setsid()
        ready.with_suffix('.detached').write_text(str(os.getpid()))
    else:
        while not ready.with_suffix('.detached').exists():
            time.sleep(.01)
        ready.write_text(json.dumps([os.getpid(), child]))
    while True:
        time.sleep(1)

if len(sys.argv) > 1 and sys.argv[1] == '--driver':
    mode, directory, config_path, baseline = sys.argv[2:]
    output = Path(directory)
    config = json.loads(Path(config_path).read_text())
    source = Path(baseline) if mode == 'baseline' else Path(__file__).with_name('test-d3d9-clear-real-browser.py')
    module = load(source)
    assert ctypes.CDLL(None).prctl(36, 1, 0, 0, 0) == 0
    command = [sys.executable, __file__, '--fixture', str(output / 'ready.json')]
    receipt = {}
    try:
        if mode == 'baseline':
            # Execute the original with/finally supervisor body byte-derived
            # from AST; no browser, memory gate substitution, or limit change.
            tree = ast.parse(source.read_text())
            main = next(x for x in tree.body if isinstance(x, ast.FunctionDef) and x.name == 'main')
            block = next(x for x in ast.walk(main) if isinstance(x, ast.With))
            scope = vars(module).copy()
            scope.update(command=command, output=output, config=config, receipt=receipt,
                         start=time.monotonic(), seen=set(), cpu_seen={}, security={}, peak=module.usage(config)[0])
            exec(compile(ast.Module(body=[block], type_ignores=[]), str(source), 'exec'), scope)
        else:
            module.supervise(command, output, config, receipt)
    except Exception as error:
        receipt['failure'] = str(error)
    (output / 'driver-result.json').write_text(json.dumps(receipt, indent=2) + '\n')
    sys.exit(0)


def main():
    root, config_path = Path(sys.argv[1]), Path(sys.argv[2])
    root.mkdir()
    assert ctypes.CDLL(None).prctl(36, 1, 0, 0, 0) == 0
    baseline = root / 'baseline.py'
    baseline.write_bytes(subprocess.check_output(['git', 'show',
        'a518fdba38985cafc52beddf76e7d6845fa97019:tools/test-d3d9-clear-real-browser.py'], stderr=subprocess.DEVNULL))
    results = {}
    all_pids = set()
    try:
        for mode in ['baseline', 'fixed']:
            directory = root / mode
            directory.mkdir()
            with (directory / 'driver.log').open('wb') as log:
                proc = subprocess.Popen([sys.executable, __file__, '--driver', mode,
                    str(directory), str(config_path), str(baseline)], stdout=log, stderr=subprocess.STDOUT)
                pids = wait_file(directory / 'ready.json', proc)
                all_pids.update(pids)
                start = time.monotonic()
                proc.send_signal(signal.SIGTERM)
                if mode == 'fixed':
                    time.sleep(.2)
                    proc.send_signal(signal.SIGTERM)
                proc.wait(timeout=8)
                alive = [pid for pid in pids if Path(f'/proc/{pid}').exists()]
                if mode == 'baseline':
                    assert proc.returncode == -signal.SIGTERM and alive == pids
                    assert not (directory / 'driver-result.json').exists()
                    results[mode] = {'signalExit': proc.returncode, 'leakedPids': alive,
                                     'reproduced': 'TERM bypasses original finally, including detached child'}
                else:
                    receipt = json.loads((directory / 'driver-result.json').read_text())
                    assert proc.returncode == 0 and not alive, receipt
                    assert receipt['failure'] == 'Supervisor received SIGTERM'
                    assert receipt['exit'] == -signal.SIGKILL and receipt['descendantsRemaining'] == []
                    assert 4.4 <= receipt['killAfterTermSeconds'] <= 5
                    assert time.monotonic() - start < 7
                    results[mode] = receipt
                for pid in alive:
                    os.kill(pid, signal.SIGKILL)
                for pid in alive:
                    os.waitpid(pid, 0)
                all_pids.difference_update(pids)
        module = load(Path(__file__).with_name('test-d3d9-clear-real-browser.py'))
        original = load(baseline)
        # Child CPU reaped before the next sample remains visible in cutime/cstime.
        cpu_ready = root / 'cpu-ready.json'
        child_code = 'import time\ns=time.process_time()\nwhile time.process_time()-s<.2: pass\n'
        parent_code = ('import subprocess,sys,time,pathlib\nsubprocess.run([sys.executable,"-c",'+
            repr(child_code)+'],check=True)\npathlib.Path('+repr(str(cpu_ready))+').write_text("[]")\ntime.sleep(5)')
        proc = subprocess.Popen([sys.executable, '-c', parent_code])
        all_pids.add(proc.pid)
        wait_file(cpu_ready, proc)
        old = original.processes()[proc.pid][1]
        new = module.processes()[proc.pid][1]
        assert new - old >= .15 * os.sysconf('SC_CLK_TCK'), (old, new)
        results['reapedChildCpu'] = {'baselineTicks': old, 'fixedTicks': new}
        proc.terminate()
        proc.wait(timeout=2)
        all_pids.discard(proc.pid)
        output = root / 'nonzero'
        output.mkdir()
        receipt = {}
        assert module.supervise([sys.executable, '-c', 'raise SystemExit(7)'], output,
            json.loads(config_path.read_text()), receipt) == 7
        assert receipt['descendantsRemaining'] == []
        results['nonzeroExit'] = receipt
        output = root / 'graceful'
        output.mkdir()
        receipt = {}
        code = 'import os,time\npid=os.fork()\nif pid==0: time.sleep(30)\n'
        assert module.supervise([sys.executable, '-c', code], output,
            json.loads(config_path.read_text()), receipt) == 0
        assert receipt['descendantsRemaining'] == [] and receipt['wallSeconds'] < 2
        results['gracefulTermUnblocked'] = receipt
        allocated = root / 'usage-allocated'
        allocated.mkdir()
        sqlite_dir = root / 'usage-sqlite'
        sqlite_dir.mkdir()
        (sqlite_dir / 'fixture.sqlite').write_bytes(b'x')
        initial = root / 'usage-baseline.json'
        initial.write_text('{}')
        cfg = dict(allocation=str(allocated), external=[], sqliteDirectory=str(sqlite_dir), sqliteBaseline=str(initial))
        old = original.usage(cfg)[2]
        new = module.usage(cfg)[2]
        assert old == 1 and new >= 4096
        results['sqliteAllocatedGrowth'] = {'baselineBytes': old, 'fixedBytes': new}
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
    main()
