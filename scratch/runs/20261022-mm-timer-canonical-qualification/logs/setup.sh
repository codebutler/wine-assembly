set -euo pipefail
cd /home/user/timer-qualification
python3 - <<'PY'
import hashlib,json,tarfile,os
assert os.statvfs('.').f_bavail*os.statvfs('.').f_frsize>2147483648
with tarfile.open('candidate-source.tar.gz') as t:t.extractall('.',filter='data')
m=json.load(open('source-manifest.json'))
for f in m['files']:
 assert hashlib.sha256(open(f['path'],'rb').read()).hexdigest()==f['sha256'],f['path']
print('Verified exact candidate manifest',len(m['files']))
PY
git init -q
git index-pack --stdin < candidate-metadata.pack
printf '%s\n' ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c > .git/shallow
git update-ref refs/heads/qualification ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c
git symbolic-ref HEAD refs/heads/qualification
git read-tree HEAD
node --version
sha256sum "$(command -v node)"
git rev-parse HEAD
npm ci --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund
npm ls --omit=dev --omit=optional
