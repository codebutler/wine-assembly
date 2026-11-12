"""Read-only acceptance checks. No guest execution, extraction, or network writes."""
import hashlib, json, pathlib, subprocess, tarfile, re

ROOT = pathlib.Path(__file__).resolve().parents[3]
E = ROOT / 'scratch/runs/20261022-deus-ex-native-support-training'
BASE = 'c26252c4a95babe583ade1d1c6e2da0c050be45c'
CANDIDATE = '45d125cba932e8a91f87fceedc7f42b4f2e7cd7e'
MODULE = 'f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])
def sha(b):
    return hashlib.sha256(b).hexdigest()
def read(n):
    return json.loads((E / n).read_text())

changed = git('diff', '--name-only', BASE, CANDIDATE).decode().splitlines()
assert len(changed) == 65 and all(p.startswith(str(E.relative_to(ROOT)) + '/') for p in changed)
assert git('rev-parse', CANDIDATE + '^').decode().strip() == BASE
seals = read('seals.json')
assert len(seals) == 64
for row in seals:
    b = (E / row['path']).read_bytes()
    assert len(b) == row['size'] and sha(b) == row['sha256'], row['path']
assert {x['path'] for x in seals} | {'seals.json'} == {pathlib.Path(x).name for x in changed}
for p in changed:
    assert (ROOT / p).read_bytes() == git('show', CANDIDATE + ':' + p), p

sources = read('prior-source-manifest.json')
assert len(sources) == 192
for row in sources:
    b = git('show', BASE + ':' + row['path'])
    assert len(b) == row['size'] and sha(b) == row['sha256'], row['path']
for rev, trees in read('prior-source-mapping.json')['trees'].items():
    for p, tree in trees.items():
        assert git('rev-parse', rev + ':' + p).decode().strip() == tree
for p in E.glob('accepted-*'):
    original = p.name.removeprefix('accepted-').replace('--', '/', 1)
    assert p.read_bytes() == git('show', BASE + ':' + original)
assert (E / 'native-provenance.md').read_bytes() == git('show', BASE + ':test/binaries/dlls/SOURCES.md')
assets = read('prior-assets.json')
assert len(assets['files']) == 112 and sum(x['size'] for x in assets['files']) == assets['totalBytes'] == 233696463
for row in assets['files']:
    b = (pathlib.Path('/home/user/wine-assembly') / row['path']).read_bytes()
    assert len(b) == row['size'] and sha(b) == row['sha256'], row['path']
for name, pin in assets['pins'].items():
    assert next(x['sha256'] for x in assets['files'] if x['path'].endswith('/' + name)) == pin

module = read('prior-module.json')
assert module['moduleSha256'] == MODULE
assert sha(pathlib.Path(module['archive']).read_bytes()) == module['archiveSha256']
module_members = []
with tarfile.open(module['archive']) as t:
    for m in t:
        if m.isfile() and m.name.endswith('.wasm'):
            b = t.extractfile(m).read()
            if sha(b) == MODULE:
                assert len(b) == module['moduleBytes']
                module_members.append(m.name)
assert len(module_members) == 1
archive = E / 'native-support-evidence.tar.gz'
assert sha(archive.read_bytes()) == 'ce1171c629af8e09299ec0fe7764c8ede3cf5ce034d030e530ba61dc8d52272e'
archive_members = []
with tarfile.open(archive) as t:
    for m in t:
        assert not m.issym() and not m.islnk() and '..' not in pathlib.PurePosixPath(m.name).parts
        if m.isfile():
            b = t.extractfile(m).read()
            if pathlib.Path(m.name).name == 'launcher.log':
                assert b == b''
            else:
                assert b == (E / pathlib.Path(m.name).name).read_bytes(), m.name
            archive_members.append(dict(path=m.name, bytes=len(b), sha256=sha(b)))
assert len(archive_members) == 13

