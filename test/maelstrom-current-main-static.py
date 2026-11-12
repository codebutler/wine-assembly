"""Compare diagnostic modules to fresh exact-current-main uninstrumented controls."""
import pathlib,json,hashlib,importlib.util,gzip,base64
O=pathlib.Path(__file__).resolve().parents[2]/'ops';C=pathlib.Path('/home/user/maelstrom-uop-canonical-native-qualification-oct26/canonical')
h=pathlib.Path('/home/user/maelstrom-uop-canonical-native-qualification-oct26/ops/static-abi-helper.py');oracle=json.load(open('/home/user/maelstrom-uop-canonical-native-qualification-oct26/ops/static-oracle.json'));assert hashlib.sha256(h.read_bytes()).hexdigest()==oracle['helperSHA256']
spec=importlib.util.spec_from_file_location('a',h);a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
sources=json.loads(gzip.decompress((O/'sources.json.gz').read_bytes()));source='\n'.join(base64.b64decode(b).decode() for b in sources.values());assert len(source.encode())<=25165824
inventory,serialization,layout=a.inventory(source,(C/'lib/region-map.generated.js').read_text());assert layout=='9a3bc9149d58209c';assert serialization==oracle['serialization']
outputs=[];baselines=[]
for mode in ['tail','compat']:
 row=json.load(open(O/('abi-base-'+mode+'.json')));b=row['base'];d=row['diagnostic'];exports={e['name']:e['signature'] for e in b['exports'] if e['kind']==0}
 for prefix,fields in [('msc','started phase token entries parks completions fault capped active api thunk thread regs pre ret post result'),('mne','status event token thread regs pre post selectRet parks result nativeEntry callBlock sourceBlock pc esp eax ebp errno caller socketSet timeout rejectReason rejectModes rejectExpectedRet rejectObservedRet rejectPhase rejectCompletions rejectFault rejectActive rejectCapped')]:
  for n in fields.split():assert prefix+'_'+n not in exports;exports[prefix+'_'+n]=dict(params=[],results=['i32'])
  exports[prefix+'_start']=dict(params=[],results=[])
 a.compare(d,b['imports'],exports,layout);assert d['noStart'];assert not any(c['name']=='name' for c in d['customSections']);assert row['storageBase']==row['storageDiagnostic'],'table/memory/elements/data unchanged'
 gs=row['globalsDiagnostic'];remaining=iter(gs)
 for old in row['globalsBase']:
  while True:
   now=next(remaining)
   if now==old:break
   assert now=='7f0141000b','only zero initialized private diagnostic i32 globals'
 assert all(g=='7f0141000b' for g in remaining);assert len(gs)==len(row['globalsBase'])+49
 p=pathlib.Path(d['file']);assert hashlib.sha256(p.read_bytes()).hexdigest()==d['sha256']
 outputs.append({k:d[k] for k in ['file','sha256','bytes','exports']});baselines.append(dict(mode=mode,sha256=b['sha256'],bytes=b['bytes'],functionExports=len(exports)-49,globalCount=len(row['globalsBase']),storage=row['storageBase']))
result=dict(status='PASS',sourceClosure='e486b6814a00518a6d9cb14ef376e69ab2f92c49',outputs=outputs,baselines=baselines,inventory=inventory,serialization=serialization,computedLayout=layout,privateGlobalsAdded=49,helperSHA256=oracle['helperSHA256'],controls='Exact unchanged independent region inventory rejecting controls reused; fresh full current-main baseline ABI and binary storage sections compared',nativeInstances=0)
(O/'static-abi.json').write_text(json.dumps(result,separators=(',',':')));print(json.dumps(dict(status='PASS',layout=layout,backends=2,sourceClosure=result['sourceClosure'],moduleSHA256=[r['sha256'] for r in outputs])))
