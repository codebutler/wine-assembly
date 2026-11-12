from common import *
import urllib.request
url='https://raw.githubusercontent.com/vgrichina/wine-assembly/5093c90b5ea7e501a8f77c78cec937f6bcf486f3/test/run.js'
gate('runner-recovery')
with urllib.request.urlopen(url,timeout=30) as r:
 b=r.read(2097153)
 assert len(b)<=2097152
 assert r.status==200
assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()=='4b8461338f4bcddde6b5d5504991523b28d3ac35'
(O/'tracked-run.js').write_bytes(b)
save('runner-recovery.json',dict(url=url,candidate=REV,path='test/run.js',gitBlob='4b8461338f4bcddde6b5d5504991523b28d3ac35',sha256=sha(b),bytes=len(b),method='immutable Git source recovery; full Git blob independently verified; no guest/game acquisition'))
print(len(b),sha(b))
