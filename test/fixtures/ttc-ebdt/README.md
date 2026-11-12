These tiny TrueType fixtures are original test artwork, dedicated to the public
domain under CC0-1.0. No installed or third-party font was used. The Chinese
strings are family-name metadata, not copied glyph designs.

Rebuild deterministically with `python3 tools/gen-ttc-ebdt-fixtures.py` (fontTools
required). Tests read the committed output and need neither Python nor network.

`bitmap.ttf` has a solid rectangle outline and a deliberately different 5x5
checker/cross bitmap at 12ppem, with advance 9 instead of the outline's 7 pixels.
It covers index formats 1/2/3/5 and image formats 1/2/5/6/7. F is absent from a
sparse E..G strike range; E/G extend above the normal font ascent; space is an explicit empty image with advance 4.
U+4E46 also maps to A. Its low byte F has no strike, so W text tests detect
truncation and the ambiguous printable-byte heuristic using different pixels.
`faces.ttc` contains this face and Fixture Other (different outline advances),
with English and Traditional Chinese family names. Tables are shared by the TTC
writer, exercising file-relative offsets and payloads before face directories.

`complex.ttf` contains original triangle geometry: H retraces a triangle 400
times in one contour (1200 points, 1200 non-horizontal edges and up to 800
simultaneous crossings); I composes two H glyphs (2400 points/edges); J uses
300 points with SVTCA[y] bytecode and four hinting phantom points. All three
must draw ink at 12/28/64px; the large simple and composite pixels must match.
The raster test also verifies geometric scratch growth and independent scratch
ownership in two Wasm instances sharing the same linear memory.
