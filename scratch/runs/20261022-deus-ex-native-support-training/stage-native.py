"""Stage only the proven native CRT dependency through authorized Boat exec."""
import pathlib,json,subprocess,hashlib,base64,os
E=pathlib.Path(__file__).resolve().parent
R='/home/user/deus-ex-training'
BOX='bx_2gnkcnac'
def run(code,label):
 r=subprocess.run(['boat','exec',BOX,'--','python3','-c',code],capture_output=True,text=True)
 v=json.loads(r.stdout)
 with (E/'stage-receipts.jsonl').open('a') as f:f.write(json.dumps(dict(label=label,response=v))+'\n')
 assert r.returncode==0 and v['exitCode']==0,v
 return v
assert os.statvfs(E).f_bavail*os.statvfs(E).f_frsize>=2982150144
a=json.loads((E/'closure-audit.json').read_text())
api={x['name']:x['id'] for x in json.loads((E/'accepted-src--api_table.json').read_text())}
expected={'comctl32.dll':{'#17'},'shell32.dll':{'ShellExecuteA','ShellExecuteW','Shell_NotifyIconA'},'ole32.dll':{'CoCreateGuid','CoInitialize','CoUninitialize','CoCreateInstance'}}
for dll,names in expected.items():
 actual={s for n in a['active'] if n in a['game'] for s in a['game'][n]['imports'].get(dll,[])}
 assert actual==names,(dll,actual)
 for name in names:assert ('InitCommonControls' if name=='#17' else name) in api
assert "'COMCTL32.DLL#17': 'InitCommonControls'" in (E/'accepted-lib--host-imports.js').read_text()
crt=a['native']['msvcrt.dll'];assert set(crt['imports'])=={'kernel32.dll'}
assert all(n in api for n in crt['imports']['kernel32.dll'])
assert crt['exports']['_vsnwprintf']['rva'] and not crt['exports']['_vsnwprintf']['forwarder']
for use in a['supportUses']:
 if use['dll']=='msvcrt.dll':assert use['export']['rva'] and not use['export']['forwarder']
decision=dict(source=a['source'],native=['msvcrt.dll'],emulated={d:sorted(n) for d,n in expected.items()},reason='Existing accepted WAT handlers resolve all direct imports from comctl32/shell32/ole32. MSVCRT supplies authentic CRT exports and imports only known kernel32 APIs. No loader policy, API handler, game, or module modification.',limitations='Static support closure only; dynamic API reachability and Training runtime remain to be tested. Unresolved FindWindowExW in the original EXE is an existing API limitation, not a missing native support DLL.',sha256=crt['sha256'])
(E/'necessary-closure.json').write_text(json.dumps(decision,indent=2))
run("import pathlib,shutil;assert shutil.disk_usage('/home/user').free>2147483648;pathlib.Path(%r).mkdir(parents=True,exist_ok=True);pathlib.Path(%r).mkdir(exist_ok=True)"%(R+'/test/binaries/dlls',R+'/native-support-evidence'),'directories')
b=pathlib.Path(crt['path']).read_bytes();assert hashlib.sha256(b).hexdigest()==crt['sha256']
target=R+'/test/binaries/dlls/msvcrt.dll'
for offset in range(0,len(b),60000):
 run("import base64;open(%r,%r).write(base64.b64decode(%r))"%(target,'wb' if offset==0 else 'ab',base64.b64encode(b[offset:offset+60000]).decode()),'CRT chunk '+str(offset))
run("import hashlib,pathlib; p=pathlib.Path(%r);assert p.stat().st_size==%d;assert hashlib.sha256(p.read_bytes()).hexdigest()==%r;print(p)"%(target,len(b),crt['sha256']),'CRT hash verified')
print('PASS necessary native support staged and hash verified:',crt['sha256'])
