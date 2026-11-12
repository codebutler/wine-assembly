import json,sys
from transfer import run,REMOTE,E
c=json.loads(sys.argv[1]);out=REMOTE+'/run'
v=run("import pathlib,json;p=pathlib.Path(%r);n=len(list(p.glob('*.json')));f=p/(str(n)+'.json');assert not f.exists();f.write_text(%r);print(n)"%(out+'/commands',json.dumps(c)))
with (E/'control.jsonl').open('a') as f:f.write(json.dumps(dict(command=c,receipt=v))+'\n')
print(v)
