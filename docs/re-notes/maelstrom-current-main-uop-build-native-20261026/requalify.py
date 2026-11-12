from stage import *
import gzip,sys,subprocess,shutil
# Retain all first-run receipts; failures remain evidence, never accepted passes.
files={p.name:p.read_text() if p.suffix=='.json' else base64.b64encode(p.read_bytes()).decode() for p in list(O.glob('evidence-*.json.gz'))+[O/'checkpoint-native.json',O/'checkpoint-build.json',O/'result.json']}
(O/'preallocation-failure-evidence.json.gz').write_bytes(gzip.compress(json.dumps(files).encode(),mtime=0))
(O/'allocation-first-failure.json').write_text(json.dumps(dict(peak=118281378,cap=67108864,ownedIncludingDirsAndSymlinks=65053858,at=1793004847.8421764,passChecks=False,reason='Reused counter excluded directory/symlink allocations; all prior compilation/native groups resource-unqualified. Actual native behavior retained as evidence only; corrected admitted execution required.'),indent=2))
# Remove only redundant local transfer staging; deterministic recovery and remote exact bundle retained.
p=O/'sources.json.gz';assert hashlib.sha256(p.read_bytes()).hexdigest()=='4b0a45661a55375bf6f6a1d1dd6f8d7828029ce5afa54e2455b7ae2dc585076f';p.unlink()
# Raw remote evidence already fully recovered in verified local gzip; clear task-owned intermediate duplicates.
code='import pathlib,json;O=pathlib.Path('+repr(REMOTE+'/ops')+');names=[p for p in O.iterdir() if p.name.startswith(("native-", "attempt-", "execution-", "resource-", "evidence-", "abi-base-")) or (p.suffix in [".stdout",".stderr"] and p.name!="canonical-build-qualified.stdout")];removed=[]\nfor p in names:\n if p.is_file():removed.append(dict(name=p.name,bytes=p.stat().st_size));p.unlink()\nprint(json.dumps(removed))'
r=py(code,'clear-recovered-duplicates');(O/'remote-cleared-recovered-duplicates.json').write_text(r['stdout'])
# Actual filesystem accounting, including all task-created link/directory metadata.
p=O/'account.py';s=p.read_text().replace("alloc=lambda p:max(p.stat().st_size,p.stat().st_blocks*512)","alloc=lambda p:max(p.lstat().st_size,p.lstat().st_blocks*512)").replace("sum(alloc(f) for f in p.rglob('*') if not f.is_symlink() and f.is_file())","sum(alloc(f) for f in [p,*p.rglob('*')])")
p.write_text(s)
s=(O/'remote-run-v2.py').read_text().replace("sum(max(p.stat().st_size,p.stat().st_blocks*512) for p in H.rglob('*') if p.is_file())","sum(max(p.lstat().st_size,p.lstat().st_blocks*512) for p in [H,*H.rglob('*')])")
s=s.replace("resource-before-compile.json","resource-corrected-compile.json")
(O/'remote-corrected.py').write_text(s);subprocess.run([sys.executable,str(O/'account.py'),'resource-corrected-compile.json'],check=True)
put(O/'resource-corrected-compile.json',REMOTE+'/ops/resource-corrected-compile.json');put(O/'remote-corrected.py',REMOTE+'/ops/remote-corrected.py')
cmd=['python3',REMOTE+'/ops/remote-corrected.py','compiler','canonical-build-allocation-corrected','/home/user/.nvm/versions/node/v24.22.1/bin/node','--max-old-space-size=512','--require','/home/user/maelstrom-uop-canonical-native-qualification-oct26/ops/native-module-bound.cjs',REMOTE+'/repo/tools/maelstrom-diagnostic-canonical-build.cjs'];print(call(cmd,'allocation-corrected-build',330)['stdout'])
# Reuse exact hash-bound current ABI comparisons; native.py requires all fresh corrected gates.
p=O/'native.py';s=p.read_text().replace("O/'remote-run-v2.py'","O/'remote-corrected.py'").replace('resource-before-compile.json','resource-corrected-compile.json').replace("'resource-corrected-compile.json'","'resource-corrected-compile.json'")
s=s.replace('remote-native.py','remote-native-corrected.py');p.write_text(s)
subprocess.run([sys.executable,str(O/'native.py')],check=True)
