import io,json,tarfile,pathlib,hashlib,os
from transfer import run,transfer,E,W,REMOTE
assert os.statvfs(W).f_bavail*os.statvfs(W).f_frsize>=2982150144
ROOT=pathlib.Path('/home/user/wine-assembly')
pins=json.loads((E/'source-manifest.json').read_text())+json.loads((E/'assets.json').read_text())['files']
b=io.BytesIO()
with tarfile.open(fileobj=b,mode='w:gz') as t:
 for name in ['aow2-gameplay-browser.js','arcanum-presentation-counter.js','arcanum-presentation-counter.test.js','arcanum-software-samples.js','arcanum-software-samples.test.js']:
  p=W/'tools'/name;d=p.read_bytes();rel='tools/'+name;t.add(p,arcname=rel);pins.append(dict(path=rel,size=len(d),sha256=hashlib.sha256(d).hexdigest()))
 for x in json.loads((E/'font-manifest.json').read_text()):
  t.add(ROOT/x['path'],arcname=x['path']);pins.append(x)
 rel='test/binaries/tlbs/stdole2.tlb';p=ROOT/rel;d=p.read_bytes();t.add(p,arcname=rel);pins.append(dict(path=rel,size=len(d),sha256=hashlib.sha256(d).hexdigest()))
 d=json.dumps(dict(commit='c26252c4a95babe583ade1d1c6e2da0c050be45c',files=pins),indent=2).encode();(E/'pins.json').write_bytes(d);info=tarfile.TarInfo('pins.json');info.size=len(d);t.addfile(info,io.BytesIO(d))
b.seek(0);transfer(b,'support.tar.gz')
print(run("import tarfile;tarfile.open(%r).extractall(%r,filter='data')"%(REMOTE+'/support.tar.gz',REMOTE)))
