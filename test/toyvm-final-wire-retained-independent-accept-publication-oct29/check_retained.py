"""Independent retained-frame checker. Never imports or executes the backend."""
import argparse, copy, hashlib, json, pathlib, stat, struct
U=lambda fmt,b,offset=0:struct.unpack_from("<"+fmt,b,offset)
def require(ok,why):
    if not ok: raise AssertionError(why)
def pin(p):
    b=p.read_bytes()
    return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def directory(n): return stat.S_ISDIR(n["mode"])
def key(name): return "bytes:"+name.hex()
def node(mode,opened=0):
    return dict(mode=mode,data={"hex":""},names={},links=1,opens=opened)
def initial(record):
    first=next(x["before"] for x in record["wire"] if "before" in x)
    return dict(root=first["root"],fd=first["fd"],live_limit=131072,write_limit=65536,file_limit=16384,
        nodes={"1":node(0o40700)},next=2,written=0,peak=4096,live=4096,failure=None,operations=0,handles=0)
def frame(row):
    q=bytes.fromhex(row["request"]); r=bytes.fromhex(row["reply"])
    require(len(q)>=40 and len(r)>=16,"minimum frame size")
    length,op,unique,ino,uid,gid,pid,padding=U("2I2Q4I",q)
    size,error,reply_unique=U("IiQ",r)
    require(length==len(q) and size==len(r),"exact frame lengths")
    require((op,ino,unique)==(row["op"],row["ino"],row["unique"]),"request metadata")
    require(reply_unique==unique,"reply unique")
    require(not error or len(r)==16,"error payload empty")
    return op,ino,q[40:],-error,r[16:]
