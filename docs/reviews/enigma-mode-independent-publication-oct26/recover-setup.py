from common import *
import sys
# Prior setup completed pinned streaming verification and trusted ls-remote.
# Only tool inventory construction failed; no checkout had started.
save('incident-tool-path.json',dict(error='Python standing-tool path /usr/bin/python3.11 absent',resolution='use actual sys.executable',noOperationDenial=True,pinnedChecksCompleted=True))
repair='docs/reviews/enigma-staging-mode-preservation-repair-oct26';ar='docs/reviews/enigma-staging-footprint-independent-accept-oct26'
pins={p:sha(D/p) for p in json.loads((D/repair/'closure.json').read_text())}
pins['test/test-enigma-staging-modes.py']=sha(D/'test/test-enigma-staging-modes.py')
manifest=json.loads((D/repair/'evidence-manifest.json').read_text())
refs={'refs/heads/main':MAIN,'refs/heads/task/enigma-staging-mode-preservation-repair-oct26':V}
objects=set()
def visit(p):
 p=p.resolve()
 if p in objects:return
 objects.add(p);a=p/'info/alternates'
 if a.exists():
  for x in a.read_text().splitlines():visit(Path(x) if Path(x).is_absolute() else p/x)
for repo in [D,A,ROOT]:visit(repo/'.git/objects')
paths=sorted(set(pins)|{ar,repair,E})
rows=(H/'capture.stdout').read_text().splitlines()
size=sum(int(x.split('\t')[0].split()[3]) for x in rows)
assert size<8388608
source=Path(__file__).with_name('setup.py').read_text()
exec(compile(source[source.index("save('inputs.json'"):],str(H/'setup.py'),'exec'))
