import copy, hashlib, json, pathlib, re, struct, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent
REV = '129441a03836ff3265befffd49163b7fed932daa'
MAIN = '5691793a58b4670fd2a621114d7926100a1e47de'
EXPECTED = {
    'runner/test/run.js': '3c59fd034391e069f24a6047cf96cd8dac84a791d7d7591d55e5f7cb6e161a5e',
    'runtime/build/wine-assembly.wasm': '8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686',
    'game/penguin-command.exe': '14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1',
}

def sha(b):
    return hashlib.sha256(b).hexdigest()

def load(p):
    names = ['command.json', 'decision-args.json', 'terminal.json',
             'fresh-identity-process-api.json', 'guest-launch-api.json', 'manifest.json',
             'predecessor-static-checkpoint.json', 'remote-rehash.json']
    d = {n: json.loads((p / n).read_text()) for n in names}
    d['log'] = (p / 'output.log').read_text()
    d['asm'] = (p / 'predecessor-penguin-command.exe-0x406ec4.asm.txt').read_text()
    return d

def check(d):
    log = d['log']; argv = d['command.json']['argv']
    assert argv == d['decision-args.json'], 'argv receipt mismatch'
    base = '/tmp/penguin-postloop-shot-acceptance-oct24/'
    assert argv[:3] == ['node', '--max-old-space-size=512', base + 'runner/test/run.js']
    required = ['--no-build', '--wasm=' + base + 'runtime/build/wine-assembly.wasm',
                '--exe=' + base + 'game/penguin-command.exe', '--quiet-api', '--quiet-blocks',
                '--no-close', '--max-seconds=60', '--max-batches=43000', '--memory-mb=512',
                '--tick-ms-per-batch=200', '--screen=840x660', '--trace-input-dispatch',
                '--trace-eip-range=0x406ec4-0x406f50', '--trace-eip-from=39999',
                '--trace-eip-detail', '--trace-eip-stream',
                '--trace-eip-dump=0x4130a0:8,0x410110:12,0x413e50:4,0x413f30:4,0x4d0750:32']
    assert all(argv.count(x) == 1 for x in required), 'trace/command binding'
    allowed = {x.split('=')[0] for x in required} | {
        '--exe-guest-path', '--cwd', '--args', '--dlls', '--vfs-include', '--input'}
    assert all(x.split('=')[0] in allowed for x in argv[3:]), 'unexpected state-changing option'
    inp = next(x for x in argv if x.startswith('--input='))
    assert inp == '--input=33000:mousemove:420:360,34000:mousedown:420:360,34500:mouseup:420:360,34800:mousemove:260:220,39999:png:' + base + 'decision/b39999.png,40000:keydown:65,40100:png:' + base + 'decision/b40100.png,40200:keyup:65', 'input schedule'
    ident = json.loads(d['fresh-identity-process-api.json']['stdout'])['identities']
    assert ident == EXPECTED, 'module/runner/EXE identity'
    manifest = {x['target']: x for x in d['manifest.json']}
    assert all(manifest[k]['sha256'] == v for k, v in EXPECTED.items()), 'manifest identity'
    assert manifest['runner/test/run.js']['revision'] == MAIN
    assert d['predecessor-static-checkpoint.json']['module']['sha256'] == EXPECTED['runtime/build/wine-assembly.wasm']
    for n in ['fresh-identity-process-api.json', 'guest-launch-api.json', 'remote-rehash.json']:
        a = d[n]
        assert a['exitCode'] == 0 and a['success'] and not a['timedOut']
        assert not a['stdoutTruncated'] and not a['stderrTruncated'], 'API clipping'
    assert json.loads(d['remote-rehash.json']['stdout']) == {'files': 291, 'bytes': 15760340, 'passHash': True}
    terminal = d['terminal.json']
    assert terminal == json.loads(d['guest-launch-api.json']['stdout']), 'terminal mismatch'
    assert terminal['returncode'] == 0 and terminal['reason'] == 'natural'
    assert not any(terminal[k] for k in ['TERM', 'KILL', 'remainingGroup'])
    assert log.endswith('\n') and len(log.encode()) < 524288
    assert '--- Final state ---' in log and '43000 batches in 2.921s' in log
    lines = [x for x in log.splitlines() if x.startswith('[EIP]')]
    ips = [int(re.search(r'^\[EIP\] (0x[0-9a-f]+)', x)[1], 16) for x in lines]
    assert ips == [0x406ec4, 0x406ed8, 0x406efb, 0x406f00, 0x406f40, 0x406f40], 'trace binding/order'
    def mem(line, addr, n):
        s = re.search(r'mem\[0x%08x:%d\]=([0-9a-f ]+)' % (addr, n), line)[1]
        return bytes.fromhex(s)
    for i, line in enumerate(lines[:4]):
        assert struct.unpack('<2i', mem(line, 0x4130a0, 8)) == (0, 0 if i == 0 else 1), 'count transition'
        assert struct.unpack('<3i', mem(line, 0x410110, 12)) == ((10,10,10) if i < 2 else (9,10,10)), 'ammo transition'
        assert struct.unpack('<2f', mem(line, 0x4d0750, 32)[:8]) == (50, 515)
        assert struct.unpack('<i', mem(line, 0x413e50, 4))[0] == 237
        assert struct.unpack('<i', mem(line, 0x413f30, 4))[0] == 177
    for line in lines[:2]:
        assert 'EDI=0x00000001' in line and 'ECX=0x00000000' in line
    assert 'EDX=0x0000000a' in lines[1] and 'a=0x0000000a b=0x0000000a res=0x00000000' in lines[1]
    for msg, lp, batch in [('100', '1e0001', 40033), ('101', 'c01e0001', 40295)]:
        pat = r'\[dispatch-input\] DispatchMessageA hwnd=0x10001 msg=0x%s wParam=0x41 lParam=0x%s .* batch=%d ' % (msg, lp, batch)
        assert len(re.findall(pat, log)) == 1, 'actual A delivery'
    assert log.index('batch=40033 guestMs=8006600 clock=batch lastGuestTick=8006601') < log.index(lines[0])
    assert sum('png FAILED' in x and 'EFBIG' in x for x in log.splitlines()) == 2
    anchors = {'406ec4':'8b 14 bd 0c 01 41 00','406ecb':'8d 41 01','406ece':'a3 a4 30 41 00',
               '406ed3':'83 fa 0a','406ee4':'8d 42 ff','406ee7':'ba 10 01 41 00','406eec':'89 44 ba fc'}
    for addr, raw in anchors.items():
        assert re.search(addr + r':\s+' + raw.replace(' ', r'\s+'), d['asm']), 'original operand'
    return {'count': [0,1], 'ammo': [10,9], 'eipEntries': len(lines), 'outputBytes': len(log.encode()),
            'laterAmmo': struct.unpack('<3i', mem(lines[-1], 0x410110, 12))[0], 'visibleProjectile': 'UNPROVEN'}

