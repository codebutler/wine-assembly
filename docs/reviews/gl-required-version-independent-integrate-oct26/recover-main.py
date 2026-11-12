"""Copy commit/tree metadata only; recover one verified local main helper blob."""
from pathlib import Path as P
import subprocess,sys,hashlib,zlib,json
H=P(__file__).resolve().parent.parent;O=H/'ops';G=H/'repo/.git'
MAIN='f461584655aa36f1ca30686cbd1428757b232b3c'
donor='/tmp/ricochet-accepted-cleanup-merged-integration-oct26/repo'
p=subprocess.Popen([sys.executable,str(O/'git-child.py'),'-C',donor,'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
seen=set();total=0
def save(typ,data,oid):
    raw=typ+b' '+str(len(data)).encode()+b'\0'+data;assert hashlib.sha1(raw).hexdigest()==oid
    dst=G/'objects'/oid[:2]/oid[2:];dst.parent.mkdir(exist_ok=True)
    if not dst.exists():dst.write_bytes(zlib.compress(raw))
    assert zlib.decompress(dst.read_bytes())==raw
try:
    todo=[MAIN]
    while todo:
        oid=todo.pop()
        if oid in seen:continue
        p.stdin.write((oid+'\n').encode());p.stdin.flush();header=p.stdout.readline().split();assert len(header)==3 and header[0].decode()==oid,header
        typ=header[1];n=int(header[2]);assert typ in (b'commit',b'tree') and n<2*1048576
        data=p.stdout.read(n);assert len(data)==n and p.stdout.read(1)==b'\n';save(typ,data,oid);seen.add(oid);total+=len(data);assert total<8*1048576
        if typ==b'commit':todo.append(data.splitlines()[0].split()[1].decode())
        else:
            i=0
            while i<len(data):
                end=data.index(b'\0',i);mode=data[i:end].split(b' ',1)[0];child=data[end+1:end+21].hex();i=end+21
                if mode==b'40000':todo.append(child)
    p.stdin.close();assert p.wait(timeout=5)==0
finally:
    if p.poll() is None:p.kill();p.wait()
b=P('/tmp/gl-published-webgl-api-qualification-oct26/repo/test/helpers/palette-browser-supervisor.py').read_bytes()
oid='85ea5f285611a2108cda3219f7cbd160a15271e7';save(b'blob',b,oid)
(O/'main-helper.py').write_bytes(b)
with (G/'shallow').open('a') as f:f.write(MAIN+'\n')
branch='task/gl-required-version-independent-integrate-oct26';(G/'refs/heads'/branch).write_text(MAIN+'\n')
j=dict(main=MAIN,metadataObjects=len(seen),metadataUncompressedBytes=total,mainHelperBlob=oid,mainHelperSHA256=hashlib.sha256(b).hexdigest(),mainHelperLocalSource='/tmp/gl-published-webgl-api-qualification-oct26/repo/test/helpers/palette-browser-supervisor.py',noBlobMissAttempt=True,noAlternates=True)
(O/'main-recovery-result.json').write_text(json.dumps(j,indent=2)+'\n');print(json.dumps(j))
