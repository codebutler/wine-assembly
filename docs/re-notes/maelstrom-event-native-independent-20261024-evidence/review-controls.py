"""Offline receipt acceptance; never import/compile/instantiate Wasm or run guest code."""
import copy,hashlib,json,struct,sys
from pathlib import Path
R=Path.cwd(); D=R/'docs/re-notes/maelstrom-event-boundary-native-20261024'
SHA=lambda b:hashlib.sha256(b).hexdigest()
TEST='2159e84c0960679855b330adf813f94351cb59f4a5cc09fc9ef27e91b7ce303c'
MODULE='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'
OBSERVER='52909f8dc9e39c9c294602c952d9bbbf4e91c52d5c56ddbba45fb3cb30d9e226'
SCHED='f0a2f006b0eb992bcdb904f10128167b06bfe143ac05661b82f9586d9755bf40'
def read(n):return json.loads((D/n).read_text())
def require(ok,label):
    if not ok:raise AssertionError(label)
def accept(r,t,rows,code):
    require(SHA(code)==TEST,'executed test identity')
    require(r['status']=='PASS' and r['instantiations']==1,'actual native instantiation')
    require((r['moduleSHA256'],r['observerSHA256'],r['schedulerSHA256'])==(MODULE,OBSERVER,SCHED),'native identities')
    require(r['qualification']=='native synthetic; no original-game execution','native provenance scope')
    require(t['returncode']==0 and t['reason']=='natural' and not t['remainingGroup'] and t['waitReaped'],'native terminal completion')
    require(t['argv'][2:]==['test/maelstrom-event-boundary-native.cjs','/tmp/maelstrom-head-yield-observer-oct24/ops/run.js','/tmp/maelstrom-head-yield-observer-oct24/ops/13-exports.wat','/tmp/maelstrom-event-triggered-boundary-observer-oct24/ops/thread-manager.js','/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm'],'native executable argv')
    require(r['isolation']==[{'enabled':False,'addresses':[0x7a3c62,0x7a3c66],'counts':[0,0]},{'enabled':True,'addresses':[0x7a3362,0x7a3366],'counts':[0,0]}],'disjoint zero-start counters')
    require([x['enabled'] for x in r['snapshots']]==[False,True],'OFF/ON lane provenance')
    off,on=[x['rows'] for x in r['snapshots']]
    require(off==on,'false OFF/ON equivalence')
    # Independent expected states avoid accepting a shared wrong normalization.
    # Only EDI=callee-pc and EIP within the lane code span are address-relative.
    stack=struct.pack('<6I',0x401234,0,0x430000,0,0,0x430200)
    fd=bytearray(520);struct.pack_into('<4I',fd,0,3,0x101,0x102,0x103);struct.pack_into('<2I',fd,512,0,5000)
    require(len(on)==6,'six lane calls')
    for i,row in enumerate(on):
        expected=dict(step=i,eip=[512,0x75040f0,0x75040f8,0,4,4][i],eax=0x430000,edi=256,ebp=0x7401000 if i<4 else 0x430000,esp=0x7402000,reason=0 if i==4 else 8,flag=0,halt=5 if i==4 else 4,counts=[[0,0],[0,0],[0,0],[1,0],[2,0],[2,1]][i],stores=0 if i<4 else 2,clears=0,invals=0,memorySHA256=SHA(stack),fdTimevalSHA256=SHA(fd))
        require(row==expected,'wrong normalized field/scoped hash at step '+str(i))
    require(len(rows)==6 and r['recordsBytes']==4124,'six native records')
    require([x['kind'] for x in rows]==['before','after','before','after','after','summary'],'record phase sequence')
    require([(x['invocation'],x['batch'],x['events']) for x in rows[:-1]]==[(3,50002,['select-net-wait']),(3,50002,[]),(4,50003,['head']),(4,50003,[]),(5,50004,['interior'])],'missing/misplaced native event')
    for x in rows[:-1]:
        require(x['apiCompletion']=='unobserved' and x['apiResult']=='unattributed','API overclaim')
        require(x['before']['selectDeadline']=='unavailable','deadline overclaim')
    for x in rows[:2]:
        require(x['detail']==dict(thunkWords=[4096,934],stack=list(struct.unpack('<6I',stack)),fdSets=[dict(count=3,prefix=[257,258],truncated=True),'NULL','NULL'],timeval=[0,5000]),'native diagnostic metadata')
    for x in [rows[1],rows[3]]:
        require(x['observation']=='pending-reason-guard-before-dispatch' and x['movCallExecuted'] is False and x['after']['last_run_halt']==4,'pending guard attribution')
    require(rows[4]['before']['ebp']==0x7401000 and rows[4]['after']['ebp']==0x430000 and rows[4]['after']['esp']==0x7402000 and rows[4]['after']['eip']==0x7a3366 and rows[4]['after']['last_run_halt']==5,'normal native CALL/RET return')
    # Bind unnormalized native records to snapshots, rather than only comparing lanes.
    for record,index in [(rows[1],2),(rows[3],3),(rows[4],4)]:
        s=record['after']; row=on[index]
        for a,b in [('eax','eax'),('edi','edi'),('ebp','ebp'),('esp','esp'),('eip','eip')]:
            value=s[a]-(0x7a3362 if a=='edi' or (a=='eip' and 0x7a3362<=s[a]<=0x7a3562) else 0)
            require(value==row[b],'record to snapshot '+a)
        require(s['cache_stores']-2==row['stores'] and s['cache_clears']==row['clears'] and s['cache_invals']==row['invals'],'cache delta binding')
    require(rows[-1]['seen']==['select-net-wait','head','interior'],'event summary')
    require(len(r['lifecycle'])==2 and r['missingObserverGetters']==[],'actual import/export recipe')
