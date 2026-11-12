from work import *
O=H/'ops';dest=O/'collected';dest.mkdir(exist_ok=True)
names=['guest/output.log','guest/command.json','guest/terminal.json','tree-validation.json','manifest.json','identities.json']
code='import pathlib,json,hashlib;h=pathlib.Path('+repr(str(H))+');names='+repr(names)+';print(json.dumps([dict(path=n,bytes=(h/n).stat().st_size,sha256=hashlib.sha256((h/n).read_bytes()).hexdigest()) for n in names]))'
j=remote('python3 -c '+shlex.quote(code));rows=json.loads(j['stdout']);save('ops/collection-inventory-api.json',j);assert sum(x['bytes'] for x in rows)<=2097152
for x in rows:
 out=bytearray()
 for off in range(0,x['bytes'],24000):
  code='import pathlib,base64;print(base64.b64encode(pathlib.Path('+repr(str(H/x['path']))+').read_bytes()['+str(off)+':'+str(off+24000)+']).decode())'
  j=remote('python3 -c '+shlex.quote(code));out.extend(base64.b64decode(j['stdout'].strip()))
 assert len(out)==x['bytes'] and sha(out)==x['sha256'];p=dest/x['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(out)
log=(dest/'guest/output.log').read_text();events=[json.loads(s.split('[MAELSTROM-EVENT] ',1)[1]) for s in log.splitlines() if '[MAELSTROM-EVENT] ' in s];save('ops/events.json',events)
summary=[x for x in events if x['kind']=='summary'];boundaries=[x for x in events if x['kind']!='summary'];save('ops/observed-summary.json',dict(eventRecords=len(events),eventBytes=sum(len(('[MAELSTROM-EVENT] '+json.dumps(x,separators=(',',':'))+'\n').encode()) for x in events),boundaries=boundaries,summary=summary,terminal=json.load(open(dest/'guest/terminal.json'))))
print(json.dumps(dict(eventRecords=len(events),summary=summary,boundaries=boundaries),indent=2))
