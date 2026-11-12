import pathlib,json,shutil,sys
base=pathlib.Path(__file__).resolve().parent.parent
ops=base/'ops'
mode=sys.argv[1]
native=False
admission=json.loads((ops/'admission.json').read_text())
def allocated(path):
    if path.is_file(): return path.stat().st_blocks * 512
    return sum(p.stat().st_blocks * 512 for p in path.rglob('*') if p.is_file())
positive = sum(max(0, pathlib.Path(p).stat().st_size - before) for p, before in admission['sqliteBaseline'].items() if pathlib.Path(p).exists())
prior = ops / 'sqlite-highwater.json'
highwater = max(positive, json.loads(prior.read_text())['positive'] if prior.exists() else 0)
prior.write_text(json.dumps({'positive': highwater}))
charges = {'owned': allocated(base), 'session': allocated(pathlib.Path(admission['session'])),
 'launcher': allocated(pathlib.Path(admission['launcher'])), 'positiveSQLiteHighwater': highwater,
 'futureGitTempEvidence': 4 * 1048576, 'futureSessionLauncherSQLite': 20 * 1048576, 'reserve': 8 * 1048576}
free = shutil.disk_usage(base).free
mem = int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:'))) * 1024
peak = sum(charges.values())
r = {'charges': charges, 'peak': peak, 'cap': 67108864, 'free': free, 'otherReservation': 67108864,
 'afterProjected': free-peak-67108864, 'floor': 2982150144, 'memAvailable': mem,
 'memMinimum': 2684354560 if native else 805306368}
r['pass'] = peak <= r['cap'] and r['afterProjected'] >= r['floor'] and mem >= r['memMinimum']
(ops / (mode + '-admission.json')).write_text(json.dumps(r, indent=2))
assert r['pass'], r

print(json.dumps(r))
