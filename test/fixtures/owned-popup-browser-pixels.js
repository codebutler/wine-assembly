/* Browser-only fixture. Geometry exports are synthetic; all pixel operations
 * use the unmodified renderer and CanvasSurface with real HTML canvases.
 * A GPU-kind layer is a bitmap stand-in, not WebGL execution. */
(() => {
  'use strict';
  const checks = [], images = [];
  function canvas(w, h, color) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    if (color) { const ctx = c.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); }
    return c;
  }
  function fixture() {
    const r = Object.create(Win98Renderer.prototype);
    r.windows = {};
    r.canvas = canvas(96, 72);
    r.surface = surfaceLib.surfaceFromCanvas(r.canvas);
    if (!(r.surface instanceof surfaceLib.CanvasSurface) || r.surface.isRaster)
      throw new Error('Expected real CanvasSurface');
    // Non-client guest painting is outside this composition fixture.
    r.drawWindow = () => {};
    r._createOffscreen = canvas;
    r._toolbarWidthLimit = () => 0;
    function win(hwnd, x, y, w, h, color, isChild = false, parentHwnd = 0) {
      const v = { hwnd, x, y, w, h, visible: true, isChild, parentHwnd,
        style: isChild ? 0x50000000 : 0x90000000, zOrder: hwnd,
        wasm: r.wasm, _canonicalOwnSurface: isChild, _gdiWriteSeq: 10, _backCanvas: canvas(w, h, color) };
      r.windows[hwnd] = v;
      return v;
    }
    const owner = win(1, 10, 10, 40, 35, '#112233');
    // Explicit post-SetParent host state: non-child popup retains owner link.
    const popup = win(2, 40, 20, 35, 30, '#334455', false, 1);
    popup.ownerHwnd = 1;
    const child = win(4, 42, 22, 28, 24, '#ee1100', true, 2);
    const nested = win(5, 65, 40, 20, 20, '#00ee11', true, 4);
    const ownerChild = win(6, 44, 12, 18, 12, '#1111ee', true, 1);
    r.wasm = { exports: {
      wnd_window_screen_x: h => r.windows[h].x, wnd_window_screen_y: h => r.windows[h].y,
      wnd_client_screen_x: h => r.windows[h].x + (h === 1 ? 2 : 0),
      wnd_client_screen_y: h => r.windows[h].y + (h === 1 ? 4 : 0),
      get_client_rect_l: () => 0, get_client_rect_t: () => 0,
      get_client_rect_r: h => r.windows[h].w - (h === 1 ? 5 : 0),
      get_client_rect_b: h => r.windows[h].h - (h === 1 ? 9 : 0),
    } };
    for (const v of Object.values(r.windows)) v.wasm = r.wasm;
    return { r, owner, popup, child, nested, ownerChild, win };
  }
  function pixel(name, c, x, y, expected) {
    if (!(c instanceof HTMLCanvasElement) || !(c.getContext('2d') instanceof CanvasRenderingContext2D))
      throw new Error('Pixel oracle requires browser Canvas2D');
    const actual = [...c.getContext('2d').getImageData(x, y, 1, 1).data];
    checks.push({ name, x, y, expected, actual, pass: actual.every((v, i) => v === expected[i]) });
  }
  function image(name, c) { images.push({ name, png: c.toDataURL('image/png').split(',')[1] }); }
  const red = [238, 17, 0, 255], green = [0, 238, 17, 255], blue = [18, 58, 188, 255];
  const popupColor = [51, 68, 85, 255], clear = [0, 0, 0, 0];
  // Production ordinary composition goes through CanvasSurface.pushClip/blit.
  {
    const { r, owner, popup } = fixture();
    r._compositeChildSurfaces(owner);
    pixel('screen owner pass excludes owned popup branch', r.canvas, 47, 30, clear);
    pixel('screen true child inside client', r.canvas, 46, 14, [17, 17, 238, 255]);
    pixel('screen true child outside owner client clipped', r.canvas, 55, 14, clear);
    r.surface.clear(0, 0, 96, 72);
    r._compositeChildSurfaces(popup);
    pixel('screen popup child outside owner survives', r.canvas, 60, 30, red);
    pixel('screen nested visible intersection', r.canvas, 67, 43, green);
    pixel('screen nested outside real parent clipped', r.canvas, 72, 48, clear);
    image('screen', r.canvas);
  }
  // Both production postprocess paths must draw the popup as a top-level slot.
  for (const mode of ['single', 'stack']) {
    const { r, owner, popup } = fixture();
    const own = r._buildExclusivePresentationSource(owner, mode === 'stack' ? [owner] : undefined);
    pixel(`${mode} owner excludes popup subtree`, own, 37, 20, [17, 34, 51, 255]);
    const c = r._buildExclusivePresentationSource(popup, mode === 'stack' ? [popup] : undefined);
    pixel(`${mode} popup child outside owner survives`, c, 20, 10, red);
    pixel(`${mode} nested visible intersection`, c, 27, 23, green);
    pixel(`${mode} nested outside real parent clipped`, c, 32, 28, popupColor);
    image(mode, c);
  }
  for (const mode of ['screen', 'single', 'stack']) {
    const { r, popup, nested } = fixture();
    nested._dxFrameLayer = { kind: 'gpu', canvas: canvas(20, 20, '#123abc') };
    nested.clientRect = { x: 66, y: 42, w: 19, h: 18 };
    const c = mode === 'screen' ? (r._compositeChildSurfaces(popup), r.canvas)
      : r._buildExclusivePresentationSource(popup, mode === 'stack' ? [popup] : undefined);
    const ox = mode === 'screen' ? 0 : 40, oy = mode === 'screen' ? 0 : 20;
    pixel(`${mode} bitmap GPU offset leaves frame visible`, c, 65 - ox, 41 - oy, green);
    pixel(`${mode} bitmap GPU inside ancestor clip`, c, 67 - ox, 43 - oy, blue);
    pixel(`${mode} bitmap GPU outside parent clipped`, c, 72 - ox, 48 - oy, mode === 'screen' ? clear : popupColor);
    image(`${mode}-gpu-bitmap`, c);
  }
  // Empty clip then later sibling tests save/restore in native Canvas2D.
  for (const mode of ['screen', 'single', 'stack']) {
    const { r, popup, child, win } = fixture();
    child.x = 90; child.y = 60;
    win(8, 71, 24, 12, 12, '#999999', true, 2);
    const c = mode === 'screen' ? (r._compositeChildSurfaces(popup), r.canvas)
      : r._buildExclusivePresentationSource(popup, mode === 'stack' ? [popup] : undefined);
    const ox = mode === 'screen' ? 0 : 40, oy = mode === 'screen' ? 0 : 20;
    pixel(`${mode} empty nested clip suppresses pixels`, c, 67 - ox, 43 - oy, mode === 'screen' ? clear : popupColor);
    pixel(`${mode} clip restored for later sibling`, c, 72 - ox, 25 - oy, [153, 153, 153, 255]);
    pixel(`${mode} sibling still clipped to popup`, c, 76 - ox, 25 - oy, clear);
    image(`${mode}-restore`, c);
  }
  // A genuine multi-window stack includes top-level pixels beyond the owner.
  {
    const { r, owner, popup } = fixture();
    const desktop = { hwnd: 9, x: 0, y: 0, w: 96, h: 72, _backCanvas: canvas(96, 72, '#080808') };
    r.windows[9] = desktop;
    const c = r._buildExclusivePresentationSource(desktop, [desktop, owner, popup]);
    pixel('multi-stack popup outside owner survives', c, 73, 48, popupColor);
    pixel('multi-stack child outside owner survives', c, 60, 30, red);
    pixel('multi-stack nested parent clip', c, 72, 48, popupColor);
    image('multi-stack', c);
  }
  return { checks, images, passed: checks.filter(c => c.pass).length, failed: checks.filter(c => !c.pass).length,
    canvas: 'HTMLCanvasElement/CanvasRenderingContext2D via production CanvasSurface',
    scope: 'Synthetic guest geometry and bitmap GPU-kind layer; no guest, WebGL or native GUI' };
})()
