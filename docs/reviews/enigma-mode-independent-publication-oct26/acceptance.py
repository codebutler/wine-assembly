from common import *
import sys
name,fixture,group,expected=sys.argv[1:]
admission('pre-'+name)
rc,out,err=run([sys.executable,'-B',H/'run-group.py',name,fixture,group,expected])
result=json.loads((H/('checkpoint-'+name+'.json')).read_text())
assert result['matchedExpected']
if name=='old-identity-contract':assert 'PermissionError' in (H/(name+'.stderr')).read_text()
cp=json.loads((H/'checkpoint.json').read_text())
cp['completed'].append(dict(name=name,candidate=V,testedTree=git('rev-parse','HEAD^{tree}')[1].decode().strip(),fixtureSHA256=sha(H/fixture),helperSHA256=sha(R/'tools/enigma-bounded-staging.py'),result=result,receipt=str(H/('checkpoint-'+name+'.json')),note='run-group baseCandidate field is inherited historical baseline; actual candidate bound here'))
cp['remaining']=[x for x in cp['remaining'] if x!=name]
save('checkpoint.json',cp)
print(json.dumps(dict(name=name,result='EXPECTED_FAILURE_RETAINED' if int(expected) else 'PASS',candidate=V)))
