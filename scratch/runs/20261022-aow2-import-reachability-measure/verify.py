import hashlib
import json
import pathlib
import subprocess
import tarfile

E = pathlib.Path(__file__).resolve().parent
W = E.parents[2]
def sha(data):
    return hashlib.sha256(data).hexdigest()

seals = json.loads((E / 'seals.json').read_text())
for row in seals:
    data = (E / row['path']).read_bytes()
    assert len(data) == row['size'] and sha(data) == row['sha256'], row['path']

receipt = json.loads((E / 'archive-receipt.json').read_text())
archive = E / 'evidence.tar.gz'
assert sha(archive.read_bytes()) == receipt['sha256']
copies = 0
with tarfile.open(archive) as bundle:
    for member in bundle.getmembers():
        if not member.isfile():
            continue
        exposed = E / 'raw' / member.name
        assert exposed.is_file(), member.name
        assert exposed.read_bytes() == bundle.extractfile(member).read(), member.name
        copies += 1

for filename, low, high in [('worker-gate-samples.json', 4, 8), ('worker-full-samples.json', 20, 30)]:
    file = E / 'raw/run' / filename
    if not file.exists():
        continue
    data = json.loads(file.read_text())
    samples = data['samples']
    count = samples[-1]['count'] - samples[0]['count']
    seconds = (samples[-1]['t'] - samples[0]['t']) / 1000
    assert count == len(data['events']) == data['frames']
    assert low <= seconds <= high and abs(seconds - data['seconds']) < 1e-9
    assert abs(count / seconds - data['fps']) < 1e-9
    code = "const fs=require('fs');const {validateSoftwareSamples:v}=require('./tools/arcanum-software-samples');const r=v(JSON.parse(fs.readFileSync(process.argv[1])),Number(process.argv[2]),Number(process.argv[3]));console.log(JSON.stringify(r));if(!r.ok)process.exit(1)"
    subprocess.run(['node', '-e', code, str(file), str(low), str(high)], cwd=W, check=True)

for script in ['tools/arcanum-presentation-counter.test.js', 'tools/arcanum-software-samples.test.js']:
    subprocess.run(['node', script], cwd=W, check=True)
print(json.dumps(dict(seals=len(seals), archiveCopies=copies, passed=True)))
