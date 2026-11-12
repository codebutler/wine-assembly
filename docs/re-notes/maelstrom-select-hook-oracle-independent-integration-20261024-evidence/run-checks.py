import subprocess,pathlib,json,hashlib,sys
ops=pathlib.Path(__file__).parent;repo=ops.parent/'repo';original=pathlib.Path('/tmp/maelstrom-select-hook-independent-closeout-oct24/ops')
seals={'independent.cjs':'d1df14e939930b69dcc9be85044899c35850feac2445748f088bafb5e3595735','evaluator-blindspot.cjs':'80ae181ca91029309875de76dde45fb2502779f9440deda025bd266b812ec614'}
for n,h in seals.items():assert hashlib.sha256((original/n).read_bytes()).hexdigest()==h
checks=[(['node','test/test-maelstrom-select-completion-hook.cjs','/home/user/wine-assembly-shadow-man-span-static-canonical-oct23'],0),(['node','test/test-maelstrom-select-hook-repair.cjs','/home/user/wine-assembly-shadow-man-span-static-canonical-oct23'],0)]
for n in ['independent.cjs','evaluator-blindspot.cjs']:checks.append((['node',str(original/n)],1))
for n in ['independent.cjs','evaluator-blindspot.cjs','source-controls.cjs']:checks.append((['node',str(ops/'path-binding.cjs'),str(original/n)],0))
checks.append((['node',str(ops/'unchanged-source.cjs')],0))
for f in ['tools/maelstrom-select-completion-hook.cjs','test/maelstrom-select-hook-model.cjs','test/test-maelstrom-select-hook-repair.cjs']:checks.append((['node','--check',f],0))
results=[]
for argv,expected in checks:
 p=subprocess.run(['python3',str(ops/'guard.py'),*argv],cwd=repo,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 results.append({'argv':argv,'expected':expected,'exit':p.returncode,'output':p.stdout.decode()})
 print(json.dumps({'check':argv[1:3],'exit':p.returncode,'expected':expected}))
 (ops/'tested.json').write_text(json.dumps({'candidate':'f0facf0a89c17dc877894a6d76181bf40ab1a409','exactTestedTree':subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=repo,text=True).strip(),'checks':results,'originalSHA256':seals,'realWasm':False,'runtimeGate':'UNRESOLVED'},indent=2))
 assert p.returncode==expected
