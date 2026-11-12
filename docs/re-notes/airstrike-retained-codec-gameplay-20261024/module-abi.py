"""Read retained module import signatures/custom stamp without native execution."""
import pathlib,json,hashlib,sys
p=pathlib.Path(sys.argv[1]);b=p.read_bytes();assert b[:8]==b'\0asm\1\0\0\0'
class Reader:
 def __init__(self,b):self.b=b;self.i=0
 def byte(self):v=self.b[self.i];self.i+=1;return v
 def leb(self):
  n=0;s=0
  while True:
   v=self.byte();n|=(v&127)<<s;s+=7
   if v<128:return n
 def raw(self,n):v=self.b[self.i:self.i+n];self.i+=n;return v
 def string(self):return self.raw(self.leb()).decode()
r=Reader(b);r.i=8;sections={};custom={}
while r.i<len(b):
 id=r.byte();s=Reader(r.raw(r.leb()))
 if id==0:
  name=s.string();custom[name]=s.raw(len(s.b)-s.i).decode(errors='replace')
 else:sections[id]=s
t=sections[1];types=[]
for _ in range(t.leb()):
 assert t.byte()==0x60
 args=[hex(t.byte()) for _ in range(t.leb())];returns=[hex(t.byte()) for _ in range(t.leb())];types.append(dict(args=args,returns=returns))
imports=[];im=sections[2]
for _ in range(im.leb()):
 module=im.string();name=im.string();kind=im.byte();rec=dict(module=module,name=name,kind=kind)
 if kind==0:rec['signature']=types[im.leb()]
 elif kind==2:
  flags=im.leb();rec.update(flags=flags,minimum=im.leb(),maximum=im.leb() if flags&1 else None)
 else:raise AssertionError('unexpected import kind '+str(kind))
 imports.append(rec)
assert custom['wine-region-layout']=='9a3bc9149d58209c'
assert [x for x in imports if x['kind']==2]==[dict(module='host',name='memory',kind=2,flags=3,minimum=8192,maximum=32768)]
print(json.dumps(dict(module=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),layout=custom['wine-region-layout'],imports=imports),indent=2))
