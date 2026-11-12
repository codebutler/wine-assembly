"""Full transformed-supervisor regression, real pipes/kernel limits, no guest.

Only historical deployment admission literals are adapted: expired start time,
UID, and native-only memory/CPU allowances reduced to this cheap test's limits.
All executable transport, receipt, finalization and cleanup code is unmodified.
"""
import binascii
import ctypes
import gzip
import hashlib
import json
import os
import pathlib
import re
import signal
import struct
import subprocess
import sys
import tempfile
import time

R = pathlib.Path(__file__).resolve().parents[1]
D = R / 'docs/re-notes/enigma-terminal-capture-guard-20261024'
original = gzip.decompress((R / 'docs/re-notes/enigma-supervisor-exit-repair-20261024/original-supervise.py.gz').read_bytes())
assert hashlib.sha256(original).hexdigest() == '73be15954cedc19340779ff6bda2397cb94927ca702d2baebdccd5e763cf7b73'
standing = json.loads((D / 'png-standing.json').read_text())['standingReadonlyPNG']
for row in standing:
    b = pathlib.Path(row['path']).read_bytes()
    assert len(b) == row['bytes'] and hashlib.sha256(b).hexdigest() == row['sha256']
codec = str(pathlib.Path(next(row['path'] for row in standing if row['path'].endswith('/package.json'))).parent)
outcomes = []
ctypes.CDLL(None).prctl(36, 1, 0, 0, 0)

def once(s, old, new):
    assert s.count(old) == 1, old
    return s.replace(old, new)

