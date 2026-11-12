from work import *
old=pathlib.Path('/tmp/enigma-recovered-lossless-startup-oct24')
# Retain the previous charged capture/session history verbatim; historical FAILs stay FAIL.
(H/'capture-history.json').write_bytes((old/'capture-history.json').read_bytes())
save('remote-admission.json',py('import os,json,pathlib,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024)))'))
measure('pretransfer')
# Same failclosed bounded streaming algorithm, direct standing payloads to remote target.
code=(old/'stage.py').read_text().replace("R='/tmp/enigma-provider-complete-startup-oct24'",'R='+repr(R)).replace("if i%50==0:","if i%500==0:")
(H/'stage.py').write_text(code)
ns={'__name__':'stage','__file__':str(H/'stage.py')};exec(compile(code,str(H/'stage.py'),'exec'),ns)
for name in ['capture.cjs','supervise.py','supervise-original.py','preflight.py','validate-tree.cjs','guest-args.json','next-env.json']:
 ns['send']((H/name).read_bytes(),name)
for name in json.load(open(H/'standing-identities.json'))['pins']:
 ns['send']((H/'repo'/name).read_bytes(),'accepted/'+name)
save('preflight-api.json',remote('python3 '+shlex.quote(R+'/preflight.py'),65))
save('tree-validation-api.json',remote('node --max-old-space-size=256 '+shlex.quote(R+'/validate-tree.cjs'),60))
code='''const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const base=ROOT,adapter=path.join(base,'accepted/tools/enigma-terminal-capture-guard.cjs');
const sibling=require.resolve('./lossless-capture-png.cjs',{paths:[path.dirname(adapter)]});
assert.strictEqual(sibling,path.join(base,'accepted/tools/lossless-capture-png.cjs'));
const sh=x=>crypto.createHash('sha256').update(fs.readFileSync(x)).digest('hex');
for(const [name,pin] of Object.entries(PINS))assert.equal(sh(path.join(base,'accepted',name)),pin);
const t=require(adapter),capture=path.join(base,'capture.cjs');
assert.strictEqual(sh(capture),'6d64a146f2daf8b598dbf13e3c13f890dbc783d8f5286aacba6d343758d22079');
const transformed=t.transformLosslessCapture(fs.readFileSync(capture,'utf8'),'single-frame');
assert(transformed.includes(JSON.stringify(sibling)));
const s=t.transformSupervisor(fs.readFileSync(path.join(base,'supervise-original.py'),'utf8'));
assert.equal(crypto.createHash('sha256').update(s).digest('hex'),TRANSFORMED);
assert(s.includes('artifact_profiles={"default":131072,"single-frame":2097152}'));
assert(s.includes('resource.setrlimit(resource.RLIMIT_FSIZE,(artifact_file_limit,artifact_file_limit))'));
assert.equal(sh(path.join(base,'supervise.py')),DEPLOYED);
const p=path.join(base,'ordinary-write-probe');fs.writeFileSync(p,'ordinary-user');assert.equal(fs.readFileSync(p,'utf8'),'ordinary-user');
console.log(JSON.stringify({sibling,adapter,originalCaptureSHA256:sh(capture),absoluteSiblingBound:true,ordinaryUserWrite:true,actualCompleteSupervisor:true,kernelArtifactLimit:2097152,outputLimit:131072,profile:'single-frame'}));'''.replace('ROOT',json.dumps(R)).replace('PINS',json.dumps(json.load(open(H/'standing-identities.json'))['pins'])).replace('TRANSFORMED',json.dumps(json.load(open(H/'supervisor-identity.json'))['acceptedTransformed'])).replace('DEPLOYED',json.dumps(json.load(open(H/'supervisor-identity.json'))['deployed']))
save('sibling-resolution-api.json',remote('node --max-old-space-size=256 -e '+shlex.quote(code),60))
info=json.loads(py('import pathlib,json;h=pathlib.Path('+repr(R)+');print(json.dumps(dict(materialized=sum(p.lstat().st_blocks*512 for p in [h,*h.rglob("*")]))))')['stdout'])
measure('ready',info['materialized']);print('READY remote full rehash, ordinary user/dependencies/tree and accepted supervisor composition PASS',flush=True)