def main():
    r=read('native-result.json'); t=read('native-terminal.json'); code=(R/'test/maelstrom-event-boundary-native.cjs').read_bytes()
    raw=(D/'native-records.jsonl').read_text();rows=[json.loads(x[x.index('{'):]) for x in raw.splitlines()]
    require(raw==''.join(r['rawRecords']),'raw records bind result')
    require(json.loads((D/'native.log').read_text())==r,'raw terminal output binds result')
    require(t['outputBytes']==len((D/'native.log').read_bytes()),'terminal output bytes')
    ident=read('execution-code-identity.json');require(ident['sha256']==SHA(code) and ident['bytes']==len(code) and ident['mtime']<=ident['nativeAttemptTime'],'code execution identity receipt')
    require(read('native-attempt.json')['executionCount']==1 and read('native-attempt.json')['argv']==t['argv'],'single attempt argv')
    accept(r,t,rows,code)
    controls=[]
    def reject(name,mutate):
        a,b,c,d=copy.deepcopy((r,t,rows,code));a,b,c,d=mutate(a,b,c,d)
        try:accept(a,b,c,d)
        except AssertionError as e:controls.append(dict(name=name,rejected=True,reason=str(e)));return
        raise AssertionError('accepted corruption '+name)
    def change(r,t,x,c,path,value):
        q=r
        for k in path[:-1]:q=q[k]
        q[path[-1]]=value;return r,t,x,c
    reject('false equivalence',lambda a,b,c,d:change(a,b,c,d,['snapshots',1,'rows',4,'eax'],1))
    def both(a,b,c,d):
        for s in a['snapshots']:s['rows'][4]['eip']=0
        return a,b,c,d
    reject('shared wrong field normalization',both)
    reject('wrong native module',lambda a,b,c,d:change(a,b,c,d,['moduleSHA256'],'0'*64))
    reject('mock-only native claim',lambda a,b,c,d:change(a,b,c,d,['instantiations'],0))
    reject('missing native event',lambda a,b,c,d:(a,b,c[:4]+c[5:],d))
    reject('changed executable',lambda a,b,c,d:(a,b,c,d+b'\n'))
    reject('native terminal failure',lambda a,b,c,d:(a,dict(b,returncode=1),c,d))
    print(json.dumps(dict(verdict='PASS_OFFLINE_RETAINED_NATIVE',candidate='f79ac8af5876ceb7356a07b16d47003719cac29c',candidateTree='65cfcd8817b0a9e9a2080ed298ffc8cf61422b6c',nativeRerun=False,controls=controls,recordBytes=len(raw.encode()),testSHA256=SHA(code)),indent=2))
if __name__=='__main__':main()
