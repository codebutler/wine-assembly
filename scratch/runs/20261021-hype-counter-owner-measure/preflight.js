const fs=require('fs'),cp=require('child_process'),crypto=require('crypto');
const root='/home/user/hype-browser-fps',repo=root+'/repo',out=root+'/counter-owner';fs.mkdirSync(out,{recursive:true});process.chdir(repo);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(fs.readFileSync(root+'/evidence/source-manifest.json')),assets=JSON.parse(fs.readFileSync(root+'/evidence/assets.json'));
for(const f of manifest.files){const b=fs.readFileSync(f.path);if(crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex')!==f.oid)throw Error('source drift '+f.path);}
for(const f of assets){const b=fs.readFileSync(f.path);if(b.length!==f.bytes||hash(b)!==f.sha256)throw Error('asset drift '+f.path);}
const moduleHash=hash(fs.readFileSync('build/wine-assembly.wasm'));if(moduleHash!=='728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c')throw Error('module drift');
const result={at:new Date().toISOString(),source:manifest.base,sourceFiles:manifest.files.length,assets:assets.length,moduleHash,head:cp.execFileSync('git',['rev-parse','HEAD']).toString().trim(),node:process.version,chrome:cp.execFileSync('google-chrome',['--version']).toString().trim(),listeners:cp.execFileSync('ss',['-ltnp']).toString(),processes:cp.execFileSync('ps',['-eo','pid,ppid,args']).toString().split('\n').filter(s=>/hype-browser|google-chrome|dev-server/.test(s))};
fs.writeFileSync(out+'/'+(process.argv[2]||'preflight')+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
