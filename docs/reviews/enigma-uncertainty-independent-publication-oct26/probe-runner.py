from common import *
gate('runner-probe')
print(g('ls-remote','origin','refs/heads/main').decode())
# Query only exact pinned object, no ref listing.
a=['git','cat-file','-s','4b8461338f4bcddde6b5d5504991523b28d3ac35']
p=subprocess.run(a,cwd=ROOT,capture_output=True,timeout=120,preexec_fn=lambda:limits(True),env=dict(os.environ,GIT_SSH_COMMAND=SSH))
save('runner-root-object-probe.json',dict(argv=a,exit=p.returncode,stdout=p.stdout.decode(),stderr=p.stderr.decode()))
print(p.returncode,p.stdout.decode(),p.stderr.decode()[:1000])
if p.returncode==0:
 b=g('cat-file','blob','4b8461338f4bcddde6b5d5504991523b28d3ac35',cwd=ROOT);(O/'tracked-run.js').write_bytes(b);print(len(b),sha(b))
