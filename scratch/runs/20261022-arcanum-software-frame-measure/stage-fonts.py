import io,json,tarfile,pathlib,hashlib,subprocess,re
from transfer import run,transfer,E,W,REMOTE
R=W/'runtime';rev='c26252c4a95babe583ade1d1c6e2da0c050be45c'
def git(p):return subprocess.check_output(['git','-C',str(W),'show',rev+':'+p])
manifest=json.loads(git('fonts/substitutions.json'))
paths={'fonts/substitutions.json','fonts/w95fa.woff2'}
for face in manifest['faces']:
 for style in face.get('win98Files',{}):
  file=face.get('styles',{}).get(style)
  if file: paths.add('fonts/subset/'+file.split('/')[-1])
# CSS-declared UI fonts, including faces used before the guest starts.
paths.update(re.findall(r"url\(['\"]?(fonts/[^)'\"]+)", (R/'index.html').read_text()))
rows=[];stream=io.BytesIO()
with tarfile.open(fileobj=stream,mode='w:gz') as t:
 for p in sorted(paths):
  d=git(p);info=tarfile.TarInfo(p);info.size=len(d);t.addfile(info,io.BytesIO(d));rows.append(dict(path=p,size=len(d),sha256=hashlib.sha256(d).hexdigest(),source=rev))
 for name in ['System','MSSansSerif','Fixedsys','Courier','Terminal']:
  p='fonts/'+name+'.fon';d=(pathlib.Path('/home/user/wine-assembly')/p).read_bytes();info=tarfile.TarInfo(p);info.size=len(d);t.addfile(info,io.BytesIO(d));rows.append(dict(path=p,size=len(d),sha256=hashlib.sha256(d).hexdigest(),source='existing local generated stock FON; no regeneration'))
 pins=json.loads((E/'pins.json').read_text());(E/'initial-pins.json').write_text(json.dumps(pins,indent=2));pins['files']+=rows
 d=json.dumps(pins,indent=2).encode();(E/'pins.json').write_bytes(d);info=tarfile.TarInfo('pins.json');info.size=len(d);t.addfile(info,io.BytesIO(d))
(E/'font-supplement.json').write_text(json.dumps(rows,indent=2))
stream.seek(0);transfer(stream,'fonts.tar.gz')
print(run("import tarfile,pathlib;tarfile.open(%r).extractall(%r,filter='data');r=pathlib.Path(%r);assert (r/'driver.exit').read_text().strip()=='0';(r/'run').rename(r/'first-run');(r/'driver.log').rename(r/'first-driver.log');(r/'driver.exit').rename(r/'first-driver.exit');(r/'preflight.json').rename(r/'initial-preflight.json')"%(REMOTE+'/fonts.tar.gz',REMOTE,REMOTE)))
