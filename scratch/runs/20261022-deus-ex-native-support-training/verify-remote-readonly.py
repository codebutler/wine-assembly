import pathlib,json,hashlib,shutil,subprocess,datetime
R=pathlib.Path('/home/user/deus-ex-training'); sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
a=json.loads((R/'evidence/assets.json').read_text());s=json.loads((R/'evidence/source-manifest.json').read_text())
for x in s+a['files']:
 p=R/x['path'];assert p.stat().st_size==x['size'] and sha(p)==x['sha256'],x['path']
assert sha(R/'wine-assembly.wasm')=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
assert shutil.disk_usage(R).free>2147483648
print(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceFiles=len(s),assetFiles=len(a['files']),moduleSha256=sha(R/'wine-assembly.wasm'),freeBytes=shutil.disk_usage(R).free,node=subprocess.check_output(['node','--version'],text=True).strip(),listeners=subprocess.check_output(['ss','-ltnp'],text=True),processes=subprocess.check_output(['ps','-eo','pid,args'],text=True)),indent=2))
