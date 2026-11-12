import pathlib,json,hashlib,subprocess,shutil,os
R=pathlib.Path('/home/user/arcanum-software');os.chdir(R)
pins=json.loads((R/'pins.json').read_text())
assert shutil.disk_usage(R).free>2147483648
bad=[]
for x in pins['files']:
 p=R/x['path']
 if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=x['sha256']:bad.append(x['path'])
assert not bad,bad
dependencies=[]
for p in sorted((R/'runtime').rglob('*')):
 if p.is_file() and not p.is_symlink():dependencies.append(dict(path=str(p.relative_to(R)),size=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
(R/'runner-dependencies.json').write_text(json.dumps(dependencies,indent=2))
commands=[['node','tools/arcanum-presentation-counter.test.js'],['node','tools/arcanum-software-samples.test.js'],['node','--check','tools/arcanum-gameplay-browser.js'],['node','-e',"const fs=require('fs'); const m=new WebAssembly.Module(fs.readFileSync('build/wine-assembly.wasm'));const ex=WebAssembly.Module.exports(m).map(x=>x.name);for(const n of ['get_eip','get_image_base','get_dll_table','load_dll','run'])if(!ex.includes(n))throw Error(n);console.log(JSON.stringify({exports:ex,imports:WebAssembly.Module.imports(m)}))"],['google-chrome','--version'],['node','--version']]
results=[]
for c in commands:
 r=subprocess.run(c,text=True,capture_output=True);results.append(dict(command=c,exitCode=r.returncode,stdout=r.stdout,stderr=r.stderr));assert r.returncode==0,results[-1]
(R/'preflight.json').write_text(json.dumps(dict(pins=len(pins['files']),dependencyFiles=len(dependencies),free=shutil.disk_usage(R).free,commands=results),indent=2))
print('PASS',len(pins['files']),'pins',len(dependencies),'runner dependency pins')
