#!/usr/bin/env python3
"""Finite streaming fixtures; no guest inputs are staged and no guest is run."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('staging', ROOT / 'tools/enigma-bounded-staging.py')
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
E = ROOT / 'docs/re-notes/enigma-staging-footprint-repair-20261026'
RESULT = {}


class Generated:
    def __init__(self, pattern, size=None):
        self.pattern = pattern
        self.size = len(pattern) if size is None else size
        self.offset = 0

    def read(self, n=-1):
        assert 0 < n <= 8192, 'unbounded input read'
        n = min(n, self.size-self.offset)
        if not n:
            return b''
        start = self.offset % len(self.pattern)
        block = (self.pattern * ((start+n+len(self.pattern)-1)//len(self.pattern)))[start:start+n]
        self.offset += n
        return block


class StagingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='enigma-regression-')
        self.root = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)
        self.donor = self.root / 'donor'
        self.donor.write_bytes(b'donor and historical evidence must survive')
        self.initial = self.donor.read_bytes()

    def row(self, target='runtime/fonts/a', content=b'font'):
        return dict(target=target, bytes=len(content), sha256=hashlib.sha256(content).hexdigest(),
                    kind='file', path=str(self.donor))

    def clean(self):
        self.assertEqual(self.donor.read_bytes(), self.initial)
        self.assertFalse(list(self.root.glob('.enigma-stage-*')))
        self.assertFalse((self.root / 'output').exists())

    def test_exact_font_shapes_baseline_fail_repair_pass(self):
        originals = json.loads((E / 'font-inputs.json').read_text())
        rows, contents = [], {}
        # Small faithful fixtures: exact sizes, multiplicities, paths; synthetic
        # content is specific to each original identity, never real font/media.
        for original in originals:
            pattern = bytes.fromhex(original['sha256'])
            stream = Generated(pattern, original['bytes'])
            digest = hashlib.sha256()
            while block := stream.read(8192):
                digest.update(block)
            row = dict(self.row(original['target']), bytes=original['bytes'], sha256=digest.hexdigest())
            rows.append(row)
            contents[row['target']] = (pattern, original['bytes'])
        # Required non-font copies stay independent, even if byte-identical.
        for target in ['vfs/game/data,1', 'runner/test/run.js', 'runtime/build/module.wasm']:
            rows.append(self.row(target, b'required bytes\0' * 19))
            contents[target] = (b'required bytes\0', len(b'required bytes\0') * 19)

        @contextlib.contextmanager
        def opener(row):
            yield Generated(*contents[row['target']])

        old = s.stage(rows, self.root / 'old', opener, share_fonts=False)
        new = s.stage(rows, self.root / 'new', opener)
        savings = old['physicalOwnedBytes'] - new['physicalOwnedBytes']
        self.assertEqual(savings, 786432)  # 4 KiB fixture filesystem contract
        self.assertEqual(old['logicalBytes'], new['logicalBytes'])
        self.assertEqual(new['pathSummedAllocatedBytes'], old['pathSummedAllocatedBytes'])
        self.assertEqual(new['pathSummedAllocatedBytes'] - new['physicalOwnedBytes'], savings)
        seen = {}
        for row in rows:
            for tree in ['old', 'new']:
                p = self.root / tree / row['target']
                self.assertEqual(p.stat().st_size, row['bytes'])
                with p.open('rb') as f:
                    s.consume(row, f)
                self.assertNotEqual(p.stat().st_ino, self.donor.stat().st_ino)
            p = self.root / 'new' / row['target']
            if s.font(row['target']):
                self.assertEqual(p.stat().st_mode & 0o222, 0)
                key = row['bytes'], row['sha256']
                if key in seen:
                    self.assertTrue(os.path.samefile(p, seen[key]))
                seen[key] = p
        nonfonts = [self.root / 'new' / x['target'] for x in rows if not s.font(x['target'])]
        self.assertEqual(len({p.stat().st_ino for p in nonfonts}), len(nonfonts))
        cap = 67108864
        projections = []
        for excess in [438272, 479232]:
            baseline = cap + excess
            repaired = baseline - savings
            self.assertGreater(baseline, cap)
            self.assertLessEqual(repaired, cap)
            projections.append(dict(baseline=baseline, excess=excess, repaired=repaired,
                                    headroom=cap-repaired))
        RESULT.update(old=old, new=new, savings=savings, projections=projections,
                      allContentHashesVerified=True, guestQualification=False)

    def test_changed_duplicate_is_not_skipped(self):
        a = self.row('runtime/fonts/a', b'abcd')
        b = dict(a, target='runner/fonts/a')
        @contextlib.contextmanager
        def opener(row):
            yield Generated(b'abcd' if row is a else b'bad!')
        with self.assertRaisesRegex(ValueError, 'identity changed'):
            s.stage([a, b], self.root / 'output', opener)
        self.clean()

    def test_missing_source(self):
        row = dict(self.row(), path=str(self.root / 'missing'))
        with self.assertRaises(FileNotFoundError):
            s.stage([row], self.root / 'output')
        self.clean()

    def test_wrong_size_and_changed_content(self):
        for data in [b'x', b'font plus extra', b'FONT']:
            @contextlib.contextmanager
            def opener(row):
                yield Generated(data)
            with self.assertRaises(ValueError):
                s.stage([self.row()], self.root / 'output', opener)
            self.clean()

    def test_interruption_and_link_error_cleanup(self):
        rows = [self.row(), self.row('runner/fonts/a')]
        @contextlib.contextmanager
        def interrupted(row):
            if row is rows[1]:
                raise KeyboardInterrupt()
            yield Generated(b'font')
        with self.assertRaises(KeyboardInterrupt):
            s.stage(rows, self.root / 'output', interrupted)
        self.clean()
        @contextlib.contextmanager
        def opener(row):
            yield Generated(b'font')
        link = s.os.link
        def broken_link(*args):
            raise OSError('no hardlinks')
        s.os.link = broken_link
        try:
            with self.assertRaises(OSError):
                s.stage(rows, self.root / 'output', opener)
        finally:
            s.os.link = link
        self.clean()

    def test_path_rejections_and_existing_evidence(self):
        for target in ['../donor', '/absolute', 'x/../donor', './x', '.', 'x//a']:
            with self.assertRaises(ValueError):
                s.stage([self.row(target)], self.root / 'output')
        for rows in [[self.row(), self.row()], [self.row('a'), self.row('a/b')]]:
            with self.assertRaises(ValueError):
                s.stage(rows, self.root / 'output')
        with self.assertRaises(FileExistsError):
            s.stage([], self.donor)
        (self.root / 'output').symlink_to(self.donor)
        with self.assertRaises(FileExistsError):
            s.stage([], self.root / 'output')
        (self.root / 'output').unlink()
        self.clean()

    def test_cli_file_and_git_sources(self):
        repo = self.root / 'git'
        subprocess.run(['git', 'init', '-q', str(repo)], check=True)
        (repo / 'blob').write_bytes(self.initial)
        subprocess.run(['git', '-C', str(repo), 'add', 'blob'], check=True)
        subprocess.run(['git', '-C', str(repo), '-c', 'user.name=fixture', '-c',
                        'user.email=fixture@local', 'commit', '-qm', 'fixture'], check=True)
        rev = subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip()
        a = self.row('runtime/fonts/a', self.initial)
        b = dict(a, target='runner/fonts/a', kind='git', donor=str(repo), revision=rev, path='blob')
        manifest = self.root / 'manifest.json'
        manifest.write_text(json.dumps([a, b]))
        p = subprocess.run([sys.executable, '-B', str(ROOT / 'tools/enigma-bounded-staging.py'),
                            str(manifest), str(self.root / 'output')], capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(json.loads(p.stdout)['files'], 2)
        self.assertTrue(os.path.samefile(self.root / 'output'/a['target'], self.root/'output'/b['target']))
        bad = dict(b, path='absent')
        with self.assertRaises(ValueError):
            s.stage([bad], self.root / 'missing-git')
        self.assertFalse((self.root / 'missing-git').exists())
        self.assertEqual(self.donor.read_bytes(), self.initial)


if __name__ == '__main__':
    result = unittest.main(exit=False)
    if result.result.wasSuccessful():
        print(json.dumps(RESULT, sort_keys=True))
    sys.exit(not result.result.wasSuccessful())
