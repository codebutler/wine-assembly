#!/usr/bin/env python3
"""Explicit installed-browser test; no packages, server, guest or native build.

Usage: python3 tools/test-owned-popup-browser-cdp.py OUTPUT RENDERER [MUTATION]
OUTPUT must be a fresh directory under a task allocation. On Linux this owns
the entire child tree, including detached Chrome helpers, using a subreaper.
Exit 0 = all pixels pass, 1 = pixel failure, 2 = harness/admission failure.
"""
import ctypes
import json
import os
from pathlib import Path
import resource
import shutil
import signal
import subprocess
import sys
import time

MIB = 1048576


def processes():
    result = {}
    for entry in Path('/proc').iterdir():
        if entry.name.isdigit():
            try:
                fields = (entry / 'stat').read_text().rsplit(')', 1)[1].split()
                result[int(entry.name)] = (int(fields[1]), int(fields[11]) + int(fields[12]), fields[0])
            except (FileNotFoundError, ProcessLookupError):
                pass
    return result


def descendants(table):
    owned = {os.getpid()}
    while True:
        new = {pid for pid, (ppid, _, _) in table.items() if ppid in owned}
        if new <= owned:
            return owned - {os.getpid()}
        owned |= new


def usage(root):
    sizes = [p.lstat().st_size for p in root.rglob('*') if p.is_file() and not p.is_symlink()]
    return sum(sizes), max(sizes, default=0)


def limits():
    resource.setrlimit(resource.RLIMIT_CPU, (60, 60))
    resource.setrlimit(resource.RLIMIT_FSIZE, (24 * MIB, 24 * MIB))


def main():
    output = Path(sys.argv[1]).resolve()
    assert len(os.fsencode(str(output))) <= 58, 'Use short OUTPUT for Chromium Unix socket paths'
    renderer = Path(sys.argv[2]).resolve()
    mutation = sys.argv[3] if len(sys.argv) > 3 else 'none'
    allocation = output.parent
    assert not output.exists(), 'Use fresh OUTPUT; previous evidence is retained'
    memory = int(next(line.split()[1] for line in Path('/proc/meminfo').read_text().splitlines()
                      if line.startswith('MemAvailable:'))) * 1024
    free = shutil.disk_usage(allocation).free
    before, largest = usage(allocation)
    assert memory >= 2684354560, f'MemAvailable {memory} < 2684354560'
    # 52 MiB total allocation projection, including 8 MiB reserve; standing
    # installed binaries and read-only Git alternates are never traversed.
    assert before + 32 * MIB <= 52 * MIB, f'Insufficient projected browser growth: {before}'
    assert free - (52 * MIB - before) >= 2982150144, f'Host free-space floor: {free}'
    assert largest <= 24 * MIB
    assert ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) == 0, 'PR_SET_CHILD_SUBREAPER failed'
    output.mkdir()
    receipt = {'memoryBefore': memory, 'freeBefore': free, 'ownedBefore': before,
               'projectedTotal': 52 * MIB, 'reserve': 8 * MIB, 'wallLimit': 60,
               'aggregateCpuLimit': 60, 'sandboxDisabled': False}
    command = ['node', '--max-old-space-size=256', str(Path(__file__).with_name('owned-popup-browser-cdp.js')),
               str(output), str(renderer), mutation]
    start = time.monotonic()
    failure = None
    peak = before
    seen = set()
    cpu_seen = {}
    renderer_security = {}
    with (output / 'harness.log').open('wb') as log:
        proc = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, preexec_fn=limits,
                                start_new_session=True)
        try:
            while proc.poll() is None:
                table = processes()
                owned = descendants(table)
                seen |= owned
                for pid in owned:
                    cpu_seen[pid] = max(cpu_seen.get(pid, 0), table[pid][1])
                    try:
                        args = Path(f'/proc/{pid}/cmdline').read_bytes().split(b'\0')
                        if b'--type=renderer' in args:
                            status = dict(line.split(':', 1) for line in Path(f'/proc/{pid}/status').read_text().splitlines() if ':' in line)
                            renderer_security[pid] = {key: status[key].strip() for key in ['NoNewPrivs', 'Seccomp']}
                            assert b'--no-sandbox' not in args, 'Renderer sandbox disabled'
                    except (FileNotFoundError, ProcessLookupError):
                        pass
                used, largest = usage(allocation)
                peak = max(peak, used)
                cpu = sum(cpu_seen.values()) / os.sysconf('SC_CLK_TCK')
                if time.monotonic() - start >= 60 or cpu >= 60:
                    raise RuntimeError('Browser tree wall/aggregate CPU limit')
                if used + 8 * MIB > 64 * MIB or largest > 24 * MIB:
                    raise RuntimeError('Browser allocation/per-file limit')
                if usage(output / 'profile')[0] > 24 * MIB:
                    raise RuntimeError('Browser profile exceeds 24 MiB allowance')
                time.sleep(0.1)
        except Exception as error:
            failure = str(error)
        finally:
            # TERM every descendant, allow up to 5s, then KILL and reap. The
            # subreaper adopts orphaned/detached helpers; no sandbox bypass.
            for sig, grace in [(signal.SIGTERM, 5), (signal.SIGKILL, 2)]:
                end = time.monotonic() + grace
                while True:
                    table = processes()
                    owned = descendants(table)
                    seen |= owned
                    for pid in owned:
                        try:
                            os.kill(pid, sig)
                        except ProcessLookupError:
                            pass
                    proc.poll()
                    while True:
                        try:
                            pid, _ = os.waitpid(-1, os.WNOHANG)
                            if not pid:
                                break
                        except ChildProcessError:
                            break
                    if not descendants(processes()) or time.monotonic() >= end:
                        break
                    time.sleep(0.05)
                if not descendants(processes()):
                    break
            remaining = sorted(descendants(processes()))
            assert not remaining, f'Unreaped browser descendants: {remaining}'
    receipt.update(command=command, exit=proc.returncode, failure=failure,
                   wallSeconds=round(time.monotonic() - start, 3), peakOwnedBytes=peak,
                   descendantsSeen=sorted(seen), descendantsRemaining=remaining,
                   rendererSecurity=renderer_security,
                   profileBytes=usage(output / 'profile')[0], finalOwnedBytes=usage(allocation)[0])
    (output / 'cleanup-resource.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt))
    return 2 if failure else proc.returncode


if __name__ == '__main__':
    sys.exit(main())
