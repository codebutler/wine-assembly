import hashlib
import json
from pathlib import Path
import resource
import subprocess

H = Path(__file__).parent
R = H.parent/'repo'
def limits():
    resource.setrlimit(resource.RLIMIT_DATA, (16777216, 16777216))
    resource.setrlimit(resource.RLIMIT_FSIZE, (25165824, 25165824))
    resource.setrlimit(resource.RLIMIT_CPU, (60, 60))
cmd = ['python3', '-B', str(R/'test/test-enigma-bounded-staging.py')]
p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                   timeout=90, preexec_fn=limits)
assert len(p.stdout)+len(p.stderr)<=131072
(H/'tests.stdout').write_bytes(p.stdout)
(H/'tests.stderr').write_bytes(p.stderr)
j = dict(command=cmd, status=p.returncode, heapDataLimit=16777216, fileLimit=25165824,
         cpuLimit=60, stdoutSHA256=hashlib.sha256(p.stdout).hexdigest(),
         stderrSHA256=hashlib.sha256(p.stderr).hexdigest(),
         sourceSHA256=hashlib.sha256((R/'tools/enigma-bounded-staging.py').read_bytes()).hexdigest(),
         testSHA256=hashlib.sha256((R/'test/test-enigma-bounded-staging.py').read_bytes()).hexdigest())
(H/'tests.json').write_text(json.dumps(j, indent=2)+'\n')
print(p.stdout.decode())
print(p.stderr.decode())
assert p.returncode == 0
