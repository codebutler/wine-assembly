"""Independent production-boundary challenges, no top-level guest execution."""
import ast, errno, hashlib, importlib.util, json, os, pathlib, shutil, sys, tempfile, time, types
from unittest import mock
P=pathlib.Path; H=P(__file__).resolve().parent.parent; R=H/'repo'; O=H/'ops'; M=1048576
HELPER=R/'test/helpers/palette-browser-supervisor.py'; RUNNER=R/'test/fixtures/gl-transient-accounting/remote-run.py'
ORIGINAL=HELPER.read_bytes(); WRAPPER=RUNNER.read_bytes(); results=[]
def load():
    ns=types.ModuleType('actual');exec(compile(HELPER.read_bytes(),str(HELPER),'exec'),ns.__dict__);return ns
sup=load()
def callback(root, boundary):
    if boundary=='shared':
        return sup.accounting_check(dict(roots=[str(root)],transientRoots=[str(root/'tmp')],reserve=8*M,future=0,walBaseline={}))
    tree=ast.parse(WRAPPER)
    nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ('alloc','check') or isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='disk' for t in n.targets)]
    assert len(nodes)==3
    ns=dict(H=root,P=P,M=M,sup=sup,shutil=shutil,future=352*M,accounting=dict(samples=0,peakProjected=0,minFree=None,minMem=None))
    exec(compile(ast.Module(body=nodes,type_ignores=[]),str(RUNNER),'exec'),ns)
    return ns['check']
def fixture():
    t=tempfile.TemporaryDirectory(dir=O); p=P(t.name);(p/'tmp').mkdir();(p/'nested').mkdir();(p/'nested/required').write_bytes(b'A'*16384);return t,p
def reject(fn, label):
    try:r=fn()
    except (sup.AccountingUnknown, OSError, ValueError):return
    assert isinstance(r,str) and r, label+' accepted'
def version(p):return sup.AllocatedDisk._version(p.lstat())
def mutate(p,kind):
    before=version(p)
    if kind=='rewrite':
        time.sleep(.02);s=p.stat();p.write_bytes(b'B'*s.st_size);os.utime(p,ns=(s.st_atime_ns,s.st_mtime_ns))
    elif kind=='chmod':p.chmod(0o600 if p.stat().st_mode&0o777!=0o600 else 0o640)
    elif kind=='truncate':p.write_bytes(b'')
    elif kind=='replace':
        q=p.with_name('swap');q.write_bytes(b'C'*16384);q.replace(p)
    elif kind=='disappear':p.unlink()
    elif kind=='type':p.unlink();p.mkdir()
    assert not p.exists() or version(p)!=before, 'fixture metadata did not change'
def versions():
    for boundary in ('production','shared'):
        for kind in ('rewrite','chmod','truncate','replace','disappear','type'):
            t,p=fixture()
            with t:
                check=callback(p,boundary);assert check() is None;mutate(p/'nested/required',kind);reject(check,boundary+'/'+kind)
                results.append(boundary+'/'+kind)
    # Deliberate discarded retry AFTER charging required input. Use actual walk
    # and actual transient-disappearance retry; mutate only when retry starts.
    for kind in ('rewrite','truncate','replace','disappear'):
        t,p=fixture()
        with t:
            required=p/'nested/required';victim=p/'tmp/socket';victim.write_bytes(b'x'*4096)
            ledger=sup.AllocatedDisk([p],transient_roots=[p/'tmp'])
            original=sup.os.stat;fired=[]
            # Force required subtree first without replacing the production walker.
            original_scandir=sup.os.scandir
            class Entries:
                def __init__(self,fd):
                    with original_scandir(fd) as it:self.rows=sorted(it,key=lambda e:e.name=='tmp')
                def __enter__(self):return iter(self.rows)
                def __exit__(self,*a):pass
            def stat(name,*a,**kw):
                fd=kw.get('dir_fd');parent=P(os.readlink('/proc/self/fd/'+str(fd))) if fd is not None else None
                if parent==victim.parent and name==victim.name and not fired:
                    assert required in ledger.required_seen
                    fired.append(True);victim.unlink();mutate(required,kind)
                return original(name,*a,**kw)
            with mock.patch.object(sup.os,'scandir',Entries),mock.patch.object(sup.os,'stat',stat):reject(ledger.allocated,'discarded retry '+kind)
            assert fired and ledger.receipt['retries']==1 and ledger.receipt['samples']==0 and ledger.receipt['lastBytes'] is None
            results.append('discarded-retry/'+kind)
def namespace():
    for boundary in ('production','shared'):
        for action in ('add','remove','rename','replace-dir'):
            t,p=fixture()
            with t:
                check=callback(p,boundary);assert check() is None
                if action=='add':(p/'nested/new-child').mkdir()
                elif action=='remove':(p/'nested/required').unlink()
                elif action=='rename':(p/'nested/required').rename(p/'nested/renamed')
                else:(p/'nested').rename(p/'old');(p/'nested').mkdir()
                reject(check,boundary+'/namespace/'+action);results.append(boundary+'/namespace/'+action)
        t,p=fixture()
        with t:
            check=callback(p,boundary);assert check() is None
            for i in range(3):
                q=p/'tmp'/('socket'+str(i));q.mkdir();(q/'new').write_bytes(b'x'*8192);assert check() is None;shutil.rmtree(q);assert check() is None
            results.append(boundary+'/transient-directory-churn')
