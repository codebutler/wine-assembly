#!/usr/bin/env python3
"""Single bounded installed-Chrome tree. No install, sandbox bypass or retries.

Usage: python3 tools/test-d3d9-clear-real-browser.py OUTPUT ACCOUNTING_JSON
Accounting names the task allocation, external session/event paths, and initial
SQLite sizes. Admission denial is exit 2, never a passing skip. OUTPUT is fresh.
"""
import ctypes
import json
import os
from pathlib import Path
import resource
import shutil
import signal
import stat
import subprocess
import sys
import time

MIB = 1048576


def processes():
    table = {}
    for p in Path('/proc').iterdir():
        if p.name.isdigit():
            try:
                f = (p / 'stat').read_text().rsplit(')', 1)[1].split()
                # Include CPU of children already reaped by this process.
                table[int(p.name)] = (int(f[1]), sum(int(v) for v in f[11:15]))
            except (FileNotFoundError, ProcessLookupError):
                pass
    return table


def descendants(table):
    owned = {os.getpid()}
    while True:
        new = {pid for pid, (ppid, _) in table.items() if ppid in owned}
        if new <= owned:
            return owned - {os.getpid()}
        owned |= new


def usage(config):
    paths = set()
    for name in [config['allocation'], *config['external']]:
        p = Path(name)
        if p.exists():
            paths.add(p)
            if p.is_dir():
                paths.update(p.rglob('*'))
    total = largest = 0
    for p in paths:
        try:
            s = p.lstat()
            # Chromium creates SingletonLock/Socket symlinks. Charge their
            # own inode bytes without traversing them or charging targets.
            total += max(s.st_size, s.st_blocks * 512)
            if stat.S_ISREG(s.st_mode):
                largest = max(largest, s.st_size)
        except FileNotFoundError:
            pass  # Chrome may remove its own transient files.
    baseline = json.loads(Path(config['sqliteBaseline']).read_text())
    growth = 0
    for p in Path(config['sqliteDirectory']).glob('*sqlite*'):
        try:
            if p.is_file():
                s = p.stat()
                increment = max(0, max(s.st_size, s.st_blocks * 512) - baseline.get(str(p), 0))
                growth += increment
                largest = max(largest, increment)
        except FileNotFoundError:
            pass
    return total + growth, largest, growth


def limits():
    resource.setrlimit(resource.RLIMIT_CPU, (60, 60))
    resource.setrlimit(resource.RLIMIT_FSIZE, (24 * MIB, 24 * MIB))
    signal.pthread_sigmask(signal.SIG_UNBLOCK, {signal.SIGTERM, signal.SIGINT})


