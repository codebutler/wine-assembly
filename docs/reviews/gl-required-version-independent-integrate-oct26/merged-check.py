"""Verify minimal merged tree, every changed blob, and actual callback binding."""
import independent as x
import json,zlib,hashlib,ast,time
G=x.R/'.git';O=x.O
def obj(oid):
    raw=zlib.decompress((G/'objects'/oid[:2]/oid[2:]).read_bytes());assert hashlib.sha1(raw).hexdigest()==oid
    return raw.split(b'\0',1)
def tree(oid,prefix=''):
    header,data=obj(oid);assert header.startswith(b'tree ');i=0;out={}
    while i<len(data):
        j=data.index(b'\0',i);mode,name=data[i:j].split(b' ',1);child=data[j+1:j+21].hex();i=j+21;path=prefix+name.decode()
        if mode==b'40000':out.update(tree(child,path+'/'))
        else:out[path]=(mode.decode(),child)
    return out
base='f461584655aa36f1ca30686cbd1428757b232b3c';_,commit=obj(base);basetree=commit.splitlines()[0].split()[1].decode()
tested=(O/'tested-tree-metadata.log').read_text().strip();before=tree(basetree);after=tree(tested)
changed={p for p in before.keys()|after.keys() if before.get(p)!=after.get(p)}
pins=json.loads((O/'pins.json').read_text())['files'];assert changed==set(pins),(changed,set(pins))
for p,v in pins.items():
    b=(x.R/p).read_bytes();oid=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
    assert after[p]==('100644',oid) and oid==v['gitBlob'] and hashlib.sha256(b).hexdigest()==v['sha256']
    header,actual=obj(oid);assert actual==b and header.startswith(b'blob ')
old=(O/'main-helper.py').read_text();new=x.HELPER.read_text()
def filtered(s):
    t=ast.parse(s)
    return ast.dump(ast.Module(body=[n for n in t.body if not (isinstance(n,(ast.ClassDef,ast.FunctionDef)) and n.name in ('AllocatedDisk','AccountingUnknown','_TransientMutation','accounting_check')) and not (isinstance(n,ast.Import) and [a.name for a in n.names]==['stat'])],type_ignores=[]),include_attributes=False)
assert filtered(old)==filtered(new)
process={}
for name in ('snapshot','key','signal_owned','lower_limit','supervise'):
    def code(s):return ast.get_source_segment(s,next(n for n in ast.parse(s).body if isinstance(n,ast.FunctionDef) and n.name==name)).encode()
    assert code(old)==code(new);process[name]=hashlib.sha256(code(new)).hexdigest()
# Execute exact merged initialization plus alloc/check definitions only.
for boundary in ('production','shared'):
    temp,p=x.fixture()
    with temp:
        check=x.callback(p,boundary);assert check() is None;assert check() is None
j=dict(status='PASS',candidate=json.loads((O/'pins.json').read_text())['candidate'],freshMain=base,baseTree=basetree,testedTree=tested,changedPaths=sorted(changed),allOtherEntriesExact=True,changedBlobObjectsAndWorkFilesVerified=True,nonAccountingASTIdentical=True,processFunctionHashes=process,mergedActualInitializerAndCallbackSamples=4,reused='unchanged independent groups and donor27/nine/process receipts, no full-suite rerun',node='not executed; startup inapplicable')
(O/'merged-result.json').write_text(json.dumps(j,indent=2)+'\n')
c=json.loads((O/'checkpoint.json').read_text());c['completed'].append('minimal merged-tree identity and actual callbacks PASS');c['testedTree']=tested;c['remaining']=['final evidence/commit, verified branch publication, fresh remote main recheck and conditional normal publication'];c['at']=time.time();p=O/'checkpoint.new';p.write_text(json.dumps(c,indent=2));p.replace(O/'checkpoint.json')
print(json.dumps(j))
