import pathlib,sys,os,json
sys.path.insert(0,str(pathlib.Path(__file__).parent));from run import gate,O
leaf=pathlib.Path(sys.argv[1]);idx=sys.argv[2]
items=[]
for d in leaf.iterdir():
 if d.name in ('info','alternates'):continue
 if d.is_dir() and (len(d.name)==2 or d.name=='pack'):
  for f in d.iterdir():
   if f.is_file() and not (O/'flat'/d.name/f.name).exists():items.append((d.name,f))
gate('additional-main-leaf-'+idx,2**20)
(O/'v'/idx).symlink_to(leaf)
for d,f in items:
 p=O/'flat'/d/f.name;p.parent.mkdir(exist_ok=True);p.symlink_to('../../v/'+idx+'/'+d+'/'+f.name)
(O/('additional-main-leaf-'+idx+'.json')).write_text(json.dumps({'leaf':str(leaf),'reason':'Resolve missing exact-main docs/reviews tree without history fetch or recursive alternates','newLinks':len(items),'standingReferencedBytes':sum(f.stat().st_blocks*512 for _,f in items)},indent=2))
print('additional read-only main leaf',len(items))
