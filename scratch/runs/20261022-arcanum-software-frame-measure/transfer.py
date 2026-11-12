import pathlib, subprocess, json, hashlib, base64, concurrent.futures, time
E=pathlib.Path(__file__).resolve().parent;W=E.parents[2]
BOX='bx_4sszn2zj';REMOTE='/home/user/arcanum-software'
def run(code):
 r=subprocess.run(['boat','exec',BOX,'--','python3','-c',code],capture_output=True,text=True)
 v=json.loads(r.stdout);assert r.returncode==0 and v['exitCode']==0,v
 return {k:v[k] for k in ['commandId','exitCode','startedAt','finishedAt','stdout']}
def transfer(stream,name):
 start=time.time(); h=hashlib.sha256();pos=0;pending=[];receipts=[]
 run("import pathlib;pathlib.Path(%r).mkdir(parents=True,exist_ok=True);open(%r,'wb').close()"%(REMOTE,REMOTE+'/'+name))
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  while True:
   b=stream.read(60000)
   if not b:break
   assert time.time()-start<1800,'immutable transfer bound'
   code="import os,base64;f=os.open(%r,os.O_WRONLY);b=base64.b64decode(%r);assert os.pwrite(f,b,%d)==len(b);os.close(f)"%(REMOTE+'/'+name,base64.b64encode(b).decode(),pos)
   pending.append(pool.submit(run,code));h.update(b);pos+=len(b)
   if len(pending)>=4:
    receipts.extend(f.result() for f in pending);pending=[]
   if pos%6000000==0: print(name,pos,round(time.time()-start,1),flush=True)
  receipts.extend(f.result() for f in pending)
 verify=run("import hashlib; h=hashlib.sha256(open(%r,'rb').read()).hexdigest();assert h==%r;print(h)"%(REMOTE+'/'+name,h.hexdigest()))
 (E/(name+'.transfer.json')).write_text(json.dumps(dict(bytes=pos,sha256=h.hexdigest(),seconds=time.time()-start,receipts=receipts,verification=verify),indent=2))
 print('TRANSFER',name,pos,h.hexdigest(),flush=True)
 return verify
if __name__=='__main__':
 mode=__import__('sys').argv[1]
 if mode=='source': cwd=W/'runtime';paths=[x['path'] for x in json.loads((E/'source-manifest.json').read_text())]
 elif mode=='assets': cwd=pathlib.Path('/home/user/wine-assembly');paths=[x['path'] for x in json.loads((E/'assets.json').read_text())['files']]
 else: raise ValueError(mode)
 p=subprocess.Popen(['tar','czf','-','-C',str(cwd),*paths],stdout=subprocess.PIPE)
 transfer(p.stdout,mode+'.tar.gz');assert p.wait()==0
 print(run("import tarfile;tarfile.open(%r).extractall(%r,filter='data')"%(REMOTE+'/'+mode+'.tar.gz',REMOTE)))
