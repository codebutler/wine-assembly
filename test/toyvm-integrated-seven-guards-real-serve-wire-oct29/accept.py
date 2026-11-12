"""Real Backend.serve protocol qualification; no dispatcher/selector substitution."""
import copy,errno,hashlib,json,os,pathlib,selectors,socket,stat,struct,threading,types
from verify_inputs import TASK,REPO,OUT,verify,pin
SOURCE=REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
P=lambda f,*v:struct.pack('<'+f,*v)
U=lambda f,b,o=0:struct.unpack_from('<'+f,b,o)
class ObservationFailure(AssertionError):pass
def check(ok,label,**detail):
 if not ok:raise ObservationFailure(json.dumps(dict(label=label,**detail),sort_keys=True))
def normalized(v):
 if isinstance(v,(bytes,bytearray)):return {'hex':bytes(v).hex()}
 if isinstance(v,dict):return {str(k) if not isinstance(k,bytes) else 'bytes:'+k.hex():normalized(x) for k,x in v.items()}
 if isinstance(v,(tuple,list)):return [normalized(x) for x in v]
 return v
def snapshot(b):
 # Every backend field, including the complete namespace, dense data, counters,
 # quotas, failure latch and inode/handle identities. Root/fd are constant too.
 return normalized({k:str(v) if isinstance(v,pathlib.Path) else v for k,v in vars(b).items()})
def fds():
 out={}
 for p in pathlib.Path('/proc/self/fd').iterdir():
  try:out[int(p.name)]=os.readlink(p)
  except FileNotFoundError:pass
 return out
def load(path):
 m=types.ModuleType('pinned_backend_'+path.stem)
 exec(compile(path.read_bytes(),str(path),'exec'),m.__dict__)
 assert m.selectors.DefaultSelector is selectors.EpollSelector
 return m
class Wire:
 def __init__(self,module,label):
  self.b=module.Backend(TASK/'unused-mountpoint',live_limit=131072,write_limit=65536,file_limit=16384)
  self.peer,server=socket.socketpair()
  self.peer.settimeout(2)
  self.b.fd=server.detach()
  self.owned_fd=self.b.fd
  self.unique=0;self.log=[];self.exceptions=[];self.label=label
  self.before=fds()
  self.thread=threading.Thread(target=self.serve,name='real-serve-'+label,daemon=True)
  self.thread.start()
  self.call(26,1,P('4I',7,31,0,0),label='INIT')
  self.active=fds()
  self.created={fd:target for fd,target in self.active.items() if fd not in self.before}
  check(sum(t=='anon_inode:[eventpoll]' for t in self.created.values())==1,'real EpollSelector created',fds=self.created)
  check(sum(t.startswith('socket:') for t in self.created.values())==1,'real control socket created',fds=self.created)
 def serve(self):
  try:self.b.serve('\0toyvm-seven-'+str(os.getpid())+'-'+self.label)
  except BaseException as e:self.exceptions.append(repr(e))
 def recv(self,n):
  out=b''
  while len(out)<n:
   part=self.peer.recv(n-len(out))
   if not part:raise RuntimeError('unexpected wire EOF')
   out+=part
  return out
 def call(self,op,ino,data=b'',expected=0,label='valid'):
  self.unique+=1;u=self.unique
  frame=P('2I2Q4I',40+len(data),op,u,ino,os.getuid(),os.getgid(),os.getpid(),0)+data
  self.peer.sendall(frame)
  header=self.recv(16);length,error,reply=U('IiQ',header)
  check(16<=length<=131072,'reply length',length=length)
  payload=self.recv(length-16)
  self.log.append(dict(label=label,op=op,ino=ino,unique=u,request=frame.hex(),reply=(header+payload).hex(),expectedErrno=expected))
  check(reply==u,'reply/request identity',expected=u,observed=reply)
  check(error==-expected,label,expectedErrno=expected,observedErrno=-error,unique=u)
  if expected:check(payload==b'','error reply payload',labelOfRequest=label)
  return payload
 def unchanged(self,op,ino,data=b'',expected=0,label='observation'):
  before=snapshot(self.b)
  try:return self.call(op,ino,data,expected,label)
  finally:
   after=snapshot(self.b);wanted=copy.deepcopy(before);wanted['operations']+=1
   self.log[-1]['before']=before;self.log[-1]['after']=after
   check(after==wanted,label+' complete state atomicity',expected=wanted,observed=after)
 def reject(self,label,op,ino,data,e):
  self.unchanged(op,ino,data,e,label)
  # A successful fresh wire request after EACH rejection.
  payload=self.unchanged(3,1,label='usable after '+label)
  check(U('Q',payload,16)[0]==1,'valid GETATTR inode')
 def mkdir(self,parent,name):
  return U('Q',self.call(9,parent,P('2I',0o700,0)+name+b'\0',label='seed MKDIR'))[0]
 def create(self,parent,name):
  p=self.call(35,parent,P('4I',0,0o600,0,0)+name+b'\0',label='seed CREATE')
  ino=U('Q',p)[0];check(U('Q',p,128)[0]==ino,'CREATE handle identity');return ino
 def write(self,ino,data):
  p=self.call(16,ino,P('2Q6I',ino,0,len(data),0,0,0,0,0)+data,label='seed WRITE')
  check(U('I',p)[0]==len(data),'WRITE size')
 def close(self):
  self.peer.shutdown(socket.SHUT_WR)
  self.thread.join(3)
  check(not self.thread.is_alive(),'bounded serve join')
  check(not self.exceptions,'serve thread exception',exceptions=self.exceptions)
  for fd in [self.owned_fd,*self.created]:
   try:os.fstat(fd)
   except OSError as e:check(e.errno==errno.EBADF,'owned descriptor EBADF',fd=fd,errno=e.errno)
   else:raise ObservationFailure('owned descriptor remained open '+str(fd))
  # Borrowed peer remains an open, usable socket even after backend closes its side.
  os.fstat(self.peer.fileno());check(self.peer.getsockopt(socket.SOL_SOCKET,socket.SO_TYPE)==socket.SOCK_STREAM,'borrowed peer usable')
  check(self.peer.recv(1)==b'','peer observes backend EOF')
  self.cleanup=dict(selector='actual selectors.EpollSelector',ownedFd=self.owned_fd,createdFds=self.created,allOwnedEBADF=True,borrowedPeerUsable=True,joined=True,threadExceptions=[])
  self.peer.close()
