"""Verify retained historical inputs or print the actual tested argv for a new root.

No launch, allocation, acquisition, installation or compilation is performed.
Coordinator must assign a fresh box and repeat admission before any replay.
"""
import sys,json,pathlib,hashlib,subprocess,os
H=pathlib.Path(__file__).parent
if sys.argv[1]=='--verify-local':
 rows=json.loads((H/'complete-runtime-manifest.json').read_text());total=0
 for f in rows:
  if f['kind']=='git':
   b=subprocess.check_output(['git','-C','/home/user/wine-assembly-shadow-man-span-static-canonical-oct23','show','b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a:'+f['source']],env=dict(os.environ,GIT_NO_LAZY_FETCH='1'))
  else:b=pathlib.Path(f['source']).read_bytes()
  assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256'],f['dest'];total+=len(b)
 print(json.dumps(dict(verified=len(rows),bytes=total)))
elif sys.argv[1]=='--print-launch':
 root=sys.argv[2].rstrip('/');record=json.loads((H/'gameplay/guest-process.json').read_text())
 print(json.dumps([x.replace('/home/user/airstrike-retained-oct24',root) for x in record['argv']],indent=2))
else:raise SystemExit('use --verify-local or --print-launch NEW_REMOTE_ROOT; no runtime is launched')
