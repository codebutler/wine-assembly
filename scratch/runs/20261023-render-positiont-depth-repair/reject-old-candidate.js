"use strict";
// Replay the corrected pixel oracle with exactly the candidate's two producers.
const fs=require('fs'),Module=require('module'),path=require('path');
const donor='/home/user/wine-assembly-render-positiont-recovered-input-oct23';
const target=path.resolve('lib/d3d-shader-ir.js'),wat=path.resolve('src/09aj-d3d-fixed.wat');
const js=Module._extensions['.js'],read=fs.readFileSync;
Module._extensions['.js']=(m,p)=>p===target?m._compile(read.call(fs,path.join(donor,'lib/d3d-shader-ir.js'),'utf8'),p):js(m,p);
fs.readFileSync=function(p,...args){return read.call(this,path.resolve(String(p))===wat?path.join(donor,'src/09aj-d3d-fixed.wat'):p,...args);};
require('./depth-controls');
// depth-controls only runs as main; compile it as the actual main module.
const main=new Module(path.resolve(__dirname,'depth-controls.js'));main.filename=main.id;main.paths=module.paths;
require.main=main;main._compile(read.call(fs,main.filename,'utf8').replace('if(require.main===module)','if(true)'),main.filename);
