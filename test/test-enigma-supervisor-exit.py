"""Offline subprocess regression on the actual transformed supervisor tail.

Executes the unchanged historical stop() against fake OS child/group interfaces;
never launches its guest/watchdog recipes. All receipt and shell-AND I/O is real.
"""
import gzip
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile

repo = pathlib.Path(__file__).resolve().parents[1]
evidence = repo / 'docs/re-notes/enigma-supervisor-exit-repair-20261024'
adapter = repo / 'tools/enigma-terminal-capture-guard.cjs'
original = gzip.decompress((evidence / 'original-supervise.py.gz').read_bytes()).decode()
assert hashlib.sha256(original.encode()).hexdigest() == '73be15954cedc19340779ff6bda2397cb94927ca702d2baebdccd5e763cf7b73'
receipt = dict(version=1, terminal=True, reason='capture-byte-limit', artifactAccepted=False,
               runnerSHA256='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809',
               captureSHA256='6d64a146f2daf8b598dbf13e3c13f890dbc783d8f5286aacba6d343758d22079',
               name='AssertionError', code='ERR_ASSERTION', message='capture byte limit')

def body(source):
    start = source.index(' while p.poll() is None:\n', source.index("why='natural'"))
    # No reconstruction of the finalization: include the actual try/finally EOF.
    return 'try:\n' + source[start:]

# Feed real receipts from the actual pinned capture _compile + writer into
# the complete transformed supervisor, rather than constructing new receipts.
profile_tests = subprocess.run(['node', '--max-old-space-size=256',
    str(repo / 'test/test-enigma-single-frame-profile.js')],
    capture_output=True, timeout=30, check=True)
