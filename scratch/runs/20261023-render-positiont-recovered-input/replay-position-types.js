'use strict';
// Run the existing position-type assertions with the focused eight-MiB native
// fragment module; this is not the canonical application harness or heap.
const Module=require('module'),path=require('path');
const root=path.resolve(__dirname,'../../..');
const {boot}=require(path.join(root,'test/test-d3d9-shared-positiont-ir.js'));
const load=Module._load;
Module._load=function(request,parent,isMain){
 if(request==='./render-helper'&&parent.filename===path.join(root,'test/test-d3d9-fixed-position-types.js'))
  return {bootRenderHarness:async()=>{const r=await boot();return {exports:r.e,memory:r.memory};}};
 return load.apply(this,arguments);
};
require(path.join(root,'test/test-d3d9-fixed-position-types.js'));
