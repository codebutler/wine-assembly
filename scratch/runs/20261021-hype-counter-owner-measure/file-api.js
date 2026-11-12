'use strict';
const fs=require('fs'),cp=require('child_process'),assert=require('assert/strict');
const box='bx_2ghgsv9d';
async function fileUrl(op,path){
 const {token}=JSON.parse(fs.readFileSync('/home/user/.config/ascii/boat/config.json'));
 const r=await fetch(`https://boat.dev/api/v1/sandboxes/${box}/files/${op}-url`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({path,ttlSeconds:900})});
 const data=await r.json(); if(!r.ok){fs.writeFileSync(__dirname+'/file-api-denial.json',JSON.stringify({op,path,status:r.status,response:data},null,2));throw Error(`${op}-url HTTP ${r.status} ${data.code}: ${data.message}`);} return data.url;
}
async function upload(path,bytes){const r=await fetch(await fileUrl('upload',path),{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:bytes});assert(r.ok,'upload '+r.status);}
async function download(path){const r=await fetch(await fileUrl('download',path));assert(r.ok,'download '+r.status);return Buffer.from(await r.arrayBuffer());}
function exec(args,name,timeout=30){
 const b=cp.execFileSync('boat',['exec',box,'--json','--timeout',String(timeout),'--',...args],{maxBuffer:12e6});
 fs.writeFileSync(__dirname+'/'+name+'.json',b);const r=JSON.parse(b);assert(r.success,JSON.stringify(r));return r.stdout;
}
module.exports={upload,download,exec};
