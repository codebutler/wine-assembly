import pathlib,sys,json,base64,zlib,shlex,time
H=pathlib.Path(__file__).resolve().parent.parent;sys.path.insert(0,str(H/'ops'))
from transport import remote,save,sha
m=json.load(open(H/'manifest.json'));rows=[];receipts=[]
def command(rows):
 enc=base64.b64encode(zlib.compress(json.dumps(rows,separators=(',',':')).encode())).decode()
 code='import pathlib,json,base64,zlib;h=pathlib.Path('+repr(str(H))+');rows=json.loads(zlib.decompress(base64.b64decode('+repr(enc)+')));[( (h/x[0]).parent.mkdir(parents=True,exist_ok=True),(h/x[0]).open(x[1]).write(base64.b64decode(x[2]))) for x in rows];print(len(rows))'
 return 'python3 -c '+shlex.quote(code)
def flush():
 global rows
 if not rows:return
 cmd=command(rows);j=remote(cmd);receipts.append(dict(commandId=j.get('commandId'),requestBytes=len(cmd.encode()),segments=len(rows)));save('ops/transfer-receipts.json',receipts);rows=[]
for x in m+ [dict(target='guest-args.json',path=str(H/'guest-args.json')),dict(target='manifest.json',path=str(H/'manifest.json')),dict(target='validate-tree.cjs',path=str(H/'validate-tree.cjs'))]:
 b=pathlib.Path(x['path']).read_bytes()
 if 'sha256' in x:assert sha(b)==x['sha256']
 for off in range(0,len(b),18000):
  row=[x['target'],'wb' if off==0 else 'ab',base64.b64encode(b[off:off+18000]).decode()]
  if len(command(rows+[row]).encode())>35000:flush()
  rows.append(row)
flush();print(json.dumps(dict(transfers=len(receipts),files=len(m),done=True)),flush=True)
