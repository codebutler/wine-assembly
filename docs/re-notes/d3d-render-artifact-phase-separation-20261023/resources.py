import os,sys,glob,json,hashlib,shutil
from pathlib import Path
P=Path(__file__).parent
def digest(file):
    h=hashlib.sha256()
    with open(file,'rb') as f:
        for b in iter(lambda:f.read(1048576),b''):h.update(b)
    return h.hexdigest()
def inventory(root):
    return {str(p):p.stat().st_size for p in Path(root).rglob('*') if p.is_file() and not p.is_symlink()}
private=inventory(P)
wal={f:os.path.getsize(f) for pat in ('/home/user/.codex/*-wal','/home/user/.codex/*-shm') for f in glob.glob(pat)}
sessions=glob.glob('/home/user/.codex/sessions/2026/10/23/*01a16a43-ab6f*')
external=inventory('/home/user/wine-assembly/scratch/usage-watch/d3d-render-artifact-phase-separation-oct23')
logs={f:os.path.getsize(f) for f in sessions};logs.update(external)
projected=sum(wal.values())+sum(logs.values())+8388608+16777216+8388608
tools={}
for name in ('node','python3','git','ssh'):
    path=os.path.realpath(shutil.which(name));tools[path]=dict(bytes=os.path.getsize(path),sha256=digest(path))
result=dict(private_bytes=sum(private.values()),private_cap=8388608,largest_private=max(private.values()),
    wal_shm=wal,external_sessions=logs,future_growth=16777216,reserve=8388608,projected=projected,
    host_after=shutil.disk_usage(P).free-projected,limit=67108864,standing_tools=tools,
    standing_readonly_git_donor_bytes=sum(inventory('/home/user/wine-assembly/.git/objects').values()),
    captured_bytes=int((P/'capture-count').read_text()),capture_limit=524288)
result['pass']=result['private_bytes']<=8388608 and result['largest_private']<=25165824 and projected<=67108864 and result['host_after']>=2982150144
(P/(sys.argv[1] if len(sys.argv)>1 else 'resources.json')).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['private_bytes','largest_private','projected','host_after','captured_bytes','pass']}))
assert result['pass']