def supervise(command, output, config, receipt):
    """Admitted child tree; offline tests supply harmless fixture commands only."""
    def interrupted(signum, frame):
        raise RuntimeError(f'Supervisor received {signal.Signals(signum).name}')
    previous = {sig: signal.signal(sig, interrupted) for sig in (signal.SIGTERM, signal.SIGINT)}
    before = resource.getrusage(resource.RUSAGE_CHILDREN)
    cpu_base = before.ru_utime + before.ru_stime
    def cpu_seconds(table):
        reaped = resource.getrusage(resource.RUSAGE_CHILDREN)
        return (reaped.ru_utime + reaped.ru_stime - cpu_base +
                sum(table[pid][1] for pid in descendants(table)) / os.sysconf('SC_CLK_TCK'))
    start = time.monotonic()
    seen, security = set(), {}
    peak = usage(config)[0]
    try:
        with (output / 'harness.log').open('wb') as log:
            # Do not allow TERM between Popen returning and entering its finally.
            blocked = signal.pthread_sigmask(signal.SIG_BLOCK, set(previous))
            try:
                proc = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT,
                                        preexec_fn=limits, start_new_session=True)
            except BaseException:
                signal.pthread_sigmask(signal.SIG_SETMASK, blocked)
                raise
            try:
                receipt['childLaunched'] = True
                signal.pthread_sigmask(signal.SIG_SETMASK, blocked)
                while proc.poll() is None:
                    table = processes()
                    owned = descendants(table)
                    seen |= owned
                    for pid in owned:
                        try:
                            args = Path(f'/proc/{pid}/cmdline').read_bytes().split(b'\0')
                            assert b'--no-sandbox' not in args
                            if b'--type=renderer' in args:
                                status = dict(s.split(':', 1) for s in Path(f'/proc/{pid}/status').read_text().splitlines() if ':' in s)
                                security[pid] = {k: status[k].strip() for k in ['NoNewPrivs', 'Seccomp']}
                        except (FileNotFoundError, ProcessLookupError):
                            pass
                    used, largest, growth = usage(config)
                    peak = max(peak, used)
                    cpu = cpu_seconds(table)
                    if time.monotonic() - start >= 60 or cpu >= 60:
                        raise RuntimeError('Browser tree wall/aggregate CPU limit')
                    if used + config['future'] + 8 * MIB > 64 * MIB or largest > 24 * MIB:
                        raise RuntimeError('Task allocation/per-file limit')
                    if shutil.disk_usage(output).free - config['future'] - 8 * MIB < 2982150144:
                        raise RuntimeError('Host free floor')
                    time.sleep(.2)
            finally:
                # Repeated TERM/INT must not interrupt cleanup and orphan children.
                for sig in previous:
                    signal.signal(sig, signal.SIG_IGN)
                # Entire original process group, plus detached/adopted helpers.
                term_at = time.monotonic()
                # Leave scheduling margin inside the mandatory five-second bound.
                for sig, grace in [(signal.SIGTERM, 4.5), (signal.SIGKILL, 2)]:
                    if sig == signal.SIGKILL:
                        receipt['killAfterTermSeconds'] = round(time.monotonic() - term_at, 3)
                    end = time.monotonic() + grace
                    try:
                        os.killpg(proc.pid, sig)
                    except ProcessLookupError:
                        pass
                    while True:
                        owned = descendants(processes())
                        seen |= owned
                        for pid in owned:
                            try:
                                os.kill(pid, sig)
                            except ProcessLookupError:
                                pass
                        proc.poll()
                        for pid in owned - {proc.pid}:
                            try:
                                os.waitpid(pid, os.WNOHANG)
                            except ChildProcessError:
                                pass
                        if not descendants(processes()) or time.monotonic() >= end:
                            break
                        time.sleep(.05)
                    if not descendants(processes()):
                        break
                proc.wait(timeout=1)
                remaining = sorted(descendants(processes()))
                receipt.update(exit=proc.returncode, wallSeconds=round(time.monotonic()-start, 3),
                               peakOwnedBytes=peak, descendantsSeen=sorted(seen),
                               descendantsRemaining=remaining, rendererSecurity=security,
                               aggregateCpuSeconds=round(cpu_seconds(processes()), 6))
                assert not remaining, 'Unreaped browser descendants'
            if receipt['aggregateCpuSeconds'] >= 60:
                raise RuntimeError('Browser tree aggregate CPU limit at exit')
            return proc.returncode
    finally:
        for sig, handler in previous.items():
            signal.signal(sig, handler)


def main():
    output = Path(sys.argv[1]).resolve()
    config = json.loads(Path(sys.argv[2]).read_text())
    assert output.parent == Path(config['allocation']).resolve()
    assert len(os.fsencode(str(output))) <= 58, 'Chrome Unix socket path bound'
    assert not output.exists(), 'Fresh OUTPUT required; retain all prior receipts'
    output.mkdir()
    receipt = {'wallLimit': 60, 'aggregateCpuLimit': 60, 'reserve': 8 * MIB,
               'future': config['future'], 'sandboxDisabled': False,
               'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    try:
        memory = int(next(s.split()[1] for s in Path('/proc/meminfo').read_text().splitlines()
                          if s.startswith('MemAvailable:'))) * 1024
        used, largest, growth = usage(config)
        free = shutil.disk_usage(output).free
        projection = used + 12 * MIB + config['future'] + 8 * MIB
        receipt.update(memoryBefore=memory, ownedBefore=used, sqliteGrowthBefore=growth,
                       freeBefore=free, projectedTotal=projection)
        assert memory >= 2684354560, f'MemAvailable {memory} < 2684354560; no browser launched'
        assert projection <= 64 * MIB, f'Task projection {projection} > 64 MiB'
        assert free - (projection - used) >= 2982150144, 'Host free floor'
        assert largest <= 24 * MIB, 'Per-file limit'
        assert ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) == 0, 'Subreaper required'
        receipt['admission'] = 'pass'
        command = ['node', '--max-old-space-size=256',
                   str(Path(__file__).with_name('d3d9-clear-real-cdp.js')), str(output)]
        receipt['command'] = command
        return supervise(command, output, config, receipt)
    except Exception as e:
        receipt.update(failure=str(e), admission=receipt.get('admission', 'denied'),
                       browserLaunched=receipt.get('childLaunched', False))
        print(json.dumps(receipt))
        return 2
    finally:
        receipt['finalOwnedBytes'], receipt['largestFile'], receipt['sqliteGrowthFinal'] = usage(config)
        (output / 'cleanup-resource.json').write_text(json.dumps(receipt, indent=2)+'\n')


if __name__ == '__main__':
    sys.exit(main())