def parse_entries(payload):
    entries=[]; off=0
    while off<len(payload):
        require(off+24<=len(payload),"dirent header")
        ino,cookie,size,kind=U("2Q2I",payload,off)
        end=off+((24+size+7)//8)*8
        require(size>0 and end<=len(payload),"dirent bounds")
        name=payload[off+24:off+24+size]
        require(not any(payload[off+24+size:end]),"dirent padding")
        entries.append((name,ino,cookie,kind)); off=end
    return entries
def expected_error(op,ino,d,s):
    ns=s["nodes"]
    if op==4: return 95 if U("I",d)[0]&~2047 else 0
    if op in (9,35):
        name=d[8 if op==9 else 16:].split(b"\0")[0]
        if not name or name in (b".",b"..") or b"/" in name or len(name)>255:return 22
        if str(ino) not in ns:return 2
        parent=ns[str(ino)]
        if not directory(parent):return 20
        if key(name) in parent["names"]:return 17
    if op in (10,11):
        child=ns[str(ino)]["names"].get(key(d.split(b"\0")[0]))
        if child is None:return 2
        n=ns[str(child)]
        if op==10 and directory(n):return 21
        if op==11 and not directory(n):return 20
        if op==11 and n["names"]:return 39
    if op in (12,45):
        dest=U("Q",d)[0]
        if op==45 and U("I",d,8)[0]:return 95
        old,new=d[8 if op==12 else 16:].split(b"\0")[:2]
        for name in (old,new):
            if not name or name in (b".",b"..") or b"/" in name or len(name)>255:return 22
        for parent in (ino,dest):
            if str(parent) not in ns:return 2
            if not directory(ns[str(parent)]):return 20
        src=ns[str(ino)]["names"]; target=ns[str(dest)]["names"]
        if key(old) not in src:return 2
        if ino==dest and old==new:return 0
        moved=src[key(old)]
        if directory(ns[str(moved)]):
            pending=[moved];seen=set()
            while pending:
                n=pending.pop()
                if n==dest:return 22
                if n in seen:continue
                seen.add(n)
                if directory(ns[str(n)]):pending.extend(ns[str(n)]["names"].values())
        if key(new) in target:
            a=directory(ns[str(moved)]);b=directory(ns[str(target[key(new)])])
            if not a and b:return 21
            if a and not b:return 20
            if ns[str(target[key(new)])]["names"]:return 39
    return 0
def apply_success(op,ino,d,p,s):
    ns=s["nodes"]
    if op in (9,35):
        name=d[8 if op==9 else 16:].split(b"\0")[0]
        child=s["next"];s["next"]+=1
        mode=(0o40000 if op==9 else 0o100000)|(U("I",d,0 if op==9 else 4)[0]&0o777)
        ns[str(child)]=node(mode,int(op==35));ns[str(ino)]["names"][key(name)]=child
        s["handles"]+=int(op==35);s["live"]+=4096;s["peak"]=max(s["peak"],s["live"])
        require(len(p)==(128 if op==9 else 144) and U("Q",p)[0]==child,"created inode and reply size")
        if op==35:require(U("Q",p,128)[0]==child,"create handle")
    elif op in (16,4):
        n=ns[str(ino)];old=bytes.fromhex(n["data"]["hex"])
        if op==16:
            fh,off,size=U("2QI",d); data=d[40:]
            require(fh==ino and len(data)==size,"write input")
            target=max(len(old),off+size);new=bytearray(old.ljust(target,b"\0"));new[off:off+size]=data
            s["written"]+=size;require(p==struct.pack("<2I",size,0),"write reply")
        elif U("I",d)[0]&8:
            target=U("Q",d,16)[0];new=old[:target].ljust(target,b"\0")
            s["written"]+=max(0,target-len(old))
        else:return
        s["live"]+=((len(new)+4095)//4096-(len(old)+4095)//4096)*4096
        s["peak"]=max(s["peak"],s["live"]);n["data"]["hex"]=bytes(new).hex()
    elif op in (12,45):
        dest=U("Q",d)[0];old,new=d[8 if op==12 else 16:].split(b"\0")[:2]
        if ino==dest and old==new:return
        src=ns[str(ino)]["names"];target=ns[str(dest)]["names"]
        require(key(new) not in target,"retained successful rename has no replacement")
        target[key(new)]=src.pop(key(old))
    elif op==3:
        require(len(p)==104 and U("Q",p,16)[0]==ino,"GETATTR size/inode")
    elif op==28:
        parents=[int(k) for k,n in ns.items() if directory(n) and ino in n["names"].values()]
        parent=1 if ino==1 else parents[0]
        require(ino==1 or len(parents)==1,"unique namespace parent")
        names=[(b".",ino),(b"..",parent)]+[(bytes.fromhex(k[6:]),v) for k,v in ns[str(ino)]["names"].items()]
        expected=[(name,child,i+1,4 if directory(ns[str(child)]) else 8) for i,(name,child) in enumerate(names)]
        require(parse_entries(p)==expected,"READDIR namespace/parent identity")
    elif op==26:require(len(p)==64 and U("2I",p)==(7,31),"INIT reply")
    else:require(False,"unexpected successful op "+str(op))
def cleanup(d):
    c=d["cleanup"];targets=list(c["createdFds"].values())
    require(c["selector"]=="actual selectors.EpollSelector" and targets.count("anon_inode:[eventpoll]")==1,"retained real epoll")
    require(sum(t.startswith("socket:") for t in targets)==1,"retained control socket")
    require(str(c["ownedFd"]) not in c["createdFds"],"distinct owned descriptor")
    require(c["allOwnedEBADF"] and c["borrowedPeerUsable"] and c["joined"] and not c["threadExceptions"],"retained cleanup")
def production(d):
    require(d["wireCount"]==len(d["wire"])==99 and d["failure"] is None,"production count/failure")
    s=initial(d);rejects=0;observations=0
    for i,row in enumerate(d["wire"]):
        op,ino,data,error,payload=frame(row)
        require(row["unique"]==i+1,"sequence unique")
        require(error==row["expectedErrno"]==expected_error(op,ino,data,s),"independent errno "+row["label"])
        if "before" in row:require(row["before"]==s,"full before state "+row["label"])
        if error:
            rejects+=1
            require("before" in row and "after" in row,"rejection snapshots")
            nxt=d["wire"][i+1]; no,ni,nd,ne,np=frame(nxt)
            require((no,ni,ne)==(3,1,0) and nxt["label"]=="usable after "+row["label"],"GETATTR after rejection")
        else:apply_success(op,ino,data,payload,s)
        s["operations"]+=1
        if "after" in row:
            observations+=1;require(row["after"]==s,"full after state "+row["label"])
    require(rejects==41 and s==d["finalState"],"final full state/rejection count")
    require(s["nodes"]["4"]["data"]["hex"]==(b"alpha"+bytes(12)).hex() and s["written"]==22 and s["handles"]==2,"interleaved growth accounting")
    require(s["nodes"]["2"]["names"]["bytes:62"]==3 and "bytes:6d6f766564" not in s["nodes"]["1"]["names"],"movement restored")
    cleanup(d)
    return dict(frames=99,rejections=rejects,completeSnapshots=observations)
MUTATIONS={
"rename-type":"if not source_is_dir and dest_is_dir:",
"unlink-type":"if op==10 and stat.S_ISDIR(self.nodes[child]['mode']):",
"cycle":"if child==newdir:",
"readdir-parent":"if ino!=1:",
"create-parent":"if not stat.S_ISDIR(n['mode']):",
"setattr-flags":"if valid&~(1|2|4|8|16|32|64|128|256|512|1024):",
"rename-parent":"if parent not in self.nodes:"}
def mutants(inputs,p,source):
    results=[];total=0
    for family,old in MUTATIONS.items():
        raw=(inputs/"mutants"/(family+".py")).read_bytes()
        require(source.count(old.encode())==1 and raw==source.replace(old.encode(),b"if False:",1),"isolated transform "+family)
        d=json.loads((inputs/("mutant-"+family+".json")).read_text())
        require(d["source"]==pin(inputs/"mutants"/(family+".py")),"mutant source identity")
        require(d["wireCount"]==len(d["wire"]) and d["failure"],"distinguishing failure")
        require(d["wire"][:8]==p["wire"][:8],"unchanged fixture wire")
        for i,row in enumerate(d["wire"]):
            frame(row);require(row["unique"]==i+1,"mutant unique")
        last=d["wire"][-1];op,ino,data,err,payload=frame(last)
        matches=[r for r in p["wire"] if (r["op"],r["ino"],bytes.fromhex(r["request"])[40:])==(op,ino,data)]
        require(len(matches)>=1,"same production payload")
        before=copy.deepcopy(last["before"]);expected=expected_error(op,ino,data,before)
        require(expected==last["expectedErrno"],"fixture independently reaches intended guard")
        target=copy.deepcopy(matches[0]["before"])
        for state in (before,target):state.pop("operations")
        # Family-only mutant starts from the identical eight-frame seed.
        # The production rename-parent group follows accepted SETATTR growth.
        # Check that exact, irrelevant data difference; do not claim identical state.
        if family=="rename-parent":
            require(before["written"]==10 and target["written"]==22,"known interleaving write count")
            require(before["nodes"]["4"]["data"]["hex"]==b"alpha".hex(),"seed file data")
            require(target["nodes"]["4"]["data"]["hex"]==(b"alpha"+bytes(12)).hex(),"production grown file data")
            target["written"]=10
            target["nodes"]["4"]["data"]["hex"]=b"alpha".hex()
        require(before==target,"complete guard setup with exact known interleaving")
        model=initial(d)
        for row in d["wire"][:-1]:
            po,pi,pd,pe,pp=frame(row)
            require(pe==row["expectedErrno"]==expected_error(po,pi,pd,model),"mutant prefix errno")
            if "before" in row:require(row["before"]==model,"mutant prefix before")
            if not pe:apply_success(po,pi,pd,pp,model)
            model["operations"]+=1
            if "after" in row:require(row["after"]==model,"mutant prefix after")
        require(last["before"]==model,"independent complete mutant seed state")
        if family=="readdir-parent":
            entries=parse_entries(payload)
            require(dict((n,i) for n,i,_,_ in entries)[b".."]==1 and ino==3,"wrong root parent distinguishes")
            require("actual parent identity" in json.loads(d["failure"])["label"],"parent oracle failure")
        else:
            require(err!=expected,"removed guard changes errno")
            expected_state=copy.deepcopy(last["before"]);expected_state["operations"]+=1
            require(last["after"]!=expected_state,"guard mutation changes complete state")
            require("complete state atomicity" in json.loads(d["failure"])["label"],"atomicity oracle failure")
        if family=="rename-parent":
            require(err==5 and "KeyError(999)" in d["finalState"]["failure"],"guard removal exposes missing-parent KeyError")
        else:require(d["finalState"]["failure"] is None,"no unrelated protocol setup failure")
        effect=copy.deepcopy(model);effect["operations"]+=1
        ns=effect["nodes"]
        if family=="create-parent":
            ns["4"]["names"][key(b"x")]=7;ns["7"]=node(0o100600,1)
            effect["next"]=8;effect["handles"]=3;effect["live"]=effect["peak"]=36864
        elif family=="cycle":
            del ns["1"]["names"][key(b"a")];ns["3"]["names"][key(b"cycle")]=2
        elif family=="rename-type":
            del ns["5"];del ns["2"]["names"][key(b"f")]
            ns["1"]["names"][key(b"d")]=4;effect["live"]=28672
        elif family=="unlink-type":
            del ns["1"]["names"][key(b"a")];del ns["2"];effect["live"]=28672
        elif family=="setattr-flags":
            ns["4"]["data"]["hex"]=(b"alpha"+bytes(8188)).hex()
            effect["written"]=8198;effect["live"]=effect["peak"]=40960
        elif family=="rename-parent":
            effect["failure"]="filesystem protocol failure: KeyError(999)"
        require(last["after"]==effect and d["finalState"]==effect,"exact intended mutant state effect "+family)
        cleanup(d);total+=len(d["wire"])
        results.append(dict(family=family,frames=len(d["wire"]),terminal=last["label"],expectedErrno=expected,mutantErrno=err,source=pin(inputs/"mutants"/(family+".py"))))
    require(total==65,"mutant total")
    return results
def controls(p):
    results=[]
    def trial(name,edit):
        d=copy.deepcopy(p);edit(d)
        try:production(d)
        except AssertionError as e:results.append(dict(name=name,rejected=True,reason=str(e)));return
        raise AssertionError("corruption accepted "+name)
    def errno(d):
        row=d["wire"][8];b=bytearray.fromhex(row["reply"]);struct.pack_into("<i",b,4,-2);row["reply"]=b.hex()
    def unique(d):
        row=d["wire"][8];b=bytearray.fromhex(row["reply"]);struct.pack_into("<Q",b,8,900);row["reply"]=b.hex()
    def state(d):d["wire"][8]["after"]["nodes"]["4"]["data"]["hex"]="00"
    def parent(d):
        row=next(x for x in d["wire"] if x["label"]=="nested b parent a")
        b=bytearray.fromhex(row["reply"]);struct.pack_into("<Q",b,16+32,1);row["reply"]=b.hex()
    for name,edit in (("changed-errno",errno),("changed-unique",unique),("changed-full-state",state),("changed-parent-identity",parent)):trial(name,edit)
    return results
def main():
    a=argparse.ArgumentParser();a.add_argument("--inputs",type=pathlib.Path);a.add_argument("--repo",type=pathlib.Path,default=pathlib.Path.cwd());a.add_argument("--output",type=pathlib.Path,required=True);args=a.parse_args()
    here=pathlib.Path(__file__).resolve().parent
    inputs=args.inputs or here.parent/"toyvm-integrated-seven-guards-real-serve-wire-oct29"
    pins=json.loads((here/"input-pins.json").read_text())
    for path,v in pins["pins"].items():require(pin(args.repo/path)==v,"source pin "+path)
    for path,v in pins["artifacts"].items():require(pin(inputs/path.split("toyvm-integrated-seven-guards-real-serve-wire-oct29/")[1])==v,"artifact pin "+path)
    p=json.loads((inputs/"production.json").read_text())
    source=(args.repo/"test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py").read_bytes()
    require(p["source"]==dict(bytes=len(source),sha256=hashlib.sha256(source).hexdigest()),"production identity")
    result=dict(status="PASS",scope="independent retained evidence only; no backend execution",production=production(p),mutants=mutants(inputs,p,source),corruptionControls=controls(p))
    args.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(dict(status=result["status"],production=result["production"],mutants=len(result["mutants"]),corruptions=len(result["corruptionControls"]))))
if __name__=="__main__":main()
