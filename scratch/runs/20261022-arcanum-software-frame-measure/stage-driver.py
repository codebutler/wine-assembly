import io,json,tarfile,pathlib,hashlib,sys
from transfer import run,transfer,E,W,REMOTE
pins=json.loads((E/'source-manifest.json').read_text())+json.loads((E/'assets.json').read_text())['files']
b=io.BytesIO()
with tarfile.open(fileobj=b,mode='w:gz') as t:
 for name in ['arcanum-gameplay-browser.js','arcanum-presentation-counter.js','arcanum-presentation-counter.test.js','arcanum-software-samples.js','arcanum-software-samples.test.js']:
  p=W/'tools'/name;d=p.read_bytes();rel='tools/'+name;t.add(p,arcname=rel)
  pins.append(dict(path=rel,size=len(d),sha256=hashlib.sha256(d).hexdigest()))
 p=pathlib.Path('/home/user/wine-assembly/test/binaries/tlbs/stdole2.tlb');d=p.read_bytes();rel='test/binaries/tlbs/stdole2.tlb';t.add(p,arcname=rel)
 pins.append(dict(path=rel,size=len(d),sha256=hashlib.sha256(d).hexdigest()))
 d=json.dumps(dict(commit='c26252c4a95babe583ade1d1c6e2da0c050be45c',files=pins),indent=2).encode()
 (E/'pins.json').write_bytes(d);info=tarfile.TarInfo('pins.json');info.size=len(d);t.addfile(info,io.BytesIO(d))
b.seek(0);transfer(b,'driver.tar.gz')
print(run("import tarfile;tarfile.open(%r).extractall(%r,filter='data')"%(REMOTE+'/driver.tar.gz',REMOTE)))
