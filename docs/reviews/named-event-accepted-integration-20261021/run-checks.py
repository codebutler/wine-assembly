from pathlib import Path
import subprocess,json,shutil,time
out=Path(__file__).resolve().parent; repo=out/'repo'; (out/'logs').mkdir(exist_ok=True)
results=[]
for t in json.loads((out/'commands.json').read_text()):
 allocated=int(subprocess.check_output(['du','-s','-B1',str(out)]).split()[0]);free=shutil.disk_usage(out).free
 assert allocated<64*1024**2 and free>2285895680,(allocated,free)
 start=time.monotonic()
 p=subprocess.run(t['command'],cwd=repo,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=90)
 log=out/'logs'/f"{t['name']}.log";log.write_bytes(p.stdout)
 valid=p.returncode==t['expected'] and (t['expected']!=1 or b'AssertionError' in p.stdout)
 results.append(dict(name=t['name'],command=t['command'],expected=t['expected'],exit=p.returncode,passed=valid,seconds=round(time.monotonic()-start,3),log=str(log.relative_to(out))))
 (out/'tests.json').write_text(json.dumps(results,indent=2))
 print(t['name'],p.returncode,'PASS' if valid else 'UNEXPECTED',flush=True)
