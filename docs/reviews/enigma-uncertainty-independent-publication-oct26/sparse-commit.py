from common import *
V=R/'docs/reviews'/H.name
# The sparse candidate retains exact trees but intentionally omits unrelated blob payloads.
# Validate the new tree's entire path delta before using missing-ok on unchanged references.
assert g('ls-remote','origin','refs/heads/task/enigma-final-dispatch-uncertainty-repair-oct26').decode().split()[0]==REV
inc=json.load(open(O/'incidents.json'));inc.append(dict(kind='sparse index commit closure',firstFailure="git commit cannot build trees because unchanged unrelated blob90413573b25a8bc99486bb8bdb4c64e60b45188d is intentionally not materialized",resolution='write-tree --missing-ok retains original immutable unchanged tree references; exact complete tree diff restricted to own evidence dir, candidate remote parent verified, commit-tree parent exact candidate. No unrelated large historical evidence copied; no source changes.'))
save('incidents.json',inc)
for name in ['incidents.json','failures.jsonl','git-log.jsonl']:
 shutil.copyfile(O/name,V/name)
shutil.copyfile(O/'sparse-commit.py',V/'sparse-commit.py')
manifest=json.load(open(V/'evidence-manifest.json'))
manifest['payloads']={str(p.relative_to(R)):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(V.iterdir()) if p.is_file() and p.name!='evidence-manifest.json'}
(V/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
gate('sparse-commit')
g('add','--','docs/reviews/'+H.name);g('diff','--cached','--check')
tree=g('write-tree','--missing-ok').decode().strip()
paths=g('diff-tree','--no-commit-id','--name-only','-r',REV,tree).decode().splitlines();assert paths and all(p.startswith('docs/reviews/'+H.name+'/') for p in paths)
commit=g('commit-tree',tree,'-p',REV,input=b'docs(enigma): accept uncertainty repair, block incompatible runner publication\n').decode().strip()
g('update-ref','refs/heads/'+BR,commit,REV)
save('sparse-commit.json',dict(parent=REV,commit=commit,tree=tree,changedPaths=paths,recipe='git write-tree --missing-ok; entire diff-tree path delta checked; git commit-tree TREE -p EXACT_CANDIDATE; update-ref with expected parent; candidate remote parent verified'))
# Resume publication past the already-completed stage/commit.
s=(O/'publish.py').read_text();s=s[s.index("commit=g('rev-parse'"):]
exec(s)
