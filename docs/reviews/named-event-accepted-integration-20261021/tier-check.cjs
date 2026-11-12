const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.cwd();const original=fs.readdirSync;
const files=new Set(cp.execFileSync('git',['ls-tree','-r','--name-only','HEAD','test'],{encoding:'utf8'}).trim().split('\n').filter(p=>p.startsWith('test/')&&!p.slice(5).includes('/')).map(p=>p.slice(5)));
for(const e of original(path.join(root,'test'),{withFileTypes:true}))if(e.isFile())files.add(e.name);
fs.readdirSync=(p,opts)=>path.resolve(p)===path.join(root,'test')&&opts?.withFileTypes ? [...files].map(name=>({name,isFile:()=>true})) : original(p,opts);
const tiers=require(path.join(root,'tools/test-tiers.js'));const result=tiers.validateTiers();assert.deepEqual(result.errors,[]);
for(const name of ['test-named-event-cli-end-to-end.js','test-named-event-cli-reservation-regressions.js','test-named-event-cli-transport-loss.js','test-named-event-entry-abi.js'])assert.equal(tiers.classifyTest('test/'+name),'unit');
console.log('PASS full Git-tree tier inventory plus NEW sparse-worktree tests:',result.actual.length,'files; four new UNIT tests');
