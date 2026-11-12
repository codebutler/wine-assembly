#!/usr/bin/env node
'use strict';
const assert = require('assert');
const {bootRenderHarness} = require('./render-helper');
(async () => {
  const {exports:w,memory} = await bootRenderHarness();
  const b=new Uint8Array(memory.buffer),wa=p=>w.guest_to_wasm(p)>>>0;
  const alloc=n=>{const p=w.guest_alloc(n);assert(p);b.fill(0,wa(p),wa(p)+n);return p;};
  const wide=s=>{const p=alloc((s.length+1)*2);b.set(Buffer.from(s+'\0','utf16le'),wa(p));return p;};
  const dc=w.test_call_CreateCompatibleDC(0),bmi=alloc(40),bitsOut=alloc(4);
  w.guest_write32(bmi,40);w.guest_write32(bmi+4,80);w.guest_write32(bmi+8,-40);
  w.guest_write16(bmi+12,1);w.guest_write16(bmi+14,32);
  w.test_call_SelectObject(dc,w.test_call_CreateDIBSection(0,bmi,0,bitsOut,0,0));
  w.test_call_SelectObject(dc,w.test_call_CreateFontW(-16,0,0,0,400,0,0,0,0,0,0,0,0,wide('MS Sans Serif')));
  const bits=wa(w.guest_read32(bitsOut)),tm=alloc(60);
  assert.strictEqual(w.test_call_GetTextMetricsA(dc,tm),1);
  const fallback=String.fromCharCode(b[wa(tm)+50]);
  const draw=(text,ext)=>{
    b.fill(255,bits,bits+80*40*4);
    const p=wide(text);
    assert.strictEqual(ext?w.test_call_ExtTextOutW(dc,8,4,0,0,p,text.length,0):
      w.test_call_TextOutW(dc,8,4,p,text.length),1);
    return Buffer.from(b.slice(bits,bits+80*40*4));
  };
  const expected=draw(fallback,true);
  assert(expected.some(v=>v===0),'default glyph draws visible ink');
  for(const ch of ['\u0141','\u4e46','\u4142']){
    // The latter two have printable low/high bytes and used to be
    // misidentified as packed ANSI strings. All are outside this FON charset.
    assert.deepStrictEqual(draw(ch,true),expected,`ExtTextOutW ${ch.charCodeAt(0).toString(16)}`);
    assert.deepStrictEqual(draw(ch,false),expected,`TextOutW ${ch.charCodeAt(0).toString(16)}`);
  }
  console.log('PASS W APIs preserve UCS-2 and FON out-of-charset text uses the default glyph');
})().catch(error=>{console.error(error);process.exitCode=1;});
