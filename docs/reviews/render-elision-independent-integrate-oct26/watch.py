import os,time,pathlib,json,signal
O=pathlib.Path(__file__).parent
p=pathlib.Path('/home/user/wine-assembly/messageboard.txt')
stop=False
def term(*_):
 global stop
 stop=True
signal.signal(signal.SIGTERM,term)
(O/'watcher-identity.json').write_text(json.dumps({'pid':os.getpid(),'uid':os.getuid(),'argv':open('/proc/self/cmdline','rb').read(4096).decode().split('\0'),'startTicks':open('/proc/self/stat').read(4096).split()[21]}))
with p.open('rb') as f, (O/'watcher.log').open('ab') as out:
 f.seek(0,2);start=time.monotonic()
 while not stop and time.monotonic()-start<54:
  d=f.read(4096)
  if d:out.write(d);out.flush()
  if out.tell()>131072:break
  time.sleep(.2)
print('watcher stopped; own PID',os.getpid())
