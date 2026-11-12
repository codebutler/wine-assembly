'use strict';
// No call can reach a native WebAssembly entry point in these static tests.
const deny=()=>{throw Error('FORBIDDEN WebAssembly API');};
global.WebAssembly=Object.fromEntries(['Module','Memory','Instance','instantiate','instantiateStreaming','compile','compileStreaming','validate'].map(k=>[k,deny]));
