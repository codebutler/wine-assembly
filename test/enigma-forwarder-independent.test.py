#!/usr/bin/env python3
"""Independent chain/provider and actual PE ordinal/boundary controls (static)."""
import copy
import hashlib
import json
from pathlib import Path
import struct
import sys
import types

sys.dont_write_bytecode = True
retained, owned = map(Path, sys.argv[1:])
owned.mkdir(parents=True, exist_ok=False)
tool = Path(__file__).resolve().parents[1]/'tools/enigma-unpacked-closure.py'
source = tool.read_bytes()
u = types.ModuleType('independent')
u.__file__ = str(tool)
exec(compile(source, str(tool), 'exec'), u.__dict__)
checks = []
def reject(label, operation, reason):
    try:
        operation()
    except (AssertionError, ValueError) as error:
        assert reason in str(error), (label, str(error))
        checks.append({'control': label, 'rejected': str(error)})
    else:
        raise AssertionError('accepted '+label)

# A multihop chain must select b.dll rather than b.dll.dll, carry the
# normalized ordinal, visit the terminal provider's imports, and permit a
# second consumer. A previously visited module must not conceal a chain cycle.
graph = {
    'enigma.exe': {'imports': {'c.dll': ['named'], 'a.dll': ['alias', 'alias']}, 'exports': {}},
    'a.dll': {'imports': {}, 'exports': {'alias': 'B.DLL.#00012'}},
    'b.dll': {'imports': {}, 'exports': {'#12': 'c.named'}},
    'b.dll.dll': {'imports': {}, 'exports': {'#12': 'absent.trap'}},
    'c.dll': {'imports': {'kernel32.dll': ['GetTickCount']}, 'exports': {'named': None}},
}
result = u.closure(graph)
assert result['packaged_bindings'] == [
    ['c.dll', 'named'], ['a.dll', 'alias'], ['b.dll', '#12'], ['c.dll', 'named'],
    ['a.dll', 'alias'], ['b.dll', '#12'], ['c.dll', 'named']]
assert result['system_requirements'] == {'kernel32.dll': ['GetTickCount']}
checks.append({'control': 'exact provider, multihop ordinal, repeated consumer and terminal imports', 'result': 'PASS'})
wrong = copy.deepcopy(graph)
wrong['c.dll']['exports']['named'] = 'a.alias'
reject('cycle through previously visited provider', lambda: u.closure(wrong), 'forward cycle')
wrong = copy.deepcopy(graph)
del wrong['b.dll']
reject('similarly named provider cannot satisfy exact provider', lambda: u.closure(wrong), 'unresolved DLL b.dll')

raw = (retained/'outputs/SDL.dll').read_bytes()
auth = u.pe(retained/'outputs/SDL.dll')
def off(rva):
    s = next(s for s in auth['sections'] if s['rva'] <= rva < s['rva']+s['raw_size'])
    return s['raw']+rva-s['rva']
o = struct.unpack_from('<I', raw, 60)[0]+24
er, es = struct.unpack_from('<II', raw, o+96)
base, nf, nn, fr, nr, orn = struct.unpack_from('<IIIIII', raw, off(er)+16)
index = next(i for i in range(nn) if raw[off(struct.unpack_from('<I',raw,off(nr)+4*i)[0]):].split(b'\0',1)[0] == b'SDL_Init')
slot = struct.unpack_from('<H', raw, off(orn)+2*index)[0]
eat = off(fr)+4*slot
assert eat == 299908
fixture = owned/'ordinal-boundary.dll'
def parse(patches):
    b = bytearray(raw)
    for at, fmt, value in patches:
        struct.pack_into(fmt, b, at, value)
    fixture.write_bytes(b)
    return u.pe(fixture)

rebased = parse([(off(er)+16, '<I', 1000)])
assert rebased['exports']['#'+str(1000+slot)] is None
assert rebased['export_rvas']['#'+str(1000+slot)] == rebased['export_rvas']['SDL_Init'] == 0x1340
checks.append({'control': 'nonunit real export ordinal base preserves name-to-slot mapping', 'result': 'PASS'})
reject('named export pointing at EAT hole', lambda: parse([(eat, '<I', 0)]), 'export ordinal/name')
reject('name ordinal index one beyond function table', lambda: parse([(off(orn)+2*index, '<H', nf)]), 'export ordinal/name')
# At the upper exclusive boundary, a mapped data RVA is a direct export,
# irrespective of its bytes. The byte immediately inside must be parsed.
assert off(er+es) < len(raw)
direct = parse([(eat, '<I', er+es)])
assert direct['exports']['SDL_Init'] is None and direct['export_rvas']['SDL_Init'] == er+es
reject('last byte inside extent is empty forwarder', lambda: parse([(eat, '<I', er+es-1), (off(er+es-1), '<B', 0)]), 'malformed forwarder')
checks.append({'control': 'exclusive export end is direct mapped data', 'result': 'PASS'})
print(json.dumps({'verdict': 'PASS_INDEPENDENT_CONTROLS', 'parser_sha256': hashlib.sha256(source).hexdigest(),
                  'SDL_sha256': hashlib.sha256(raw).hexdigest(), 'checks': checks}, indent=2))