def rename(op,parent,dest,old,new,flags=0):
 return P('Q',dest)+(P('2I',flags,0) if op==45 else b'')+old+b'\0'+new+b'\0'
def setattr_data(flags,size):
 return P('2I2Q',flags,0,0,size)+bytes(64)
def readdir(w,ino,expected_parent,label):
 p=w.unchanged(28,ino,P('2Q6I',ino,0,4096,0,0,0,0,0),label=label)
 entries={};offset=0
 while offset<len(p):
  child,cookie,n,kind=U('2Q2I',p,offset);name=p[offset+24:offset+24+n]
  entries[name]=(child,kind);offset+=(24+n+7)//8*8
 check(entries.get(b'.')==(ino,4),label+' self identity',observed=normalized(entries))
 check(entries.get(b'..')==(expected_parent,4),label+' actual parent identity',expected=expected_parent,observed=normalized(entries))
def seed(w):
 a=w.mkdir(1,b'a');b=w.mkdir(a,b'b');f=w.create(a,b'f');d=w.mkdir(1,b'd');g=w.create(1,b'g')
 w.write(f,b'alpha');w.write(g,b'omega')
 # Derived from production accounting: root + five created inode metadata
 # charges, and one dense payload block for each of the two writes.
 check(w.b.live==8*4096 and w.b.written==10 and w.b.handles==2,'valid production fixture accounting')
 return a,b,f,d,g
FAMILIES=('rename-type','unlink-type','cycle','readdir-parent','create-parent','setattr-flags','rename-parent')
def group(w,family,ids):
 a,b,f,d,g=ids
 if family=='rename-type':
  for op in (12,45):
   w.reject('file over directory '+str(op),op,a,rename(op,a,1,b'f',b'd'),errno.EISDIR)
   w.reject('directory over file '+str(op),op,1,rename(op,1,1,b'd',b'g'),errno.ENOTDIR)
 elif family=='unlink-type':
  w.reject('UNLINK directory',10,1,b'a\0',errno.EISDIR)
  w.reject('RMDIR file',11,1,b'g\0',errno.ENOTDIR)
 elif family=='cycle':
  for op in (12,45):
   w.reject('descendant cycle '+str(op),op,1,rename(op,1,b,b'a',b'cycle'),errno.EINVAL)
   w.reject('self cycle '+str(op),op,1,rename(op,1,a,b'a',b'cycle'),errno.EINVAL)
 elif family=='readdir-parent':
  readdir(w,b,a,'nested b parent a')
  w.call(45,a,rename(45,a,1,b'b',b'moved'),label='valid RENAME2 move directory')
  readdir(w,b,1,'moved b parent root')
  w.call(12,1,rename(12,1,a,b'moved',b'b'),label='valid RENAME restore directory')
  readdir(w,b,a,'restored b parent a')
 elif family=='create-parent':
  for op,head in ((35,P('4I',0,0o600,0,0)),(9,P('2I',0o700,0))):
   for parent,name,e,tag in ((999,b'x',errno.ENOENT,'missing parent'),(f,b'x',errno.ENOTDIR,'file parent'),(1,b'a',errno.EEXIST,'directory collision'),(1,b'g',errno.EEXIST,'file collision'),(1,b'..',errno.EINVAL,'unsafe name')):
    w.reject(str(op)+' '+tag,op,parent,head+name+b'\0',e)
 elif family=='setattr-flags':
  for flags in (8|2048,8|0x80000000,2048):
   w.reject('SETATTR unsupported '+str(flags),4,f,setattr_data(flags,8193),errno.EOPNOTSUPP)
  w.call(4,f,setattr_data(8,17),label='valid size SETATTR')
  check(bytes(w.b.nodes[f]['data'])==b'alpha'+bytes(12),'valid SETATTR content')
  w.reject('SETATTR after accepted growth',4,f,setattr_data(8|2048,8193),errno.EOPNOTSUPP)
 elif family=='rename-parent':
  for op in (12,45):
   for parent,dest,e,tag in ((999,1,errno.ENOENT,'source missing'),(f,1,errno.ENOTDIR,'source file'),(a,999,errno.ENOENT,'destination missing'),(a,f,errno.ENOTDIR,'destination file')):
    w.reject(str(op)+' '+tag,op,parent,rename(op,parent,dest,b'f',b'x'),e)
    if op==45:w.reject('flags precede '+tag,op,parent,rename(op,parent,dest,b'f',b'x',1),errno.EOPNOTSUPP)
   w.reject(str(op)+' missing source name',op,a,rename(op,a,1,b'absent',b'x'),errno.ENOENT)
  w.reject('flags precede unsafe names',45,999,rename(45,999,f,b'..',b'/',1),errno.EOPNOTSUPP)
  w.call(45,a,rename(45,a,a,b'f',b'f'),label='valid flag-zero RENAME2 no-op')
