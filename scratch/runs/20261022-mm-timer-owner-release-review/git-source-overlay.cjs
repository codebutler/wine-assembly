// Read-only missing-source fallback for canonical source scanners on a sparse
// checkout. Existing files always win. No source rewrite or gate suppression.
const fs = require('fs'), cp = require('child_process'), path = require('path');
const root = process.cwd();
const paths = cp.execFileSync('git',['ls-tree','-r','--name-only','HEAD'],{encoding:'utf8'}).trim().split('\n');
const tracked = new Set(paths);
const read = fs.readFileSync, exists = fs.existsSync, readdir = fs.readdirSync;
const relative = p => typeof p === 'string' ? path.relative(root,path.resolve(p)) : '';
fs.existsSync = function(p) {return exists(p) || tracked.has(relative(p));};
fs.readFileSync = function(p,options) {
  if (exists(p) || !tracked.has(relative(p))) return read(p,options);
  const b = cp.execFileSync('git',['show',`HEAD:${relative(p)}`],{maxBuffer:32*1024*1024});
  const enc = typeof options === 'string' ? options : options?.encoding;
  return enc ? b.toString(enc) : b;
};
fs.readdirSync = function(p,options) {
  const rel = relative(p), prefix = rel ? rel+'/' : '';
  const names = new Map();
  if(exists(p)) for(const d of readdir(p,{withFileTypes:true})) names.set(d.name,d);
  for(const f of paths) if(f.startsWith(prefix)) {
    const rest=f.slice(prefix.length), name=rest.split('/')[0], dir=rest.includes('/');
    if(!names.has(name)) names.set(name,{name,isFile:()=>!dir,isDirectory:()=>dir,isSymbolicLink:()=>false});
  }
  return options?.withFileTypes ? [...names.values()] : [...names.keys()];
};
