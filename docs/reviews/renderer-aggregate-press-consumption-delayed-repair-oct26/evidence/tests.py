from task import *
def test(label,path,expected=0):
 args=['node','--max-old-space-size=16','--test',str(path)]
 p=S.run(args,cwd=REPO,env=ENV,stdout=S.PIPE,stderr=S.PIPE,timeout=30)
 assert len(p.stdout)+len(p.stderr)<=2097152
 (OPS/(label+'.log')).write_bytes(p.stdout+p.stderr)
 result={'label':label,'command':args,'exitCode':p.returncode,'expectedExit':expected,'fixtureSha256':sha(P.Path(path).read_bytes()),'rendererSha256':sha((REPO/'lib/renderer-input.js').read_bytes()),'log':label+'.log','logSha256':sha(p.stdout+p.stderr)}
 write(label+'.json',result)
 print(label,p.returncode, '\n'.join(p.stdout.decode().splitlines()[-8:]))
 assert p.returncode==expected
 return result
def checkpoint(results,remaining):
 write('checkpoint.json',{'candidate':git('rev-parse','HEAD').decode().strip(),'source':sha((REPO/'lib/renderer-input.js').read_bytes()),'fixtures':{str(p.relative_to(REPO)):sha(p.read_bytes()) for p in (REPO/'test').glob('*.cjs')},'groups':results,'remaining':remaining})
if __name__=='__main__':
 measure('baseline')
 result=test('baseline-unchanged-aggregate',OPS/'aggregate-latch-repro.cjs',1)
 checkpoint([result],['implementation','focused regression','affected prior fixtures','commit and verified push'])
