'use strict';
// Run main's unchanged mocked launch regression; deny compiler/guest paths.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const child = require('child_process');
const spawn = child.spawnSync;
child.spawnSync = (command,args,options) => {
  assert.strictEqual(command,process.execPath);
  assert.strictEqual(args[0],'-e');
  assert.strictEqual(args[1],"process.on('SIGTERM', () => {}); process.stdout.write('armed'); while (true) {}");
  return spawn(command,args,options);
};
const load=Module._load;
Module._load=function(request,parent,isMain) {
  if(request==='./compile-src')return {compileSrcWasm(){throw Error('FORBIDDEN compiler');}};
  return load.call(this,request,parent,isMain);
};
const filename=path.resolve(__dirname,'../../test-candidate-runner-launch.js');
const run=new Module(filename,module);run.filename=filename;run.paths=Module._nodeModulePaths(path.dirname(filename));
run._compile(fs.readFileSync(filename,'utf8'),filename);