def probes(d):
    out = {}
    for name in ['wrong-count', 'wrong-ammo', 'wrong-module', 'wrong-trace-range', 'wrong-trace-entry']:
        bad = copy.deepcopy(d)
        if name == 'wrong-count':
            bad['log'] = bad['log'].replace('00 00 00 00 01 00 00 00', '00 00 00 00 02 00 00 00', 1)
        elif name == 'wrong-ammo':
            bad['log'] = bad['log'].replace('09 00 00 00 0a 00 00 00', '08 00 00 00 0a 00 00 00', 1)
        elif name == 'wrong-module':
            a = json.loads(bad['fresh-identity-process-api.json']['stdout'])
            a['identities']['runtime/build/wine-assembly.wasm'] = '0' * 64
            bad['fresh-identity-process-api.json']['stdout'] = json.dumps(a)
        elif name == 'wrong-trace-range':
            for a in [bad['command.json']['argv'], bad['decision-args.json']]:
                a[a.index('--trace-eip-range=0x406ec4-0x406f50')] = '--trace-eip-range=0x406d80-0x406f50'
        else:
            bad['log'] = bad['log'].replace('[EIP] 0x00406ec4', '[EIP] 0x00406eb0', 1)
        try:
            check(bad)
        except AssertionError as e:
            out[name] = {'rejected': True, 'reason': str(e)}
        else:
            raise AssertionError('corruption accepted: ' + name)
    return out

if __name__ == '__main__':
    bindings = ROOT / 'bindings.json'
    if bindings.exists():
        repo = ROOT.parents[2]
        for row in json.loads(bindings.read_text()):
            raw = (repo / row['path']).read_bytes()
            assert len(raw) == row['bytes'] and sha(raw) == row['sha256'], row['path']
    p = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / 'penguin-command-postloop-shot-acceptance-20261024'
    d = load(p)
    print(json.dumps({'pristine': check(d), 'probes': probes(d)}, indent=2))
