"""Read-only PE closure audit; never executes a guest or changes source/assets."""
import pathlib, struct, json, hashlib, subprocess, re
E=pathlib.Path(__file__).resolve().parent
ROOT=pathlib.Path('/home/user/wine-assembly')
DONOR='/home/user/wine-assembly-mm-timer-qualified-integrate-oct22'
REV='c26252c4a95babe583ade1d1c6e2da0c050be45c'
PRE=pathlib.Path('/home/user/wine-assembly-deus-ex-training-runtime-oct22/scratch/runs/20261022-deus-ex-training-runtime')
def source(p): return subprocess.check_output(['git','-C',DONOR,'show',REV+':'+p])
def pe(p):
 b=p.read_bytes(); u=lambda o:struct.unpack_from('<I',b,o)[0]; h=lambda o:struct.unpack_from('<H',b,o)[0]
 e=u(60); assert b[e:e+4]==b'PE\0\0' and h(e+24)==267
 sections=[(u(s+12),u(s+16),u(s+20)) for s in range(e+24+h(e+20),e+24+h(e+20)+40*h(e+6),40)]
 def off(r):
  for va,size,raw in sections:
   if va<=r<va+size:return raw+r-va
  raise ValueError((str(p),hex(r)))
 def string(o):return b[o:b.index(0,o)].decode('ascii')
 imports={}; r=u(e+128)
 if r:
  d=off(r)
  while u(d+12):
   name=string(off(u(d+12))).lower(); t=off(u(d) or u(d+16)); a=[]
   while u(t):
    v=u(t);a.append('#'+str(v&65535) if v&0x80000000 else string(off(v)+2));t+=4
   imports[name]=a;d+=20
 exports={};r=u(e+120);sz=u(e+124)
 if r:
  d=off(r);base=u(d+16);functions=off(u(d+28)); names={}
  for i in range(u(d+24)):names[h(off(u(d+36))+2*i)]=string(off(u(off(u(d+32))+4*i)))
  for i in range(u(d+20)):
   v=u(functions+4*i)
   if v:
    row={'rva':v,'forwarder':string(off(v)) if r<=v<r+sz else None}
    exports['#'+str(base+i)]=row
    if i in names:exports[names[i]]=row
 return dict(path=str(p),size=len(b),sha256=hashlib.sha256(b).hexdigest(),imports=imports,exports=exports)
assets=json.loads((PRE/'assets.json').read_text())
game={pathlib.Path(x['path']).name.lower():pe(ROOT/x['path']) for x in assets['files'] if x['path'].lower().endswith(('.dll','.exe'))}
for x in assets['files']:
 p=ROOT/x['path'];assert p.stat().st_size==x['size'] and hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256'],p
native={n:pe(ROOT/'test/binaries/dlls'/n) for n in ['msvcrt.dll','comctl32.dll']}
native.update({n:pe(ROOT/'test/binaries/explorer98/dlls'/n) for n in ['shell32.dll','ole32.dll','shlwapi.dll']})
pins={'msvcrt.dll':'887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1','comctl32.dll':'28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4'}
for n,h in pins.items():assert native[n]['sha256']==h
api={x['name']:x for x in json.loads(source('src/api_table.json'))}
host=source('lib/host-imports.js').decode(); ordinal={k.lower():v for k,v in re.findall(r"['\"]([^'\"]+\.DLL#\d+)['\"]\s*:\s*['\"]([^'\"]+)['\"]",host)}
loader=source('src/08b-dll-loader.wat').decode()
# WAT-first ordinal table: each system DLL comparison starts a bounded block.
ordinalBody=loader.split('(func $system_ordinal_api_id',1)[1].split('(func $resolve_import_ordinal',1)[0]
blocks=re.split(r'\(call \$dll_name_match[^\n]*"([^"]+\.dll)"',ordinalBody)
for i in range(1,len(blocks)-1,2):
 for number,name in re.findall(r'local.get \$ordinal\) \(i32.const (\d+)\).*?lookup_api_id "([^"]+)"',blocks[i+1],re.S):ordinal[blocks[i].lower()+'#'+number]=name
supportUses=[];unresolved=[];emulated=[]
for name,row in {**game,**native}.items():
 for dll,imports in row['imports'].items():
  for symbol in imports:
   target={**game,**native}.get(dll)
   if target:
    entry=target['exports'].get(symbol)
    if not entry:unresolved.append([name,dll,symbol,'missing native export'])
    elif dll in native:supportUses.append(dict(importer=name,dll=dll,symbol=symbol,export=entry))
   else:
    resolved=ordinal.get(dll+symbol) if symbol.startswith('#') else symbol
    emulated.append(dict(importer=name,dll=dll,symbol=symbol,resolved=resolved,apiId=api.get(resolved,{}).get('id')))
    if resolved not in api:unresolved.append([name,dll,symbol,'not in API table'])
# Only registered DLL seeds plus EXE are launch roots; unused alternative renderers are separately visible.
seeds={pathlib.Path(x).name.lower() for x in assets['app']['dlls']}|{pathlib.Path(assets['app']['exe']).name.lower()}
active=seeds|set(native)
unresolvedActive=[x for x in unresolved if x[0] in active]
out=dict(source=REV,game=game,native=native,nativePins=pins,active=sorted(active),supportUses=supportUses,emulated=emulated,unresolved=unresolved,unresolvedActive=unresolvedActive,originalAssetsVerified=len(assets['files']))
(E/'closure-audit.json').write_text(json.dumps(out,indent=2))
(E/'native-provenance.md').write_bytes(source('test/binaries/dlls/SOURCES.md'))
print(json.dumps(dict(active=sorted(active),unresolvedActive=unresolvedActive,ordinalMapEntries=len(ordinal)),indent=2))
