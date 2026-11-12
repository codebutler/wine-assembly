'use strict';
const fs=require('fs'),assert=require('assert');
const packageRoot=process.argv[2];const {PNG}=require(packageRoot);
assert.strictEqual(require(packageRoot+'/package.json').version,'7.0.0');
const image=new PNG({width:2,height:1});image.data.set([255,0,0,255,0,255,0,255]);
const bytes=PNG.sync.write(image);const decoded=PNG.sync.read(bytes);
assert(decoded.data.equals(image.data));
const record={version:'7.0.0',resolved:require.resolve(packageRoot),encodedBytes:bytes.length,pixels:[...decoded.data],pass:true};
if(process.argv[3]){
 const canvas=require(process.argv[3]+'/lib/canvas-compat').createCanvas(2,1);
 const ctx=canvas.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,2,1);
 const png=PNG.sync.read(canvas.toBuffer('image/png'));assert.strictEqual(png.data[0],255);assert.strictEqual(png.data[3],255);
 record.rasterCanvas=true;record.renderer=typeof require(process.argv[3]+'/lib/renderer').Win98Renderer;
}
console.log(JSON.stringify(record));
