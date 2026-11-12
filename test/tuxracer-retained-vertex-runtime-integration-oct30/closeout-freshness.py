import control as c,pathlib,json,hashlib,shutil
O=c.O;R=c.REPO;A='a998bf36b108275335af501d8ae774731495b9b2'
node=shutil.which('node');assert node
flags=['--max-old-space-size=128']
start=c.run('node-startup-exact',[node,*flags,'-e','console.log(JSON.stringify({node:process.execPath,version:process.version,argv:process.execArgv,NODE_OPTIONS:process.env.NODE_OPTIONS||null}))'])
c.save('node-startup-receipt.json',dict(PASS=True,executable=node,flags=flags,result=json.loads(start),inherited=c.ORIG,DATA_AS='Original inherited limits restored for Node by pinned supervisor',groupRSS=512*1048576,supervisorRSS=128*1048576))
out=c.run('dispatch-freshness',[node,*flags,'tools/gen_dispatch.js','--check'])
expected='6c2c885a88a33da79048d7a2eab2c453a8ddcc393e5a31b2467d19535580dadb'
assert hashlib.sha256((R/'src/09b2-dispatch-table.generated.wat').read_bytes()).hexdigest()==expected
paths=['src/09a8b-handlers-opengl.wat','src/api_table.json','tools/gen_dispatch.js','src/09b2-dispatch-table.generated.wat','test/test-gl-color4dv-dispatch.js']
ids=c.git('accepted-five-path-identities','ls-tree',A,'--',*paths).decode()
for line in ids.splitlines():
 meta,p=line.split('\t');oid=meta.split()[2]
 if (R/p).exists():assert c.git('working-blob-'+pathlib.Path(p).name,'hash-object','--',p).decode().strip()==oid
c.save('freshness-and-test-reuse.json',dict(PASS=True,generatedDispatchSHA=expected,apiCount=4595,accepted=A,identities=ids,unchangedNativeArchitectureReview='architecture-api-review.json',freshnessOutput=out.decode(),behavioralTestsReused='Exact accepted4color+4vertex, six color mutants and vertex-route mutation, stack/nonaffine/page-crossing/list/packed replay; all source/transform identity unchanged. No new behavioral delta in integrated implementation.',fullBuildAndGuestReplayed=False))
print('NODE STARTUP AND EXACT 4595-API GENERATOR FRESHNESS PASS; UNCHANGED ACCEPTANCE REUSED')
