import pathlib,json,hashlib,importlib.util,sys
sys.dont_write_bytecode=True
O=pathlib.Path(__file__).parent;E=json.load(open(O/'expected-abi-layout.json'));A=pathlib.Path(E['helperPath']);assert hashlib.sha256(A.read_bytes()).hexdigest()==E['helperSHA256']
spec=importlib.util.spec_from_file_location('abi',A);abi=importlib.util.module_from_spec(spec);spec.loader.exec_module(abi)
outputs=[]
for row in json.load(open(O/'outputs.json')):
 p=pathlib.Path(row['file']);o=abi.parse(p);assert o['sha256']==row['sha256'];abi.compare(o,E['imports'],E['exports'],E['layout'])
 r=abi.Reader(p.read_bytes()[8:]);segments=[]
 while r.p<len(r.b):
  k=r.byte();v=r.take(r.leb())
  if k!=11:continue
  d=abi.Reader(v)
  for _ in range(d.leb()):
   flags=d.leb();assert flags in (0,2)
   if flags==2:assert d.leb()==0
   assert d.byte()==0x41
   value=0;shift=0
   for _ in range(5):
    b=d.byte();value|=(b&127)<<shift;shift+=7
    if not b&128:break
   else:raise AssertionError('offset LEB overflow')
   if b&64:value|=-(1<<shift)
   offset=value&0xffffffff;assert d.byte()==11
   n=d.leb();payload=d.take(n);assert offset+n<=8192*65536
   segments.append(dict(offset=offset,bytes=n,sha256=hashlib.sha256(payload).hexdigest()))
  d.end()
 segments.sort(key=lambda s:s['offset'])
 assert all(a['offset']+a['bytes']<=b['offset'] for a,b in zip(segments,segments[1:])), 'data overlap'
 storage=[r for r in E['regions'] if r['kind']!='span'];assert all(0<=r['base']<=r['end']<=8192*65536 for r in storage)
 o['dataSegments']=segments;o['dataBounds']='PASS';o['storageBounds']='PASS';outputs.append(o)
(O/'static-abi.json').write_text(json.dumps(dict(state='STATIC_ABI_PASS',outputs=outputs,imports=len(E['imports']),functionExports=len(E['exports']),inventory=len(E['regions']),layout=E['layout'],Memory=False,Instance=False),indent=2)+'\n')
print(json.dumps(dict(state='STATIC_ABI_PASS',outputs=len(outputs),imports=len(E['imports']),exports=len(E['exports']),dataSegments=[len(o['dataSegments']) for o in outputs],layout=E['layout'])))
