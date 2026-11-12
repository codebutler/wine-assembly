#!/usr/bin/env python3
"""Rebuild original CC0 test fonts; requires fontTools, never an installed font.

All glyph geometry and bitmap pixels below were constructed for this repository.
There is no CJK font input: Chinese strings are name-table metadata only.
"""
from pathlib import Path
import struct
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTCollection, newTable
from fontTools.ttLib.tables.DefaultTable import DefaultTable

OUT = Path(__file__).resolve().parents[1] / 'test/fixtures/ttc-ebdt'
STAMP = 2082844800  # 1970-01-01 in the sfnt epoch
GLYPHS = ['.notdef', 'space', 'A', 'B', 'C', 'D', 'E', 'F', 'G']
PIXELS = ['10101', '01010', '11111', '01010', '10101']

def bitmap(aligned):
    bits = ''.join(row.ljust(8, '0') if aligned else row for row in PIXELS)
    bits = bits.ljust((len(bits) + 7) // 8 * 8, '0')
    return int(bits, 2).to_bytes(len(bits) // 8, 'big')

def embedded(font):
    data = bytearray(struct.pack('>I', 0x20000))
    subtables = []
    # glyphs, index format, image format; F intentionally absent in sparse E..G.
    cases = [([1], 1, 1), ([2], 1, 1), ([3], 3, 2),
             ([4], 2, 5), ([5], 1, 6), ([6, 8], 5, 7)]
    for gids, index, image in cases:
        start = len(data)
        offsets = [0]
        blank = gids == [1]
        small = struct.pack('>BBbbB', 0 if blank else 5, 0 if blank else 5,
                            0 if blank else -1, 0 if blank else (14 if image == 7 else 7),
                            4 if blank else 9)
        big = small + bytes([0, 0, 0])
        for _ in gids:
            if image in (1, 2):
                data.extend(small)
            elif image in (6, 7):
                data.extend(big)
            if not blank:
                data.extend(bitmap(image in (1, 6)))
            offsets.append(len(data) - start)
        sub = struct.pack('>HHI', index, image, start)
        if index == 1:
            sub += struct.pack('>' + 'I' * len(offsets), *offsets)
        elif index == 3:
            sub += struct.pack('>' + 'H' * len(offsets), *offsets)
        elif index == 2:
            sub += struct.pack('>I', offsets[1]) + big
        elif index == 5:
            sub += struct.pack('>I', offsets[1]) + big
            sub += struct.pack('>I', len(gids)) + struct.pack('>' + 'H' * len(gids), *gids)
        subtables.append((gids[0], gids[-1], sub))
    array = bytearray()
    payload = bytearray()
    for first, last, sub in subtables:
        array.extend(struct.pack('>HHI', first, last, len(subtables) * 8 + len(payload)))
        payload.extend(sub)
    indexes = array + payload
    # 48-byte bitmapSizeTable: horizontal metrics + vertical metrics, range,
    # ppemX/Y, depth, horizontal flag.
    size = struct.pack('>IIII', 56, len(indexes), len(subtables), 0)
    size += struct.pack('>bbBbbbbbbbbb', 9, -3, 9, 1, 0, 0, -1, 0, 7, 2, 0, 0)
    size += bytes(12) + struct.pack('>HHBBBB', 1, 8, 12, 12, 1, 1)
    assert len(size) == 48
    for tag, value in [('EBLC', struct.pack('>II', 0x20000, 1) + size + indexes),
                       ('EBDT', bytes(data))]:
        table = DefaultTable(tag)
        table.data = value
        font[tag] = table

def face(family, localized, advance, strikes=False):
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(GLYPHS)
    # Above U+00FF, with a low byte pointing at F: catches byte truncation
    # and exercises both the Unicode cmap and embedded image selection.
    fb.setupCharacterMap({32: 'space', 0x4E46: 'A', **{ord(g): g for g in GLYPHS[2:]}})
    glyphs = {}
    for name in GLYPHS:
        pen = TTGlyphPen(None)
        if name != 'space':
            # Deliberately unlike the bitmap: a solid rectangle.
            pen.moveTo((100, 0)); pen.lineTo((400, 0))
            pen.lineTo((400, 700)); pen.lineTo((100, 700)); pen.closePath()
        glyphs[name] = pen.glyph()
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics({g: (advance, 100) for g in GLYPHS})
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({'familyName': family, 'styleName': 'Regular',
                       'uniqueFontIdentifier': family + '-1', 'fullName': family,
                       'psName': family.replace(' ', ''), 'version': 'Version 1.000',
                       'copyright': 'Original test artwork dedicated to the public domain under CC0-1.0.'})
    fb.font['name'].setName(localized, 1, 3, 1, 0x0404)
    fb.setupOS2(sTypoAscender=800, sTypoDescender=-200,
                usWinAscent=800, usWinDescent=200)
    fb.setupPost(); fb.setupMaxp()
    fb.font['head'].created = fb.font['head'].modified = STAMP
    fb.font.recalcTimestamp = False
    if strikes:
        embedded(fb.font)
    return fb.font

def complex_face():
    # One contour retraces the same triangle 400 times: 1200 explicit points
    # and 1200 non-horizontal edges, with 800 simultaneous scan crossings.
    # Repeated winding keeps expected pixels simple and the compressed font tiny.
    fb = FontBuilder(1000, isTTF=True)
    order = ['.notdef', 'space', 'H', 'I', 'J']
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({32: 'space', 72: 'H', 73: 'I', 74: 'J'})
    glyphs = {}
    for name in ['.notdef', 'space', 'H', 'J']:
        pen = TTGlyphPen(None)
        if name != 'space':
            pen.moveTo((100, 0))
            for n in range(400 if name == 'H' else 100 if name == 'J' else 1):
                if n:
                    pen.lineTo((100, 0))
                pen.lineTo((400, 700)); pen.lineTo((700, 200))
            pen.closePath()
        glyphs[name] = pen.glyph()
    pen = TTGlyphPen(glyphs)
    pen.addComponent('H', (1, 0, 0, 1, 0, 0))
    pen.addComponent('H', (1, 0, 0, 1, 0, 0))
    glyphs['I'] = pen.glyph()
    # Exercise a 300-point hinted outline including its four phantom points.
    from fontTools.ttLib.tables.ttProgram import Program
    glyphs['J'].program = Program()
    glyphs['J'].program.fromBytecode([0x00])  # SVTCA[y]
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics({g: (800, 100) for g in order})
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({'familyName': 'Fixture Complex', 'styleName': 'Regular',
                       'uniqueFontIdentifier': 'FixtureComplex-1',
                       'fullName': 'Fixture Complex', 'psName': 'FixtureComplex',
                       'copyright': 'Original CC0-1.0 test geometry.'})
    fb.setupOS2(sTypoAscender=800, sTypoDescender=-200,
                usWinAscent=800, usWinDescent=200)
    fb.setupPost(); fb.setupMaxp()
    fb.font['head'].created = fb.font['head'].modified = STAMP
    fb.font.recalcTimestamp = False
    return fb.font

if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    first = face('Fixture Bitmap', '測試甲', 600, True)
    second = face('Fixture Other', '測試乙', 900)
    first.save(OUT / 'bitmap.ttf')
    collection = TTCollection(); collection.fonts = [first, second]
    collection.save(OUT / 'faces.ttc')
    complex_face().save(OUT / 'complex.ttf')
