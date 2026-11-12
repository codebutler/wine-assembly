import guard as g,json,subprocess,hashlib
B=g.B;m=json.loads((B/'focused-manifest.json').read_text());p='src/09a8-handlers-directx.wat'
b=subprocess.check_output(['git','-C',m['donor'],'show',m['revision']+':'+p]);assert len(b)<g.FILE
m['files'].append({'path':p,'bytes':len(b),'blob':subprocess.check_output(['git','-C',m['donor'],'rev-parse',m['revision']+':'+p],text=True).strip(),'sha256':hashlib.sha256(b).hexdigest()});m['selectedBytes']+=len(b)
assert m['selectedBytes']==2388036, 'changed dependency closure needs review'
g.write(B/'focused-manifest.json',m);s=g.sample();remaining=max(0,8388608-s['privateBytes'])+16777216+8388608
assert s['measuredNew']+remaining<=g.LIMIT and s['hostFree']-remaining>=2982150144
g.write(B/'expanded-admission.json',{'selectedBytes':m['selectedBytes'],'files':len(m['files']),'projection':s['measuredNew']+remaining,'hostAfter':s['hostFree']-remaining,'PASS':True})
with (B/'repo/.git/info/sparse-checkout').open('a') as f:f.write('/'+p+'\n')
g.run(['git','-C',str(B/'repo'),'read-tree','-mu','HEAD'],phase='python')
print('additional authentic fill_primcaps dependency admitted',len(b))
text=(B/'repo'/p).read_text();start=text.index('  (func $fill_primcaps ');print(text[start:start+3600])
w=(B/'repo/src/09ab-handlers-d3dim-core.wat').read_text();print('GLOBALS',*[l for l in w.splitlines() if any(s in l for s in ['(global $D3DIM_OFF_TEX_STAGE','(global $d3dim_dbg_tex_last','(global $gl_sw_white'])])
