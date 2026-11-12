'use strict';
const fs=require('node:fs');const {Model}=require('/tmp/maelstrom-select-hook-independent-closeout-oct24/repo/test/maelstrom-select-hook-model.cjs');
const s=fs.readFileSync('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/src/09d-winsock.wat','utf8');
const m=new Model(s,1),sentinel={modelReturn:true,value:123,originalImportException:true};m.throwOn='$vsock_pump';m.exception=sentinel;let thrown=false,result;try{result=m.select()}catch(e){thrown=e===sentinel}
console.log(JSON.stringify({expected:'same original exception thrown',actual:{thrown,result},finding:'Model.run catches any truthy .modelReturn, including original import exceptions; this is an evaluator blindspot, not evidence the actual WAT swallows exceptions',realWasm:false}));process.exitCode=thrown?0:1;
