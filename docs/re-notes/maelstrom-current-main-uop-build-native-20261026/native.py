from stage import *
import sys,subprocess,gzip
s=(O/'remote-corrected.py').read_text().replace("resource-corrected-compile.json","resource-PLACEHOLDER.json").replace("O/'resource-PLACEHOLDER.json'","O/('resource-'+case+'.json')")
(O/'remote-native-corrected.py').write_text(s);put(O/'remote-native-corrected.py',REMOTE+'/ops/remote-native-corrected.py')
cases=['errno4','errno0','errno37','switch-pending','switch-complete','switch-call','stale-start','wrong-select-return','wrong-native-target','wrong-ebp','return-without-call','nested-call','foreign-thread','foreign-thread-ret','postframe','unsafe-errno','block-mode','code16-mode'];checkpoint=dict(sourceClosure='e486b6814a00518a6d9cb14ef376e69ab2f92c49',completed=[],remaining=[c+'-'+m for m in ['tail','compat'] for c in cases],historical36='retained unchanged historical; no offline acceptance replay')
def save():
 p=O/'checkpoint-native.tmp';p.write_text(json.dumps(checkpoint,indent=2));p.replace(O/'checkpoint-native.json')
save()
for compat in [False,True]:
 for case in cases:
  ev=case+('-compat' if compat else '-tail');subprocess.run([sys.executable,str(O/'account.py'),'resource-'+ev+'.json'],check=True,stdout=subprocess.DEVNULL);put(O/('resource-'+ev+'.json'),REMOTE+'/ops/resource-'+ev+'.json')
  cmd=['python3',REMOTE+'/ops/remote-native-corrected.py','native',ev,'/home/user/.nvm/versions/node/v24.22.1/bin/node','--max-old-space-size=512','--require','/home/user/maelstrom-uop-canonical-native-qualification-oct26/ops/native-module-bound.cjs',REMOTE+'/repo/test/maelstrom-diagnostic-canonical-native.cjs',case]+(['--compat'] if compat else [])
  try:call(cmd,'native-'+ev,65)
  except Exception as err:
   checkpoint['blocker']=ev;save()
   for ext in ['stdout','stderr']:
    r=py('import pathlib;print(pathlib.Path('+repr(REMOTE+'/ops/'+ev+'.'+ext)+').read_text())','failure-'+ev+'-'+ext);(O/('failure-'+ev+'.'+ext)).write_text(r['stdout']);print(r['stdout'][:8192])
   raise
  names=['native-result-'+ev+'.json','native-preflight-'+ev+'.json','attempt-'+ev+'.json','execution-'+ev+'.json',ev+'.stdout',ev+'.stderr']
  code='import pathlib,json,gzip,base64;O=pathlib.Path('+repr(REMOTE+'/ops')+');names='+repr(names)+';b=gzip.compress(json.dumps({n:(O/n).read_text() for n in names}).encode(),mtime=0);(O/'+repr('evidence-'+ev+'.json.gz')+').write_bytes(b);print(base64.b64encode(b).decode());(O/'+repr('native-result-'+ev+'.json')+').unlink();p=O/'+repr('native-progress-'+ev+'.json')+';p.exists() and p.unlink()'
  r=py(code,'retain-'+ev);b=base64.b64decode(r['stdout']);(O/('evidence-'+ev+'.json.gz')).write_bytes(b);files=json.loads(gzip.decompress(b));d=json.loads(files[names[0]]);assert d['status']=='PASS';row={k:d[k] for k in ['status','scenario','compat','moduleSHA256','capture','equivalent','warm']};row.update(evidence='evidence-'+ev+'.json.gz',evidenceSHA256=hashlib.sha256(b).hexdigest());checkpoint['completed'].append(row);checkpoint['remaining'].remove(ev);save();print(json.dumps(dict(case=ev,status='PASS',capture=d['capture']['status'],equivalent=d['equivalent'])),flush=True)
