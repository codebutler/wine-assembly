'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const inventory=require('./candidate-corpus/worms-armageddon-demo-files.json');
const root=path.join(__dirname,'binaries/candidates/worms-armageddon-demo/game');
if(!fs.existsSync(root)) console.log('SKIP: fetch with node tools/fetch-candidate-corpus.js --id=worms-armageddon-demo');
else {for(const file of inventory.files){const b=fs.readFileSync(path.join(root,file.path));assert.equal(b.length,file.size,file.path);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),file.sha256,file.path);}console.log('PASS '+inventory.files.length+' original worms-armageddon-demo recovery files');}
