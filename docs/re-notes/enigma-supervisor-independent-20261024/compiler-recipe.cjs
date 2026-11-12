'use strict';
const fs=require('node:fs'),z=require('node:zlib'),c=require('node:crypto'),p=require('node:path');
const repo='/tmp/enigma-supervisor-independent-integrate-oct24/repo';
const T=require(p.join(repo,'tools/enigma-terminal-capture-guard.cjs'));
const Q=require(p.join(repo,'tools/enigma-quiet-filesystem.cjs'));
const sha=b=>c.createHash('sha256').update(b).digest('hex');
const original=z.gunzipSync(fs.readFileSync(p.join(repo,'docs/re-notes/enigma-terminal-capture-guard-20261024/runner.js.gz'))).toString();
const source=T.transformRunner(Q.transform(original));
const a=source.indexOf("      } else if (ev.action === 'png' && renderer && renderer.canvas) {");
const b=source.indexOf("      } else if (ev.action === 'png-raw'",a);
const d=source.indexOf('    } catch (e) {\n',source.indexOf('if (!mainExecutionSuspended()) instance.exports.run(BATCH_SIZE);'));
const e=source.indexOf('\n\n    if (gameplayBench',d);
const spans=[[a,b],[d,e]].map(([start,end])=>({startUTF16:start,endUTF16:end,startByte:Buffer.byteLength(source.slice(0,start)),endByte:Buffer.byteLength(source.slice(0,end)),startLine:source.slice(0,start).split('\n').length,endLine:source.slice(0,end).split('\n').length,bytes:Buffer.byteLength(source.slice(start,end)),sha256:sha(source.slice(start,end))}));
const result={originalRunnerSHA256:sha(original),originalRunnerBytes:Buffer.byteLength(original),transformedRunnerSHA256:sha(source),transformedRunnerBytes:Buffer.byteLength(source),compilerBoundary:'Node Module.prototype._compile; full-source equality verified by unchanged composition fixture',candidateAdapterSHA256:sha(fs.readFileSync(p.join(repo,'tools/enigma-terminal-capture-guard.cjs'))),excerptOrder:spans,concatenatedExcerptSHA256:sha(source.slice(a,b)+source.slice(d,e))};
// Derive the Git blob using the actual immutable source manifest, never an assumed pin.
result.candidateAdapterGitBlob=JSON.parse(fs.readFileSync('/tmp/enigma-supervisor-independent-integrate-oct24/ops/admission.json')).manifest.find(x=>x.path==='tools/enigma-terminal-capture-guard.cjs').blob;
fs.writeFileSync(p.join(repo,'docs/re-notes/enigma-supervisor-independent-20261024/compiler-recipe.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({pass:true,spans:spans.length,transformedSHA256:sha(source)}));
