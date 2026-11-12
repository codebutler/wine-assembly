from work import *
old=pathlib.Path('/tmp/enigma-recovered-lossless-startup-oct24')
accepted=pathlib.Path('/tmp/enigma-accepted-lossless-startup-oct24')
manifest=(P/'manifest.json').read_bytes();assert sha(manifest)=='4ccbdd4e9bab80a88bf9565f813681c5369e4b16ef5dcd34291b87c361a793fe'
m=json.loads(manifest)
args=json.load(open(accepted/'guest-args.json'))
args=[x.replace(str(P),R) for x in args]
assert len([x for x in args if x.startswith('--input=')])==1
assert args[-1]=='--input=30000:png:'+R+'/guest/startup.png'
if '--quiet-fs' not in args:args.append('--quiet-fs')
save('guest-args.json',args)
s=payload(m[0]).decode();assert sha(s.encode())=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
parser=s[s.index('const getArg ='):s.index('// Was `--name=...`')]
code='const assert=require("assert"),args='+json.dumps(args[7:])+';'+parser+';assert.deepEqual(getArgs("vfs-tree"),['+json.dumps(R+'/vfs')+']);assert.equal(getArgs("vfs-mount").length,0);assert.equal(getArgs("dlls").length,8);assert(hasFlag("no-build"));assert(hasFlag("quiet-fs"));console.log("PASS exact argv canonical parser")'
r=subprocess.run(['node','--max-old-space-size=256','-e',code],capture_output=True,text=True,timeout=60,preexec_fn=lambda:resource.setrlimit(resource.RLIMIT_CPU,(60,60)))
save('precheckout-parser.json',dict(status=r.returncode,stdout=r.stdout,stderr=r.stderr,argv=args,parserSHA256=sha(parser.encode()),enumeratedFiles=len([x for x in m if x['target'].startswith('vfs/')]),commaFilenames=[x['target'] for x in m if ',' in x['target']],fullEnumeration=str(P/'manifest.json')));assert r.returncode==0
save('remote-admission.json',py('import os,json,pathlib,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024)))'))
measure('precheckout')
repo=H/'repo';repo.mkdir()
subprocess.run(['git','init','-q',str(repo)],check=True)
# Resolve the complete alternate graph as read-only paths, writing one deduplicated file.
roots=[];seen=set()
def add(p):
 p=p.resolve()
 if str(p) in seen:return
 seen.add(str(p));roots.append(str(p))
 f=p/'info/alternates'
 if f.exists():
  for line in f.read_text().splitlines():
   q=pathlib.Path(line);add(q if q.is_absolute() else p/q)
add(D/'.git/objects')
(repo/'.git/objects/info/alternates').write_text('\n'.join(roots)+'\n')
pins=json.load(open(accepted/'standing-identities.json'))['acceptedPaths'];pins.update(json.load(open('/home/user/wine-assembly/scratch/usage-watch/enigma-api-single-frame-startup-oct26-dispatch.json'))['pins']);pins={p:v for p,v in pins.items() if not p.startswith('/')}
pins['tools/enigma-supervisor-output.py']='2d8e66d5e0c42513a6b21b62e897fccaa152c54b93d4e68e5e5595b8b3350d9a'
git('config','core.sparseCheckout','true');git('config','core.sparseCheckoutCone','false')
(repo/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in pins)+'\n/docs/re-notes/enigma-api-single-frame-startup-20261026.md\n/docs/re-notes/enigma-api-single-frame-startup-20261026/\n')
git('checkout','-b','task/enigma-api-single-frame-startup-oct26',REV)
git('config','user.name','Wine Ops');git('config','user.email','wine-ops@local');git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
for p,pin in pins.items():assert sha((repo/p).read_bytes())==pin,(p,pin)
save('standing-identities.json',dict(donor=str(D),revision=REV,pins=pins,alternates=roots,standingManifest=str(P/'manifest.json'),standingManifestBytes=sum(x['bytes'] for x in m),standingModule='/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm',standingCodec='/home/user/wine-assembly/scratch/usage-watch/shadow-man-codec-recovery-oct22/node_modules/pngjs',historicalFailures='All retained prior source/storage/kernel/capture failures remain FAIL; no resets or reruns',acceptedControlsReceipt='/home/user/wine-assembly/scratch/usage-watch/enigma-supervisor-output-coordinator-accept-oct24.json'))
for name in ['capture.cjs','supervise-original.py']:(H/name).write_bytes((old/name).read_bytes())
assert sha((H/'capture.cjs').read_bytes())=='6d64a146f2daf8b598dbf13e3c13f890dbc783d8f5286aacba6d343758d22079'
assert sha((H/'supervise-original.py').read_bytes())=='73be15954cedc19340779ff6bda2397cb94927ca702d2baebdccd5e763cf7b73'
code='const fs=require("fs"),t=require('+json.dumps(str(repo/'tools/enigma-terminal-capture-guard.cjs'))+');fs.writeFileSync('+json.dumps(str(H/'supervise-transformed.py'))+',t.transformSupervisor(fs.readFileSync('+json.dumps(str(H/'supervise-original.py'))+',"utf8")));'
subprocess.run(['node','--max-old-space-size=256','-e',code],check=True,timeout=60)
s=(H/'supervise-transformed.py').read_text();assert "1792835520,'latest start09:52UTC'" in s
schedule=json.load(open('/home/user/wine-assembly/scratch/usage-watch/enigma-api-single-frame-startup-oct26.task.runtime.json'))
import datetime
cutoff=int(datetime.datetime.fromisoformat(schedule['guestCutoff'].replace('Z','+00:00')).timestamp())
s=s.replace("1792835520,'latest start09:52UTC'",str(cutoff)+",'latest start05:35UTC'").replace('bx_fvkjwxap',BOX).replace('shutdown09:57UTC','shutdown05:50UTC').replace('2026-10-24T10:02:44.741Z',schedule['expiry'])
(H/'supervise.py').write_text(s)
env={k:v.replace(str(P),R) for k,v in json.load(open(accepted/'next-env.json')).items()};env['ENIGMA_CAPTURE_PROFILE']='single-frame';save('next-env.json',env)
save('supervisor-identity.json',dict(original=sha((H/'supervise-original.py').read_bytes()),acceptedTransformed=sha((H/'supervise-transformed.py').read_bytes()),deployed=sha(s.encode()),configurationOnly=['lateststart05:35UTC','box','shutdown05:50UTC','expiry'],schedule=schedule,selectedKernelArtifactLimit=2097152,combinedOutputLimit=131072,environment=env))
# Remote-only manifest targets; never create a full local payload copy.
(H/'manifest.json').write_bytes(manifest)
pf=(old/'preflight.py').read_text().replace(str(P),R)
(H/'preflight.py').write_text(pf)
(H/'validate-tree.cjs').write_text((old/'validate-tree.cjs').read_text().replace(str(P),R))
measure('prepared');print('PREPARED exact parser, sparse pins, full accepted supervisor')
