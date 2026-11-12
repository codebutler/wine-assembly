"""Affected merged-tree wiring check. No transport or guest is executed."""
import hashlib
import json
import pathlib
import sys

O = pathlib.Path(__file__).resolve().parent
R = O.parent / 'repo'
pins = json.loads((O / 'verified-inputs.json').read_text())
for name, pin in pins.items():
    assert hashlib.sha256((R / name).read_bytes()).hexdigest() == pin['sha256'], name
sys.path.insert(0, str(R / 'test/fixtures/ricochet-serial-controller'))
import read as adapter
import work

assert pathlib.Path(work.capture.__file__).resolve() == R / 'tools/boat-capture-readback.py'
assert adapter.capture is work.capture
assert adapter.read_executor is work.read_executor
assert pathlib.Path(adapter.__file__).resolve() == R / 'test/fixtures/ricochet-serial-controller/read.py'
executor = work.read_executor()
assert type(executor) is work.capture.SubprocessExecutor
assert executor.argv_factory is work.python_argv
assert not hasattr(executor, 'process')

# Exercise the real default adapter/factory binding while intercepting only the
# final readback function. Historical Boat argv is inspected as data only.
calls = []
original = work.capture.readback
sentinel = object()
def observe(executor, source, destination, *, deadline, concurrency):
    assert type(executor) is work.capture.SubprocessExecutor
    assert executor.argv_factory is work.python_argv
    calls.append((source, destination, deadline, concurrency))
    return sentinel
work.capture.readback = observe
try:
    destination = O / 'never-created.png'
    assert not destination.exists()
    assert adapter.readfile('frozen.png', destination, deadline=123.5) is sentinel
    assert calls == [(str(pathlib.PurePosixPath(adapter.R) / 'frozen.png'), destination, 123.5, 4)]
    assert not destination.exists()
    for target in ('../outside', '/outside'):
        try:
            adapter.readfile(target, destination, deadline=123.5)
        except work.capture.ReadbackError:
            pass
        else:
            raise AssertionError('immutable-root guard omitted')
    assert len(calls) == 1
finally:
    work.capture.readback = original
argv = executor.argv_factory('print("comma, filename")', 1.2)
assert argv[:7] == ['boat', '--no-update', '--json', 'exec', '--timeout', '2', work.BOX]
assert len(argv) == 8
assert argv[-1].startswith('timeout 120 prlimit --cpu=90 --fsize=25165824 -- sh -c ')
result = dict(sourceHashes=pins, exactHelperBinding=True, defaultFactoryBinding=True,
              immutableRootGuard=True, destinationUntouched=True, historicalArgvDataOnly=argv,
              executedTransport=False, reusedBehavioralGroups=True)
(O / 'merged-bindings-results.json').write_text(json.dumps(result, indent=2) + '\n')
print('PASS seven exact source pins, real merged imports/default executor, immutable-root guard and untouched destination; no transport execution')
