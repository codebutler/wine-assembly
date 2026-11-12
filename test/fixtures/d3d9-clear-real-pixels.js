/* Browser-only oracle. Real production Device/GPU constructors and GL objects.
 * Direct GLSL draws observe stored depth/stencil; no mock GL or guest fixture.
 * Returns evidence even on assertion failure. Harness owns expected controls.
 */
(() => {
  'use strict';
  const checks = [], images = [], identities = [], errors = [];
  const W = 8, H = 8, blue = [0,0,255,255], green = [0,255,0,255];
  let serial = 10;
  function fixture() {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const d = new D3D9Backend.Device(canvas, {webglVersion:2});
    const g = d.gpu, gl = g.gl;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!identities.length) identities.push({version:gl.getParameter(gl.VERSION),
      shading:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      renderer:gl.getParameter(gl.RENDERER), vendor:gl.getParameter(gl.VENDOR),
      unmaskedRenderer:ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
      unmaskedVendor:ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null,
      extensions:gl.getSupportedExtensions(), attributes:gl.getContextAttributes()});
    function shader(type, text) {
      const s = gl.createShader(type); gl.shaderSource(s,text); gl.compileShader(s);
      if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
      return s;
    }
    const vs = shader(gl.VERTEX_SHADER, `#version 300 es
      uniform float z; void main() {
        vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
        gl_Position=vec4(p*2.0-1.0,z*2.0-1.0,1.0);
      }`);
    const fs = shader(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float; uniform vec4 color; out vec4 pixel;
      void main(){pixel=color;}`);
    const program = gl.createProgram(); gl.attachShader(program,vs); gl.attachShader(program,fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    const zloc=gl.getUniformLocation(program,'z'), cloc=gl.getUniformLocation(program,'color');
    function clear(p={}) {
      d.clearCommand(structuredClone(RenderClear.create({color:[0,0,1,1],flags:1,...p},W,H)));
    }
    // Seed storage without RenderClear, Device.clearCommand or wrapper.clear.
    // Restore every GL value we change so wrapper caches remain synchronized.
    function seed({depth=.25,stencil=52,color=[0,0,1,1],hasDepth=true,hasStencil=true}={}) {
      const saved={color:gl.getParameter(gl.COLOR_CLEAR_VALUE),depth:gl.getParameter(gl.DEPTH_CLEAR_VALUE),
        stencil:gl.getParameter(gl.STENCIL_CLEAR_VALUE),colorMask:gl.getParameter(gl.COLOR_WRITEMASK),
        depthMask:gl.getParameter(gl.DEPTH_WRITEMASK),front:gl.getParameter(gl.STENCIL_WRITEMASK),
        back:gl.getParameter(gl.STENCIL_BACK_WRITEMASK),scissor:gl.isEnabled(gl.SCISSOR_TEST)};
      try {
        gl.disable(gl.SCISSOR_TEST);gl.colorMask(true,true,true,true);gl.depthMask(true);gl.stencilMask(255);
        gl.clearColor(...color);gl.clearDepth(depth);gl.clearStencil(stencil);
        gl.clear(gl.COLOR_BUFFER_BIT|(hasDepth?gl.DEPTH_BUFFER_BIT:0)|(hasStencil?gl.STENCIL_BUFFER_BIT:0));
        if(gl.getError()!==gl.NO_ERROR)throw Error('Independent seed GL error');
      } finally {
        gl.clearColor(...saved.color);gl.clearDepth(saved.depth);gl.clearStencil(saved.stencil);
        gl.colorMask(...saved.colorMask);gl.depthMask(saved.depthMask);
        gl.stencilMaskSeparate(gl.FRONT,saved.front);gl.stencilMaskSeparate(gl.BACK,saved.back);
        if(saved.scissor)gl.enable(gl.SCISSOR_TEST);else gl.disable(gl.SCISSOR_TEST);
      }
    }
    function draw({z=.5, stencil=null, depth=true, color=[0,1,0,1]}={}) {
      g.setCapability(gl.SCISSOR_TEST,false); g.setCapability(gl.BLEND,false);
      g.setCapability(gl.DEPTH_TEST,depth); g.setDepthMask(false);
      g.setCapability(gl.STENCIL_TEST,stencil!==null); g.setStencilMask(0);
      gl.depthFunc(gl.LESS); gl.stencilFunc(gl.EQUAL,stencil??0,255);
      gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP); gl.colorMask(true,true,true,true);
      gl.viewport(0,0,W,H); gl.depthRange(0,1); gl.useProgram(program);
      gl.uniform1f(zloc,z); gl.uniform4fv(cloc,color); gl.drawArrays(gl.TRIANGLES,0,3);
    }
    function pixels() {
      const a=new Uint8Array(W*H*4);
      gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,a);
      const e=gl.getError(); if(e!==gl.NO_ERROR)throw Error('GL error '+e);
      const top=new Uint8ClampedArray(a.length);
      for(let y=0;y<H;y++)top.set(a.subarray((H-1-y)*W*4,(H-y)*W*4),y*W*4);
      return top;
    }
    function expect(name, expected, save=false) {
      const a=pixels(); let mismatch=0, first=null;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        const want=typeof expected==='function'?expected(x,y):expected;
        const got=Array.from(a.subarray((y*W+x)*4,(y*W+x)*4+4));
        if(got.some((v,k)=>v!==want[k])){mismatch++;first??={x,y,got,want};}
      }
      checks.push({name,kind:'pixels',pass:mismatch===0,pixels:W*H,mismatch,first});
      if(save){const c=document.createElement('canvas');c.width=W;c.height=H;
        c.getContext('2d').putImageData(new ImageData(a,W,H),0,0);
        images.push({name,png:c.toDataURL('image/png').split(',')[1]});}
    }
    function close(){gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);d.destroy();
      gl.getExtension('WEBGL_lose_context')?.loseContext();}
    return {d,g,gl,clear,seed,draw,expect,close};
  }
  function run(name, body) {let f;try{f=fixture();body(f);}catch(e){errors.push({name,error:String(e.stack||e)});}
    finally{f?.close();}}
  run('normalized-default',({g,gl,clear,draw,expect,d})=>{
    clear({flags:3,depth:.25}); draw(); expect('normalized-quarter-rejects-half',blue);
    // Adapter warmed .25, then public wrapper requests its documented default 1.
    g.setDepthMask(true);g.clear(null,gl.DEPTH_BUFFER_BIT);
    draw();expect('wrapper-default-one-after-quarter',green,true);
    clear({flags:3,depth:.5});clear({flags:2,depth:.25});
    draw({z:.375});expect('adapter-quarter-after-half-rejects',blue);
    clear({flags:3,depth:.25});d.clear([0,0,1,1],2);
    draw();expect('positional-default-one-after-quarter',green);
  });
  for(const format of [80,75])for(const named of [false,true])run(`fresh-${format}-${named}`,f=>{
    const {d,g,gl,clear,draw,expect}=f;
    const depth={id:++serial,width:W,height:H,format};
    const color=named?{id:++serial,width:W,height:H,format:21}:null;
    if(color){const bytes=new Uint8Array(W*H*4);for(let n=0;n<bytes.length;n+=4)bytes.set([255,0,0,255],n);
      d.createColor(color,bytes);} // BGRA blue, real texture allocation/upload.
    clear();g.clear(null,0,.25,52);
    const p={depthAttachment:depth,colorAttachment:color};
    clear({...p,flags:format===75?6:2,depth:.25,stencil:52});
    const prefix=`${named?'named':'implicit'}-${format}`;
    expect(prefix+'-color-retained',blue);
    draw();expect(prefix+'-fresh-quarter-rejects-half',blue,true);
    if(format===75){draw({depth:false,stencil:52});expect(prefix+'-fresh-stencil-52',green,true);}
    // Repeated same request and switching back to the existing depth identity.
    clear({...p,flags:format===75?7:3,depth:.25,stencil:52});
    clear({flags:3,depth:.75});
    clear({...p,flags:1});draw();expect(prefix+'-existing-depth-retained',blue);
    if(format===75){draw({depth:false,stencil:52});expect(prefix+'-existing-stencil-retained',green);}
    gl.bindRenderbuffer(gl.RENDERBUFFER,g._target.depth);
    checks.push({name:prefix+'-actual-renderbuffer',kind:'capability',pass:
      gl.getRenderbufferParameter(gl.RENDERBUFFER,gl.RENDERBUFFER_DEPTH_SIZE)===(format===80?16:24)&&
      gl.getRenderbufferParameter(gl.RENDERBUFFER,gl.RENDERBUFFER_STENCIL_SIZE)===(format===80?0:8)});
  });
  run('attachments-regions-masks',({clear,seed,draw,expect,d})=>{
    const depth={id:++serial,width:W,height:H,format:75};
    const p={depthAttachment:depth};
    const inside=(x,y,r)=>x>=r[0]&&x<r[2]&&y>=r[1]&&y<r[3];
    const region=[1,1,3,4], magenta=[255,0,255,255];
    clear({...p,flags:0});seed();
    clear({...p,color:[1,1,0,0],colorMask:1,rects:[[-2,1,3,4]],clip:[1,0,7,7]});
    const pattern=(x,y)=>inside(x,y,region)?magenta:blue;
    expect('clipped-top-left-red-channel',pattern,true);
    draw();expect('color-only-preserves-quarter-depth',pattern);
    draw({depth:false,stencil:52});expect('color-only-preserves-stencil',green);
    seed();
    const dr=[1,1,4,3], sr=[4,3,7,6];
    clear({...p,flags:2,depth:.75,stencil:0,rects:[dr]});
    expect('depth-only-retains-color',blue);
    draw({stencil:52});expect('depth-rectangle-and-stencil-retention',
      (x,y)=>inside(x,y,dr)?green:blue,true);
    seed({hasDepth:false,hasStencil:false});
    clear({...p,flags:4,stencil:9,depth:1,rects:[sr]});
    expect('stencil-only-retains-color',blue);
    draw({stencil:52});expect('stencil-only-retains-depth',
      (x,y)=>inside(x,y,dr)?green:blue);
    seed({hasDepth:false,hasStencil:false});draw({depth:false,stencil:9});
    expect('stencil-rectangle-origin',(x,y)=>inside(x,y,sr)?green:blue,true);
    seed();
    clear({...p,flags:0,color:[1,0,0,1],depth:1,stencil:0});
    expect('zero-flags-retain-color',blue);draw();expect('zero-flags-retain-depth',blue);
    draw({depth:false,stencil:52});expect('zero-flags-retain-stencil',green);
    seed();
    clear({...p,flags:7,color:[1,0,0,1],depth:1,stencil:0,rects:[]});
    expect('empty-regions-retain-color',blue);draw();expect('empty-regions-retain-depth',blue);
    draw({depth:false,stencil:52});expect('empty-regions-retain-stencil',green);
    for(let mask=0;mask<16;mask++){
      clear({depthAttachment:null,flags:0});seed({hasDepth:false,hasStencil:false});
      clear({depthAttachment:null,color:[1,1,0,0],colorMask:mask});
      expect('channel-mask-'+mask,[mask&1?255:0,mask&2?255:0,mask&4?0:255,mask&8?0:255]);
    }
    let rejected=false;try{clear({depthAttachment:null,flags:2});}catch(e){rejected=/depth/.test(e.message);}
    checks.push({name:'absent-depth-rejected',kind:'validation',pass:rejected});
    // Deliberately invalid metadata is rejection, never a passing skip.
    rejected=false;try{d.clearCommand({...RenderClear.create({color:[0,0,0,1],flags:1},W,H),origin:'bottom-left'});}
    catch(e){rejected=/descriptor/.test(e.message);}
    checks.push({name:'invalid-origin-rejected',kind:'validation',pass:rejected});
  });
  return {checks,images,identities,errors,passed:checks.filter(c=>c.pass).length,
    failed:checks.filter(c=>!c.pass).length+errors.length,
    scope:'Real WebGL2 production Device/GPU allocations and descriptor clears; direct GLSL observation. No guest, host COM, full module, gameplay or hardware qualification.'};
})()