audit = read('closure-audit.json')
api = {x['name'] for x in read('accepted-src--api_table.json')}
for name, row in audit['native'].items():
    b = pathlib.Path(row['path']).read_bytes()
    assert len(b) == row['size'] and sha(b) == row['sha256']
    dump = subprocess.check_output(['objdump', '-p', row['path']])
    assert dump == (E / (name + '.objdump.txt')).read_bytes(), name
crt = audit['native']['msvcrt.dll']
assert crt['sha256'] == '887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1'
assert set(crt['imports']) == {'kernel32.dll'}
assert set(crt['imports']['kernel32.dll']) <= api
for row in audit['game'].values():
    for symbol in row['imports'].get('msvcrt.dll', []):
        export = crt['exports'][symbol]
        assert export['rva'] and not export['forwarder']
assert crt['exports']['_vsnwprintf']['rva'] and not crt['exports']['_vsnwprintf']['forwarder']
for dll, expected in read('necessary-closure.json')['emulated'].items():
    actual = {s for n in audit['active'] if n in audit['game'] for s in audit['game'][n]['imports'].get(dll, [])}
    assert actual == set(expected)
    assert {('InitCommonControls' if s == '#17' else s) for s in actual} <= api
assert "'COMCTL32.DLL#17': 'InitCommonControls'" in (E / 'accepted-lib--host-imports.js').read_text()
for row in read('existing-emulated-handlers.json'):
    b = git('show', BASE + ':' + row['path'])
    assert sha(b) == row['sourceSha256'] and row['body'] in b.decode()
selected = read('selected-graph.json')
assert len(selected['resolved']) == 15
all_modules = {**audit['game'], **audit['native']}
for row in selected['resolved']:
    assert row['sha256'] == all_modules[row['name']]['sha256']

receipts = []
for name in ['remote-verification.receipt', 'post-run-verification.receipt']:
    receipt = read(name)
    assert receipt['exitCode'] == 0 and not receipt['stdoutTruncated']
    status, end = json.JSONDecoder().raw_decode(receipt['stdout'])
    assert status['sourceFiles'] == 192 and status['assetFiles'] == 112 and status['moduleSha256'] == MODULE
    receipts.append({k: v for k, v in status.items() if k not in ['processes', 'listeners']})
inputs = []
for line in (E / 'input-log.jsonl').read_text().splitlines():
    row = json.loads(line)
    response = json.loads(row['stdout'])
    assert row['returncode'] == response['exitCode'] == 0 and not response['stdoutTruncated']
    args = row['command'][row['command'].index('tools/ctl.js') + 1:]
    assert args[0] in ['step', 'png', 'snapshot', 'quit', 'cmd', 'key']
    if args[0] == 'key':
        assert args == ['key', 'VK_ESCAPE']
    if args[0] == 'cmd':
        assert re.fullmatch(r'(keydown|keyup|keypress):(13|27|38|40)', args[1])
    inputs.append(dict(args=args, stdout=response['stdout']))
assert len(inputs) == 35 and inputs[-1]['args'] == ['quit']
log = (E / 'run.log').read_text()
assert '[input] keydown vk=38 at batch 3828' in log and '[input] keyup vk=38 at batch 3978' in log
assert '4382 batches in 284.972s' in log and (E / 'run.exit').read_text().strip() == '0'
assert not re.search(r'RuntimeError|unreachable|unimplemented API|out of bounds', log, re.I)
print(json.dumps(dict(verdict='checks passed', candidate=CANDIDATE, testedRevision=BASE,
    seals=len(seals), sources=len(sources), assets=len(assets['files']), moduleSha256=MODULE,
    moduleMembers=module_members, archiveMembers=archive_members, receipts=receipts,
    inputRequests=len(inputs), threadNullDiagnostics=log.count('EIP=0 (likely call/jmp to NULL)'),
    scope='Read-only evidence checks; image judgment recorded separately'), indent=2))
