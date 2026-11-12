import integrate as s
import json, pathlib, hashlib, sys, ctypes
s.configure_parent();ctypes.CDLL(None).prctl(36,1,0,0,0)
s.BASE=json.loads((s.OWN/'baseline.json').read_text());s.SEQ=sum(1 for _ in (s.OWN/'operations.jsonl').open())
def main():
    receipt=pathlib.Path('/tmp/toyvm-offline-receipt-validation-cli-oct29/repo/test/toyvm-offline-receipt-validation-cli-oct29/evidence/mount-configuration.json')
    r=json.loads(receipt.read_bytes());source=pathlib.Path(r['source']).read_text();a=source.index('const getArgs = name => {');b=source.index('const hasFlag',a)
    assert s.sha(source[a:b].encode())==r['parserSHA256'];assert r['mountArgv']==r['intendedFiles']==[] and r['parsed']==[[],[],[]]
    s.write('mount-configuration.json',dict(r,revalidatedAt=s.stamp(),receiptSHA256=s.sha(receipt.read_bytes())))
    caller=(s.REPO/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py').read_bytes()
    # Static AST obtains pins without executing a predecessor supervisor/backend.
    import ast
    tree=ast.parse(caller);pins=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='BACKEND_PINS' for t in n.targets))
    dependencies={}
    for rel,pin in pins.items():
        p='test/'+rel
        line=s.git('ls-tree',s.D['currentMain'],'--',p).decode().strip()
        if not line:dependencies[p]=dict(expected=pin,present=False);continue
        blob=line.split()[2];b=s.git('show',blob)
        dependencies[p]=dict(expected=pin,present=True,blob=blob,actual=s.sha(b),matches=s.sha(b)==pin)
    # Query exactly named supporting test imports, without executing them.
    extras=['test/toyvm-offline-receipt-validation-cli-oct29/supervisor.py','supervisor.py','test/toyvm-offline-command-independent-accept-oct29/evidence/unchanged-reproducer.json']
    support={p:s.git('ls-tree',s.D['currentMain'],'--',p).decode().strip() for p in extras}
    s.write('dependency-review.json',dict(backendPins=dependencies,testSupport=support,callerSHA256=s.sha(caller)))
    print(json.dumps(dict(dependencies=dependencies,support=support)))
if __name__=='__main__':
    try:main()
    except Exception as ex:
        s.write('blocked-receipt.json',dict(at=s.stamp(),status='BLOCKED',error=str(ex),task=s.TASK,runtimeUsed=False,allocationRetainedThroughCoordinatorCloseout=True));print(str(ex)[:2000]);sys.exit(1)
