import subprocess,os,pathlib,json,hashlib
R=pathlib.Path('/home/user/wine-assembly-render-positiont-qualified-integrate-oct23');E=pathlib.Path(__file__).parent
C='95a12b641d2b9195762c4800a1db8e3b76a3ceee';B='bb9c496ed13095cc832fdf607f0937fb9c14b7de'
os.environ.update(GIT_NO_LAZY_FETCH='1',GIT_SSH_COMMAND='ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -i /home/user/.ssh/wine_github_ed25519',GIT_TERMINAL_PROMPT='0')
def git(*a):return subprocess.check_output(['git','-C',str(R),*a],timeout=45)
def save(n,b):(E/n).write_bytes(b)
remote=git('ls-remote','--heads','origin','main','task/render-positiont-reuse-independent-qualification-oct23');save('remote-before.txt',remote)
refs={r.split()[1]:r.split()[0] for r in remote.decode().splitlines()};M=refs['refs/heads/main'];assert refs['refs/heads/task/render-positiont-reuse-independent-qualification-oct23']==C
assert M=='6666ab7b28c9efca61c3ce6875c05da71111507a',('fresh main differs',M)
git('cat-file','-e',M+'^{commit}')
for x in [M,C]:git('merge-base','--is-ancestor',B,x)
mainPaths=git('diff','--name-only',B,M).decode().splitlines();owned=git('diff','--name-only',B,C).decode().splitlines();assert not set(mainPaths)&set(owned)
save('current-main-docs.patch',git('diff',B,M,'--','TODOS.md','docs/re-notes'));save('accepted-delta.patch',git('diff','--binary',B,C));save('accepted-delta-stat.txt',git('diff','--stat',B,C));save('ancestry.txt',git('log','--format=%H %P %s','--reverse',B+'..'+C))
def tree(rev):
 d={}
 for row in git('ls-tree','-r',rev).decode().splitlines():
  meta,p=row.split('\t');mode,kind,blob=meta.split();d[p]=(mode,blob)
 return d
mt,ct,bt=tree(M),tree(C),tree(B)
manifest=json.loads(git('show',C+':docs/re-notes/render-positiont-reuse-independent-qualification-20261023/source-manifest.json'))
assert len(manifest)==290 and sum(r['pin'] for r in manifest)==286
for r in manifest:
 assert tuple([r['mode'],r['blob']])==ct[r['path']]
 assert r['path'] not in mainPaths,('qualified input changed on main',r['path'])
review={'freshMain':M,'oldMain':B,'acceptedHead':C,'mainDeltaPaths':mainPaths,'acceptedDeltaPaths':owned,'overlap':[], 'pins':286,'closure':290,'proposedTree':{p:list(ct[p]) if p in ct else None for p in owned},'unrelatedMainEntries':len(mt)-len(set(owned)&set(mt))}
save('reconciliation.json',(json.dumps(review,indent=2)+'\n').encode())
print(json.dumps({'main':M,'mainDeltaPaths':mainPaths,'acceptedDeltaPaths':len(owned),'qualifiedPinsUnchanged':286,'closureModes':290}))
