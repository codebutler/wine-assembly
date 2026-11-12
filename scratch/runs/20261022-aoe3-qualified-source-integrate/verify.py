#!/usr/bin/env python3
"""Verify the compact integration evidence without a build or runtime."""
from pathlib import Path
import json,hashlib,subprocess
E=Path(__file__).resolve().parent
def sealed(data,row):
 assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']
seals=json.loads((E/'evidence-seals.json').read_text())
for n,row in seals.items():
 p=E/n;assert p.resolve().is_relative_to(E) and not p.is_symlink();sealed(p.read_bytes(),row)
m=json.loads((E/'source-mapping.json').read_text())
assert m['base']=='63d563df7a2b901d222a311ceaf55a0823a22261'
assert m['qualifiedCandidate']=='c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2'
assert m['watSourceFilesIdentical']==128 and m['matchingNonEvidenceNonNotePaths']==7362
assert m['allOtherTrackedPathsAndModesIdentical'] and not m['freshBuild'] and not m['freshGuest']
assert m['census']['entries']==407 and m['census']['changedRows']==1
assert (E/'root-before.json').read_bytes()==(E/'root-after.json').read_bytes()
for n in ['host-check-result.json','census-mutations-result.json']:
 assert json.loads((E/n).read_text())['exit']==0
assert '407 source boundaries unchanged' in (E/'census.log').read_text()
assert json.loads((E/'canonical-receipt-drift.json').read_text())['result']=='PASS'
assert len(json.loads((E/'canonical-receipt-drift.json').read_text())['overlayOnlyForPublishedReceipt'])==1
a=json.loads((E/'allocation.json').read_text());assert a['allocated']+a['reserve']<a['cap'] and a['free']>a['floor']
row=seals['source-mapping.json'];data=(E/'source-mapping.json').read_bytes()
for altered in [data+b'changed',data[:-1]]:
 try:sealed(altered,row)
 except AssertionError:pass
 else:raise AssertionError('changed/truncated mapping accepted')
try:sealed(data,dict(row,sha256='0'*64))
except AssertionError:pass
else:raise AssertionError('forged digest accepted')
print('PASS integration seals/source mapping/407 metadata/test results/root protection/allocation; changed/truncated mapping and forged hash REJECT. No fresh build/runtime claim.')
