'use strict';
// Independent JSON-reachable contract boundaries. No extraction or guest runs.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const {spawnSync} = require('child_process');
const cli = path.resolve(__dirname, '../../test-cli-candidate-corpus.js');
const manifestPath = path.resolve(__dirname, '../../candidate-corpus/manifest.json');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const bg = 'baldurs-gate-interactive-demo';
const pinned = '7a99c19b56531a46cae5ec09e0589d227ca60979dbd5f23eb4dd699eff97642e';
if (process.argv[2] === '--probe') {
  const input = fs.readFileSync(0, 'utf8');
  const data = JSON.parse(input);
  const selected = data.candidates.find(c => c.id === 'thps2-demo');
  const assetRoot = path.resolve(data.assetRoot);
  const selectedRoot = path.join(assetRoot, selected.fixture || selected.id);
  const deny = () => {throw Error('FORBIDDEN write/compiler/guest');};
  const probeFs = {...fs};
  for (const name of ['existsSync','readdirSync','statSync','openSync','readFileSync']) {
    probeFs[name] = (filename, ...rest) => {
      const p = path.resolve(filename);
      if (name === 'readFileSync' && p === manifestPath) return input;
      if (p === assetRoot || (p.startsWith(assetRoot + path.sep) && p !== selectedRoot && !p.startsWith(selectedRoot + path.sep))) {
        throw Error('FORBIDDEN unselected fixture access ' + p);
      }
      return fs[name](filename, ...rest);
    };
  }
  for (const name of ['writeFileSync','mkdirSync','mkdtempSync','copyFileSync','rmSync','unlinkSync']) probeFs[name] = deny;
  process.argv = [process.execPath, cli, ...process.argv.slice(3)];
  vm.runInNewContext(fs.readFileSync(cli,'utf8'), {
    __dirname:path.dirname(cli), Buffer, Set, Map, process, console,
    require(name) {
      if (name === 'fs') return probeFs;
      if (name === './compile-src') return {compileSrcWasm:deny};
      if (name === 'child_process') return {spawnSync:deny};
      if (['assert','os','path'].includes(name)) return require(name);
      throw Error('LOADER unexpected module ' + name);
    },
  }, {filename:cli, timeout:2000});
} else {
  assert.strictEqual(hash(fs.readFileSync(cli)),pinned);
  const originalBytes = fs.readFileSync(manifestPath);
  const original = JSON.parse(originalBytes);
  const userFixture = '/home/user/wine-assembly/test/candidate-corpus/manifest.json';
  const userHash = hash(fs.readFileSync(userFixture));
  assert.strictEqual(userHash,'212be4a27b33cbd8f675fdef80d13bbea45d3d81aa8e3e643a26edbde6e924bd');
  const temp = fs.mkdtempSync(path.join(process.env.TMPDIR,'boundaries-'));
  const thps = original.candidates.find(c=>c.id==='thps2-demo');
  const pePath = path.join(temp,thps.fixture||thps.id,thps.executables[0]);
  fs.mkdirSync(path.dirname(pePath),{recursive:true});
  const pe=Buffer.alloc(90);pe.write('MZ');pe.writeUInt32LE(64,60);pe.write('PE\0\0',64,'binary');pe.writeUInt16LE(0x14c,68);pe.writeUInt16LE(0x10b,88);fs.writeFileSync(pePath,pe);
  const cases=[];
  function probe(name,mutate,expected='CONTRACT_ASSERTION',options={}) {
    const data=JSON.parse(JSON.stringify(original));data.assetRoot=temp;
    const c=data.candidates.find(c=>c.id===bg);mutate(c,data);
    let input=JSON.stringify(data);
    if(options.serialize) input=options.serialize(data);
    const args=options.list?['--id= thps2-demo,thps2-demo, ','--list']:['--id=thps2-demo','--dry-run','--strict'];
    const r=spawnSync(process.execPath,['--max-old-space-size=192',__filename,'--probe',...args],{input,encoding:'utf8',timeout:5000,maxBuffer:1048576});
    const output=(r.stdout||'')+(r.stderr||'');
    const category=r.error||r.signal?'PROCESS_ERROR':/FORBIDDEN|LOADER|Cannot find module|SyntaxError|TypeError|ENOENT/.test(output)?'LOADER_ERROR':/AssertionError/.test(output)?'CONTRACT_ASSERTION':r.status===0?'ACCEPTED':'OTHER_FAILURE';
    const pass=category===expected && r.status===(expected==='ACCEPTED'?0:1) && (expected!=='ACCEPTED'||(options.list?/^LOCAL  thps2-demo\t/.test(output):/1 ready\/local, 0 blocked, 0 skipped, 0 harness failures/.test(output))) && (expected!=='CONTRACT_ASSERTION'||/data-track, cabinet and executable identity/.test(output));
    const item={name,expected,category,status:r.status,signal:r.signal,error:r.error?.message||null,pass,inputSHA256:hash(input),outputSHA256:hash(output)};
    if(!pass)item.output=output;
    cases.push(item);console.log(JSON.stringify(item));
  }
  try {
    probe('exact committed 19-step recipe',()=>{},'ACCEPTED');
    probe('exact recipe list selection and deduplication',()=>{},'ACCEPTED',{list:true});
    function reverseKeys(value) {
      if(Array.isArray(value))return value.map(reverseKeys);
      if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).reverse().map(k=>[k,reverseKeys(value[k])]));
      return value;
    }
    probe('JSON property order and whitespace preserve exact recipe',()=>{},'ACCEPTED',{serialize:d=>JSON.stringify(reverseKeys(d),null,2)});
    probe('JSON Unicode escapes preserve exact string values',()=>{},'ACCEPTED',{serialize:d=>JSON.stringify(d).replaceAll('copyFile','copy\\u0046ile')});
    probe('unrelated descriptive metadata remains allowed',(c,d)=>{d.reviewDescription='independent';c.reviewDescription='not a recipe field';},'ACCEPTED');
    const steps=original.candidates.find(c=>c.id===bg).postExtract;
    assert.strictEqual(steps.length,19);
    for(let i=0;i<steps.length;i++) {
      probe('delete ordered step '+i,c=>c.postExtract.splice(i,1));
      probe('duplicate inserted step '+i,c=>c.postExtract.splice(i,0,c.postExtract[i]));
      probe('null step '+i,c=>c.postExtract[i]=null);
      probe('extra own property step '+i,c=>c.postExtract[i].optional=false);
      probe('JSON __proto__ own property step '+i,c=>Object.defineProperty(c.postExtract[i],'__proto__',{value:{type:'copyFile'},enumerable:true}));
      for(const key of Object.keys(steps[i])) {
        probe('missing '+i+'.'+key,c=>delete c.postExtract[i][key]);
        probe('wrong type '+i+'.'+key,c=>c.postExtract[i][key]=false);
      }
      if(i+1<steps.length)probe('swap adjacent steps '+i+'/'+(i+1),c=>{[c.postExtract[i],c.postExtract[i+1]]=[c.postExtract[i+1],c.postExtract[i]];});
    }
    for(const value of [null,{},'19',19,false])probe('postExtract type '+JSON.stringify(value),c=>c.postExtract=value);
    for(let i=0;i<6;i++) {
      probe('delete replacement '+i,c=>c.postExtract[18].replacements.splice(i,1));
      probe('replaceText from changed '+i,c=>c.postExtract[18].replacements[i].from+='x');
      probe('replaceText to changed '+i,c=>c.postExtract[18].replacements[i].to+='x');
      probe('replacement prototype-name property '+i,c=>Object.defineProperty(c.postExtract[18].replacements[i],'__proto__',{value:{to:'x'},enumerable:true}));
    }
    probe('configuration replacement order',c=>c.postExtract[18].replacements.reverse());
    probe('path dot segment is not exact source identity',c=>c.postExtract[3].from=c.postExtract[3].from.replace('cd/','cd/./'));
    probe('path case is not exact source identity',c=>c.postExtract[3].from=c.postExtract[3].from.toLowerCase());
    probe('path backslash is not exact source identity',c=>c.postExtract[3].from=c.postExtract[3].from.replaceAll('/','\\'));
    probe('array-like object cannot substitute recipe',c=>c.postExtract={...c.postExtract,length:19});
    probe('constructor own property cannot alter step identity',c=>c.postExtract[17].constructor={prototype:{from:'cd/DATA1.CAB'}});
    const report={candidate:'c07ec5c0311c06d954bfc8569f59e418a551ef3e',sourceSHA256:pinned,manifestSHA256:hash(originalBytes),userFixtureSHA256:userHash,total:cases.length,passed:cases.filter(c=>c.pass).length,rejections:cases.filter(c=>c.pass&&c.category==='CONTRACT_ASSERTION').length,legitimateAccepted:cases.filter(c=>c.pass&&c.category==='ACCEPTED').length,loaderErrors:cases.filter(c=>/ERROR|FAILURE/.test(c.category)).length,cases,scope:'JSON manifests only; exact recipe identity; property ordering and JSON escapes are equivalent, path spellings are pinned; synthetic selected PE; denies unselected reads and every compiler/guest/write call'};
    assert.strictEqual(hash(fs.readFileSync(manifestPath)),report.manifestSHA256);
    assert.strictEqual(hash(fs.readFileSync(userFixture)),userHash);
    assert.strictEqual(hash(fs.readFileSync(cli)),pinned);
    fs.writeFileSync(path.join(process.env.CORPUS_REVIEW_OUTPUT,'boundary-results.json'),JSON.stringify(report,null,2)+'\n');
    console.log('RESULT '+JSON.stringify({total:report.total,passed:report.passed,rejections:report.rejections,legitimateAccepted:report.legitimateAccepted,loaderErrors:report.loaderErrors}));
    process.exitCode=report.passed===report.total?0:1;
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
}
