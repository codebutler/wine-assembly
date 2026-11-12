const assert=require('assert/strict');
const {VirtualFS}=require(process.argv[2]);
const literals=['+[a](b){2}^$.txt','a-b.txt','é+雪[1].txt','x|y.txt','a..b.txt'];
for(const literal of literals){
 const v=new VirtualFS();v.cwd='c:\\game';
 const entries=[literal,'prefix'+literal,literal+'.suffix',literal.replace(/[+()[\]{}^$|.]/g,'x')];
 for(const n of entries)v.setLazyFile('c:\\game\\'+n,{size:17,load(){throw Error('read');}});
 const first=v.findFirstFile(literal.toUpperCase());assert(first.handle,literal);
 const found=[first.entry.name];assert.equal(first.entry.size,17);
 for(let n;(n=v.findNextFile(first.handle));)found.push(n.name);
 v.findClose(first.handle);assert.deepEqual(found,[literal],literal);
 assert.equal(v.findHandles.size,0);
}console.log('PASS independent combined punctuation, unicode, hyphen, anchors, metadata');
