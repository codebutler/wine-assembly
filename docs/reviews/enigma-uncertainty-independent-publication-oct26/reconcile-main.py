from common import *
import urllib.request
main=g('ls-remote','origin','refs/heads/main').decode().strip();rev=main.split()[0];assert rev=='7681b752d7c3fe565a49e92832c3d9825bec7ed9'
url=f'https://raw.githubusercontent.com/vgrichina/wine-assembly/{rev}/test/run.js'
with urllib.request.urlopen(url,timeout=30) as r:b=r.read(2097153);assert r.status==200 and len(b)<=2097152
blob=hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest();assert blob=='4b8461338f4bcddde6b5d5504991523b28d3ac35'
assert sha(b)==json.load(open(O/'runner-recovery.json'))['sha256']
save('main-reconciliation.json',dict(remoteMain=main,path='test/run.js',immutableURL=url,gitBlob=blob,sha256=sha(b),bytes=len(b),candidateRunner=g('ls-tree',REV,'test/run.js').decode().strip(),runnerByteIdentical=True,mainPublished=False,mergedValidation='not attempted because prerequisite runner gate failed',reason='production wireRunner rejects actual candidate AND exact freshly reconciled main source',rootObjectReadIncident='exact main commit not materialized in root shallow store; resolved through immutable exact-revision source, no donor substitution'))
print('fresh exact main source matched candidate; publication remains blocked')
