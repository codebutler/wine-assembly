#!/usr/bin/env python3
"""Small mode/identity regressions; no full-media staging or guest execution."""
import contextlib
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('staging', ROOT/'tools/enigma-bounded-staging.py')
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)


@contextlib.contextmanager
def umask(value):
    old = os.umask(value)
    try:
        yield
    finally:
        os.umask(old)


def row(path, target):
    data = path.read_bytes()
    return dict(kind='file', path=str(path), target=target, bytes=len(data),
                sha256=hashlib.sha256(data).hexdigest())


def signature(path):
    st = path.stat()
    return (st.st_dev, st.st_ino, stat.S_IMODE(st.st_mode), st.st_size,
            path.read_bytes(), st.st_nlink, st.st_mtime_ns)


def oracle(root):
    entries = [root.stat(), *(p.stat() for p in root.rglob('*'))]
    unique = {(x.st_dev, x.st_ino): x.st_blocks*512 for x in entries}
    return dict(files=sum(stat.S_ISREG(x.st_mode) for x in entries),
                logicalBytes=sum(x.st_size for x in entries if stat.S_ISREG(x.st_mode)),
                physicalOwnedBytes=sum(unique.values()),
                pathSummedAllocatedBytes=sum(x.st_blocks*512 for x in entries),
                uniqueInodes=len(unique))


class ModeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='enigma-mode-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def test_standing_modes_umasks_identity_and_accounting(self):
        observations = []
        # Include readonly nonfonts and every special permission bit. All files
        # have identical bytes: only fonts may share a newly owned inode.
        modes = [0o644, 0o600, 0o755, 0o664, 0o444, 0o7644, 0o7755]
        rows = []
        for i, mode in enumerate(modes):
            p = self.root/('source'+str(i))
            p.write_bytes(b'identical mode fixture\0'*37)
            p.chmod(mode)
            rows.append(row(p, 'vfs/required'+str(i)))
        rows += [dict(rows[0], target='runner/fonts/a'),
                 dict(rows[1], target='runtime/fonts/b')]
        before = {r['path']: signature(Path(r['path'])) for r in rows}
        for mask in [0o000, 0o002, 0o077]:
            out = self.root/('out'+str(mask))
            with umask(mask):
                receipt = s.stage(rows, out)
            self.assertEqual(receipt, oracle(out))
            ids = set()
            for r, mode in zip(rows, modes):
                target = out/r['target']
                actual = stat.S_IMODE(target.stat().st_mode)
                self.assertEqual(actual, mode & 0o777)
                self.assertEqual(target.read_bytes(), Path(r['path']).read_bytes())
                self.assertFalse(os.path.samefile(target, r['path']))
                ids.add((target.stat().st_dev, target.stat().st_ino))
                observations.append(dict(umask=oct(mask), source=oct(mode), actual=oct(actual)))
            self.assertEqual(len(ids), len(modes))
            a, b = out/rows[-2]['target'], out/rows[-1]['target']
            self.assertTrue(os.path.samefile(a, b))
            self.assertNotIn((a.stat().st_dev, a.stat().st_ino), ids)
            self.assertEqual(stat.S_IMODE(a.stat().st_mode), 0o444)
            # Writable source -> independent writable output. Readonly source
            # -> readonly output; no writable sharing with the fonts or donors.
            (out/rows[0]['target']).write_bytes(b'changed')
            self.assertEqual(a.read_bytes(), Path(rows[0]['path']).read_bytes())
            self.assertEqual((out/rows[1]['target']).read_bytes(), a.read_bytes())
            self.assertEqual(before, {r['path']: signature(Path(r['path'])) for r in rows})
        print(json.dumps(dict(modeObservations=observations)), flush=True)

    def test_git_modes_are_from_pinned_regular_tree_entries(self):
        repo = self.root/'git'
        def git(*args):
            return subprocess.check_output(['git', '-C', str(repo), *args], stderr=subprocess.DEVNULL)
        subprocess.run(['git', 'init', '-q', str(repo)], check=True)
        names = ['plain, [literal]\nfile', 'nested/executable']
        for name, mode in zip(names, [0o644, 0o755]):
            p = repo/name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(b'git mode fixture\0')
            p.chmod(mode)
        (repo/'link').symlink_to(names[0])
        git('add', '.')
        git('-c', 'user.name=fixture', '-c', 'user.email=fixture@local', 'commit', '-qm', 'fixture')
        revision = git('rev-parse', 'HEAD').decode().strip()
        rows = [dict(row(repo/name, 'runner/'+str(i)), kind='git', donor=str(repo),
                     revision=revision, path=name) for i, name in enumerate(names)]
        # Worktree metadata disagrees with Git: pinned tree is authoritative.
        for name in names:
            (repo/name).chmod(0o600)
        for mask in [0o000, 0o002, 0o077]:
            out = self.root/('git-out'+str(mask))
            with umask(mask):
                s.stage(rows, out)
            self.assertEqual([stat.S_IMODE((out/r['target']).stat().st_mode) for r in rows],
                             [0o644, 0o755])
        for path in ['link', 'nested', 'missing']:
            with self.assertRaises(ValueError):
                s.stage([dict(rows[0], path=path)], self.root/'rejected')
            self.assertFalse((self.root/'rejected').exists())
            self.assertFalse(list(self.root.glob('.enigma-stage-*')))

    def test_nonregular_file_sources_rejected_before_read(self):
        donor = self.root/'donor'
        donor.write_bytes(b'fixture')
        r = row(donor, 'runtime/required')
        (self.root/'link').symlink_to(donor)
        (self.root/'dir').mkdir()
        os.mkfifo(self.root/'fifo')
        for name in ['link', 'dir', 'fifo', 'missing']:
            with self.assertRaises((ValueError, FileNotFoundError)):
                s.stage([dict(r, path=str(self.root/name))], self.root/'out')
            self.assertFalse((self.root/'out').exists())
            self.assertFalse(list(self.root.glob('.enigma-stage-*')))
        self.assertEqual(donor.read_bytes(), b'fixture')

    def test_chmod_failure_cleans_only_owned_tree(self):
        donor = self.root/'donor'
        donor.write_bytes(b'fixture')
        donor.chmod(0o600)
        before = signature(donor)
        foreign = self.root/'.enigma-stage-foreign'
        foreign.mkdir()
        (foreign/'keep').write_bytes(b'evidence')
        with patch.object(Path, 'chmod', side_effect=OSError('injected chmod failure')):
            with self.assertRaisesRegex(OSError, 'injected chmod'):
                s.stage([row(donor, 'runtime/required')], self.root/'out')
        self.assertEqual(signature(donor), before)
        self.assertFalse((self.root/'out').exists())
        self.assertEqual(list(self.root.glob('.enigma-stage-*')), [foreign])
        self.assertEqual((foreign/'keep').read_bytes(), b'evidence')

    def test_changed_duplicate_still_rehashed_with_mode_preservation(self):
        donor = self.root/'font'
        duplicate = self.root/'duplicate'
        donor.write_bytes(b'pinned font')
        duplicate.write_bytes(donor.read_bytes())
        donor.chmod(0o644)
        rows = [row(donor, 'runner/fonts/a'), row(duplicate, 'runtime/fonts/a'),
                row(donor, 'vfs/independent')]
        before = signature(donor)
        duplicate.write_bytes(b'changed now')  # same length; original pin retained
        with self.assertRaisesRegex(ValueError, 'identity changed'):
            s.stage(rows, self.root/'out')
        self.assertFalse((self.root/'out').exists())
        self.assertFalse(list(self.root.glob('.enigma-stage-*')))
        self.assertEqual(signature(donor), before)


if __name__ == '__main__':
    unittest.main()
