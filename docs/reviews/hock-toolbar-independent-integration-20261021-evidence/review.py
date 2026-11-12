import hashlib,json,pathlib,subprocess,tarfile,io,urllib.parse
root=pathlib.Path(__file__).resolve().parent
repo=root/'repo'
sha=lambda b:hashlib.sha256(b).hexdigest()
base='71bc4a6d07387c18725da334983d25c6290fed40'
def git(*args):return subprocess.check_output(['git',*args],cwd=repo)
archive=repo/'docs/reviews/hock-toolbar-options-repair-20261021-evidence.tgz'
assert sha(archive.read_bytes())=='25f97cff2c9f12bdfea9f4e9b97c450a4a08d7d2516baa5e867746c518834fdc'
with tarfile.open(archive) as t:
    members={m.name.removeprefix('hock-toolbar-options-repair/'):t.extractfile(m).read() for m in t if m.isfile()}
def j(n):return json.loads(members[n])
coverage={}
association=repo/'docs/reviews/hock-browser-route-gameplay-20261021-evidence.tgz'
with tarfile.open(association) as t:
    a={m.name.removeprefix('hock-browser-route-gameplay/'):t.extractfile(m).read() for m in t if m.isfile()}
aseals=json.loads(a['SHA256SUMS.json']);assert len(aseals)==43
for n,h in aseals.items():assert sha(a[n])==h,n
coverage['association']=43
for prefix,count in [('',102),('runtime/',85)]:
    seals=j(prefix+'SHA256SUMS.json');assert len(seals)==count
    for n,h in seals.items():assert sha(members[prefix+n])==h,n
    coverage[prefix or 'outer']=len(seals)
ident=j('runtime/identity-final.json')
for n,h in ident['changed'].items():assert sha(git('show','HEAD:'+n))==h,n
assert sha(git('show','HEAD:test/test-browser-launch-options.js'))==sha(members['runtime/test-browser-launch-options.js'])
assert git('diff',base,'HEAD','--','src','tools','lib/vendor','host.js')==b''
assert members['runtime/prior-build.exit'].strip()==b'0'
assert b'Build complete: build/wine-assembly.wasm (1878508 bytes)' in members['runtime/prior-build.log']
seals=j('runtime/prior-accepted-package-seals.json');assert len(seals)==44
game={n:h for n,h in seals.items() if n.startswith('game/')};assert len(game)==39
responses=j('runtime/input-aimed/responses.json')
exe=next(r for r in responses if r['url'].endswith('/BBLOOGIE.EXE'))
assert exe['sha256']==game['game/BBLOOGIE.EXE'] and exe['status']==200
wasm=next(r for r in responses if '.wasm?' in r['url'])
assert wasm['sha256']==ident['wasmSha256'] and wasm['status']==200
manifest=next(r for r in responses if r['url'].endswith('.wine-assembly-browser.json'))
assert manifest['sha256']==ident['manifestSha256'] and manifest['status']==200
bundle=next(r for r in responses if '__bundle?' in r['url'])
files=urllib.parse.parse_qs(urllib.parse.urlparse(bundle['url']).query)['f']
assert len(files)==38 and bundle['status']==200
assert {n.split('/hock-a-loogie-1995/')[1] for n in files}==set(game)-{'game/BBLOOGIE.EXE'}
events=j('runtime/input-aimed/events.json');assert len(events)==113
assert events[0]['action']=='select' and events[0]['value']=='hock_a_loogie'
assert events[1]['selector']=='button[onclick="launchApp()"]'
runtime=j('runtime/input-aimed/runtime.json');assert runtime['entry'].endswith('/emulator/?debug')
driver=members['runtime/input-aimed.cjs'].decode();assert 'await page.goto(entry,' in driver and 'await page.goto(route,' not in driver
assert not any('error' in x or '[launchApp] failed' in x.get('text','') for x in j('runtime/input-aimed/console.json'))
for n in ['browser-selected.png','selection.png','shot-00.png','final.png']:
    (root/n).write_bytes(members['runtime/input-aimed/'+n])
(root/'negative-controls.cjs').write_bytes(members['negative-controls.cjs'])
result={'archiveSha256':sha(archive.read_bytes()),'seals':coverage,'changedSourceHashes':ident['changed'],'sourceTestMatches':True,'unchangedCompileInputs':True,'priorCanonicalBuildExit':0,'identityReceipt':ident,'packageSeals':44,'gameFiles':39,'bundleCompanions':38,'exe':exe,'wasm':wasm,'manifest':manifest,'events':len(events),'runtime':runtime,'runtimeReplayed':False}
(root/'evidence-review.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
