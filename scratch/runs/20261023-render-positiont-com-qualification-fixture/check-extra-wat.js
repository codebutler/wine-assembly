'use strict';
const path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../../..');
const input=require(path.join(root,'test/support/positiont-com-module'));
const {parseSource}=require(path.join(root,'tools/watx'));
const forms=parseSource(input.extraWat,'positiont-com-extra.wat');
assert.strictEqual(forms.length,29);
input.verifySources();
console.log(JSON.stringify({result:'PASS',extraWatForms:forms.length,extraWatSha256:input.sha256(input.extraWat),
 sourcePinsSha256:input.pinsHash,requiredExports:input.requiredExports,
 mode:'parse only, exact candidate blob verification; NO source/module compilation or instantiation'}));
