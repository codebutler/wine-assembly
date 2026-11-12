'use strict';
const assert=require('node:assert/strict'), Module=require('node:module'), fs=require('node:fs');
const root=process.env.REVIEW_ROOT||'/tmp/render-nested-elision-semantics-repair-oct26/repo';
const {create,instrument}=require(root+'/tools/d3d9-operation-observer.js');
const results=[];let serial=0;
function check(name,body,expectedReads){
 const filename=__filename+'.case'+serial++;
 const code=`'use strict';module.exports=function(){const log=[],src=new Uint8Array([11,23]),marker={};let a,b,out,error;try{${body}}catch(e){error=e===marker?'marker':e.name;}return {log,a,b,out,error};};`;
 const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(code,filename);
 let native,actual,counts={indexedSourceReads:0};
 try{
  const measured=create(filename);native=m.exports();
  const leave=measured.enter({counts,isSource:o=>o instanceof Uint8Array,allocation(){}});
  try{actual=measured.exports();}finally{leave();}
  assert.deepEqual(actual,native);if(expectedReads!==undefined)assert.equal(counts.indexedSourceReads,expectedReads);
  results.push({name,pass:true,counts});
 }catch(e){results.push({name,pass:false,body,native,actual,counts,diagnostic:e.message});finish();process.exit(1);}
}
const iter=(mode)=>`let step=0;const it={ [Symbol.iterator](){log.push('iterator',this===it);return this;}, next(){log.push('next',++step);if('${mode}'==='next-throw'&&step===2)throw marker; if('${mode}'==='primitive'&&step===2)return 4;return {get done(){log.push('done',step);if('${mode}'==='done-throw'&&step===2)throw marker;return '${mode}'==='empty'||('${mode}'==='short'&&step===2)||step>4;},get value(){log.push('value',step);if('${mode}'==='value-throw'&&step===1)throw marker;return undefined;}};},get return(){log.push('return-get');if('${mode}'==='return-get-throw')throw marker;return function(){log.push('return',this===it);if('${mode}'==='return-throw')throw marker;return '${mode}'==='return-primitive'?0:{};};}};`;
function finish(){fs.writeFileSync(__dirname+'/independent-results.json',JSON.stringify({pass:results.filter(x=>x.pass).length,fail:results.filter(x=>!x.pass).length,results},null,2));console.log(JSON.stringify({pass:results.filter(x=>x.pass).length,fail:results.filter(x=>!x.pass).length,last:results.at(-1)}));}
for(const mode of ['normal','empty','short','next-throw','primitive','done-throw','value-throw','return-get-throw','return-throw','return-primitive'])
 for(const p of ['[]','[,]','[,,,,]','[,a,,]','[a=src[1],,]'])
  for(const assignment of [false,true]){
   const pattern=assignment?p:p.replaceAll('a','bound');
   const statement=assignment?`out=({outer:{leaf:${pattern}}}=rhs);out=out===rhs;`:`{const {outer:{leaf:${pattern}}}=rhs;out=true;}`;
   check(`${mode} ${assignment?'assign':'bind'} ${p}`,iter(mode)+`const rhs={get outer(){log.push('outer');return {get leaf(){log.push('leaf');return it;}};}};${statement}`);
  }
for(const val of ['null','undefined','17','{}','"ab"','[1]','[]'])
 for(const p of ['[,]','[a,,]','[[a,,],,]'])
  check(`nonarray ${val} ${p}`,`({x:${p}}={x:${val}});`);
for(const mode of ['normal','return-throw','return-primitive']){
 check(`default exception ${mode}`,iter(mode)+`({x:[a=(()=>{log.push('default');throw marker;})(),,]}={x:it});`);
 check(`throwing assignment receiver ${mode}`,iter(mode)+`const target={set prop(v){log.push('setter',v);throw marker;}};const key={toString(){log.push('target-key');return 'prop';}};({x:[target[key]=src[0],,]}={x:it});`,1);
}
check('nested array iterator and default object alias',iter('normal')+`const key={toString(){log.push('key');return 'x';}};const rhs={x:undefined,y:8};out=({[key]:[{missing:{leaf:[a=src[1],,]}={leaf:it}}]=[{}],...b}=rhs);out=out===rhs;`,1);
check('computed method receiver default',iter('normal')+`const target={v:src,method(){log.push('receiver',this===target);return this.v[0];}};({x:[a=target['method'](),,]}={x:it});`,1);
for(const code of ['const {x:[...r]}=rhs;','({x:[{[key]:a},,]}=rhs);','const {x:[{0:a},,]}=rhs;']){
 assert.throws(()=>instrument(code),/outside the observer grammar/);results.push({name:'failclosed '+code,pass:true});
}
finish();
