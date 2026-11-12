// tl;dr: control-eval expression (sent as code to ctl.sh eval): reads the B&W2
// input manager's cursor, per-frame deltas, motion scale, pending button bits,
// consumer gate and action locks, plus hit-counter slots 0..15 if armed.
(()=>{
  const r=a=>exports.guest_read32(a)>>>0;
  const f=a=>{const d=new DataView(new ArrayBuffer(4));d.setUint32(0,r(a));return +d.getFloat32(0).toFixed(3);};
  const o=0x1d733e8;
  const counts=[];for(let i=0;i<16;i++)counts.push(exports.get_count(i));
  return {cx:r(o+0xc4),cy:r(o+0xc8),cxf:f(o+0xc4),cyf:f(o+0xc8),dx:r(o+0xcc)|0,dy:r(o+0xd0)|0,
    scale:r(0x17792c0),scalef:f(0x17792c0),bits:r(0x1d73544)&0xff,gate:r(0x1d73678)&0xff,
    gmask:r(0xd0ae4c)&0xff,lockA:r(0x18ed55c),lockK:r(0x18ed558),poll:r(0x17792d4),
    wheel:r(0x19a30e0)|0,counts};
})()
