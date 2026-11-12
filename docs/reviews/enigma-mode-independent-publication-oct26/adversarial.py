"""Independent acceptance controls. No source edits or full-media inputs."""
import contextlib,hashlib,importlib.util,json,os,stat,sys,tempfile
from pathlib import Path
from unittest.mock import patch
H=Path(__file__).parent
spec=importlib.util.spec_from_file_location('repair',H.parent/'repo/tools/enigma-bounded-staging.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
def row(p,t):
 b=p.read_bytes();return dict(kind='file',path=str(p),target=t,bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def sig(p):
 st=p.stat();return (st.st_dev,st.st_ino,stat.S_IMODE(st.st_mode),st.st_nlink,st.st_size,st.st_mtime_ns,p.read_bytes())
def oracle(root):
 entries=[]
 for d,ds,fs in os.walk(root):
  entries.append(Path(d).lstat());entries.extend((Path(d)/f).lstat() for f in fs)
 assert all(not stat.S_ISLNK(st.st_mode) for st in entries)
 unique={(st.st_dev,st.st_ino):st.st_blocks*512 for st in entries}
 return dict(files=sum(stat.S_ISREG(st.st_mode) for st in entries),logicalBytes=sum(st.st_size for st in entries if stat.S_ISREG(st.st_mode)),physicalOwnedBytes=sum(unique.values()),pathSummedAllocatedBytes=sum(st.st_blocks*512 for st in entries),uniqueInodes=len(unique))
@contextlib.contextmanager
def mask(n):
 old=os.umask(n)
 try:yield
 finally:os.umask(old)
def ownership(t):
 observations=[];modes=[0o644,0o600,0o755,0o444]
 donors=[]
 for i,m in enumerate(modes):
  p=t/str(i);p.write_bytes(b'independent pinned content\0'*257);p.chmod(m);donors.append(p)
 before=[sig(p) for p in donors]
 # Nonfont first, then fonts from readonly/writable donors, then namespace
 # near misses and another identical nonfont. Canonical must be font-only.
 rows=[row(donors[i],'vfs/mode'+str(i)) for i in range(4)]
 rows += [row(donors[3],'runner/fonts/readonly, font'),row(donors[0],'runtime/fonts/writable font'),row(donors[1],'runner/fonts-extra/x'),row(donors[2],'runtime/fontside/x'),row(donors[0],'vfs/second')]
 for n in [0o000,0o002,0o022,0o027,0o077]:
  out=t/('mask'+str(n))
  with mask(n):receipt=s.stage(rows,out)
  assert receipt==oracle(out)
  fontpaths=[out/rows[i]['target'] for i in [4,5]]
  assert os.path.samefile(*fontpaths)
  assert all(stat.S_IMODE(p.stat().st_mode)==0o444 for p in fontpaths)
  ordinary=[out/r['target'] for i,r in enumerate(rows) if i not in [4,5]]
  ids={(p.stat().st_dev,p.stat().st_ino) for p in ordinary}
  assert len(ids)==len(ordinary)
  assert (fontpaths[0].stat().st_dev,fontpaths[0].stat().st_ino) not in ids
  for r in rows:
   p=out/r['target'];assert p.read_bytes()==Path(r['path']).read_bytes()
   assert all(not os.path.samefile(p,d) for d in donors)
  assert [stat.S_IMODE(p.stat().st_mode) for p in ordinary]==[0o644,0o600,0o755,0o444,0o600,0o755,0o644]
  # Actual write-independence control deliberately has writable source.
  ordinary[0].write_bytes(b'changed independent output')
  assert fontpaths[0].read_bytes()==donors[0].read_bytes()
  assert ordinary[-1].read_bytes()==donors[0].read_bytes()
  for readonly in [ordinary[3],*fontpaths]:
   try:
    with readonly.open('r+b'):pass
   except PermissionError:pass
   else:raise AssertionError('readonly open unexpectedly writable')
  assert before==[sig(p) for p in donors]
  observations.append(dict(umask=oct(n),modes=[oct(stat.S_IMODE(p.stat().st_mode)) for p in ordinary],receipt=receipt,postWriteIndependent=True,readonlyOpenRejected=True))
 return dict(matrix=observations,cases=20,donorsUnchanged=True)
def failures(t):
 p=t/'source';p.write_bytes(b'consistent source');p.chmod(0o600)
 dup=t/'duplicate';dup.write_bytes(p.read_bytes());dup.chmod(0o444)
 baseline=sig(p),sig(dup)
 foreign=t/'.enigma-stage-foreign';foreign.mkdir();(foreign/'keep').write_bytes(b'foreign evidence')
 rr=[row(p,'vfs/writable'),row(p,'runner/fonts/a'),row(dup,'runtime/fonts/b')]
 for fail in ['nonfont-chmod','font-chmod','link','interrupt','bad-duplicate']:
  dest=t/('out-'+fail);realchmod=Path.chmod
  def chmod(path,mode,*a,**kw):
   if (fail=='nonfont-chmod' and path.name=='writable') or (fail=='font-chmod' and path.name=='a'):raise OSError('injected permission publication')
   return realchmod(path,mode,*a,**kw)
  def brokenlink(*a,**kw):raise OSError('injected alias')
  @contextlib.contextmanager
  def opener(r):
   if r['target']=='runtime/fonts/b' and fail=='interrupt':raise KeyboardInterrupt('owned interrupted')
   with s.source(r) as f:yield f
  rows=[dict(r) for r in rr]
  if fail=='bad-duplicate':rows[-1]['sha256']='0'*64
  with patch.object(Path,'chmod',chmod),patch.object(s.os,'link',brokenlink if fail=='link' else os.link):
   try:s.stage(rows,dest,opener)
   except (OSError,ValueError,KeyboardInterrupt):pass
   else:raise AssertionError('failure not propagated: '+fail)
  assert not os.path.lexists(dest)
  assert list(t.glob('.enigma-stage-*'))==[foreign]
  assert (foreign/'keep').read_bytes()==b'foreign evidence'
  assert baseline==(sig(p),sig(dup))
 return dict(cases=5,donorsAndForeignEvidencePreserved=True,temporaryTreesCleaned=True)
if __name__=='__main__':
 with tempfile.TemporaryDirectory(dir=H,prefix='adversarial-') as d:result=globals()[sys.argv[1]](Path(d))
 print(json.dumps(dict(group=sys.argv[1],status='PASS',result=result)))
