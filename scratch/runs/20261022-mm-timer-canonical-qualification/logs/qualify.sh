set -u
cd /home/user/timer-qualification
mkdir -p evidence
python3 - <<'PY'
import os
free=os.statvfs('.').f_bavail*os.statvfs('.').f_frsize
print('remote free bytes',free)
assert free>2147483648
PY
[ $? -eq 0 ] || exit 90
# No WINE compiler overrides or gate bypass. Exact canonical entry point.
bash tools/build.sh > evidence/build.log 2>&1
rc=$?
printf '%s\n' "$rc" > evidence/build.exit
cat evidence/build.log
[ "$rc" -eq 0 ] || exit "$rc"
sha256sum build/wine-assembly.wasm build/wine-assembly.compat.wasm > evidence/modules.sha256
node - <<'JS' > evidence/full-closure-identity.log 2>&1
const fs=require('fs'),crypto=require('crypto'),assert=require('assert');
const b=require('./test/compile-src').compileSrcWasm();
assert.deepStrictEqual(b,fs.readFileSync('build/wine-assembly.wasm'));
console.log('PASS untransformed full-test compile is byte-identical to canonical shipping module',crypto.createHash('sha256').update(b).digest('hex'));
JS
printf '%s\n' "$?" > evidence/full-closure-identity.exit
for test in test-mm-timer-callback test-mm-timer-thread test-wave-callback-wait; do
  node --require ./evidence/observe.cjs "test/$test.js" > "evidence/$test.log" 2>&1
  printf '%s\n' "$?" > "evidence/$test.exit"
  cat "evidence/$test.log"
done
python3 - <<'PY' > evidence/source-verification.json
import hashlib,json,os
m=json.load(open('source-manifest.json'));bad=[]
for f in m['files']:
 if hashlib.sha256(open(f['path'],'rb').read()).hexdigest()!=f['sha256']:bad.append(f['path'])
print(json.dumps({'verifiedFiles':len(m['files']),'mismatches':bad,'remoteFreeBytes':os.statvfs('.').f_bavail*os.statvfs('.').f_frsize}))
assert not bad
PY
