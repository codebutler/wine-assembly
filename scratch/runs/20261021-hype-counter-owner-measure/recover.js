'use strict';
const fs=require('fs'),crypto=require('crypto'),api=require('./file-api');
(async()=>{
const remote='/home/user/hype-browser-fps/counter-owner';
const script=`const fs=require('fs'),path=require('path'),crypto=require('crypto');const root=${JSON.stringify(remote)},files=[];function walk(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n);if(fs.statSync(p).isDirectory())walk(p);else{const b=fs.readFileSync(p);files.push({path:path.relative(root,p),bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}}}walk(root);console.log(JSON.stringify(files));`;
const files=JSON.parse(api.exec(['node','-e',script],'recovery-list'));
const total=files.reduce((n,f)=>n+f.bytes,0);if(total>16*1024**2)throw Error('recovery exceeds projected 16MiB');
for(const f of files){if(f.path.includes('..'))throw Error('path');const b=await api.download(remote+'/'+f.path);if(b.length!==f.bytes||crypto.createHash('sha256').update(b).digest('hex')!==f.sha256)throw Error('hash '+f.path);const p=__dirname+'/evidence/'+f.path;fs.mkdirSync(require('path').dirname(p),{recursive:true});fs.writeFileSync(p,b);}
fs.writeFileSync(__dirname+'/recovery-manifest.json',JSON.stringify({at:new Date().toISOString(),files,total},null,2));console.log('recovered',files.length,total);
})().catch(e=>{console.error(e);process.exitCode=1});
