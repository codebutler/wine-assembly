from control import *
gate('acceptance-decision')
pins=json.load(open(O/'pins.json'))
assert all(c.sha((R/p).read_bytes())==s for p,s in pins['sourcePins'].items())
E=DONOR/'repo/docs/reviews/alien-terminal-dispatch-boundary-repair-oct26'
manifest=json.load(open(E/'evidence-manifest.json'))
# Root already verified all174; inspect retained group logs and hash their retained exact bytes.
names=['original','crashes','production','early-terminal','unit','omission','postwal-omission','partial-http','boundary-3-final']+['boundary-'+str(i) for i in range(10)]
reused={}
for name in names:
 files={}
 for suffix in ('-execution.json','-output.log'):
  p=E/(name+suffix);b=p.read_bytes();expected=manifest[p.name]
  assert len(b)==expected['bytes'] and c.sha(b)==expected['sha256'],p
  files[p.name]=expected
 execution=json.load(open(E/(name+'-execution.json')))
 assert execution['reason']=='natural' and execution['exit']==0 and execution['peakSampledRSS']<=execution['physicalCap']
 log=(E/(name+'-output.log')).read_text()
 if name.startswith('boundary-') and name!='boundary-3-final':
  rows=[json.loads(line) for line in log.splitlines() if line.startswith('{')]
  assert {r['where'] for r in rows}=={'connected-before-bytes','durable-intent','request-prepared'}
  assert all(r['index']==int(name.split('-')[1]) and r['sends']==r['index'] and r['restartSentNothing'] for r in rows)
 if name in ('omission','postwal-omission'):assert 'unchangedRegressionRejected": true' in log and 'FAILED (failures=1)' in log
 else:assert '\nOK\n' in log
 reused[name]=files
assert c.sha((E/'fixture-before-partial-extension.py').read_bytes())=='23ba75c2da14b090cc9b62dcf31e3c0dcb4191858e11187235b920931ba729ba'
assert c.sha((R/'test/test-alien-terminal-dispatch-boundary-oct26.py').read_bytes())=='7728be1d23f0d203e7b774a873f233f8872f18b2980da5b691dfad787436856b'
save('retained-groups-reviewed.json',dict(candidate=REV,tree=TREE,donorPublishedBranch='task/alien-terminal-dispatch-boundary-repair-oct26',manifestSHA256=c.sha((E/'evidence-manifest.json').read_bytes()),rootVerified174=True,reviewedGroups=reused,fixtureBeforePartial='23ba75c2da14b090cc9b62dcf31e3c0dcb4191858e11187235b920931ba729ba',fixtureFinal='7728be1d23f0d203e7b774a873f233f8872f18b2980da5b691dfad787436856b',allHTTPBoundaryPositions=30,customTransportPositions=10,actualProcessExitCases=4,rerun=False))
for n in ['first-production','independent-focused']:
 e=json.load(open(O/(n+'-execution.json')));assert e['exit']==0 and e['reason']=='natural'
assert json.load(open(O/'independent-latch-positive.json'))['wireBytes']==0
mutant=json.load(open(O/'independent-latch-mutant.json'));assert mutant['wireBytes']>0 and mutant['commands']==[dict(action='snapshot')]
source=(R/'test/helpers/alien-control-sequence.py').read_text()
assert 'self._store(state)\n                    # Intent persistence' in source
assert 'self._check_guest(state)\n                    if isinstance(self.transport, HttpTransport)' in source
assert 'self.connect()\n                before_send()\n                return super().send(data)' in source
cp=json.load(open(O/'checkpoint.json'));cp.update(verdict='ACCEPT_BOUNDED_OBSERVATION_REPAIR',remaining=['scoped-main-tree-integration','source-identity-and-affected-validation','taskbranch-and-main-normal-push-exact-verify'],independentTestSHA256=c.sha((R/'test/test-alien-dispatch-independent-oct27.py').read_bytes()));cp['completed']+=['retained-groups-reviewed-with-fixture-version-pins','independent-focused-three-tests','acceptance-decision'];save('checkpoint.json',cp)
save('review.json',dict(verdict='ACCEPT_BOUNDED_OBSERVATION_REPAIR',candidate=REV,tree=TREE,pins=pins['sourcePins'],actualGroups=['unchanged historical reproducer via actual CLI main + real HTTP','three new independent tests: disabled entry and offline collect; atomic terminal rename with failed latch store and zero-wire refusal/pending WAL/no replay after terminal removal; final-guard mutation rejected'],reusedGroups=list(reused),sourceChangedInAcceptance=False,scope='Observed terminal after durable intent and at each HTTP header/body write; independent writer can publish between final check and write. Partial headers already sent cannot be retracted. No atomic writer/send, powerloss, guest or gameplay acceptance.',queuedACKIsGuestAcceptance=False,productionHelperSHA256=pins['sourcePins']['test/helpers/alien-control-sequence.py'],remaining=cp['remaining']))
print('ACCEPT bounded observation repair; passed groups retained; merged-tree integration/publication still pending.')
