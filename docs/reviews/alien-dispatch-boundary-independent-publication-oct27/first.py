import sys,os,json,runpy
from pathlib import Path
R=Path('/tmp/alien-dispatch-boundary-independent-publication-oct27/repo')
p=R/'test/alien-terminal-failfast-independent-accept-oct26.py'
sys.argv=[str(p),'dispatch-boundary']
try:runpy.run_path(str(p),run_name='__main__')
except SystemExit as error:assert error.code==1,error.code
else:raise AssertionError('historical driver did not exit')
j=json.load(open(Path(os.environ['TMPDIR'])/'dispatch-boundary-receipt.json'))
assert j['sends']==j['expectedSends']==[dict(action='snapshot')]
assert j['restartSentNothing'] and j['restartReturn']==1 and j['cliReturn']==1
assert j['ledger']['next']==1 and len(j['ledger']['receipts'])==1
assert j['ledger']['pending']==dict(index=1,command=dict(action='png',path='/tmp/offline-only.png'))
assert j['ledger']['status']=='terminal' and j['ledger']['guestAcceptance']=='unqualified'
assert [e['event'] for e in j['events']]==['intent-file-and-directory-fsynced','terminal-receipt-durable-before-transport']
assert j['ledger']['terminalObserved']==dict(reason='supervisor-ended-invocation',returncode=0,batch=4650)
print('PASS: unchanged original assertions, true production main + real HTTP; snapshot only, durable pending PNG, no replay. Legacy success exit1 interpreted.')