assert len(profile_tests.stdout) + len(profile_tests.stderr) < 65536
actual_outcomes = json.loads(profile_tests.stdout)['outcomes']
actual_receipts = {o['mode']: o['receipt'] for o in actual_outcomes if 'receipt' in o}
results = []
with tempfile.TemporaryDirectory(prefix='enigma-supervisor-exit-') as tmp:
    root = pathlib.Path(tmp)
    sourcefile = root / 'original.py'
    sourcefile.write_text(original)
    transformed = subprocess.run(['node', '--max-old-space-size=256', '-e',
        'process.stdout.write(require(process.argv[1]).transformSupervisor(require("fs").readFileSync(process.argv[2],"utf8")))',
        str(adapter), str(sourcefile)], capture_output=True, timeout=10, check=True).stdout.decode()
    helper = transformed[transformed.index('def terminal_capture():'):transformed.index('H=pathlib.Path')]
    original_stop = original[original.index('def stop(p):'):original.index('def limits():')]
    assert original_stop.replace('monotonic()+5', 'monotonic()+1') in transformed, 'cleanup must retain TERM/KILL/reaping with a shorter grace'
    exit_guard = 'if capture_terminal is not None:raise SystemExit(1)\n'
    assert transformed.count(exit_guard) == 1
    reverted = transformed.replace(exit_guard, '')
    # The meaningful mutant is the exact previously rejected transformation.
    old_adapter = root / 'old.cjs'
    old_adapter.write_bytes(gzip.decompress((repo / 'docs/re-notes/enigma-runner-repairs-independent-20261024/candidate-terminal.cjs.gz').read_bytes()))
    old = subprocess.run(['node', '--max-old-space-size=256', '-e',
        'process.stdout.write(require(process.argv[1]).transformSupervisor(require("fs").readFileSync(process.argv[2],"utf8")))',
        str(old_adapter), str(sourcefile)], capture_output=True, timeout=10, check=True).stdout.decode()
    # Normalize only the new allowlisted single-frame branch; the complete
    # historical transformation must still match the retained old oracle.
    new_validation = """ assert record.get('code')=='ERR_ASSERTION'
 assert record.get('profile') in (None,'default','single-frame')
 if record.get('profile')=='single-frame':
  assert record.get('message') in ('capture byte limit','capture frame limit','capture cumulative byte limit')
 else:
  assert record.get('message')=='capture byte limit'"""
    old_validation = " assert record.get('code')=='ERR_ASSERTION' and record.get('message')=='capture byte limit'"
    assert reverted.count(new_validation) == 1
    # Compare the receipt helper against the old oracle independently of the
    # newly tested transport. Keep the entire original terminal validation.
    def receipt_helper(s):
        return s[s.index('def terminal_capture():'):s.index('# Retained-output transport') if '# Retained-output transport' in s else s.index('H=pathlib.Path')].rstrip()
    assert receipt_helper(reverted).replace(new_validation, old_validation) == receipt_helper(old)
    assert exit_guard not in reverted and exit_guard in transformed

    def run(name, source, raw, poll='running', failure='', configured=True, output=b''):
        case = root / name
        case.mkdir()
        (case / 'output.log').write_bytes(output)
        if raw is not None:
            (case / 'raw.json').write_text(raw)
        env = dict(os.environ)
        env.pop('ENIGMA_TERMINAL_RECEIPT', None)
        if configured:
            env['ENIGMA_TERMINAL_RECEIPT'] = str(case / 'raw.json')
        script = case / 'supervisor.py'
        prelude = '''import os,json,pathlib,signal,types
E=pathlib.Path(CASE)
trace=[]
def save():
 (E/'trace.json').write_text(json.dumps(trace))
def killpg(pid,sig):
 trace.append(['killpg',pid,sig]);save();raise ProcessLookupError()
def waitpid(pid,flag):
 trace.append(['waitpid',pid,flag]);save();raise ChildProcessError()
os=types.SimpleNamespace(environ=os.environ,path=os.path,killpg=killpg,waitpid=waitpid,WNOHANG=os.WNOHANG)
class Child:
 pid=12345
 returncode=CHILDCODE
 def poll(self):
  if FAILURE=='poll' and not getattr(self,'polled',False):
   self.polled=True;raise RuntimeError('original poll failure')
  return None if POLL=='running' else self.returncode
 def wait(self):
  trace.append(['wait']);save()
  if FAILURE=='cleanup':raise RuntimeError('original cleanup failure')
class Clock:
 def monotonic(self):return 61
 def sleep(self,n):raise AssertionError('unexpected sleep')
class Log:
 def close(self):
  trace.append(['log.close']);save()
  if FAILURE=='publication':(E/'terminal.json').mkdir()
class Output:
 capped=False
 fault=False
 def drain(self):return b''
 def close(self):pass
p=Child();time=Clock();start=0;why='natural';offset=0;tail=b'';log=Log();output=Output()
'''.replace('CASE', repr(str(case))).replace('CHILDCODE', '1' if poll == 'failed' else '0').replace('POLL', repr(poll)).replace('FAILURE', repr(failure))
        # Actual stop() runs here using only fake OS interfaces above.
        script.write_text(prelude + helper + original_stop + body(source))
        dependent = case / 'dependent.py'
        dependent.write_text('import pathlib\npathlib.Path(' + repr(str(case / 'dependent')) + ').touch()\n')
        process = subprocess.run(['bash', '-c', '"$1" "$2" && "$1" "$3"',
            'probe', sys.executable, str(script), str(dependent)], env=env, capture_output=True, timeout=10)
        assert len(process.stdout) + len(process.stderr) < 8192
        recordfile = case / 'terminal.json'
        record = json.loads(recordfile.read_text()) if recordfile.is_file() else None
        trace = json.loads((case / 'trace.json').read_text())
        result = dict(name=name, exit=process.returncode, dependentRan=(case / 'dependent').exists(),
                      receipt=record, cleanupTrace=trace, stderr=process.stderr.decode())
        results.append(result)
        return result

    def denial(result, expected=receipt):
        assert result['exit'] == 1 and not result['dependentRan']
        assert result['receipt']['reason'] == 'capture-byte-limit'
        assert result['receipt']['captureTerminal'] == expected
        assert result['cleanupTrace'] == [['killpg',12345,15],['killpg',12345,0],
            ['killpg',12345,9],['wait'],['waitpid',-1,1],['killpg',12345,0],['log.close']]
        assert result['receipt']['remainingGroup'] is False

    for poll in ['running', 'success', 'failed']:
        denial(run('denial-' + poll, transformed, json.dumps(receipt), poll=poll))
    for mode in ['default', 'frames', 'cumulative']:
        actual = actual_receipts[mode]
        for poll in ['running', 'success', 'failed']:
            denial(run('actual-' + mode + '-' + poll, transformed, json.dumps(actual), poll=poll), actual)
    for message in ['capture byte limit', 'capture frame limit', 'capture cumulative byte limit']:
        single = dict(receipt, profile='single-frame', message=message)
        for poll in ['running', 'success', 'failed']:
            denial(run('single-' + message.replace(' ', '-') + '-' + poll,
                       transformed, json.dumps(single), poll=poll), single)
    for name, changes in [('writer', dict(code='EIO', message='writer failure')),
                          ('unrelated-assert', dict(message='unrelated assertion')),
                          ('invalid-profile', dict(profile='unbounded', message='capture byte limit'))]:
        rejected = run('single-invalid-' + name, transformed,
                       json.dumps(dict(dict(receipt, profile='single-frame'), **changes)))
        assert rejected['exit'] == 1 and not rejected['dependentRan']
        assert 'AssertionError' in rejected['stderr']
    mutant = run('revert-exit-guard', reverted, json.dumps(receipt))
    try:
        denial(mutant)
    except AssertionError:
        assert mutant['exit'] == 0 and mutant['dependentRan']
    else:
        raise AssertionError('reverting mutation accepted')
    # Receipt classification stays identical. Guards and nonzero child exit
    # now also prevent dependent shell work (formerly silently returned zero).
    for name, raw, configured, poll in [
        ('natural-success', None, True, 'success'),
        ('missing-receipt', None, True, 'running'),
        ('disabled-with-denial-file', json.dumps(receipt), False, 'success'),
        ('unrelated-child-failure', None, True, 'failed')]:
        result = run(name, transformed, raw, poll=poll, configured=configured)
        baseline = run(name + '-original', original, raw, poll=poll, configured=configured)
        expected_nonzero = poll in ('running', 'failed')
        assert result['receipt'] == baseline['receipt']
        assert result['cleanupTrace'] == baseline['cleanupTrace']
        assert result['exit'] == int(expected_nonzero)
        assert result['dependentRan'] is (not expected_nonzero)
    for failure in ['poll', 'cleanup', 'publication']:
        result = run('exception-' + failure, transformed, json.dumps(receipt), failure=failure)
        assert result['exit'] == 1 and not result['dependentRan']
        assert ('original ' + failure + ' failure' in result['stderr']) if failure != 'publication' else 'IsADirectoryError' in result['stderr']
        assert 'SystemExit' not in result['stderr']
        if failure == 'poll':
            assert result['receipt']['captureTerminal'] == receipt
            assert result['cleanupTrace'][-1] == ['log.close']
    # Malformed/oversized receipts remain rejecting failures through full EOF.
    for name, raw in [('malformed','{}'), ('oversized','x'*1025)]:
        result = run(name, transformed, raw)
        assert result['exit'] != 0 and not result['dependentRan']
        assert 'AssertionError' in result['stderr']
    print(json.dumps(dict(passTests=True, actualTransformedSource=True, cleanupStructurePreserved=True,
        revertingMutationRejected=True, receiptClassificationPreserved=True, nonzeroChildExitPreserved=True, results=results), indent=2))
