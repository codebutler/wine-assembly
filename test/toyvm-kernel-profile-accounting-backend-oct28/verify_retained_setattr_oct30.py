#!/usr/bin/env python3
"""Validate retained raw mounted artifacts; never starts/resumes a Boat."""
import hashlib
import json
import pathlib
import sys

def pin(p):
    b=p.read_bytes()
    return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def verify(raw, repo):
    receipt=raw/'completion-receipt.json'
    assert pin(receipt)==dict(bytes=20354,sha256='cf734283770cc73b7b53cfeb27f2b9c9d6de3dbd783b5634adf1ca45ec865d7e')
    c=json.loads(receipt.read_text())
    assert c['publication']['commit']=='a1e2521277aaae7c5c6382272d03fc284fa0d3a2'
    for name,want in c['rawEvidencePins'].items(): assert pin(raw/name)==want, name
    for rel,want in c['publication']['paths'].items(): assert pin(repo/rel)==want, rel
    r=json.loads((raw/'runtime-guards.json').read_text())
    manifest=json.loads((raw/'runtime-manifest-base.json').read_text())
    for rel,want in manifest['sourcePins'].items():
        assert pin(repo/rel)==want and pin(raw/'stage/repo'/rel)==want, rel
    package=repo/'test/toyvm-kernel-profile-accounting-backend-oct28/mounted-setattr-accounting-oct30'
    assert pin(package/'fixture.py')==manifest['fixturePin']
    assert pin(package/'observer.py')==manifest['observerPin']
    child=[json.loads(line) for line in r['fixtureOutput'].splitlines()]
    assert child==r['syscalls']
    assert [s['step'] for s in child]==['before','rejected','shrink','regrowth','cleanup']
    payload=(b'AtomicSetattr-0123456789abcdef'*200)[:4096]
    contents=[payload,payload,payload[:1024],payload[:1024]+b'\0'*7168]
    for step,content in zip(child,contents):
        assert step['state']['length']==len(content)
        assert step['state']['sha256']==hashlib.sha256(content).hexdigest()
        assert step['state']['inode']==2
    assert child[1]['errno']==28 and child[1]['unchanged']
    assert child[0]['state']==child[1]['state']
    assert child[3]['zeroFill'] and child[3]['prefixRetained'] and child[4]['empty']
    backend=r['report']['backendReceipt']; fs=backend['filesystem']
    records=fs['setattrEvidence']['records']
    pre=dict(live=12288,peak=12288,written=4096,inodes=2,openHandles=1)
    post=dict(pre,live=16384,peak=16384,written=11264)
    expected=[dict(opcode=4,unique=u,inode=2,errno=e,callbackCount=i+1,before=pre,after=pre if i<2 else post)
              for i,(u,e) in enumerate([(196,28),(206,0),(216,0)])]
    assert records==expected
    assert fs['setattrEvidence']==dict(limit=64,callbackCount=3,countSaturated=False,records=expected)
    samples=[s for s in r['counterSamples'] if s['state'].get('setattrEvidence',{}).get('callbackCount')]
    assert samples and all(s['at']>child[4]['at'] for s in samples)
    assert all(s['state']['setattrEvidence']==fs['setattrEvidence'] for s in samples)
    assert (fs['live'],fs['peak'],fs['written'],fs['inodes'],fs['openHandles'])==(4096,16384,11264,1,0)
    assert backend['exit']==0 and r['exit']==1 and not r['report']['accepted']
    assert fs['failure']=='filesystem per-file limit'
    assert r['observerCleanup']==dict(remainingMounts=[],processes=[])
    assert backend['filesystemCleanup']['unmountExit']==0 and backend['filesystemCleanup']['remainingMounts']==[]
    life=c['lifecycle']
    assert life['id']=='bx_w5h7gue8' and life['state']=='stopped'
    assert life['snapshotAvailable'] and life['lastSnapshotStatus']=='completed'
    return dict(PASS=True,rawEvidencePinsVerified=len(c['rawEvidencePins']),
                publicationPinsVerified=len(c['publication']['paths']),sourcePinsVerified=len(manifest['sourcePins']),
                callbacks=expected,childContentHashesVerified=True,cleanupVerified=True,
                externalInstantaneousSample=False,externalObserver='polled after all three callbacks and cleanup',
                counterScope='immediate before/after comes from production serve capture',
                lifecycle=life,newMountedInvocations=0)
if __name__=='__main__':
    print(json.dumps(verify(pathlib.Path(sys.argv[1]),pathlib.Path(__file__).resolve().parents[2]),sort_keys=True))
