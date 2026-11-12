import sys,importlib.util,json,hashlib,os
from pathlib import Path
sys.dont_write_bytecode=True
s=importlib.util.spec_from_file_location('r',str(Path(__file__).with_name('run.py')));r=importlib.util.module_from_spec(s);s.loader.exec_module(r);g=r.g
g.admission('tests')
ops=g.OPS;repo=g.REPO
base=g.run(['git','show','397cdb6ca37c1f247cdd6e2618f6e1f3529342c4:lib/save-sync.js'])[1];(ops/'baseline-save-sync.js').write_bytes(base)
candidate=(repo/'lib/save-sync.js').read_bytes();assert hashlib.sha256(base).hexdigest()=='0c26053d75655e1a5117cb635980c0a60df0b33f339dd64f3b6eb8718f260875'
# Inject exact source without changing checkout or donor. No original test main executes except the selected suite.
(ops/'supplied.js').write_text("require('./load-source'); require('../repo/test/test-save-sync-owned-upload.js');\n")
(ops/'load-source.js').write_text("const fs=require('fs'),Module=require('module'),path=require('path'); const filename=path.resolve(__dirname,'../repo/lib/save-sync.js'); if(process.env.ACCEPT_SOURCE){const m=new Module(filename);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(fs.readFileSync(process.env.ACCEPT_SOURCE,'utf8'),filename);require.cache[filename]=m;}\n")
source=(repo/'test/test-save-bundle.js').read_text();idx=source.index('async function main()')
body=source[:idx]+"testUrls(); testSyncDeadline().then(()=>console.log('PASS existing URL and deadline checks: '+checks)).catch(e=>{console.error(e);process.exitCode=1;});\n"
(ops/'offline.js').write_text("const Module=require('module'),path=require('path');const filename=path.resolve(__dirname,'../repo/test/test-save-bundle.js');const m=new Module(filename);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile("+json.dumps(body)+",filename);\n")
results=[]
def test(label,file,source=None,expected=0):
 if source:g.env['ACCEPT_SOURCE']=str(source)
 else:g.env.pop('ACCEPT_SOURCE',None)
 code,out=g.run(['node','--max-old-space-size=128',str(file)],check=False);(ops/(label+'.log')).write_bytes(out)
 text=out.decode();summary=[x for x in text.splitlines() if x.startswith(('# tests','# pass','# fail','PASS','ℹ tests','ℹ pass','ℹ fail','ℹ cancelled'))]
 results.append(dict(label=label,exitCode=code,expected=expected,summary=summary));print(label,code,summary)
 assert code==expected,(label,text[-2000:])
test('baseline-supplied',ops/'supplied.js',ops/'baseline-save-sync.js',1)
test('candidate-supplied',ops/'supplied.js')
test('baseline-independent',ops/'independent.js',ops/'baseline-save-sync.js',1)
test('candidate-independent',ops/'independent.js')
test('existing-validation',repo/'test/test-save-sync-upload-validation.js')
test('existing-offline',ops/'offline.js')
mutants={
 'alias':candidate.replace(b'bytes = new Uint8Array(bytes);',b'bytes = bytes;'),
 'copy-after-validation':candidate.replace(b'bytes = new Uint8Array(bytes);',b'').replace(b'const manifest = bundleModule(options).readBundle(bytes, options).manifest;',b'const manifest = bundleModule(options).readBundle(bytes, options).manifest; bytes = new Uint8Array(bytes);'),
 'redundant-upload-copy':candidate.replace(b'async function uploadOwned(options, bytes) {',b'async function uploadOwned(options, bytes) { bytes = new Uint8Array(bytes);'),
 'skip-local-app-check':candidate.replace(b'if (options.appId && manifest.appId !== options.appId) {',b'if (false) {'),
}
for label,data in mutants.items():
 assert data!=candidate
 p=ops/('mutant-'+label+'.js');p.write_bytes(data);test('reject-'+label,ops/'independent.js',p,1)
g.env.pop('ACCEPT_SOURCE',None)
(ops/'tests.json').write_text(json.dumps(results,indent=2))
