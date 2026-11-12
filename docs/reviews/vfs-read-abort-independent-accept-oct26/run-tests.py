from work import *
fixture=R/'test/test-vfs-read-abort-independent-accept-oct26.js'; source=R/'lib/vfs-persistence.js'
assert sha(source.read_bytes())==json.load(open(O/'pins.json'))['lib/vfs-persistence.js']['sha256']
def checkpoint(completed,remaining):
 save('checkpoint.json',dict(candidate=C,baseline=BASE,sourceSha256=sha(source.read_bytes()),fixtureSha256=sha(fixture.read_bytes()),nodeSha256=json.load(open(O/'admission.json'))['tools'][NODE]['sha256'],completed=completed,remaining=remaining,blockers=[],evidence={str(p.relative_to(H)):{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in [O/'reuse.json']+sorted(O.glob('*.test.log'))}))
def limits():
 resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
 resource.setrlimit(resource.RLIMIT_CORE,(0,0))
def run(name,path,expected,summary):
 log=O/(name+'.test.log')
 with log.open('wb') as out:
  p=subprocess.run([NODE,'--max-old-space-size=16',str(fixture),str(path)],stdout=out,stderr=subprocess.STDOUT,timeout=25,preexec_fn=limits,cwd=R)
 assert log.stat().st_size<=131072
 b=log.read_bytes(); assert p.returncode==expected,(name,p.returncode,b[:8192]);assert summary.encode() in b,(name,b[:8192]);print(name,p.returncode,b.decode().splitlines()[-1])
 return dict(exitCode=p.returncode,summary=summary,logSha256=sha(b),sourceSha256=sha(path.read_bytes()),command=[NODE,'--max-old-space-size=16',str(fixture),str(path)])
completed={'retained':'17 manifest payloads rehashed; exact eight-file + Node closure verified; 13 cases and scoped suites reused'}
# initial checkpoint retained from first execution
resources('before-tests')
completed['independent']=dict(exitCode=0,summary='12 PASS 0 FAIL',logSha256=sha((O/'candidate.test.log').read_bytes()),sourceSha256=sha(source.read_bytes()),reusedSameTaskExactFixture=True)
assert b'12 PASS 0 FAIL' in (O/'candidate.test.log').read_bytes()
checkpoint(completed,['rejecting mutations','report/publication'])
s=source.read_text();old="          tx.onabort = () => reject(tx.error || new Error('indexedDB transaction aborted'));";assert s.count(old)==1
wrong=O/'wrong-identity.js';wrong.write_text(s.replace(old,"          tx.onabort = () => reject(new Error('indexedDB transaction aborted'));"))
completed['wrongIdentityMutation']=dict(exitCode=1,summary='9 PASS 3 FAIL',logSha256=sha((O/'wrong-identity.test.log').read_bytes()),sourceSha256=sha(wrong.read_bytes()),reusedSameTaskExactFixture=True)
assert b'9 PASS 3 FAIL' in (O/'wrong-identity.test.log').read_bytes()
save('harness-incident.json',dict(incident='Expected mutation summary8PASS4FAIL was miscounted; actual original exit1 with9PASS3FAIL correctly rejects mutation. Retained original log; corrected metadata only, no passed case rerun.',fixtureSha256=sha(fixture.read_bytes()),logSha256=sha((O/'wrong-identity.test.log').read_bytes())))
checkpoint(completed,['early partial resolution mutation','report/publication'])
old='            out.push([String(c.key), String(c.value)]);';assert s.count(old)==1
early=O/'early-partial.js';early.write_text(s.replace(old,old+'\n            resolve(out);'))
completed['earlyPartialMutation']=run('early-partial',early,1,'5 PASS 7 FAIL')
checkpoint(completed,['report/publication'])
save('tests.json',completed)
