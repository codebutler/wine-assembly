#!/usr/bin/env python3
"""Replacement streaming recipe, offline verification by default.

Optional --stage creates a NEW tree on a host with the pinned standing inputs.
It requires a separate fresh resource admission; never run that option on the
repair worker. For API transfer, send each canonical font once and create its
listed aliases inside the owned target, then rehash EVERY target there. Do not
use donor links or skip verification of a required duplicate source.
Independent non-font files must retain ordinary source rwx bits, regardless of
umask (standing regular file st_mode & 0777; pinned Git tree 0644/0755).
The helper applies this contract locally. Any later transfer must preserve and
verify these modes as well as bytes/aliases; strip setuid/setgid/sticky bits,
and never chmod font aliases. Source metadata must remain stable during staging.
"""
import argparse
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path

E = Path(__file__).resolve().parent
R = E.parents[2]
spec = importlib.util.spec_from_file_location('staging', R/'tools/enigma-bounded-staging.py')
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--stage', help='NEW owned destination; fresh admission required')
    args = p.parse_args()
    raw = gzip.decompress((E/'required-manifest.json.gz').read_bytes())
    pins = json.loads((E/'input-pins.json').read_text())
    assert hashlib.sha256(raw).hexdigest() == pins['manifest']['sha256']
    rows = json.loads(raw)
    s.validate(rows)
    canonical = {}
    aliases = []
    for row in rows:
        with s.source(row) as stream:
            s.consume(row, stream)
        if s.font(row['target']):
            key = row['bytes'], row['sha256']
            if key in canonical:
                aliases.append(dict(target=row['target'], canonical=canonical[key],
                                    bytes=row['bytes'], sha256=row['sha256']))
            else:
                canonical[key] = row['target']
    receipt = dict(manifestSHA256=pins['manifest']['sha256'], files=len(rows),
                   logicalBytes=sum(x['bytes'] for x in rows), allSourcesRehashed=True,
                   aliases=aliases, savedLogicalBytes=sum(x['bytes'] for x in aliases),
                   projected4KiBBlockSavings=sum((x['bytes']+4095)//4096*4096 for x in aliases),
                   guestExecuted=False, actualFullStaging=False)
    if args.stage:
        receipt['staging'] = s.stage(rows, args.stage)
        receipt['actualFullStaging'] = True
    print(json.dumps(receipt, sort_keys=True))

if __name__ == '__main__':
    main()