def mutable():
    t,p=fixture()
    with t:
        f=p/'wal';f.write_bytes(b'w'*16384)
        for bad in (p,p/'nested'):
            reject(lambda:sup.AllocatedDisk([bad],mutable_file_roots=[bad]),'mutable directory')
        reject(lambda:sup.AllocatedDisk([p],mutable_file_roots=[f]),'nonroot mutable exception')
        alias=p/'wal-link';alias.symlink_to(f)
        reject(lambda:sup.AllocatedDisk([alias],mutable_file_roots=[alias]),'symlink root exception');alias.unlink()
        hard=p/'hard';os.link(f,hard)
        # Exception is path-scoped. A required hardlink must still pin versions.
        ledger=sup.AllocatedDisk([f,hard],mutable_file_roots=[f]);ledger.allocated();mutate(f,'truncate');reject(ledger.allocated,'hardlink leaked exception')
        f.write_bytes(b'w'*16384);ledger=sup.AllocatedDisk([f],mutable_file_roots=[f]);ledger.allocated();f.write_bytes(b'g'*32768);grown=ledger.allocated();assert grown==f.stat().st_blocks*512
        f.write_bytes(b'');assert ledger.allocated()==0 # disclosed existing shrink semantics
        f.unlink();f.mkdir();reject(ledger.allocated,'mutable root type changed')
    t,p=fixture()
    with t:
        wal=p/'outside';wal.write_bytes(b'w'*8192);base=wal.stat().st_blocks*512
        root=p/'nested';check=sup.accounting_check(dict(roots=[str(root)],transientRoots=[],reserve=8*M,future=0,walBaseline={str(wal):base}));assert check() is None
        before=check.receipt['peakBytes'];wal.write_bytes(b'g'*32768);delta=wal.stat().st_blocks*512-base;assert delta>0
        assert check() is None;assert check.receipt['peakBytes']==before+delta
        assert check() is None;assert check.receipt['peakBytes']==before+delta
        wal.write_bytes(b'');assert check() is None
        reject(lambda:sup.accounting_check(dict(roots=[str(p)],reserve=8*M,future=0,walBaseline={str(wal):base})),'WAL counted under primary root')
    results.append('mutable roots, hardlinks, types, path scope, positive WAL once, shrink qualified')
def bounds():
    for err in (PermissionError(errno.EACCES,'fixture'),OSError(errno.EIO,'fixture'),FileNotFoundError(errno.ENOENT,'fake missing')):
        t,p=fixture()
        with t:
            ledger=sup.AllocatedDisk([p],transient_roots=[p/'tmp']);ledger.allocated();original=sup.os.stat
            def fault(name,*a,**kw):
                if name=='required':raise err
                return original(name,*a,**kw)
            with mock.patch.object(sup.os,'stat',fault):reject(ledger.allocated,'fault '+str(err.errno))
            assert ledger.receipt['lastBytes'] is None
    for kw in (dict(ceiling=1),dict(max_entries=2),dict(max_depth=1)):
        t,p=fixture()
        with t:reject(sup.AllocatedDisk([p],**kw).allocated,'bound '+str(kw))
    t,p=fixture()
    with t:
        ledger=sup.AllocatedDisk([p]);original=sup.time.monotonic;calls=[]
        def clock():calls.append(1);return 1 if len(calls)==1 else 3
        with mock.patch.object(sup.time,'monotonic',clock):reject(ledger.allocated,'deadline')
        check=callback(p,'production')
        with mock.patch.object(shutil,'disk_usage',return_value=types.SimpleNamespace(free=2982150144+352*M-1)):assert check()=='remote free floor'
        shared=callback(p,'shared')
        with mock.patch.object(shutil,'disk_usage',return_value=types.SimpleNamespace(free=2982150144+8*M-1)):assert shared()=='projected host disk floor'
    results.append('permission/EIO/fakeENOENT/ceiling/inventory/depth/deadline/headroom')
def omissions():
    global sup
    cases=[('version','if prior != version:', 'if False:',versions),
           ('namespace','if self.required_names.get(p, mandatory) != mandatory:', 'if False:',namespace),
           ('path-exception','p in self.mutable_files else self._version(s))','True else self._version(s))',versions),
           ('ceiling','if self.ceiling is not None and self.total > self.ceiling:', 'if False:',bounds)]
    for name,old,new,test in cases:
        assert ORIGINAL.count(old.encode())==1
        try:
            HELPER.write_bytes(ORIGINAL.replace(old.encode(),new.encode()));sup=load()
            failed=False
            try:test()
            except AssertionError as e:failed=True;results.append(dict(omission=name,rejected=str(e)))
            assert failed,'omitted ACTUAL control escaped '+name
        finally:HELPER.write_bytes(ORIGINAL);sup=load()
    assert HELPER.read_bytes()==ORIGINAL
groups=dict(versions=versions,namespace=namespace,mutable=mutable,bounds=bounds,omissions=omissions)
if __name__=='__main__':
    group=sys.argv[1]
    try:
        groups[group]()
        result=dict(group=group,status='PASS',results=results,helperSHA256=hashlib.sha256(HELPER.read_bytes()).hexdigest(),fixtureSHA256=hashlib.sha256(P(__file__).read_bytes()).hexdigest())
    except BaseException as e:
        result=dict(group=group,status='REJECT',error=repr(e),results=results,helperSHA256=hashlib.sha256(HELPER.read_bytes()).hexdigest(),fixtureSHA256=hashlib.sha256(P(__file__).read_bytes()).hexdigest())
        (O/(group+'-result.json')).write_text(json.dumps(result,indent=2)+'\n');raise
    (O/(group+'-result.json')).write_text(json.dumps(result,indent=2)+'\n')
    checkpoint=json.loads((O/'checkpoint.json').read_text());checkpoint['completed'].append(group+' PASS');checkpoint['latest']=result;checkpoint['at']=time.time();tmp=O/'checkpoint.new';tmp.write_text(json.dumps(checkpoint,indent=2)+'\n');tmp.replace(O/'checkpoint.json')
    print(json.dumps(result))
