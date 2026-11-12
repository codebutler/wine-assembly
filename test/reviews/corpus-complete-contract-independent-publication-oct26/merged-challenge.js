'use strict';
// Original 14 cases/oracles remain byte-for-byte unchanged in challenge.js.
// This adapter changes only source/manifest identities and the fresh-main
// CommonJS loader dependency. Child probes re-enter this same adapter.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
let source = fs.readFileSync(path.join(__dirname, 'challenge.js'),'utf8');
assert.strictEqual(sha(source),'87b4d8240283ac98ad87c04aa613db42d515958ea290077f2d93cb7e599fea38');
const cli = path.resolve(__dirname, '../../test-cli-candidate-corpus.js');
assert.strictEqual(sha(fs.readFileSync(cli)),'e96681ed31436b95d034aca9206943668272792dcf3f77a045d1c888dfc5f7d5');
function replaceOnce(before,after) {
  assert.strictEqual(source.split(before).length,2,before);
  source=source.replace(before,after);
}
replaceOnce('e8046f77b7fad166c81d48f43fe3b2ea5f2e3643e8dd905de364ac53081206b0','e96681ed31436b95d034aca9206943668272792dcf3f77a045d1c888dfc5f7d5');
replaceOnce('25d9dc55241ad3e80b42d71986c4cf147e4e09c2c1370190d14fd0402b4cf4eb','6e53c7c94ccf3b623c719efdf9402b2cfadd99e7fddcf6b2c4d735f3908b855e');
replaceOnce('vm.runInNewContext(fs.readFileSync(cli, \'utf8\'), {','const probeModule = {exports:{}};\n  vm.runInNewContext(fs.readFileSync(cli, \'utf8\'), {');
replaceOnce('    require(name) {','    module: probeModule, require: Object.assign(function(name) {');
replaceOnce("      if (name === './compile-src')", "      if (name === '../lib/candidate-cli') return require(path.resolve(path.dirname(cli),name));\n      if (name === './compile-src')");
replaceOnce('    },\n  }, {filename:cli, timeout:2000});','    }, {main:probeModule}),\n  }, {filename:cli, timeout:2000});');
replaceOnce("candidate:'1bc85c5d8e7513cb30ddd796cef6d93de0a0415b'","candidate:'merged-on-938ea5bb01a25c51a9d70db756be3873fefe68f7'");
const replay = new Module(__filename,module);
replay.filename=__filename;
replay.paths=Module._nodeModulePaths(__dirname);
replay._compile(source,__filename);
