import subprocess,json,sys,pathlib
E=pathlib.Path(__file__).resolve().parent
name=sys.argv[1]; command=sys.argv[2]
p=subprocess.run(['boat','exec','--timeout','0','bx_pfv6b6wu','--','bash','-lc',command],capture_output=True,text=True)
(E/(name+'.receipt')).write_text(p.stdout+p.stderr)
print(p.stdout[-14000:]);print(p.stderr);sys.exit(p.returncode)
