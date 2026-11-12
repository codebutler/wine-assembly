from common import *
admission('premerge-final')
save('incident-related-ancestry-scope.json',dict(note='Initial conservative merge guard also encountered inherited Enigma capture documentation from the pinned candidate ancestry. Exact docs namespace explicitly admitted; no production paths added to allowance.',paths=['docs/re-notes/enigma-api-single-frame-startup-20261026.md','docs/re-notes/enigma-api-single-frame-startup-20261026/'],semanticConflict=False))
refs={'refs/heads/main':MAIN,'refs/heads/task/enigma-staging-mode-preservation-repair-oct26':V}
code=(H/'reuse-merge.py').read_text()
exec(compile(code[code.index("mb=git('merge-base'"):],str(H/'reuse-merge.py'),'exec'))
