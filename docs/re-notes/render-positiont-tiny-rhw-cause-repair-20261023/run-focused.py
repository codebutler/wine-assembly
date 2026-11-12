#!/usr/bin/env python3
"""One bounded JS arithmetic run and one rejecting mutation; no native imports."""
import hashlib, json, os, pathlib, resource, selectors, signal, subprocess, time

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
NODE = '/home/user/.nvm/versions/node/v24.18.1/bin/node'
CAP = 524288
captured_total = 0

def limits():
    resource.setrlimit(resource.RLIMIT_CPU, (60, 60))
    resource.setrlimit(resource.RLIMIT_FSIZE, (25165824, 25165824))

def run(name, extra):
    global captured_total
    mem = int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines()
                   if x.startswith('MemAvailable:'))) * 1024
    assert mem >= 805306368, 'fresh memory admission denied'
    argv = [NODE, '--max-old-space-size=256', str(HERE / 'probe.cjs'), *extra]
    started = time.monotonic()
    p = subprocess.Popen(argv, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                         start_new_session=True, preexec_fn=limits)
    selector = selectors.DefaultSelector()
    selector.register(p.stdout, selectors.EVENT_READ)
    selector.register(p.stderr, selectors.EVENT_READ)
    capture = bytearray()
    failure = None
    while selector.get_map():
        if time.monotonic() - started >= 60:
            failure = 'wall limit'
            break
        for key, _ in selector.select(.1):
            data = os.read(key.fileobj.fileno(), 8192)
            if not data:
                selector.unregister(key.fileobj)
            elif captured_total + len(capture) + len(data) > CAP:
                failure = 'aggregate capture limit'
                break
            else:
                capture.extend(data)
        if failure:
            break
    if failure:
        os.killpg(p.pid, signal.SIGTERM)
        try:
            p.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, signal.SIGKILL)
    p.wait(timeout=5)
    captured_total += len(capture)
    try:
        os.killpg(p.pid, 0)
        raise AssertionError('owned process group still live')
    except ProcessLookupError:
        pass
    (HERE / (name + '.log')).write_bytes(capture)
    result = dict(argv=argv, memAvailable=mem, pid=p.pid, exit=p.returncode,
                  wallSeconds=time.monotonic()-started, captureBytes=len(capture),
                  sha256=hashlib.sha256(capture).hexdigest(), boundFailure=failure,
                  groupReaped=True)
    (HERE / (name + '.json')).write_text(json.dumps(result, indent=2)+'\n')
    assert failure is None
    return p.returncode, capture.decode()

code, output = run('arithmetic', [])
assert code == 0, output
code, output = run('reject-multiply-mutation', ['--control-remove-overflow-branch'])
assert code != 0 and 'finite tiny-RHW quotient' in output, output
print('PASS: source arithmetic; old reciprocal-multiply mutation rejected; groups reaped')
