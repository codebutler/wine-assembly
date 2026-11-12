from common import *
admission('premain-object-recovery')
donor=Path('/tmp/vfs-read-abort-main-publication-oct26/repo')
assert git('rev-parse','HEAD',repo=donor)[1].decode().strip()==MAIN
assert git('cat-file','-t',MAIN,repo=donor)[1]==b'commit\n'
objects={Path(x) for x in (R/'.git/objects/info/alternates').read_text().splitlines()}
def visit(p):
 p=p.resolve()
 if p in objects:return
 objects.add(p);a=p/'info/alternates'
 if a.exists():
  for x in a.read_text().splitlines():visit(Path(x) if Path(x).is_absolute() else p/x)
visit(donor/'.git/objects')
(R/'.git/objects/info/alternates').write_text(''.join(str(p)+'\n' for p in sorted(objects)))
assert git('cat-file','-t',MAIN)[1]==b'commit\n'
save('incident-main-object-recovery.json',dict(error='Current remote main object not present in root/repair alternate stores',main=MAIN,readonlyRecoveryDonor=str(donor),donorHEADVerified=True,flatReadonlyObjects=[str(p) for p in sorted(objects)],networkFetch=False,donorMutated=False))
base='f1aac7b9ba83e2bbc763cb58d38646653d626468'
code=(H/'reuse-merge.py').read_text()
exec(compile(code[code.index("mb=git('merge-base'"):],str(H/'reuse-merge.py'),'exec'))
