import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import time

H = Path(__file__).parent
TASK = H.parent
LAUNCH = Path('/home/user/wine-assembly/scratch/usage-watch/enigma-staging-footprint-repair-oct26')
SESSION = Path('/home/user/.codex/sessions/2026/10/26/rollout-2026-10-26T07-13-19-01a1770e-79e4-7b12-bcda-f98d4f47660a.jsonl')

def allocated(path):
    if not path.exists():
        return 0
    seen = set()
    total = 0
    for p in [path, *path.rglob('*')] if path.is_dir() else [path]:
        st = p.lstat()
        key = st.st_dev, st.st_ino
        if key not in seen:
            total += st.st_blocks * 512
            seen.add(key)
    return total

baseline = json.loads((H/'sqlite-baseline.json').read_text())
positive = sum(max(0, allocated(Path(p))-n) for p,n in baseline.items())
high = H/'sqlite-highwater.json'
positive = max(positive, json.loads(high.read_text())['bytes'] if high.exists() else 0)
high.write_text(json.dumps(dict(bytes=positive)))
external = allocated(SESSION)+allocated(LAUNCH)
external += sum(allocated(Path(str(LAUNCH)+suffix)) for suffix in ['.task.txt','.task.runtime.json','.admission.json'])
charges = dict(taskTree=allocated(TASK), launcherAndSession=external,
               positiveSQLiteHighwaterOnce=positive, sessionWALFuture=12582912,
               testsTempAndGitPublicationFuture=16777216, reserve=8388608)
peak = sum(charges.values())
free = shutil.disk_usage(TASK).free
mem = int(Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
largest = max(p.stat().st_size for p in TASK.rglob('*') if p.is_file())
j = dict(at=time.time(),phase=sys.argv[1],charges=charges,measuredProjectedPeak=peak,
         projectedGrowthBound=58720256,cap=67108864,memAvailable=mem,client=536870912,
         testHeap=16777216,memoryFloor=805306368,freeDisk=free,diskFloor=2982150144,
         largest=largest,externalSession=str(SESSION),positiveSQLiteBaseline=baseline)
j['pass'] = (peak<=58720256 and mem-553648128>=805306368 and
             free-58720256>=2982150144 and largest<=25165824)
(H/('admission-'+sys.argv[1]+'.json')).write_text(json.dumps(j,indent=2)+'\n')
print(json.dumps({k:v for k,v in j.items() if k!='positiveSQLiteBaseline'}))
assert j['pass'], 'operation resource rejection'
