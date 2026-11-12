const Module = require('module'), path = require('path');
const compile = Module.prototype._compile;
const mode = process.argv[2];
Module.prototype._compile = function (source, filename) {
 if (filename.endsWith('/lib/browser-shell.js')) {
   const from = mode === 'omit-normalization' ? '      launchOpts = launchOpts ?? {};\n' : 'showCmd: launchOpts.showCmd,';
   const to = mode === 'omit-normalization' ? '' : 'showCmd: launchOpts.showCmd == null ? launchOpts.showCmd : (launchOpts.showCmd || 1),';
   if (!source.includes(from)) throw Error('control did not match');
   source = source.replace(from, to);
 }
 return compile.call(this, source, filename);
};
require(path.resolve(process.argv[3]));
