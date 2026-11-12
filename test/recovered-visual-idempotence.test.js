#!/usr/bin/env node
'use strict';
// Disposable synthetic roots only: never invoke the CLI or read real captures.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const baseline=process.argv[2]==='--baseline';
const {recover,REPORTED_BUILD_LIMITATION}=require(baseline?path.resolve(process.argv[3]):'../ops/recover-visuals.js');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function fixture(build=false){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'recovered-visual-fixture-'));
  for(const p of ['ops','test/candidate-corpus','captures'])fs.mkdirSync(path.join(root,p),{recursive:true});
  const entry={candidateId:'synthetic',sha256:hash(png),source:'captures/sample-0-after.png',
    evidence:['Synthetic reviewed association only'],sourceModifiedAt:'2001-02-03T04:05:06.000Z',
    scene:'Synthetic scene',summary:'Synthetic historical image.',associationReview:'Synthetic association reviewed; historical only.'};
  fs.writeFileSync(path.join(root,entry.source),png);
  if(build){
    const sourceResult=path.join(root,'captures/result.json');
    write(sourceResult,{app:'synthetic-app',wasmSha256:'a'.repeat(64),samples:1,results:[{outcome:'unknown'}]});
    entry.buildEvidence={sourceResult:'captures/result.json',sourceResultSha256:hash(fs.readFileSync(sourceResult)),
      reportedWasmSha256:'a'.repeat(64),app:'synthetic-app',sampleIndex:0,basis:'Synthetic associated historical result',limitation:REPORTED_BUILD_LIMITATION};
  }
  write(path.join(root,'ops/historical-visuals.json'),[entry]);
  write(path.join(root,'test/candidate-corpus/manifest.json'),{candidates:[{id:'synthetic'},{id:'other'}]});
  const directory=path.join(root,'scratch/runs/recovered-synthetic-'+entry.sha256.slice(0,16));
  const file=name=>path.join(directory,name);
  const edit=(name,fn)=>{const v=load(file(name));fn(v);write(file(name),v);};
  return {root,entry,directory,file,edit,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
// Hash every byte and retain original mtime/ctime, excluding access time changed by reads.
function snapshot(directory){
  const rows=[];
  function visit(p){
    const s=fs.lstatSync(p,{bigint:true});
    rows.push([path.relative(directory,p),String(s.mode),String(s.mtimeNs),String(s.ctimeNs),
      s.isFile()?hash(fs.readFileSync(p)):s.isSymbolicLink()?fs.readlinkSync(p):null]);
    if(s.isDirectory())for(const name of fs.readdirSync(p).sort())visit(path.join(p,name));
  }
  visit(directory);return rows;
}
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name);}
function using(build,fn){const f=fixture(build);try{fn(f);}finally{f.cleanup();}}
const cases=[
  ['missing screen','screen.png',f=>fs.unlinkSync(f.file('screen.png')),/screen\.png/],
  ['tampered screen','screen.png',f=>fs.writeFileSync(f.file('screen.png'),'corrupt'),/screen\.png SHA-256/],
  ['missing provenance','provenance.json',f=>fs.unlinkSync(f.file('provenance.json')),/provenance\.json/],
  ['malformed provenance','provenance.json',f=>fs.writeFileSync(f.file('provenance.json'),'{'),/provenance\.json is malformed/],
  ['null provenance','provenance.json',f=>write(f.file('provenance.json'),null),/importedAt/],
  ['candidate provenance','provenance.json',f=>f.edit('provenance.json',v=>v.candidateId='other'),/provenance\.json differs/],
  ['hash provenance','provenance.json',f=>f.edit('provenance.json',v=>v.sha256='b'.repeat(64)),/provenance\.json differs/],
  ['source provenance','provenance.json',f=>f.edit('provenance.json',v=>v.source='different.png'),/provenance\.json differs/],
  ['association provenance','provenance.json',f=>f.edit('provenance.json',v=>v.associationReview='Unreviewed replacement'),/provenance\.json differs/],
  ['evidence provenance','provenance.json',f=>f.edit('provenance.json',v=>v.evidence=[]),/provenance\.json differs/],
  ['missing provenance field','provenance.json',f=>f.edit('provenance.json',v=>delete v.summary),/provenance\.json differs/],
  ['extra provenance field','provenance.json',f=>f.edit('provenance.json',v=>v.unreviewed=true),/provenance\.json differs/],
  ['invalid importedAt','provenance.json',f=>f.edit('provenance.json',v=>v.importedAt='invalid'),/importedAt/],
  ['malformed result','result.json',f=>fs.writeFileSync(f.file('result.json'),'['),/result\.json is malformed/],
  ['null result','result.json',f=>write(f.file('result.json'),null),/result\.json differs/],
  ...['candidateId','startedAt','route','summary','command','outcome','verification','importedAt'].map(key=>
    [key+' result','result.json',f=>f.edit('result.json',v=>v[key]='tampered'),/result\.json differs/]),
  ['build result','result.json',f=>f.edit('result.json',v=>v.build.wasmSha256='b'.repeat(64)),/result\.json differs/],
  ['commit result','result.json',f=>f.edit('result.json',v=>v.build.commit='inferred'),/result\.json differs/],
  ['screenshots result','result.json',f=>f.edit('result.json',v=>v.screenshots=['other.png']),/result\.json differs/],
  ['artifacts result','result.json',f=>f.edit('result.json',v=>v.artifacts=[]),/result\.json differs/],
  ['extra result field','result.json',f=>f.edit('result.json',v=>v.gameplay=true),/result\.json differs/],
  ['build provenance','provenance.json',f=>f.edit('provenance.json',v=>v.buildEvidence.reportedWasmSha256='b'.repeat(64)),/provenance\.json differs/],
  ['build association provenance','provenance.json',f=>f.edit('provenance.json',v=>v.buildEvidence.app='other-app'),/provenance\.json differs/],
  ['reviewed association changed','provenance.json',f=>{f.entry.associationReview='Different reviewed association';write(path.join(f.root,'ops/historical-visuals.json'),[f.entry]);},/provenance\.json differs/],
  ['reviewed build changed','provenance.json',f=>{f.entry.buildEvidence.reportedWasmSha256='c'.repeat(64);write(path.join(f.root,'ops/historical-visuals.json'),[f.entry]);},/provenance\.json differs/]
  ,['reviewed hash changed in same bundle prefix','screen.png',f=>{
    f.entry.sha256=f.entry.sha256.slice(0,16)+'b'.repeat(48);
    write(path.join(f.root,'ops/historical-visuals.json'),[f.entry]);
  },/screen\.png SHA-256/]
];
for(const [name,,mutate,error] of cases){
  check((baseline?'baseline false-success: ':'reject unchanged: ')+name,()=>using(true,f=>{
    assert.equal(recover(f.root)[0].status,'imported');mutate(f);
    const before=snapshot(f.root);
    if(baseline)assert.equal(recover(f.root)[0].status,'already imported');
    else{
      assert.throws(()=>recover(f.root),e=>/Invalid existing recovered bundle/.test(e.message)&&error.test(e.message));
      assert.deepEqual(snapshot(f.root),before,'rejection must not modify any fixture bytes or timestamps');
    }
  }));
}
if(!baseline){
  for(const build of [false,true])for(const missingSources of [false,true]){
    check(`valid unchanged rerun build=${build} missingSources=${missingSources}`,()=>using(build,f=>{
      assert.equal(recover(f.root)[0].status,'imported');
      const result=load(f.file('result.json'));
      assert.equal(result.startedAt,f.entry.sourceModifiedAt);
      assert.equal(result.outcome,'unknown');assert.equal(result.verification,'unreviewed');
      assert.equal(result.command,'Unknown; see provenance evidence');
      assert.deepEqual(result.build,{commit:null,wasmSha256:build?'a'.repeat(64):null});
      assert.match(result.summary,/Historical image only; no current compatibility or performance result/);
      assert.equal(load(f.file('provenance.json')).importedAt,result.importedAt);
      if(build)assert.equal(load(f.file('provenance.json')).buildEvidence.limitation,REPORTED_BUILD_LIMITATION);
      for(const name of fs.readdirSync(f.directory))fs.utimesSync(f.file(name),1000000000,1000000000);
      if(missingSources)fs.rmSync(path.join(f.root,'captures'),{recursive:true});
      const before=snapshot(f.directory);
      for(let n=0;n<2;n++)assert.equal(recover(f.root)[0].status,'already imported');
      assert.deepEqual(snapshot(f.directory),before);
      assert.equal(load(f.file('result.json')).importedAt,result.importedAt);
    }));
  }
  for(const name of ['result.json','screen.png','provenance.json']){
    check('reject partial without result: '+name,()=>using(false,f=>{
      recover(f.root);fs.unlinkSync(f.file('result.json'));
      if(name!=='result.json')fs.unlinkSync(f.file(name));
      const before=snapshot(f.root);assert.throws(()=>recover(f.root),/Invalid existing recovered bundle/);
      assert.deepEqual(snapshot(f.root),before);
    }));
  }
  for(const name of ['screen.png','provenance.json','result.json']){
    check('reject symlink: '+name,()=>using(false,f=>{
      recover(f.root);fs.copyFileSync(f.file(name),path.join(f.root,'linked'));
      fs.unlinkSync(f.file(name));fs.symlinkSync(path.join(f.root,'linked'),f.file(name));
      const before=snapshot(f.root);assert.throws(()=>recover(f.root),/must be a regular file/);
      assert.deepEqual(snapshot(f.root),before);
    }));
  }
  for(const kind of ['empty directory','directory replaced by file','directory symlink','dangling directory symlink']){
    check('reject existing '+kind,()=>using(false,f=>{
      recover(f.root);fs.rmSync(f.directory,{recursive:true});
      if(kind==='empty directory')fs.mkdirSync(f.directory);
      if(kind==='directory replaced by file')fs.writeFileSync(f.directory,'existing');
      if(kind.includes('symlink'))fs.symlinkSync(path.join(f.root,kind.startsWith('dangling')?'absent':'captures'),f.directory);
      const before=snapshot(f.root);assert.throws(()=>recover(f.root),/Invalid existing recovered bundle/);
      assert.deepEqual(snapshot(f.root),before);
    }));
  }
  for(const kind of ['schema','capture identity']){
    check('reject invalid reviewed build '+kind+' even if provenance agrees',()=>using(true,f=>{
      recover(f.root);
      if(kind==='schema')f.entry.buildEvidence.limitation='Unproven fresh module claim';
      else f.entry.buildEvidence.sourceResult='unrelated/result.json';
      write(path.join(f.root,'ops/historical-visuals.json'),[f.entry]);
      f.edit('provenance.json',v=>v.buildEvidence=f.entry.buildEvidence);
      const before=snapshot(f.root);assert.throws(()=>recover(f.root),kind==='schema'?/Invalid reported build evidence/:/Build evidence capture identity mismatch/);
      assert.deepEqual(snapshot(f.root),before);
    }));
  }
  check('missing original source remains unavailable',()=>using(false,f=>{
    fs.unlinkSync(path.join(f.root,f.entry.source));
    assert.equal(recover(f.root)[0].status,'source unavailable');assert.equal(fs.existsSync(f.directory),false);
  }));
  check('default historical association remains idempotent',()=>using(false,f=>{
    delete f.entry.associationReview;write(path.join(f.root,'ops/historical-visuals.json'),[f.entry]);
    recover(f.root);const before=snapshot(f.directory);
    assert.equal(recover(f.root)[0].status,'already imported');assert.deepEqual(snapshot(f.directory),before);
  }));
  check('JSON key ordering is immaterial',()=>using(true,f=>{
    recover(f.root);
    for(const name of ['provenance.json','result.json'])write(f.file(name),Object.fromEntries(Object.entries(load(f.file(name))).reverse()));
    const before=snapshot(f.directory);assert.equal(recover(f.root)[0].status,'already imported');
    assert.deepEqual(snapshot(f.directory),before);
  }));
}
console.log(JSON.stringify({mode:baseline?'baseline-false-success':'repaired-integrity',passed}));
