import pathlib,json,hashlib,shutil,difflib
O=pathlib.Path(__file__).parent;R=O.parent/'repo';D=pathlib.Path('/tmp/maelstrom-diagnostic-changed-module-native-oct26/repo');P=pathlib.Path('/tmp/maelstrom-uop-canonical-native-qualification-oct26');sha=lambda b:hashlib.sha256(b).hexdigest()
for p,h in [('tools/maelstrom-diagnostic-canonical-build.cjs','5e017d86566fc64d7e2f4e0357cfb4e8e54e53152995a6c0317f2a5da9d98b3f'),('test/maelstrom-diagnostic-canonical-native.cjs','ddb0d889541d32dddd881b168d6a69a85610050c1d56679765cec1c1531c65e2')]:
 assert sha((D/p).read_bytes())==h
 q=O/(pathlib.Path(p).name+'.immutable');q.write_bytes((D/p).read_bytes())
# Accepted helper remains byte exact. The composed select helper pins alone migrate
# over reviewed removal of unrelated opt-in NULL diagnostics. All once anchors remain.
assert sha((R/'tools/maelstrom-native-errno-latch.cjs').read_bytes())=='3ea873bc5c18283fc6045b55d00a2e957eaff46b4372534dd59fba18354a9f6f'
changes=json.load(open(O/'changed-pins.json'));q=R/'tools/maelstrom-select-completion-hook.cjs';s=q.read_text()
for row in changes.values():assert s.count(row['old'])==1;s=s.replace(row['old'],row['new'])
q.write_text(s)
s=(P/'repo/tools/maelstrom-diagnostic-canonical-build.cjs').read_text();a=s.index('const m=');b=s.index('const hookPath=',a)
s=s[:a]+'''const m=JSON.parse(fs.readFileSync(H+'/current-manifest.json'));
assert.equal(m.candidate,'e486b6814a00518a6d9cb14ef376e69ab2f92c49');
assert.equal(m.sourceCount,128);assert.equal(m.sourceBytes,20713733);
const packed=fs.readFileSync(H+'/sources.json.gz');assert.equal(sha(packed),m.bundleSHA256);
const originals=Object.fromEntries(Object.entries(JSON.parse(zlib.gunzipSync(packed))).map(([p,b])=>[p,Buffer.from(b,'base64')]));
const inputSeals=m.files.map(row=>{const b=row.path.startsWith('src/')?originals[row.path]:fs.readFileSync(ROOT+'/'+row.path);assert.equal(b.length,row.bytes,row.path);assert.equal(sha(b),row.sha256,row.path);return {...row};});
assert.equal(Object.keys(originals).length,128);
'''+s[b:]
s=s.replace("'b7c77c20b12cd582d6fcfbe246e1f0abdcb644266fc3f161bf5d683d93b13930'",repr(sha(q.read_bytes())))
s=s.replace("canonicalScope:'exact sealed historical closure; not current production',acceptedIntegration:'e745cc29a1a3b859625aa0cd335abee0b185da71'","canonicalScope:'exact current-main closure',acceptedIntegration:m.candidate").replace("candidate:'e745cc29a1a3b859625aa0cd335abee0b185da71'","candidate:m.candidate")
s=s.replace("assert.equal(sha(fs.readFileSync(STANDING+'/sources.json.gz')),projection.bundleSHA256);","assert.equal(sha(fs.readFileSync(H+'/sources.json.gz')),m.bundleSHA256);")
(R/'tools/maelstrom-diagnostic-canonical-build.cjs').write_text(s)
q=R/'test/maelstrom-diagnostic-canonical-native.cjs';q.parent.mkdir(exist_ok=True);prev=pathlib.Path('/tmp/maelstrom-uop-retained-native-closeout-oct26/repo/test/maelstrom-diagnostic-canonical-native.cjs');q.write_bytes(prev.read_bytes());(O/'native-adaptation.diff').write_text(''.join(difflib.unified_diff((D/'test/maelstrom-diagnostic-canonical-native.cjs').read_text().splitlines(True),q.read_text().splitlines(True))))
for name in ['stage.py','remote-run.py','account.py']:
 s=(P/'ops'/name).read_text().replace('maelstrom-uop-canonical-native-qualification-oct26','maelstrom-current-main-uop-build-native-oct26').replace('01a17730-8b6c-7343-bfda-d05145ae2af7','01a17760-c040-73e1-97d8-0224b44ae0b9')
 if name=='stage.py':s=s[:s.index("if __name__=='__main__':")];s=s.replace("['boat','--json'","['boat','--no-update','--json'")
 if name=='remote-run.py':
  s=s.replace('/tmp/wine-ops-heavy-runtime.lock','/tmp/wine-qualification-heavy.lock').replace('cpu=600','cpu=300').replace('wall=600','wall=300').replace('2097152,2097152','25165824,25165824').replace("assert datetime.datetime.now(datetime.timezone.utc)<cutoff","assert datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=300 if stage=='compiler' else 60)<cutoff")
  s=s.replace("MNE_CANONICAL_ROOT=str(H/'canonical')","MNE_CANONICAL_ROOT='/home/user/maelstrom-uop-canonical-native-qualification-oct26/canonical'").replace("MNE_ANCHORS=str(O/'anchors')","MNE_ANCHORS='/home/user/maelstrom-uop-canonical-native-qualification-oct26/ops/anchors'")
 (O/name).write_text(s)
(O/'runtime.json').write_text(json.dumps(dict(guestCutoff='2026-10-26T09:05:00Z',handback='2026-10-26T09:10:00Z',shutdown='2026-10-26T09:20:00Z',expiry='2026-10-26T09:48:43.654Z')))
(O/'adaptation.json').write_text(json.dumps(dict(currentMain='e486b6814a00518a6d9cb14ef376e69ab2f92c49',helperUnchanged=True,selectPinChanges=changes,reason='Only removed unrelated NULL diagnostic instrumentation in dispatch and exports; exact select and native boundary anchors retained and checked by once; no production source substitution',fixtureCorrections='Retained accepted UOP warm/exclusion/counter isolation and reason3 mode4 controls, immutable base independently hash verified',files={str(p.relative_to(R)):sha(p.read_bytes()) for p in R.rglob('*.cjs')}),indent=2))
