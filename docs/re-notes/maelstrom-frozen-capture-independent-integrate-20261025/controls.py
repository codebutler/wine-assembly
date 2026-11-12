import pathlib,json,sys
from guard import run
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo'
controls=['stored-result','call-identity','wrong-module','wrong-argv','live-substitution','historical-substitution','park-as-completion','missing-terminal','remaining-group','multiple-guests']
rows=[]
for n in controls:
 j=run('reject-'+n,[sys.executable,str(O/'verify.py'),str(R),n]);assert j['returncode']!=0,n
 error=(O/('reject-'+n+'.stderr')).read_text().splitlines()[-1]
 assert error.startswith('ValueError:'),error
 rows.append(dict(control=n,actuallyRejected=True,returncode=j['returncode'],reason=error,remainingGroup=j['remainingGroup']))
(O/'controls.json').write_text(json.dumps(dict(unchangedPass=json.loads((O/'retained-pass.json').read_text())['returncode']==0,controls=rows,scope='offline receipt/provenance; no new runtime equivalence'),indent=2)+'\n')
print(json.dumps(rows))