with tempfile.TemporaryDirectory(prefix='enigma-full-supervisor-') as tmp:
    H = pathlib.Path(tmp)
    (H / 'original.py').write_bytes(original)
    transformed = subprocess.run(['node', '--max-old-space-size=256', '-e',
        'process.stdout.write(require(process.argv[1]).transformSupervisor(require("fs").readFileSync(process.argv[2],"utf8")))',
        str(R / 'tools/enigma-terminal-capture-guard.cjs'), str(H / 'original.py')],
        check=True, capture_output=True, timeout=10).stdout.decode()
    assert 'stdout=subprocess.PIPE,stderr=subprocess.STDOUT' in transformed
    source = once(transformed, "assert time.time()<1792835520,'latest start09:52UTC'", "assert time.time()<" + str(int(time.time()) + 300))
    source = once(source, 'assert os.getuid()==1000', 'assert os.getuid()==' + str(os.getuid()))
    source = once(source, 'assert mem>=2684354560', 'assert mem>=805306368')
    source = once(source, 'resource.RLIMIT_CPU,(90,90)', 'resource.RLIMIT_CPU,(60,60)')
    # Record this exact deployment-only adaptation for reviewers.
    adaptation = dict(originalSHA256=hashlib.sha256(original).hexdigest(),
        transformedSHA256=hashlib.sha256(transformed.encode()).hexdigest(),
        configuredSHA256=hashlib.sha256(source.encode()).hexdigest(),
        latestStart=int(re.search(r'assert time.time\(\)<(\d+)', source)[1]), uid=os.getuid(),
        changes=['expired admission time', 'actual UID', 'memory floor805306368', 'CPU60'])
    evidence = os.environ.get('ENIGMA_SUPERVISOR_TEST_EVIDENCE')
    if evidence:
        evidence = pathlib.Path(evidence)
        assert evidence.is_absolute()
        evidence.mkdir(exist_ok=False)
        (evidence / 'transformed-supervise.py').write_text(transformed)
        (evidence / 'configured-supervise.py').write_text(source)
        (evidence / 'deployment-adaptation.json').write_text(json.dumps(adaptation, indent=2))
    js = r'''
const fs=require('fs'),assert=require('assert/strict'),zlib=require('zlib');
const {PNG}=require(CODEC);
const mode=process.argv[2];
function send(fd,buf){
 const deadline=Date.now()+5000;
 for(let offset=0;offset<buf.length;){
  try{offset+=fs.writeSync(fd,buf,offset,buf.length-offset);}
  catch(e){if(e.code!=='EAGAIN'||Date.now()>deadline)throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1);}
 }
}
if(mode==='flood-fast'){send(1,Buffer.alloc(120000,65));send(2,Buffer.alloc(120000,66));process.exit(0);}
if(mode==='flood-slow'){setInterval(()=>{send(1,Buffer.alloc(4096,65));send(2,Buffer.alloc(4096,66));},1);return;}
if(mode==='fail'){throw Object.assign(new Error('original child EIO'),{code:'EIO'});}
if(mode==='fault-fast'){send(2,Buffer.from('RuntimeError: original observable fault\n'));process.exit(0);}
const guard=require(ADAPTER);
guard.install(process.cwd(),process.cwd()+'/capture.cjs',process.cwd()+'/raw.json',true,process.env.ENIGMA_CAPTURE_PROFILE||'default');
const original=fs.writeFileSync;
const eio=Object.assign(new Error('original writer EIO'),{code:'EIO'});
if(mode==='writer-eio')fs.writeFileSync=function(file,...rest){if(String(file).endsWith('.png'))throw eio;return original.call(this,file,...rest);};
require('./capture.cjs');
let seed=0x12345678;const data=Buffer.alloc(640*480*4);
for(let i=0;i<data.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;data[i]=seed&255;}
let input=PNG.sync.write({width:640,height:480,data});
if(mode==='oversize')input=fs.readFileSync('../../oversize.png');
const target=process.cwd()+'/frame.png';
try{fs.writeFileSync(target,input);}catch(error){
 if(mode==='writer-eio'){
  assert.equal(error,eio);assert.throws(()=>fs.writeFileSync(process.cwd()+'/later.png',input),e=>e===eio);
  original.call(fs,'identity.json',JSON.stringify({sameError:true,code:error.code,message:error.message}));
 }
 throw error;
}
assert(mode==='accept');
const written=fs.readFileSync(target);assert(written.length>131072&&written.length<=2097152);
assert.deepEqual(PNG.sync.read(written,{checkCRC:true}).data,data);
original.call(fs,'pixels.json',JSON.stringify({exactRGBA:true,bytes:written.length,pixelsSHA256:require('crypto').createHash('sha256').update(data).digest('hex')}));
fs.writeSync(1,Buffer.from('stdout-ok\n'));fs.writeSync(2,Buffer.from('stderr-ok\n'));
'''.replace('CODEC', json.dumps(codec)).replace('ADAPTER', json.dumps(str(R / 'tools/enigma-terminal-capture-guard.cjs')))
    # Valid PNG over 2MiB, with a CRC-correct ancillary chunk; no giant payload
    # in the retained log, and the real writer must reject it before open().
    png = subprocess.run(['node', '--max-old-space-size=256', '-e',
        'process.stdout.write(require(process.argv[1]).PNG.sync.write({width:1,height:1,data:Buffer.alloc(4)}))', codec],
        check=True, capture_output=True, timeout=10).stdout
    chunk = b'tEXt' + b'x' * 2097152
    oversized = png[:33] + struct.pack('>I', len(chunk)-4) + chunk + struct.pack('>I', binascii.crc32(chunk)) + png[33:]
    (H / 'oversize.png').write_bytes(oversized)

    def run(name, profile=None, mutation=None):
        case = H / name
        runner = case / 'runner'
        (runner / 'test').mkdir(parents=True)
        (case / 'supervise.py').write_text(source if mutation is None else mutation(source))
        (runner / 'test/run.js').write_bytes(gzip.decompress((D / 'runner.js.gz').read_bytes()))
        capture = gzip.decompress((D / 'capture.cjs.gz').read_bytes()).decode()
        # Pinned capture locates pngjs at its original absolute dependency path.
        (runner / 'capture.cjs').write_text(capture)
        (runner / 'child.cjs').write_text(js)
        (runner / 'runner/node_modules').mkdir(parents=True)
        (runner / 'runner/node_modules/pngjs').symlink_to(codec, target_is_directory=True)
        mode = name.split('-case')[0]
        args = ['node', '--max-old-space-size=256', 'child.cjs', mode]
        if mode == 'flood-eof':
            # Real kernel scheduling barrier, not a poll/read mock: freeze the
            # supervisor in its between-turn sleep, write a final pipeful, exit,
            # and resume it only after the writer is a zombie. Thus poll() must
            # observe exit before another drain turn, under any host load.
            code = '''import os,time,signal,pathlib
supervisor=os.getppid();writer=os.getpid()
os.write(1,b'A'*126000)
deadline=time.monotonic()+2
while True:
 if pathlib.Path('../guest/output.log').stat().st_size==126000 and 'nanosleep' in pathlib.Path('/proc/'+str(supervisor)+'/wchan').read_text():break
 assert time.monotonic()<deadline,'EOF barrier timeout'
 time.sleep(.001)
if os.fork()==0:
 try:
  deadline=time.monotonic()+2
  while pathlib.Path('/proc/'+str(writer)+'/stat').read_text().split()[2]!='Z':
   assert time.monotonic()<deadline
   time.sleep(.001)
 finally:os.kill(supervisor,signal.SIGCONT)
 os._exit(0)
os.kill(supervisor,signal.SIGSTOP)
os.write(2,b'B'*6000)
os._exit(0)
'''
            args = [sys.executable, '-c', code]
        if mode == 'descendants':
            # Both descendants ignore TERM, proving KILL/reap within the bound.
            code = "import signal,time,subprocess,sys,os;signal.signal(signal.SIGTERM,signal.SIG_IGN);c=subprocess.Popen([sys.executable,'-c','import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);time.sleep(30)']);open('pids.json','w').write(__import__('json').dumps([os.getpid(),c.pid]));os.write(1,b'x'*131072);time.sleep(30)"
            args = [sys.executable, '-c', code]
        if mode in ('limits', 'limits-over'):
            count = 2097153 if mode == 'limits-over' else 131073
            code = "import resource,json,os;lim=resource.getrlimit(resource.RLIMIT_FSIZE);open('limits.json','w').write(json.dumps(lim));f=open('raw-artifact','wb');f.write(b'x'*" + str(count) + ");f.close()"
            args = [sys.executable, '-c', code]
        (case / 'guest-args.json').write_text(json.dumps(args))
        env = dict(os.environ, MAELSTROM_CAPTURE_INSTALL='1', ENIGMA_TERMINAL_RECEIPT=str(runner / 'raw.json'))
        env.pop('ENIGMA_TERMINAL_CAPTURE_INSTALL', None)
        env.pop('ENIGMA_CAPTURE_PROFILE', None)
        if profile is not None:
            env['ENIGMA_CAPTURE_PROFILE'] = profile
        start = time.monotonic()
        command = ['bash', '-c', '"$1" "$2" guest && touch "$3"',
            'probe', sys.executable, str(case / 'supervise.py'), str(case / 'dependent')]
        proc = subprocess.Popen(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        emergency = []
        try:
            stdout, stderr = proc.communicate(timeout=12)
            p = subprocess.CompletedProcess(command, proc.returncode, stdout, stderr)
        finally:
            # Reap owned groups even on a failed assertion/timeout in a mutant.
            groups = [proc.pid]
            commandfile = case / 'guest/command.json'
            if commandfile.exists():
                groups.insert(0, json.loads(commandfile.read_text())['pgid'])
            for pgid in groups:
                try:
                    os.killpg(pgid, signal.SIGTERM)
                except ProcessLookupError:
                    continue
                emergency.append(pgid)
                deadline = time.monotonic()+.5
                while time.monotonic()<deadline:
                    try:os.killpg(pgid, 0)
                    except ProcessLookupError:break
                    time.sleep(.01)
                try:os.killpg(pgid, signal.SIGKILL)
                except ProcessLookupError:pass
            proc.wait(timeout=3)
            deadline = time.monotonic()+1
            while time.monotonic()<deadline:
                try:
                    pid, _ = os.waitpid(-1, os.WNOHANG)
                    if pid == 0:time.sleep(.01)
                except ChildProcessError:break
        assert len(p.stdout)+len(p.stderr) <= 131072
        log = case / 'guest/output.log'
        terminal = case / 'guest/terminal.json'
        row = dict(name=name, exit=p.returncode, elapsed=time.monotonic()-start,
            retainedBytes=log.stat().st_size if log.exists() else 0,
            dependentRan=(case / 'dependent').exists(), artifact=(runner / 'frame.png').exists(),
            stderr=p.stderr.decode()[-2000:], receipt=json.loads(terminal.read_text()) if terminal.exists() else None)
        assert not emergency, emergency
        assert row['retainedBytes'] <= 131072, row
        assert row['elapsed'] < 5, row
        if row['receipt']:
            assert row['receipt']['remainingGroup'] is False
        outcomes.append(row)
        return row, runner

    row, runner = run('accept', 'single-frame')
    assert row['exit'] == 0 and row['dependentRan'] and row['artifact'], row
    row['pixels'] = json.loads((runner / 'pixels.json').read_text())
    log = (runner.parent / 'guest/output.log').read_bytes()
    assert b'[capture] pixel-preserving png 1 ' in log and log.endswith(b'stdout-ok\nstderr-ok\n')
    row, runner = run('default')
    assert row['exit'] != 0 and not row['dependentRan'] and not row['artifact'], row
    assert row['receipt']['reason'] == 'capture-byte-limit'
    for profile, cap in [(None, 131072), ('single-frame', 2097152)]:
        row, runner = run('limits-case-' + str(cap), profile)
        assert json.loads((runner / 'limits.json').read_text()) == [cap, cap]
        assert row['exit'] == (1 if profile is None else 0), row
        assert (runner / 'raw-artifact').stat().st_size == (131072 if profile is None else 131073)
    for name in ['oversize', 'writer-eio', 'fail']:
        row, runner = run(name, 'single-frame')
        assert row['exit'] != 0 and not row['dependentRan'] and not row['artifact'], row
        if name == 'writer-eio':
            row['identity'] = json.loads((runner / 'identity.json').read_text())
            assert row['identity']['sameError'] and row['identity']['code'] == 'EIO'
            assert not (runner / 'later.png').exists()
    row, runner = run('limits-over', 'single-frame')
    assert row['exit'] != 0 and not row['dependentRan']
    assert (runner / 'raw-artifact').stat().st_size == 2097152
    row, runner = run('fault-fast', 'single-frame')
    assert row['exit'] != 0 and not row['dependentRan']
    assert row['receipt']['reason'] == 'first-observable-fault'
    for name in ['flood-fast', 'flood-slow', 'flood-eof', 'descendants']:
        row, runner = run(name, 'single-frame')
        assert row['exit'] != 0 and not row['dependentRan']
        assert row['retainedBytes'] == 131072 and row['receipt']['reason'] == 'output-guard', row
        if name == 'descendants':
            row['pids'] = json.loads((runner / 'pids.json').read_text())
            for pid in row['pids']:
                assert not pathlib.Path('/proc/' + str(pid)).exists(), pid
    row, runner = run('accept-case-invalid', 'unbounded')
    assert row['exit'] != 0 and not row['artifact'] and not (runner.parent / 'guest').exists()
    # Force an EOF race witness: the last 6KiB fits in the kernel pipe and the
    # process exits before poll's next turn. Removing only final drain misses it.
    row, runner = run('flood-eof-case-no-final-drain', 'single-frame',
        lambda s: once(s, '  output.drain()\n  if output.capped', '  pass\n  if output.capped'))
    assert row['exit'] == 0 and row['dependentRan'] and row['retainedBytes'] == 126000, row
    row['mutationRejected'] = True
    # A cap-removal mutant must be caught by real pipe flood retention, rather
    # than a source-text assertion alone; the child exits so no timeout retry.
    try:
        run('flood-fast-case-mutant', 'single-frame',
            lambda s: once(s, 'self.capped=self.bytes==131072', 'self.capped=False').replace(
                'min(8192,131072-self.bytes)', '8192'))
    except AssertionError as error:
        mutant = error.args[0]
        assert isinstance(mutant, dict) and mutant['retainedBytes'] > 131072
        outcomes.append(dict(mutant, mutationRejected=True))
    else:
        raise AssertionError('uncapped transport mutation accepted')

result = dict(passTests=True, completeTransformedSupervisor=True,
    deploymentAdaptation=adaptation, outcomes=outcomes)
if evidence:
    (evidence / 'full-result.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))
