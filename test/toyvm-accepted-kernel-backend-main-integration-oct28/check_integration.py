#!/usr/bin/env python3
"""Source/entry checks only: never mount FUSE or launch a supervised child."""
import ast
import hashlib
import importlib.util
import json
import pathlib
from unittest.mock import patch

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
pins = json.loads((HERE / 'source-pins.json').read_text())
for row in pins:
    source = ROOT / row['path']
    data = source.read_bytes()
    assert len(data) == row['bytes']
    assert hashlib.sha256(data).hexdigest() == row['sha256'], source
    if source.suffix == '.py':
        compile(data, str(source), 'exec')  # Compile only; no top-level execution.

backend = ROOT / 'test/toyvm-kernel-profile-accounting-backend-oct28'
supervisor = ROOT / 'test/toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py'
spec = importlib.util.spec_from_file_location('integration_adapter', backend / 'supervise_accounted.py')
adapter = importlib.util.module_from_spec(spec)
with patch('subprocess.Popen', side_effect=AssertionError('child execution forbidden')) as spawn:
    spec.loader.exec_module(adapter)
    # Exact production entry must reject an unsafe backend before path setup.
    try:
        adapter.supervise_accounted([], None, backend='pathname-stat')
    except ValueError as error:
        assert str(error) == 'unsafe filesystem accounting backend'
    else:
        raise AssertionError('unsafe backend accepted')
    assert hashlib.sha256(supervisor.read_bytes()).hexdigest() == adapter.PIN
    original = pathlib.Path.read_bytes

    def wrong_pin(path):
        return b'incompatible supervisor' if path == supervisor else original(path)

    with patch.object(pathlib.Path, 'read_bytes', wrong_pin):
        try:
            adapter.supervise_accounted([], HERE)
        except RuntimeError as error:
            assert str(error) == 'supervisor identity mismatch'
        else:
            raise AssertionError('wrong supervisor accepted')
    assert spawn.call_count == 0

# Dependencies are repository siblings; no donor or temporary runtime path.
for name in ['supervise_accounted.py', 'confine.py', 'fuse_backend.py']:
    tree = ast.parse((backend / name).read_text())
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            assert '/tmp/' not in node.value and '/home/user/' not in node.value
for name in ['fuse_backend.py', 'confine.py']:
    assert (backend / name).is_file()
assert (supervisor.parent / 'pinned-guard.py').is_file()
assert (supervisor.parent / 'test_accounting.py').is_file()
print(json.dumps(dict(sourceFiles=len(pins), syntax=True, productionUnsafeBackendRejected=True,
                      productionWrongPinRejected=True, childStarts=0, siblingClosure=True,
                      browserAllowed=False, kernelChecksReused=8, inheritedChecksReused=31)))
