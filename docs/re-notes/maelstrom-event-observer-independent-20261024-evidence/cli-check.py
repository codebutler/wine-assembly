import hashlib,json,pathlib,subprocess
b=pathlib.Path('/tmp/maelstrom-event-observer-independent-integrate-oct24')
r=b/'repo'; temp=b/'ops/cli';temp.mkdir()
source=pathlib.Path('/tmp/maelstrom-head-yield-observer-oct24/ops/run.js').read_bytes()
(temp/'run.js').write_bytes(source)
tool=str(r/'tools/maelstrom-event-boundary-observer.cjs')
common=[str(temp/'run.js'),'/tmp/maelstrom-head-yield-observer-oct24/ops/13-exports.wat','/tmp/maelstrom-event-triggered-boundary-observer-oct24/ops/thread-manager.js']
for mode,name in [('--disabled','disabled.js'),('--enable','events.js')]:
 subprocess.run(['node',tool,mode,*common,str(temp/name)],check=True)
 subprocess.run(['node','--check',str(temp/name)],check=True)
assert (temp/'disabled.js').read_bytes()==source
assert (temp/'events.js').read_bytes()!=source
before=(temp/'events.js').read_bytes()
p=subprocess.run(['node',tool,'--enable',*common,str(temp/'events.js')],capture_output=True)
assert p.returncode!=0 and b'EEXIST' in p.stderr
assert (temp/'events.js').read_bytes()==before
p=subprocess.run(['node',tool,'--enable',*common,str(temp/'run.js')],capture_output=True)
assert p.returncode!=0 and b'new and adjacent' in p.stderr
assert (temp/'run.js').read_bytes()==source
receipt={'status':'PASS','disabledSHA':hashlib.sha256(source).hexdigest(),
 'enabledSHA':hashlib.sha256(before).hexdigest(),'exclusiveCreationControl':'rejects; existing file unchanged',
 'inputOverwriteControl':'rejects; input unchanged','syntax':'both generated runners PASS',
 'guestExecutions':0,'moduleReads':0,'stagingBytes':sum(x.stat().st_size for x in temp.iterdir())}
(b/'ops/cli.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
for p in temp.iterdir():p.unlink()
temp.rmdir()