MUTATIONS={
 'rename-type':("if not source_is_dir and dest_is_dir:","if False:"),
 'unlink-type':("if op==10 and stat.S_ISDIR(self.nodes[child]['mode']):","if False:"),
 'cycle':("if child==newdir:","if False:"),
 'readdir-parent':("if ino!=1:","if False:"),
 'create-parent':("if not stat.S_ISDIR(n['mode']):","if False:"),
 'setattr-flags':("if valid&~(1|2|4|8|16|32|64|128|256|512|1024):","if False:"),
 'rename-parent':("if parent not in self.nodes:","if False:")}
def run(path,label,only=None):
 w=Wire(load(path),label);failure=None
 try:
  ids=seed(w)
  for family in ([only] if only else FAMILIES):
   group(w,family,ids)
  if not only:
   # Mixed guards again after accepted namespace movement and data growth.
   readdir(w,ids[1],ids[0],'mixed parent after mutations')
   w.reject('mixed RMDIR file',11,1,b'g\0',errno.ENOTDIR)
   w.reject('mixed rename cycle',45,1,rename(45,1,ids[1],b'a',b'x'),errno.EINVAL)
   readdir(w,ids[1],ids[0],'mixed parent after rejection')
 except ObservationFailure as e:failure=str(e)
 finally:w.close()
 result=dict(label=label,source=pin(path),wireCount=len(w.log),failure=failure,wire=w.log,cleanup=w.cleanup,finalState=snapshot(w.b))
 (OUT/(label+'.json')).write_text(json.dumps(result,indent=2)+'\n')
 return result
def main():
 verified=verify()
 # FIRST behavioral execution is the exact pinned production dispatcher.
 production=run(SOURCE,'production')
 if production['failure']:
  (OUT/'results.json').write_text(json.dumps(dict(status='SOURCE DEFECT',production=production),indent=2)+'\n')
  raise SystemExit('STOP: decisive production wire defect; production unchanged')
 mutants=[];src=SOURCE.read_text();private=TASK/'private-mutants';private.mkdir(exist_ok=True)
 for family,(old,new) in MUTATIONS.items():
  assert src.count(old)==1,(family,old)
  transformed=src.replace(old,new,1);path=private/(family+'.py');path.write_text(transformed)
  # Exact one predicate replacement, byte identity outside its isolated span.
  prefix,suffix=src.split(old);assert transformed==prefix+new+suffix
  result=run(path,'mutant-'+family,family)
  check(result['failure'] is not None,'mutant must fail same wire oracle',family=family)
  # Copy the private transformed source into owned report assets for recovery.
  copy_path=OUT/'mutants'/(family+'.py');copy_path.parent.mkdir(exist_ok=True);copy_path.write_bytes(path.read_bytes())
  mutants.append(dict(family=family,source=pin(path),old=old,new=new,scope='one predicate replaced; unchanged serve and primary oracle',failure=result['failure'],wireCount=result['wireCount'],cleanup=result['cleanup']))
 verify()
 result=dict(status='PASS',baseline=verified['baseline'],source=pin(SOURCE),productionWireCount=production['wireCount'],productionRejections=sum(bool(x['expectedErrno']) for x in production['wire']),mutants=mutants,totalWireCount=production['wireCount']+sum(m['wireCount'] for m in mutants),cleanup=production['cleanup'],scope='real local socketpair Backend.serve only; no mount/kernel/CLI/browser/gameplay')
 (OUT/'results.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({k:v for k,v in result.items() if k not in ('mutants','cleanup')},sort_keys=True))
if __name__=='__main__':main()
