'use strict';
// Cooperative exports are a get-only Proxy, not an enumerable export object.
// Forward reads rather than spreading it; preserve its owner/liveness checks.
function observeNeQtRun(exports,afterRun) {
  const run=blocks=>{const result=exports.run(blocks);afterRun();return result;};
  return new Proxy({}, {get:(_target,name)=>name==='run'?run:exports[name]});
}
module.exports={observeNeQtRun};
