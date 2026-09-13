// A real WebGL context for headless Node runs, so the OpenGL guests are not
// browser-only.
//
// WHY THIS EXISTS
//   lib/gl-compat.js reaches the GPU through `document.createElement('canvas')`
//   and `canvas.getContext('webgl')`. Node has neither, so every OpenGL guest
//   -- Warcraft III, Quake II, the D3D paths that land on the GL backend --
//   could only ever be driven through tools/profile-web-frames.js and a real
//   Chrome. That is why the WC3 investigation has been a browser-automation
//   problem rather than an emulator problem: `wglCreateContext` returns 0
//   headless, the guest takes its "no 3D hardware" path, and test/run.js's
//   whole tracing arsenal (--trace-api, --count, --break, --handler-hist)
//   was unreachable for exactly the apps that most needed it.
//
// WHAT BACKS IT
//   @kmamal/gl -- the maintained fork of stackgl/headless-gl. It ships prebuilt
//   binaries, which matters: plain `gl` cannot be built here at all. Its
//   vendored ANGLE is old enough to use `std::auto_ptr`, removed in C++17,
//   while Node 23's V8 headers `#error` out below C++20 -- the two requirements
//   have no overlap, verified by building it both ways.
//
//   The fork binds a context to an @kmamal/sdl window rather than to nothing,
//   so "headless" here means a HIDDEN window, not the absence of one. Measured
//   on this box: `WebGL 1.0 stack-gl 9.1.0`, renderer ANGLE (Metal-backed),
//   MAX_TEXTURE_SIZE 16384 -- real hardware, not a software rasterizer.
//
// OPTIONAL BY CONSTRUCTION
//   Both packages are native and both are optionalDependencies. Everything
//   here degrades to `null`, and a caller that gets null behaves exactly as
//   Node behaved before this file existed. The browser never loads it.
//
// WEBGL 1, NOT 2
//   That is what the fork exposes, and lib/gpu-backend.js already falls back to
//   `webgl`/`experimental-webgl` when it is not asked for version 2. The one
//   thing that genuinely needs WebGL2 is transform feedback on the d3d9 shader
//   path, which throws its own clear error rather than rendering wrongly.

let sdl = null;
let createGl = null;
let loadError = null;
let loaded = false;

// Loading is deferred and memoized: requiring a native module costs real time,
// and the overwhelmingly common case is a run that never asks for GL at all.
function load() {
  if (loaded) return !loadError;
  loaded = true;
  try {
    sdl = require('@kmamal/sdl');
    createGl = require('@kmamal/gl');
  } catch (err) {
    loadError = err;
    sdl = null;
    createGl = null;
  }
  return !loadError;
}

function available() { return load(); }

// Why the load failed, for a caller that wants to say so out loud rather than
// silently render nothing. A missing optional dependency and a broken native
// build are very different problems and the message separates them.
function unavailableReason() {
  if (available()) return null;
  const msg = loadError ? String(loadError.message || loadError) : 'not loaded';
  if (/Cannot find module/.test(msg)) {
    return 'headless GL needs the optional native deps: npm install @kmamal/sdl @kmamal/gl';
  }
  return `headless GL is installed but did not load: ${msg}`;
}

// One hidden SDL window per context. SDL windows are a scarce, process-wide
// resource and the guest can create and destroy GL contexts freely, so each one
// is tracked and released in destroy() rather than left to the process exit.
const live = new Set();

// Create an offscreen WebGL 1 context sized w x h, or null if the native deps
// are not installed. `opts` takes the same shape getContext() does; only the
// flags the backend actually sets are forwarded, because the fork rejects
// unknown keys on some builds.
function createContext(w, h, opts) {
  if (!available()) return null;
  const width = Math.max(1, w | 0);
  const height = Math.max(1, h | 0);
  let window = null;
  try {
    window = sdl.video.createWindow({
      opengl: true, hidden: true, width, height, resizable: true,
    });
    const o = opts || {};
    const gl = createGl(width, height, {
      window,
      alpha: o.alpha !== false,
      depth: o.depth !== false,
      stencil: !!o.stencil,
      antialias: !!o.antialias,
      // The compositor reads the drawing buffer back with readPixels AFTER the
      // guest's present returns, which is precisely the case the WebGL spec
      // says is undefined without this. Without it the frame is whatever the
      // driver felt like leaving behind -- usually black, intermittently not,
      // which is the worst way for this to fail.
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('createGl returned null');
    const entry = { gl, window };
    live.add(entry);
    gl.__wineWindow = window;
    gl.__wineDestroy = () => {
      if (!live.has(entry)) return;
      live.delete(entry);
      try { const e = gl.getExtension('STACKGL_destroy_context'); if (e) e.destroy(); } catch (_) {}
      try { window.destroy(); } catch (_) {}
    };
    return gl;
  } catch (err) {
    try { if (window) window.destroy(); } catch (_) {}
    loadError = err;
    return null;
  }
}

// Resize an existing context in place. Returns false when the build has no
// resize extension, which tells the caller to recreate instead of silently
// rendering at the old size -- a wrong-sized drawing buffer reads downstream as
// a scaling bug in the compositor and is very hard to see.
function resizeContext(gl, w, h) {
  if (!gl) return false;
  const width = Math.max(1, w | 0);
  const height = Math.max(1, h | 0);
  try {
    if (gl.__wineWindow && typeof gl.__wineWindow.setSize === 'function') {
      gl.__wineWindow.setSize(width, height);
    }
  } catch (_) {}
  try {
    const ext = gl.getExtension('STACKGL_resize_drawingbuffer');
    if (!ext || typeof ext.resize !== 'function') return false;
    ext.resize(width, height);
    return true;
  } catch (_) { return false; }
}

function destroyContext(gl) {
  if (gl && typeof gl.__wineDestroy === 'function') gl.__wineDestroy();
}

// Read the drawing buffer into an RGBA Uint8ClampedArray laid out the way a 2D
// canvas is: top row first. GL's origin is bottom-left, so this flips. The
// destination is passed in because the caller owns a canvas-sized buffer
// already and a per-frame allocation of a 940x702 surface is 2.6 MB of garbage.
function readPixelsInto(gl, w, h, dest) {
  const width = Math.max(1, w | 0);
  const height = Math.max(1, h | 0);
  const stride = width * 4;
  const need = stride * height;
  if (!dest || dest.length < need) return false;
  const row = readPixelsInto._row && readPixelsInto._row.length === need
    ? readPixelsInto._row : (readPixelsInto._row = new Uint8Array(need));
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, row);
  for (let y = 0; y < height; y++) {
    dest.set(row.subarray((height - 1 - y) * stride, (height - y) * stride), y * stride);
  }
  return true;
}

module.exports = {
  available, unavailableReason, createContext, resizeContext, destroyContext,
  readPixelsInto,
  // For a harness that wants to assert nothing leaked.
  liveContextCount: () => live.size,
};
