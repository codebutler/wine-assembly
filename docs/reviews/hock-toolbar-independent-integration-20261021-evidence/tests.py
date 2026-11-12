import pathlib,subprocess,json,tarfile,io
root=pathlib.Path(__file__).resolve().parent;repo=root/'repo';results=[]
def run(name,args,expected=0,cwd=repo):
    p=subprocess.run(args,cwd=cwd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=60)
    (root/(name+'.log')).write_bytes(p.stdout)
    results.append({'name':name,'command':args,'cwd':str(cwd),'exit':p.returncode,'expected':expected})
    print(name,p.returncode,flush=True)
    assert p.returncode==expected,p.stdout.decode()[-2000:]
run('options',['node','test/test-browser-launch-options.js'])
for mode in ['omit-normalization','truthy-showcmd']:
    run(mode,['node',str(root/'negative-controls.cjs'),mode,'test/test-browser-launch-options.js'],1)
run('catalog',['node','--test','ops/emulator-server.test.js'])
run('registration',['node','test/test-hock-a-loogie-local-registration.js'])
run('boot-cursor',['node','test/test-boot-cursor.js'])
run('shell-current',['node','test/test-shell-execute-launch.js'],1)
baseline=root/'baseline';baseline.mkdir(exist_ok=True)
data=subprocess.check_output(['git','archive','71bc4a6d07387c18725da334983d25c6290fed40','lib','host.js','test/test-shell-execute-launch.js'],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(data)) as t:t.extractall(baseline,filter='data')
run('shell-baseline',['node','test/test-shell-execute-launch.js'],1,baseline)
for name in ['shell-current','shell-baseline']:
    log=(root/(name+'.log')).read_text()
    assert 'test-shell-execute-launch.js:182:' in log and 'browser host offers relative and absolute executable names to the caller VFS' in log
assert subprocess.check_output(['git','diff','71bc4a6d','HEAD','--','host.js','test/test-shell-execute-launch.js'],cwd=repo)==b''
run('syntax',['node','--check','lib/browser-shell.js'])
run('whitespace',['git','diff','--check','71bc4a6d','HEAD'])
(root/'tests.json').write_text(json.dumps(results,indent=2)+'\n')
