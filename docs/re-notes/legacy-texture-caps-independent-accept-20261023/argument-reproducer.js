const fs=require('fs'),path=require('path'),Module=require('module');
const file='/tmp/legacy-texture-operation-caps-oct23/repo/test/test-legacy-texture-operation-caps.js';
const src=fs.readFileSync(file,'utf8');const cut=src.indexOf('\ntry {\n  const f = makeFixture(assembled);');if(cut<0)throw Error('boundary');
const probe=String.raw`
const f=makeFixture(assembled);
for(const [type,val] of [[2,0],[3,2],[5,0],[6,2]]) {f.e.d3dim_set_tss(1,0,type,val);assert.equal(f.e.d3dim_tss_load(4096,0,type),val);}
const stage=gpuDraw(f,2,2);
const record={coreSHA256:receipts.coreSHA256,storedColorArg1:f.e.d3dim_tss_load(4096,0,2),storedAlphaArg1:f.e.d3dim_tss_load(4096,0,5),expectedArg1:0,loweredColorArg1:stage.colorArg1,loweredAlphaArg1:stage.alphaArg1,expectedRGBA:'8060a0e0',loweredSelectionRGBA:'a0c08040',memoryBytes:f.e.memory.buffer.byteLength};
fs.writeFileSync(process.env.REPRO_RECEIPT,JSON.stringify(record,null,2)+'\n');
assert.equal(stage.colorArg1,0,'SELECTARG1 must honor stored COLORARG1=DIFFUSE');
assert.equal(stage.alphaArg1,0,'SELECTARG1 must honor stored ALPHAARG1=DIFFUSE');
`;
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(src.slice(0,cut)+'\n'+probe,file);
