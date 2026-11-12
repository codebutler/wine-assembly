"""Independent additional omissions at actual retry, root, and runner controls."""
import independent as x
import json,hashlib,time
helper=x.ORIGINAL;runner=x.WRAPPER;results=[]
cases=[('discarded-retry-version-retention','helper',b'self.present = set()',b'self.present = set(); self.required_seen = {} if attempt else self.required_seen',x.versions,'discarded retry'),
       ('mutable-root-regular-only','helper',b'if p in self.mutable_files and not stat.S_ISREG(s.st_mode):',b'if False:',x.mutable,'mutable directory'),
       ('mutable-explicit-root-only','helper',b'if not self.mutable_files.issubset(self.roots):',b'if False:',x.mutable,'nonroot mutable exception'),
       ('production-alloc-hook','runner',b'used=alloc(H);',b'used=0;',x.versions,'production/rewrite'),
       ('production-headroom','runner',b'if free<2982150144:',b'if False:',x.bounds,'')]
for name,target,old,new,test,expected in cases:
    path=x.HELPER if target=='helper' else x.RUNNER;original=helper if target=='helper' else runner
    assert original.count(old)==1
    try:
        path.write_bytes(original.replace(old,new));x.sup=x.load();x.WRAPPER=x.RUNNER.read_bytes()
        failure=None
        try:test()
        except AssertionError as e:failure=str(e)
        assert failure is not None and expected in failure,(name,failure)
        results.append(dict(omittedActualControl=name,expectedRejection=failure))
    finally:
        x.HELPER.write_bytes(helper);x.RUNNER.write_bytes(runner);x.sup=x.load();x.WRAPPER=runner
assert x.HELPER.read_bytes()==helper and x.RUNNER.read_bytes()==runner
j=dict(status='PASS',results=results,helperSHA256=hashlib.sha256(helper).hexdigest(),runnerSHA256=hashlib.sha256(runner).hexdigest(),fixtureSHA256=hashlib.sha256(x.P(__file__).read_bytes()).hexdigest())
(x.O/'targeted-omissions-result.json').write_text(json.dumps(j,indent=2)+'\n')
c=json.loads((x.O/'checkpoint.json').read_text());c['completed'].append('five targeted production/retry/root omissions PASS');c['latest']=j;c['at']=time.time();p=x.O/'checkpoint.new';p.write_text(json.dumps(c,indent=2));p.replace(x.O/'checkpoint.json')
print(json.dumps(j))
