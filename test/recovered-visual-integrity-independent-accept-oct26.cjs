'use strict';
// Independent public-API acceptance: all inputs are synthetic disposable roots.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const args=process.argv.slice(2),opt=k=>args[args.indexOf(k)+1];
const modulePath=args.includes('--module')?path.resolve(opt('--module')):path.resolve(__dirname,'../ops/recover-visuals.js');
const {recover,REPORTED_BUILD_LIMITATION}=require(modulePath);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const json=(p,v)=>fs.writeFileSync(p,JSON.stringify(v)+'\n');
const load=p=>JSON.parse(fs.readFileSync(p));
function snap(p){const rows=[];function walk(p){const s=fs.lstatSync(p,{bigint:true});rows.push([p,String(s.mode),String(s.mtimeNs),String(s.ctimeNs),s.isSymbolicLink()?fs.readlinkSync(p):s.isFile()?sha(fs.readFileSync(p)):null]);if(s.isDirectory())for(const k of fs.readdirSync(p).sort())walk(path.join(p,k));}walk(p);return rows;}
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'independent-visual-'));
 for(const d of ['ops','captures','test/candidate-corpus'])fs.mkdirSync(path.join(root,d),{recursive:true});
 const source=path.join(root,'captures/sample-1-after.png'),sourceResult=path.join(root,'captures/result.json');
 fs.writeFileSync(source,png);
 json(sourceResult,{app:'historical-app',wasmSha256:'d'.repeat(64),samples:2,results:[{},{}]});
 const entry={candidateId:'reviewed',sha256:sha(png),source:'captures/sample-1-after.png',evidence:['Explicit reviewed synthetic association'],sourceModifiedAt:'2002-01-01T00:00:00Z',scene:'old scene',summary:'old image',buildEvidence:{sourceResult:'captures/result.json',sourceResultSha256:sha(fs.readFileSync(sourceResult)),reportedWasmSha256:'d'.repeat(64),app:'historical-app',sampleIndex:1,basis:'Historical result association',limitation:REPORTED_BUILD_LIMITATION}};
 const mapping=path.join(root,'ops/historical-visuals.json');json(mapping,[entry]);json(path.join(root,'test/candidate-corpus/manifest.json'),{candidates:[{id:'reviewed'},{id:'other'}]});
 const dir=path.join(root,'scratch/runs/recovered-reviewed-'+entry.sha256.slice(0,16));
 return {root,dir,entry,mapping,source,sourceResult,file:n=>path.join(dir,n),edit(n,fn){const v=load(this.file(n));json(this.file(n),fn(v)??v);}};
}
const cases=[];
function test(n,fn){cases.push([n,fn]);}
function reject(f,change,pattern=/Invalid existing recovered bundle/){recover(f.root);change(f);const before=snap(f.root);let error;try{recover(f.root);}catch(e){error=e;}assert.ok(error,'expected rejection; actual successful recovery');assert.match(error.message,pattern);assert.deepEqual(snap(f.root),before,'rejection changed fixture');}
for(const v of [null,false,0,'',[],[{}]])for(const name of ['provenance.json','result.json'])test('json-type-'+name+'-'+JSON.stringify(v),f=>reject(f,()=>json(f.file(name),v)));
for(const n of ['screen.png','provenance.json','result.json'])test('directory-component-'+n,f=>reject(f,()=>{fs.unlinkSync(f.file(n));fs.mkdirSync(f.file(n));}));
for(const n of ['screen.png','provenance.json','result.json'])test('dangling-component-'+n,f=>reject(f,()=>{fs.unlinkSync(f.file(n));fs.symlinkSync(path.join(f.root,'absent'),f.file(n));}));
test('retained-png-hash',f=>reject(f,()=>fs.writeFileSync(f.file('screen.png'),Buffer.concat([png,Buffer.from('tamper')]))));
test('forged-candidate-pair',f=>reject(f,()=>{f.edit('provenance.json',v=>{v.candidateId='other';});f.edit('result.json',v=>{v.candidateId='other';});}));
test('provenance-only-evidence',f=>reject(f,()=>f.edit('provenance.json',v=>{v.evidence=['Unreviewed replacement'];})));
test('forged-build-pair',f=>reject(f,()=>{f.edit('provenance.json',v=>{v.buildEvidence.reportedWasmSha256='f'.repeat(64);});f.edit('result.json',v=>{v.build.wasmSha256='f'.repeat(64);});}));
test('forged-evidence-pair',f=>reject(f,()=>{f.edit('provenance.json',v=>{v.evidence=['Unreviewed replacement'];v.summary='Replaced';});f.edit('result.json',v=>{v.summary='Replaced';});}));
test('false-gameplay-result',f=>reject(f,()=>f.edit('result.json',v=>{v.outcome='pass';v.verification='reviewed';})));
test('source-unavailable-still-rejects',f=>reject(f,()=>{fs.rmSync(path.join(f.root,'captures'),{recursive:true});f.edit('result.json',v=>{v.build.commit='current';});}));
for(const prop of ['app','sourceResultSha256','sampleIndex','basis','limitation'])test('source-unavailable-build-schema-'+prop,f=>reject(f,()=>{fs.rmSync(path.join(f.root,'captures'),{recursive:true});f.entry.buildEvidence[prop]=null;json(f.mapping,[f.entry]);f.edit('provenance.json',v=>{v.buildEvidence=f.entry.buildEvidence;});},/Invalid reported build evidence/));
test('source-unavailable-build-identity',f=>reject(f,()=>{fs.rmSync(path.join(f.root,'captures'),{recursive:true});f.entry.buildEvidence.sourceResult='other/result.json';json(f.mapping,[f.entry]);f.edit('provenance.json',v=>{v.buildEvidence=f.entry.buildEvidence;});},/Build evidence capture identity mismatch/));
test('symlink-regular-component',f=>reject(f,()=>{const p=f.file('screen.png'),target=path.join(f.root,'target.png');fs.renameSync(p,target);fs.symlinkSync(target,p);}));
test('partial-provenance-only',f=>{recover(f.root);fs.unlinkSync(f.file('screen.png'));fs.unlinkSync(f.file('result.json'));const before=snap(f.root);assert.throws(()=>recover(f.root));assert.deepEqual(snap(f.root),before);});
function reverse(v){if(Array.isArray(v))return v.map(reverse);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).reverse().map(([k,v])=>[k,reverse(v)]));return v;}
test('nested-json-order-whitespace',f=>{recover(f.root);for(const n of ['provenance.json','result.json'])fs.writeFileSync(f.file(n),' \n'+JSON.stringify(reverse(load(f.file(n))),null,4)+' \n');fs.rmSync(path.join(f.root,'captures'),{recursive:true});const before=snap(f.dir);assert.equal(recover(f.root)[0].status,'already imported');assert.deepEqual(snap(f.dir),before);});
test('legacy-output-source-unavailable',f=>{assert.ok(args.includes('--baseline'),'baseline recipe required');const legacy=require(path.resolve(opt('--baseline')));assert.equal(legacy.recover(f.root)[0].status,'imported');const old=load(f.file('result.json'));assert.equal(old.build.wasmSha256,'d'.repeat(64));fs.rmSync(path.join(f.root,'captures'),{recursive:true});const before=snap(f.dir);assert.equal(recover(f.root)[0].status,'already imported');assert.deepEqual(snap(f.dir),before);assert.equal(load(f.file('result.json')).importedAt,old.importedAt);});
test('legacy-no-build-default-review',f=>{delete f.entry.buildEvidence;json(f.mapping,[f.entry]);const legacy=require(path.resolve(opt('--baseline')));legacy.recover(f.root);fs.rmSync(path.join(f.root,'captures'),{recursive:true});const before=snap(f.dir);assert.equal(recover(f.root)[0].status,'already imported');assert.deepEqual(snap(f.dir),before);assert.equal(load(f.file('result.json')).build.wasmSha256,null);});
let passed=0;
for(const [name,fn] of cases){if(args.includes('--case')&&opt('--case')!==name)continue;const f=fixture();try{fn(f);passed++;console.log('PASS '+name);fs.rmSync(f.root,{recursive:true});}catch(e){console.error(JSON.stringify({decision:'REJECT',name,modulePath,fixtureRoot:f.root,expected:'required public-API behavior and nonmutation',actual:e.message,stack:e.stack}));process.exitCode=1;break;}}
if(!process.exitCode){assert.ok(passed);console.log(JSON.stringify({passed,modulePath}));}
