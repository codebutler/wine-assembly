"""Independent real-program controls. Reuse only the candidate's fixture setup/run,
then supply separate assertions and deliberate boundary fault injections.
Production source is unchanged except named rejecting mutants/fault injections.
"""
import pathlib,os
H0=pathlib.Path(__file__).resolve().parents[1];R0=H0/'repo'
test=R0/'test/test-enigma-supervisor-output.py'
s=test.read_text();marker="    row, runner = run('accept', 'single-frame')";assert s.count(marker)==1
prefix=s.split(marker)[0]
custom=r'''
    # Fault token straddles an 8192-byte read boundary of the real pipe.
    js=js.replace("if(mode==='flood-fast')", "if(mode==='split-fault'){send(1,Buffer.alloc(8190,65));send(2,Buffer.from('RuntimeError: split boundary fault\\n'));setInterval(()=>{},1000);return;}\nif(mode==='flood-fast')")
    row,runner=run('split-fault','single-frame')
    assert row['exit']!=0 and not row['dependentRan']
    assert row['receipt']['reason']=='first-observable-fault',row
    assert row['retainedBytes']>=8190+len('RuntimeError:')
    for kind in ['short-write','write-eio','flush-eio','close-eio']:
        faultclass="""class FaultLog:
 def __init__(self,raw):self.raw=raw
 def write(self,data):
  if KIND=='short-write':return self.raw.write(data[:-1])
  if KIND=='write-eio':raise OSError(5,'independent retained write EIO')
  return self.raw.write(data)
 def flush(self):
  if KIND=='flush-eio':raise OSError(5,'independent retained flush EIO')
  return self.raw.flush()
 def close(self):
  self.raw.close()
  if KIND=='close-eio':raise OSError(5,'independent retained close EIO')
""".replace('KIND',repr(kind))
        def inject(s):
            s=once(s,'H=pathlib.Path',faultclass+'\nH=pathlib.Path')
            return once(s,"log=open(E/'output.log','wb');p=", "log=open(E/'output.log','wb');log=FaultLog(log);p=")
        row,runner=run('accept-case-'+kind,'single-frame',inject)
        assert row['exit']!=0 and not row['dependentRan'],row
        expected='retained output short write' if kind=='short-write' else 'independent retained '+kind.split('-')[0]+' EIO'
        assert expected in row['stderr'],row
    # Exercise the actual cleanup, then fail its return boundary.
    def cleanup_error(s):
        return once(s,'def limits():',"real_stop=stop\ndef stop(p):\n real_stop(p)\n raise OSError(5,'independent cleanup EIO')\ndef limits():")
    row,runner=run('fail-case-cleanup-error','single-frame',cleanup_error)
    assert row['exit']!=0 and not row['dependentRan'] and 'independent cleanup EIO' in row['stderr'],row
    # A child which fails without a receipt or recognized fault must still fail.
    js=js.replace("if(mode==='flood-fast')", "if(mode==='plain-nonzero'){process.exit(7);}\nif(mode==='flood-fast')")
    row,runner=run('plain-nonzero','single-frame')
    assert row['exit']!=0 and not row['dependentRan'] and row['receipt']['returncode']==7,row
    guard="if capture_terminal is None and (why!='natural' or p.returncode):raise SystemExit(1)\n"
    row,runner=run('plain-nonzero-case-mutant','single-frame',lambda s:once(s,guard,''))
    assert row['exit']==0 and row['dependentRan'] and row['receipt']['returncode']==7,row
    row['mutationRejected']=True
    # Independently reject final-drain and retention removal using real EOF race/flood.
    row,runner=run('flood-eof','single-frame')
    assert row['exit']!=0 and not row['dependentRan'] and row['retainedBytes']==131072,row
    row,runner=run('flood-eof-case-independent-mutant','single-frame',lambda s:once(s,'  output.drain()\n  if output.capped','  pass\n  if output.capped'))
    assert row['exit']==0 and row['dependentRan'] and row['retainedBytes']==126000,row
    row['mutationRejected']=True
    try:
        run('flood-fast-case-independent-mutant','single-frame',lambda s:once(s,'self.capped=self.bytes==131072','self.capped=False').replace('min(8192,131072-self.bytes)','8192'))
    except AssertionError as error:
        mutant=error.args[0]
        assert isinstance(mutant,dict) and mutant['retainedBytes']==240000,mutant
        outcomes.append(dict(mutant,mutationRejected=True,productionCapAccepted=False))
    else:raise AssertionError('retention removal accepted')
    result=dict(passTests=True,independentFullProgram=True,deploymentAdaptation=adaptation,outcomes=outcomes)
    (pathlib.Path(evidence)/'independent-result.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))
'''
os.environ['ENIGMA_SUPERVISOR_TEST_EVIDENCE']=str(H0/'ops/independent-source')
exec(compile(prefix+custom,str(test),'exec'),{'__file__':str(test),'__name__':'__main__'})
