from work import *
import fcntl,resource,re
O=H/'ops';C=pathlib.Path('/home/user/.codex');a=json.load(open(O/'admission-local.json'));base=json.load(open(O/'sqlite-baseline.json'))
def account(stage):
 owned=size(H);external=size(pathlib.Path(a['launcher']))+max(pathlib.Path(a['session']).stat().st_size,pathlib.Path(a['session']).stat().st_blocks*512)
 sql=sum(max(0,max(p.stat().st_size,p.stat().st_blocks*512)-base.get(str(p),0)) for p in C.glob('*.sqlite*') if p.is_file());wal=sum(max(p.stat().st_size,p.stat().st_blocks*512) for p in C.glob('*.sqlite-wal') if p.is_file())
 charges=dict(localOwned=owned,remoteAllocatedProjection=19000000,fullExternal=external,sqlitePositivePlusFullWAL=sql+wal,futureExternalSQLite=3000000,futureEvidence=1000000,futurePublicationCopies=2500000,transferOverlap=1000000,reserve=8388608)
 peak=sum(charges.values());free=shutil.disk_usage('/tmp').free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
 j=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,free=free,after=free-peak,memAvailable=mem,passAdmission=peak<=67108864 and free-peak>=2982150144 and mem>=805306368,baselineQualification='Full current WAL conservatively charged in addition to positive SQLite growth because initial pin-literal correction reran setup; no historical charge reset.',standingInputsManifest=str(H/'manifest.json'),standingTools=[dict(path=str(pathlib.Path(shutil.which(x)).resolve()),bytes=pathlib.Path(shutil.which(x)).stat().st_size) for x in ['node','git','python3']],standingObjectStores=str(O/'alternates.json'))
 save('ops/resource-'+stage+'.json',j);assert j['passAdmission'],j
 return j
if __name__=='__main__':
 lock=open('/tmp/wine-ops-heavy-runtime.lock','a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 lock.seek(0);lock.truncate();lock.write('maelstrom-event-qualified-original-capture-oct24 remote bx_qa9ex5bu '+str(os.getpid())+'\n');lock.flush()
 account('preguest')
 assert json.load(open(O/'ready.json'))['passReady']
 # Remote fresh UID/memory/disk and lock admission happen inside the actual supervisor before Popen.
 p=subprocess.run([B,'--no-update','--json','info',BOX],capture_output=True,text=True,timeout=30);save('ops/box-before.json',dict(returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0
 assert not (O/'guest-attempt.json').exists();save('ops/guest-attempt.json',dict(at=time.time(),guestStartsAuthorized=1,retryForbidden=True))
 j=remote('cd '+shlex.quote(str(H))+' && timeout 70 python3 supervise.py guest',80);save('ops/guest-api.json',j)
 print(json.dumps(dict(captureReturned=True,commandId=j.get('commandId'),terminal=json.loads(j['stdout']))))
