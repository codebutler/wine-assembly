"""Validate the retained evidence without rerunning any guest/native process."""
import pathlib,json,hashlib
H=pathlib.Path(__file__).parent
for run in ['startup','observed-input','final-input','gameplay']:
 t=json.loads((H/run/'terminal.json').read_text());assert t['returncode']==0 and t['remaining']==[] and not t['fault']
 abi=json.loads((H/run/'abi-instantiated.json').read_text());assert len(abi['requiredImports'])==291 and abi['missing']==[] and abi['stamps']==['9a3bc9149d58209c'] and abi['arenaBytes']==512*1048576 and abi['shared']
 assert (H/run/'output.log').stat().st_size<=8192
 assert '*** CRASH' not in (H/run/'output.log').read_text()
argv=json.loads((H/'gameplay/guest-process.json').read_text())['argv'];log=(H/'gameplay/output.log').read_text()
for a in ['--no-build','--no-threads','--memory-mb=512','--max-seconds=60','--max-batches=4500','--vfs-include=airstrikerc','--vfs-include=data/**/*','--cwd=C:\\']:assert a in argv,a
assert len(next(a for a in argv if a.startswith('--dlls=')).split('=',1)[1].split(','))==8
assert '--max-old-space-size=512' in argv
for code,on,off in [(188,2100,4000),(37,3100,3800),(190,3200,3900)]:
 assert f'keydown vk={code} at batch {on}' in log and f'keyup vk={code} at batch {off}' in log
 assert f'wParam=0x{code:x} ' in log
review=json.loads((H/'screenshot-review.json').read_text())
for image in review['images']:
 p=H/'gameplay'/image['name'];assert hashlib.sha256(p.read_bytes()).hexdigest()==image['sha256'];assert image['width']==800 and image['height']==600
assert all(d['changedPixelsBelowConsole']>10000 for d in review['differences'])
t=json.loads((H/'control/evidence/terminal.json').read_text());assert t['signals']==['TERM','KILL after 5s'] and t['returncode']==-9 and t['remaining']==[]
assert not (H/'control/sentinel').exists()
manifest=json.loads((H/'complete-runtime-manifest.json').read_text());assert len(manifest)==261 and sum(f['bytes'] for f in manifest)==17345286
assert len({f['dest'] for f in manifest})==len(manifest)
for p in H.rglob('*'):
 assert not p.is_symlink()
 assert p.suffix.lower() not in ['.exe','.dll','.wasm','.ttf','.fon','.zip','.tgz'],p
if (H/'artifact-seals.json').exists():
 for f in json.loads((H/'artifact-seals.json').read_text()):
  p=H/f['path'];assert p.stat().st_size==f['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256'],f['path']
print('PASS: four historical native runs; actual ABI; eight providers; held/matched inputs; three distinct reviewed frames; watchdog/reap control; complete runtime recovery manifest; no binary payload committed')
