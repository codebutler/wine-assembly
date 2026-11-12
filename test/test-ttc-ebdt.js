#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {bootRenderHarness} = require('./render-helper');
(async () => {
  const {exports:w, memory, hostCtx, module:compiledModule} = await bootRenderHarness({extraWat: `
    (func (export "fixture_reserve") (param i32 i32) (result i32)
      (call $tt_raster_scratch (local.get 0) (local.get 1)))
    (func (export "fixture_scratch_bytes") (result i32) (global.get $tt_scratch_allocated))
    (func (export "fixture_scratch_pointer") (result i32) (global.get $tt_scratch))
    (func (export "test_call_GetCharWidth32A") (param i32 i32 i32 i32) (result i32)
      (call $handle_GetCharWidth32A (local.get 0) (local.get 1) (local.get 2) (local.get 3)
        (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
    (func (export "fixture_geometry") (param i32 i32 i32 i32 i32 i32 i32) (result i32)
      (call $tt_glyph_geometry (local.get 0) (local.get 1) (local.get 2) (i32.const 28)
        (local.get 3) (local.get 4) (local.get 5) (local.get 6) (i32.const 1)))
    (func (export "fixture_register") (param i32) (result i32) (call $tt_reg_add (local.get 0)))
    (func (export "fixture_glyph") (param i32 i32 i32) (result i32)
      (call $tt_glyph_ensure (local.get 0) (local.get 1) (local.get 2)))
    (func (export "fixture_map") (param i32 i32 i32)
      (call $handle_SetMapMode (local.get 0) (i32.const 8) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (call $handle_SetWindowExtEx (local.get 0) (local.get 1) (local.get 1) (i32.const 0) (i32.const 0) (i32.const 0))
      (call $handle_SetViewportExtEx (local.get 0) (local.get 2) (local.get 2) (i32.const 0) (i32.const 0) (i32.const 0)))
    (func (export "fixture_enum") (param i32) (result i32)
      (call $tt_scan_font_dir) (call $tt_enum_face_name (local.get 0)))
    (func (export "fixture_data") (param i32) (result i32) (call $tt_face_data (local.get 0)))
    (func (export "fixture_index") (param i32) (result i32)
      (i32.load offset=44 (call $tt_face_record (local.get 0))))
    (func (export "fixture_lookup") (param i32 i32 i32 i32 i32) (result i32)
      (call $tt_sbit_lookup (local.get 0) (local.get 1) (local.get 2) (local.get 3) (local.get 4)))
    (func (export "fixture_remove") (param i32) (result i32) (call $tt_reg_remove (local.get 0)))
  `});
  const b = new Uint8Array(memory.buffer), wa = p => w.guest_to_wasm(p) >>> 0;
  const alloc = n => {const p = w.guest_alloc(n) >>> 0; assert(p); b.fill(0, wa(p), wa(p)+n); return p;};
  const str = s => {const p=alloc(s.length+1); b.set(Buffer.from(s,'latin1'),wa(p)); return p;};
  const wide = s => {const p=alloc((s.length+1)*2); b.set(Buffer.from(s+'\0','utf16le'),wa(p)); return p;};
  const readString = p => {let s=''; for(let i=0;i<64 && b[p+i];i++) s+=String.fromCharCode(b[p+i]);return s;};
  const fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures/ttc-ebdt', name));
  const ttc=fixture('faces.ttc'), ttf=fixture('bitmap.ttf');
  const ttcPath='c:\\windows\\fonts\\fixture.ttc', ttfPath='c:\\windows\\fonts\\fixture.ttf';
  hostCtx.vfs.files.set(ttcPath,{data:new Uint8Array(ttc),attrs:0x20});
  // Separate filename with same family demonstrates collection selection wins.
  hostCtx.vfs.files.set(ttfPath,{data:new Uint8Array(ttf),attrs:0x20});
  const names=[];
  for(let i=0;i<100;i++){const p=w.fixture_enum(i)>>>0;if(!p)break;names.push(readString(p));}
  assert.strictEqual(names.filter(n=>n==='Fixture Bitmap').length,1);
  assert.strictEqual(names.filter(n=>n==='Fixture Other').length,1);
  assert(!names.includes('測試甲'),'enumeration uses English until ACP 950');
  const first=w.test_tt_face_for_logfont(wa(str('Fixture Bitmap')),400,0);
  const second=w.test_tt_face_for_logfont(wa(str('Fixture Other')),400,0);
  assert(first>=0 && second>=0 && first!==second);
  assert.strictEqual(w.fixture_index(first),0);
  assert.strictEqual(w.fixture_index(second),1);
  console.log('PASS collection directory scan, one family per face and distinct indices');
  const dc=w.test_call_CreateCompatibleDC(0)>>>0;
  const makeFont=(name,ppem=12)=>w.test_call_CreateFontW(-ppem,0,0,0,400,0,0,0,0,0,0,0,0,wide(name))>>>0;
  const getData=(tag,off=0,n=null)=>{
    const len=w.test_call_GetFontData(dc,tag,off,0,0)>>>0;
    assert.notStrictEqual(len,0xffffffff);
    const count=n===null?len:n, out=alloc(count+4);
    b.fill(0xa5,wa(out),wa(out)+count+4);
    const got=w.test_call_GetFontData(dc,tag,off,out,count)>>>0;
    assert.strictEqual(got,Math.min(count,len));
    assert.deepStrictEqual([...b.slice(wa(out)+count,wa(out)+count+4)],Array(4).fill(0xa5));
    return Buffer.from(b.slice(wa(out),wa(out)+got));
  };
  for(const [english,local,index] of [['Fixture Bitmap','測試甲',0],['Fixture Other','測試乙',1]]){
    for(const name of [english,local]){
      const font=makeFont(name);assert(font);w.test_call_SelectObject(dc,font);
      const offset=ttc.readUInt32BE(12+index*4);
      assert.deepStrictEqual(getData(0),ttc.subarray(offset),'selected member starts at its own directory');
      assert.deepStrictEqual(getData(0x66637474),ttc,'ttcf reads original shared offsets and payload');
      assert.deepStrictEqual(getData(0,3,17),ttc.subarray(offset+3,offset+20));
      const d=w.fixture_data(index===0?first:second)>>>0;
      const size=w.test_tt_face_size(index===0?first:second)>>>0;
      const no=w.test_tt_table_off(d,size,0x6e616d65)>>>0;
      const nl=w.test_tt_table_len(d,size,0x6e616d65)>>>0;
      assert.deepStrictEqual(getData(0x656d616e),Buffer.from(b.slice(d+no,d+no+nl)));
    }
  }
  console.log('PASS English/localized LOGFONTW selection and GetFontData member/ttcf/table/offset modes');
  // Raw standalone TTF remains byte exact, including GetFontData(0).
  const standalone=w.test_tt_face_open(str(ttfPath));assert(standalone>=0);
  const data=w.fixture_data(standalone)>>>0,size=w.test_tt_face_size(standalone)>>>0;
  assert.deepStrictEqual(Buffer.from(b.slice(data,data+size)),ttf);
  const lookup=alloc(32);
  for(const code of 'ABCDEG'){
    const glyph=w.test_tt_face_glyph(first,code.charCodeAt(0),12)>>>0;assert(glyph);
    assert.strictEqual(w.test_tt_entry_width(glyph),5,code);
    assert.strictEqual(w.test_tt_entry_height(glyph),5,code);
    for(let y=0;y<5;y++) for(let x=0;x<5;x++)
      assert.strictEqual(w.test_tt_entry_pixel(glyph,x,y),Number(['10101','01010','11111','01010','10101'][y][x]),`${code} ${x},${y}`);
    assert.strictEqual(w.test_tt_face_char_width(first,code.charCodeAt(0),12),9);
  }
  assert.strictEqual(w.test_tt_face_char_width(first,32,12),4,'empty strike retains advance');
  const text=str('ABCDEG F');
  const total=6*9+4+7;
  assert.strictEqual(w.test_tt_face_text_width(first,wa(text),8,12),total);
  const fallback=w.test_tt_face_glyph(first,70,12)>>>0;
  assert.strictEqual(w.test_tt_face_char_width(first,70,12),7,'sparse absent F uses hmtx');
  assert.notStrictEqual(w.test_tt_entry_height(fallback),5,'absent F uses its outline');
  const outline=w.test_tt_face_glyph(first,65,13)>>>0;
  assert.notStrictEqual(w.test_tt_entry_height(outline),5,'no exact strike uses outline');
  assert.strictEqual(w.test_tt_face_char_width(first,65,13),8);
  console.log('PASS index 1/2/3/5, image 1/2/5/6/7, pixels, blank and absent glyph fallback');
  // Declared table truncation must not read the next table or leave memory.
  for(let n=0;n<ttf.length;n+=13)
    assert.strictEqual(w.fixture_lookup(data,n,2,12,wa(lookup)),0,`truncated font ${n}`);
  const font=makeFont('Fixture Bitmap');w.test_call_SelectObject(dc,font);
  const out=alloc(64), gm=alloc(20), bitmap=alloc(256);
  assert.strictEqual(w.test_call_GetTextExtentExPointA(dc,text,8,0x7fffffff,0,0,out),1);
  assert.strictEqual(w.guest_read32(out),total);
  assert.strictEqual(w.test_call_GetCharWidth32A(dc,65,71,out),1);
  assert.deepStrictEqual(Array.from({length:7},(_,i)=>w.guest_read32(out+i*4)),[9,9,9,9,9,7,9]);
  const needed=w.test_call_GetGlyphOutlineA(dc,65,1,gm,64,bitmap,0)>>>0;
  assert.strictEqual(needed,20);
  assert.deepStrictEqual([...b.slice(wa(bitmap),wa(bitmap)+20)],
    [0xa8,0,0,0,0x50,0,0,0,0xf8,0,0,0,0x50,0,0,0,0xa8,0,0,0]);
  assert.strictEqual(w.guest_read32(gm+16)&0xffff,9);
  console.log('PASS public extent, per-character widths and GGO_BITMAP agree');
  // Headless DIB rendering: every public text entry point must emit the same
  // exact monochrome pixels, including a negative horizontal bearing.
  const createDib = () => {
    const bmi=alloc(40), bitsOut=alloc(4);
    w.guest_write32(bmi,40);w.guest_write32(bmi+4,128);w.guest_write32(bmi+8,-40);
    w.guest_write16(bmi+12,1);w.guest_write16(bmi+14,32);
    const bmp=w.test_call_CreateDIBSection(0,bmi,0,bitsOut,0,0)>>>0;
    const hdc=w.test_call_CreateCompatibleDC(0)>>>0;assert(bmp && hdc);
    w.test_call_SelectObject(hdc,bmp);
    return {hdc,bits:w.guest_read32(bitsOut)>>>0};
  };
  const draw=(ppem,route='text',mapped=false,char='A')=>{
    const {hdc,bits}=createDib();
    w.test_call_SelectObject(hdc,makeFont('Fixture Bitmap',ppem));
    if(mapped)w.fixture_map(hdc,1,2);
    const tm=alloc(60);assert.strictEqual(w.test_call_GetTextMetricsA(hdc,tm),1);
    // Opaque white background makes the canonical DIB easy to inspect.
    b.fill(255,wa(bits),wa(bits)+128*40*4);
    if(route==='text')assert.strictEqual(w.test_call_TextOutA(hdc,8,4,str(char),1),1);
    if(route==='textW')assert.strictEqual(w.test_call_TextOutW(hdc,8,4,wide(char),char.length),1);
    if(route==='extW')assert.strictEqual(w.test_call_ExtTextOutW(hdc,8,4,0,0,wide(char),char.length,0),1);
    if(route==='index')assert.strictEqual(w.test_call_ExtTextOutW(hdc,8,4,16,0,wide('\u0002'),1,0),1);
    if(route==='drawW'){
      const rect=alloc(16);[8,4,120,36].forEach((v,i)=>w.guest_write32(rect+i*4,v));
      assert(w.test_call_DrawTextW(hdc,wide(char),char.length,rect,0x100)>0);
    }
    if(route==='ext')assert.strictEqual(w.test_call_ExtTextOutA(hdc,8,4,0,0,str(char),1,0),1);
    if(route==='draw'){
      const rect=alloc(16);[8,4,120,36].forEach((v,i)=>w.guest_write32(rect+i*4,v));
      assert(w.test_call_DrawTextA(hdc,str(char),1,rect,0x100)>0);
    }
    return {hdc, bits, ascent:w.guest_read32(tm+4), pixels:Buffer.from(b.slice(wa(bits),wa(bits)+128*40*4))};
  };
  const strikeDraw=draw(12), outlineDraw=draw(13);
  assert.deepStrictEqual(draw(12,'ext').pixels,strikeDraw.pixels);
  assert.deepStrictEqual(draw(12,'draw').pixels,strikeDraw.pixels);
  const black=render=>{
    const result=[];
    for(let y=0;y<40;y++)for(let x=0;x<128;x++){
      const at=(y*128+x)*4;
      if(render.pixels[at]===0 && render.pixels[at+1]===0 && render.pixels[at+2]===0)result.push([x,y]);
    }
    return result;
  };
  const expected=[];
  ['10101','01010','11111','01010','10101'].forEach((row,y)=>{
    [...row].forEach((bit,x)=>{if(bit==='1')expected.push([7+x,4+strikeDraw.ascent-7+y]);});
  });
  assert.deepStrictEqual(black(strikeDraw),expected);
  assert.notDeepStrictEqual(black(outlineDraw),expected);
  const overhang=draw(12,'text',false,'G');
  assert.strictEqual(black(overhang).length,15,'bitmap above font-cell ascent is complete');
  assert.deepStrictEqual(draw(12,'ext',false,'G').pixels,overhang.pixels);
  assert.deepStrictEqual(draw(12,'draw',false,'G').pixels,overhang.pixels);
  assert.strictEqual(black(overhang)[0][1],0,'overhang begins above the requested text top');
  const mapped=draw(6,'text',true);
  assert.strictEqual(w.test_call_GetGlyphOutlineA(mapped.hdc,65,1,gm,64,bitmap,0),20,
    'mapped -6 font selects the native 12ppem strike');
  assert.strictEqual(w.guest_read32(gm+16)&0xffff,9);
  assert.strictEqual(w.test_call_GetTextExtentPoint32A(mapped.hdc,str('A'),1,out),1);
  assert.strictEqual(w.test_call_GetCharWidth32A(mapped.hdc,65,65,out+8),1);
  assert.strictEqual(w.guest_read32(out),w.guest_read32(out+8));
  assert.strictEqual(black(mapped).length,15,'mapped draw preserves exact bitmap ink');
  console.log('PASS TextOut/ExtTextOut/DrawText pixels and mapped DC strike/advance selection');
  // U+4E46 maps to A; its low byte F has no embedded image. Exercise both
  // the strike and outline fallback with identical public W/indexed pixels.
  for(const ppem of [12,13,28]){
    const unicode='\u4e46', render=draw(ppem,'textW',false,unicode);
    assert.deepStrictEqual(draw(ppem,'extW',false,unicode).pixels,render.pixels);
    assert.deepStrictEqual(draw(ppem,'drawW',false,unicode).pixels,render.pixels);
    assert.deepStrictEqual(draw(ppem,'index').pixels,render.pixels);
    if(ppem===12)assert.notDeepStrictEqual(draw(ppem,'text',false,'F').pixels,render.pixels);
    const hdc=render.hdc, text=wide(unicode+unicode), widths=alloc(8), fit=alloc(4);
    assert.strictEqual(w.test_call_GetCharWidth32W(hdc,0x4e46,0x4e46,out),1);
    const advance=w.guest_read32(out);
    assert.strictEqual(w.test_call_GetTextExtentPoint32W(hdc,text,2,out),1);
    assert.strictEqual(w.guest_read32(out),advance*2);
    const calc=alloc(16);[8,4,120,36].forEach((v,i)=>w.guest_write32(calc+i*4,v));
    assert(w.test_call_DrawTextW(hdc,text,2,calc,0xD00)>0);
    assert.strictEqual(w.guest_read32(calc+8)-w.guest_read32(calc),advance*2,'DrawTextW CALCRECT agrees');
    assert.strictEqual(w.test_call_GetTextExtentExPointW(hdc,text,2,advance,fit,widths,out),1);
    assert.strictEqual(w.guest_read32(out),advance*2);
    assert.strictEqual(w.guest_read32(fit),1);
    assert.deepStrictEqual([w.guest_read32(widths),w.guest_read32(widths+4)],[advance,advance*2]);
    assert.strictEqual(w.test_call_GetCharABCWidthsW(hdc,0x4e46,0x4e46,out),1);
    assert.strictEqual((w.guest_read32(out)+w.guest_read32(out+4)+w.guest_read32(out+8))|0,advance);
    const count=w.test_call_GetGlyphOutlineW(hdc,0x4e46,1,gm,256,bitmap,0)>>>0;
    assert(count>0 && count<=256,`UCS-2 bitmap at ${ppem}: ${count}`);
    assert.strictEqual(w.guest_read32(gm+16)&65535,advance);
    const saved=Buffer.from(b.slice(wa(bitmap),wa(bitmap)+count));
    assert.strictEqual(w.test_call_GetGlyphOutlineA(hdc,2,129,gm,256,bitmap,0)>>>0,count);
    assert.deepStrictEqual(Buffer.from(b.slice(wa(bitmap),wa(bitmap)+count)),saved);
    for(const format of [0,2,4,5,6]){
      const unicodeSize=w.test_call_GetGlyphOutlineW(hdc,0x4e46,format,gm,0,0,0)>>>0;
      const unicodeMetrics=Buffer.from(b.slice(wa(gm),wa(gm)+20));
      assert.notStrictEqual(unicodeSize,0xffffffff,`W outline format ${format}`);
      assert.strictEqual(w.test_call_GetGlyphOutlineA(hdc,2,format|128,gm,0,0,0)>>>0,unicodeSize);
      assert.deepStrictEqual(Buffer.from(b.slice(wa(gm),wa(gm)+20)),unicodeMetrics);
    }
    // lpDx consumes exactly one advance per WCHAR, independent of its value.
    const dx=alloc(8);w.guest_write32(dx,20);w.guest_write32(dx+4,27);
    const spaced=draw(ppem,'textW',false,'');
    assert.strictEqual(w.test_call_ExtTextOutW(spaced.hdc,8,4,0,0,text,2,dx),1);
    const indexed=draw(ppem,'textW',false,'');
    assert.strictEqual(w.test_call_ExtTextOutW(indexed.hdc,8,4,16,0,wide('\u0002\u0002'),2,dx),1);
    assert.deepStrictEqual(Buffer.from(b.slice(wa(spaced.bits),wa(spaced.bits)+128*40*4)),
      Buffer.from(b.slice(wa(indexed.bits),wa(indexed.bits)+128*40*4)));
  }
  const bitmapDc=w.test_call_CreateCompatibleDC(0)>>>0;
  w.test_call_SelectObject(bitmapDc,makeFont('MS Sans Serif',16));
  assert.strictEqual(w.test_call_GetTextExtentPoint32W(bitmapDc,wide('\u0141'),1,out),1);
  assert.strictEqual(w.test_call_GetCharWidth32W(bitmapDc,0x141,0x141,out+8),1);
  assert.strictEqual(w.guest_read32(out),w.guest_read32(out+8),'FON default-char width agrees');
  assert.strictEqual(w.test_call_GetTextExtentPoint32W(bitmapDc,wide('\u4e46'),1,out+16),1);
  assert.strictEqual(w.guest_read32(out),w.guest_read32(out+16),'out-of-charset UCS-2 uses default char');
  assert(w.fixture_scratch_bytes()<100000,'small glyphs never reserve maxp*256 edges');
  console.log('PASS UCS-2 W drawing, lpDx, extents, widths, ABC, outlines and FON default character');
  if(process.env.TTC_EBDT_EVIDENCE_DIR){
    const {createCanvas}=require('../lib/canvas-compat');
    const dir=process.env.TTC_EBDT_EVIDENCE_DIR;fs.mkdirSync(dir,{recursive:true});
    for(const [name,render] of [['strike-12',strikeDraw],['outline-13',outlineDraw]]){
      const canvas=createCanvas(128,40),ctx=canvas.getContext('2d');
      const image=ctx.createImageData(128,40);
      for(let i=0;i<128*40;i++){
        image.data[i*4]=render.pixels[i*4+2];image.data[i*4+1]=render.pixels[i*4+1];
        image.data[i*4+2]=render.pixels[i*4];image.data[i*4+3]=255;
      }
      ctx.putImageData(image,0,0);fs.writeFileSync(path.join(dir,name+'.png'),canvas.toBuffer('image/png'));
    }
  }
  if(process.env.UMING_REFERENCE){
    const reference=JSON.parse(fs.readFileSync(process.env.UMING_REFERENCE,'utf8'));
    const raw=fs.readFileSync(process.env.UMING_TTC);
    const p='c:\\windows\\fonts\\uming.ttc';
    hostCtx.vfs.files.set(p,{data:new Uint8Array(raw),attrs:0x20});
    assert.strictEqual(w.fixture_register(str(p)),4);
    const face=w.test_tt_face_for_logfont(wa(str('AR PL UMing TW')),400,0);
    assert(face>=0);assert.strictEqual(w.fixture_index(face),2);
    for(const ref of reference){
      const d=w.fixture_data(face)>>>0,n=w.test_tt_face_size(face)>>>0;
      const gid=w.test_tt_glyph_index(d,n,ref.code);
      const glyph=w.fixture_glyph(face,gid,ref.ppem)>>>0;assert(glyph);
      assert.deepStrictEqual([w.test_tt_entry_width(glyph),w.test_tt_entry_height(glyph),
        w.test_tt_entry_left(glyph),w.test_tt_entry_top(glyph)],[ref.width,ref.height,ref.left,ref.top]);
      const bits=[];for(let y=0;y<ref.height;y++)for(let x=0;x<ref.width;x++)bits.push(w.test_tt_entry_pixel(glyph,x,y));
      assert.deepStrictEqual(bits,ref.pixels,`UMing U+${ref.code.toString(16)} at ${ref.ppem}`);
      const render=createDib(), metrics=alloc(60), indices=alloc(2);
      w.test_call_SelectObject(render.hdc,makeFont('AR PL UMing TW',ref.ppem));
      w.guest_write16(indices,gid);
      b.fill(255,wa(render.bits),wa(render.bits)+128*40*4);
      assert.strictEqual(w.test_call_GetTextMetricsA(render.hdc,metrics),1);
      assert.strictEqual(w.test_call_ExtTextOutW(render.hdc,8,4,16,0,indices,1,0),1);
      const expected=[];
      for(let y=0;y<ref.height;y++)for(let x=0;x<ref.width;x++)if(ref.pixels[y*ref.width+x])
        expected.push([8+ref.left+x,4+w.guest_read32(metrics+4)-ref.top+y]);
      assert.deepStrictEqual(black({pixels:Buffer.from(b.slice(wa(render.bits),wa(render.bits)+128*40*4))}),expected,
        'UMing indexed rendering preserves every bitmap pixel and overhang');
    }
    console.log(`PASS optional UMing TW face 2: ${reference.length} bitmap glyphs exactly match fontTools`);
  }
  // Original CC0 outline fixture: H has 1200 points/edges, I composes two H
  // outlines, and J has 300 points plus a real glyph program/phantom points.
  const complexPath='c:\\windows\\fonts\\complex.ttf';
  hostCtx.vfs.files.set(complexPath,{data:new Uint8Array(fixture('complex.ttf')),attrs:0x20});
  assert.strictEqual(w.fixture_register(str(complexPath)),1);
  const complexFace=w.test_tt_face_for_logfont(wa(str('Fixture Complex')),400,0);
  assert(complexFace>=0);
  const cd=w.fixture_data(complexFace)>>>0, cs=w.test_tt_face_size(complexFace)>>>0;
  for(const ppem of [12,28,64]){
    let simple=null;
    for(const code of [72,73,74]){
      const gid=code?w.test_tt_glyph_index(cd,cs,code):0;
      const entry=w.fixture_glyph(complexFace,gid,ppem)>>>0;assert(entry);
      const width=w.test_tt_entry_width(entry),height=w.test_tt_entry_height(entry);
      const pixels=[];
      for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixels.push(w.test_tt_entry_pixel(entry,x,y));
      assert(pixels.some(Boolean),`complex glyph ${code} at ${ppem} draws ink`);
      if(code===72)simple=pixels;
      if(code===73)assert.deepStrictEqual(pixels,simple,`simple/composite winding at ${ppem}`);
    }
  }
  const points=alloc(2404*6), edges=alloc(2400*32);
  const hintedGid=w.test_tt_glyph_index(cd,cs,74);
  assert.strictEqual(w.test_tt_glyph_load_outline(cd,cs,hintedGid,wa(points),2404),300);
  assert(w.test_tth_hint_outline(cd,cs,hintedGid,28,wa(points),300),
    '300 real points plus four phantom points execute the hint program');
  const complexGid=w.test_tt_glyph_index(cd,cs,72);
  assert.strictEqual(w.fixture_geometry(cd,cs,complexGid,wa(points),2404,wa(edges),2400),1200,
    'regression fixture actually emits more than 1024 raster edges');
  assert.throws(()=>w.fixture_geometry(cd,cs,complexGid,wa(points),16,wa(edges),2400),
    WebAssembly.RuntimeError,'insufficient outline points fail fast');
  assert.throws(()=>w.fixture_geometry(cd,cs,complexGid,wa(points),2404,wa(edges),16),
    WebAssembly.RuntimeError,'insufficient raster edges fail fast');
  console.log('PASS 1200-point/1200-edge simple, 2400-point composite, 300-point hinted outlines at 12/28/64px');
  assert(w.fixture_scratch_bytes()<220000,'2400-edge fixture grows geometrically, below 220KB');
  const ownerPointer=w.fixture_scratch_pointer(),ownerBytes=w.fixture_scratch_bytes();
  const worker=await bootRenderHarness({memory,prebuiltModule:compiledModule});
  assert.strictEqual(worker.exports.fixture_scratch_pointer(),0,'new shared-memory instance has no scratch owner');
  assert.strictEqual(worker.exports.fixture_scratch_bytes(),0,'spawn does not inherit another instance capacity');
  worker.exports.set_current_thread_id(2);
  worker.exports.fixture_reserve(cd,cs);
  assert.notStrictEqual(worker.exports.fixture_scratch_pointer(),ownerPointer,'instances allocate distinct work buffers');
  assert.strictEqual(w.fixture_scratch_pointer(),ownerPointer);
  assert.strictEqual(w.fixture_scratch_bytes(),ownerBytes);
  console.log('PASS shared-memory thread instance starts fresh and owns independent raster scratch');
  assert.strictEqual(w.fixture_remove(str(ttcPath)),1);
  const remaining=[];for(let i=0;i<100;i++){const p=w.fixture_enum(i)>>>0;if(!p)break;remaining.push(readString(p));}
  assert(!remaining.includes('Fixture Other'),'collection removal removes every member');
  w.test_call_SelectObject(dc,makeFont('Fixture Bitmap'));
  assert.deepStrictEqual(getData(0),ttf,'single TTF GetFontData remains byte identical');
  assert.strictEqual(w.test_call_GetFontData(dc,0x66637474,0,0,0)>>>0,0xffffffff,
    'standalone TTF has no collection');
  assert.strictEqual(w.test_tt_face_char_width(first,90,12),7,'unmapped character falls back to outline .notdef');
  const badCases=[
    bytes=>bytes.writeUInt32BE(0x30000,4),
    bytes=>bytes.writeUInt32BE(0,8),
    bytes=>bytes.writeUInt32BE(33,8),
    bytes=>bytes.writeUInt32BE(0xffffffff,12),
    bytes=>bytes.writeUInt32BE(0xfffffff8,ttc.readUInt32BE(12)+20),
  ];
  for(let i=0;i<badCases.length;i++){
    const bytes=Buffer.from(ttc);badCases[i](bytes);
    const p=`c:\\windows\\fonts\\bad-${i}.ttc`;
    hostCtx.vfs.files.set(p,{data:new Uint8Array(bytes),attrs:0x20});
    assert.strictEqual(w.fixture_register(str(p)),0,`invalid TTC header/directory case ${i}`);
  }
  console.log('PASS TTC and embedded bitmap fixtures');
})().catch(e=>{console.error(e);process.exitCode=1;});
