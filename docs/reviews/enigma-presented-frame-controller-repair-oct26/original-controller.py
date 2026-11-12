import pathlib,json,time,urllib.request,urllib.error
H=pathlib.Path(__file__).parent;records=[]
def save(): (H/'controls.json').write_text(json.dumps(records,indent=2))
def ask(c,timeout=10):
 req=urllib.request.Request('http://127.0.0.1:18127/ctl',data=json.dumps(c).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=timeout) as f: b=f.read(8193)
 assert len(b)<=8192
 j=json.loads(b);records.append(dict(at=time.time(),command=c,response=j));save();assert j['ok'],j
 return j['value']
code="(()=>{const w=renderer.canvas.width,h=renderer.canvas.height,d=renderer.canvas.getContext('2d').getImageData(0,0,w,h).data;return {batch:tickState.batch,width:w,height:h,arenaBytes:memory.buffer.byteLength,memory:process.memoryUsage(),rgbaSHA256:process.getBuiltinModule('crypto').createHash('sha256').update(Buffer.from(d)).digest('hex')}})()"
start=time.monotonic();failure=None
try:
 # One launch readiness wait, not another guest or admission attempt.
 while True:
  try:
   with urllib.request.urlopen('http://127.0.0.1:18127/snapshot',timeout=1) as f:j=json.loads(f.read(8192))
   records.append(dict(at=time.time(),command={'action':'initial-snapshot'},response=j));save();assert j['ok'];break
  except urllib.error.URLError:
   if time.monotonic()-start>10:raise
   time.sleep(.1)
 ask({'cmd':'step 100000'},72)
 before=ask({'action':'eval','code':code});snap=ask({'action':'snapshot'})
 assert before['rgbaSHA256']=='a44ee9b285f41ab7ac824d47703d06a81cf85b126b77cb6b93ae0b285207f587','before framebuffer differs from inspected menu; no click'
 assert any(x['title']=='Enigma - Main Menu' for x in snap['windows']),'unexpected before title; no click'
 ask({'cmd':'mousemove:344:212'});ask({'cmd':'step 64'})
 ask({'cmd':'mousedown:344:212'});ask({'cmd':'step 64'})
 ask({'cmd':'mouseup:344:212'});ask({'cmd':'step 3000'})
 ask({'action':'eval','code':code});ask({'action':'snapshot'})
except Exception as e:
 failure=repr(e);(H/'controller-first-failure.json').write_text(json.dumps(dict(error=failure,at=time.time())))
finally:
 try:ask({'action':'png','path':str(H/'guest/final.png')})
 except Exception as e:
  if failure is None:failure=repr(e)
 try:ask({'cmd':'quit'})
 except Exception as e:
  if failure is None:failure=repr(e)
 (H/'controller-terminal.json').write_text(json.dumps(dict(firstFailure=failure,elapsed=time.monotonic()-start)))
print(json.dumps(dict(firstFailure=failure,elapsed=time.monotonic()-start)))
