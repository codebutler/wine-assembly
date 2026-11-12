'use strict';
// Replay accepted source tests or unchanged CLI gates against an integrated tree.
// Usage: node this.js REPO TREE acceptance OUTPUT.json
//        node this.js REPO TREE gate tools/check-region-decls.js --strict --check-owners
const cp=require('child_process'),path=require('path'),assert=require('assert/strict');
const repo=path.resolve(process.argv[2]),tree=process.argv[3],mode=process.argv[4];
const object=(rev,file)=>cp.execFileSync('git',['show',rev+':'+file],{cwd:repo,encoding:'utf8',maxBuffer:32e6,stdio:['ignore','pipe','pipe']});
assert(/^[a-f0-9]{40}$/.test(tree));
if(mode==='acceptance'){
 let source=object('fffb14ee9ce82906927e394f3b84539b7758e5d5','docs/reviews/iw-registry-independent-final-20261020.js');
 const anchor="const candidate='ecf1850383c4c155aae0650de3ef5ab8b8661326'";assert(source.includes(anchor));
 source=source.replace(anchor,"const candidate='"+tree+"'");
 new Function('require','process',source)(require,{...process,argv:['node','acceptance',repo,process.argv[5],'--accept']});
}else if(mode==='gate'){
 let source=object(tree,'docs/reviews/iw-registry-preserve-gates-20261020.js');
 source=source.replace("base='ac72debe7522d4d57034627712b8ec000f8e1d92'","base='"+tree+"'");
 // Supply exact-tree directory entries too, including recursive census Dirents.
 source=source.replace("if(!inside(p)||opts)return fs.readdirSync(p,opts);const prefix=rel(p)+'/';return [...new Set(tree.filter(f=>f.startsWith(prefix)).map(f=>f.slice(prefix.length).split('/')[0]))];",
 "if(!inside(p))return fs.readdirSync(p,opts);const prefix=rel(p)?rel(p)+'/':'';const names=[...new Set(tree.filter(f=>f.startsWith(prefix)).map(f=>f.slice(prefix.length).split('/')[0]))];return opts?.withFileTypes?names.map(name=>({name,isDirectory:()=>tree.some(f=>f.startsWith(prefix+name+'/')),isFile:()=>tree.includes(prefix+name),isSymbolicLink:()=>false})):names;");
 new Function('require','process',source)(require,{...process,argv:['node','gate',repo,...process.argv.slice(5)]});
}else throw Error('unknown mode');
