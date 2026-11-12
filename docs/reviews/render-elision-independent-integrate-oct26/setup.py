import os,pathlib,json,hashlib,sys
sys.path.insert(0,str(pathlib.Path(__file__).parent));from run import gate,O,B
R=pathlib.Path('/home/user/wine-assembly');a=json.loads((R/'scratch/usage-watch/render-elision-independent-integrate-oct26.admission.json').read_bytes());D=pathlib.Path(a['donor'])
pins={}
for name,h in a['pins'].items():
 p=D/name
 digest=hashlib.sha256()
 with p.open('rb') as f:
  while True:
   d=f.read(65536)
   if not d:break
   digest.update(d)
 assert digest.hexdigest()==h,name
 pins[name]=h
configuration={'ssh':'ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes','mountArgv':[],'intendedMountedFiles':[],'mountValidation':'Offline source-only task: no mount argv or mount execution. Exact unchanged configuration receipt reused; no conditional mount operation.','pins':pins,'candidate':a['candidate'],'tree':a['tree']}
(O/'configuration.json').write_text(json.dumps(configuration,indent=2))
leaves=a['flatLeaves'];entries={};standing=0
for i,leaf in enumerate(leaves):
 for d in pathlib.Path(leaf).iterdir():
  if d.name in ('info','alternates'):continue
  if d.is_dir() and (len(d.name)==2 or d.name=='pack'):
   for f in d.iterdir():
    if f.is_file() and not f.name.endswith('.lock'):
     entries.setdefault((d.name,f.name),(i,f))
for key,(i,f) in entries.items():standing+=f.stat().st_blocks*512
projected=len(leaves)*4096+len(set(k[0] for k in entries))*4096+3*2**20
gate('flat-projected',projected)
v=O/'v';v.mkdir()
for i,leaf in enumerate(leaves):(v/str(i)).symlink_to(leaf)
for (d,n),(i,f) in entries.items():
 target=O/'flat'/d/n;target.parent.mkdir(parents=True,exist_ok=True)
 target.symlink_to('../../v/'+str(i)+'/'+d+'/'+n)
(O/'standing-inputs.json').write_text(json.dumps({'flatLeaves':leaves,'uniqueFiles':len(entries),'standingBytes':standing,'newLinksProjected':projected,'tools':{p:{'realpath':os.path.realpath(p),'bytes':pathlib.Path(os.path.realpath(p)).stat().st_size} for p in ['/usr/bin/node','/usr/bin/git','/usr/bin/python3']},'readOnly':True},indent=2))
print('pins verified; flat view files',len(entries),'standing',standing,'projected',projected)
