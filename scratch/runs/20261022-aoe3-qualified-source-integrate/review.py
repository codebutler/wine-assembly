#!/usr/bin/env python3
"""Offline integration review. Never starts a guest, compiles or uses Boat."""
from pathlib import Path
import subprocess,json,hashlib,io,contextlib,copy
E=Path(__file__).resolve().parent
R=E.parents[2]
D=Path('/home/user/wine-assembly-aoe3-host-census-canonical-oct22')
MAIN='63d563df7a2b901d222a311ceaf55a0823a22261'
QUAL='c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2'
def git(root,*args):
 p=subprocess.run(['git','-C',str(root),*args],capture_output=True)
 with (E/'review-git-stderr.log').open('ab') as f:f.write(p.stderr)
 assert p.returncode==0,(args,p.stderr[-1000:]);return p.stdout
def tree(root,rev):
 out={}
 for row in git(root,'ls-tree','-rz',rev).split(b'\0'):
  if row:
   h,n=row.split(b'\t');mode,typ,oid=h.split();out[n.decode()]=(mode.decode(),oid.decode())
 return out
Q=tree(D,QUAL);B=tree(D,MAIN)
I={}
for row in git(R,'ls-files','--stage','-z').split(b'\0'):
 if row:
  h,n=row.split(b'\t');mode,oid,stage=h.split();assert stage==b'0';I[n.decode()]=(mode.decode(),oid.decode())
note='docs/re-notes/age-of-empires3-demo.md'
owned='scratch/runs/20261022-aoe3-qualified-source-integrate/'
delta={n for n in set(B)|set(I) if B.get(n)!=I.get(n) and not n.startswith(owned)}
expected={note,'lib/host-imports.js','src/01-header.wat','test/test-oleaut32-ordinals.js','test/test-getprocaddress-sparse-name.js','tools/callback-ownership-census.json'}
assert delta==expected,delta
diffs={n for n in set(Q)|set(I) if Q.get(n)!=I.get(n)}
assert all(n==note or n.startswith('scratch/') for n in diffs),diffs
assert {n for n in diffs if not n.startswith('scratch/')}=={note}
for n in expected-{note}:
 assert (R/n).read_bytes()==git(D,'show',QUAL+':'+n),n
before=json.loads(git(D,'show',MAIN+':tools/callback-ownership-census.json'))
after=json.loads((R/'tools/callback-ownership-census.json').read_text())
assert len(before['entries'])==len(after['entries'])==407
changes=[(a,b) for a,b in zip(before['entries'],after['entries']) if a!=b]
assert len(changes)==1
a,b=changes[0];assert (a['file'],a['name'])==('lib/host-imports.js','host-file')
assert {k for k in set(a)|set(b) if a.get(k)!=b.get(k)}=={'sha256','reason'}
assert b['reason'].startswith(a['reason'])
assert b['sha256']==hashlib.sha256((R/'lib/host-imports.js').read_bytes()).hexdigest()
for k in before.keys()-{'entries'}:assert before[k]==after[k]
mapping={'base':MAIN,'qualifiedCandidate':QUAL,'indexSourceDeltaFromMain':sorted(delta),'candidateVsIntegrationDifferences':sorted(diffs),'allOtherTrackedPathsAndModesIdentical':True,'matchingNonEvidenceNonNotePaths':sum(n!=note and not n.startswith('scratch/') for n in Q),'watSourceFilesIdentical':sum(n.startswith('src/') and n.endswith(('.wat','.watx')) for n in Q),'census':{'entries':407,'changedRows':1,'changedFields':['sha256','reason'],'allClassificationsOwnershipAndReviewLocksPreserved':True},'canonicalModuleSHA256':'6ac6b43475d9217ffffa98aaec3f57243de47c78c0647dcd31abef404e008678','freshBuild':False,'freshGuest':False}
(E/'source-mapping.json').write_text(json.dumps(mapping,indent=2)+'\n')
# Reuse sealed published evidence. The one in-place API receipt was overwritten
# by a later successful coordinator recheck; it is neither silently resealed nor
# treated as the original. Read its exact published blob into an explicit overlay.
runtime=Path('/home/user/wine-assembly-aoe3-complete-input-canonical-runtime-oct22')
rel='scratch/runs/20261022-aoe3-complete-input-canonical-runtime'
base=runtime/rel;pub='5551b0272cdc2efa4cf9f9c13961a25ef1cbfd18'
seals=git(runtime,'show',pub+':'+rel+'/evidence-seals.json')
assert seals==(base/'evidence-seals.json').read_bytes()
code=git(runtime,'show',pub+':'+rel+'/verify.py')
assert code==(base/'verify.py').read_bytes()
overlay={};drift=[]
for n,row in json.loads(seals).items():
 actual=(base/n).read_bytes()
 if len(actual)==row['bytes'] and hashlib.sha256(actual).hexdigest()==row['sha256']:continue
 published=git(runtime,'show',pub+':'+rel+'/'+n)
 assert len(published)==row['bytes'] and hashlib.sha256(published).hexdigest()==row['sha256']
 assert n=='verify-remote-receipt.json'
 overlay[base/n]=published
 (E/('published-'+n)).write_bytes(published)
 drift.append({'path':n,'publishedSHA256':row['sha256'],'inPlaceSHA256':hashlib.sha256(actual).hexdigest(),'publishedReceipt':json.loads(published),'laterInPlaceReceipt':json.loads(actual)})
original=Path.read_bytes
def read_bytes(p):return overlay[p] if p in overlay else original(p)
out=io.StringIO()
try:
 Path.read_bytes=read_bytes
 with contextlib.redirect_stdout(out):exec(compile(code,str(base/'verify.py'),'exec'),{'__file__':str(base/'verify.py')})
finally:Path.read_bytes=original
(E/'canonical-published-verification.log').write_text(out.getvalue())
(E/'canonical-receipt-drift.json').write_text(json.dumps({'publishedCommit':pub,'unchangedVerifierUsed':True,'overlayOnlyForPublishedReceipt':drift,'result':'PASS'},indent=2)+'\n')
for name,root,run in [
 ('independent-source','/home/user/wine-assembly-aoe3-oleaut-independent-sparse-review-oct22','20261022-aoe3-oleaut-independent-sparse-review'),
 ('accepted-census','/home/user/wine-assembly-aoe3-host-census-canonical-oct22','20261022-aoe3-host-census-canonical'),
 ('native-provider','/home/user/wine-assembly-aoe3-native-dxdiag-retest-oct22','20261022-aoe3-native-dxdiag-retest')]:
 p=subprocess.run(['python3',str(Path(root)/'scratch/runs'/run/'verify.py')],capture_output=True,text=True)
 (E/(name+'-verification.log')).write_text(p.stdout+p.stderr);assert p.returncode==0
print('PASS complete tracked production/test mapping, 407 census metadata preservation, reused independent/census/native evidence and exact published canonical evidence; one later receipt drift explicitly isolated')
