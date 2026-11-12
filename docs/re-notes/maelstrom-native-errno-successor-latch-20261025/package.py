import pathlib,json,hashlib,re,shutil,subprocess
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';S=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23')
E=R/'docs/re-notes/maelstrom-native-errno-successor-latch-20261025';E.mkdir(exist_ok=True)
def sha(b):return hashlib.sha256(b).hexdigest()
def identity(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=sha(b))
def write(n,x):(E/n).write_text(json.dumps(x,indent=2)+'\n')
paths=['src/03-registers.wat','src/04-cache.wat','src/07-decoder.wat','src/02-thread-table.wat','src/07c-block-exec.wat','src/07d-uop-engine.wat','src/09d-winsock.wat','src/09b-dispatch.wat','src/09b2-dispatch-table.generated.wat','src/05-alu.wat','src/06b-core-handlers.wat','src/13-exports.wat']
gate=json.load(open('/home/user/wine-assembly/scratch/usage-watch/maelstrom-native-errno-successor-latch-oct25-dispatch-gate.json'))
write('source-identity.json',dict(base='1ccd6130970d3151a1be23e388f0aa2b820188b2',sourceRoot=str(S),sourceFiles={p:identity(S/p) for p in paths},acceptedTransform=identity(R/'tools/maelstrom-select-completion-hook.cjs'),tool=identity(R/'tools/maelstrom-native-errno-latch.cjs'),test=identity(R/'test/maelstrom-native-errno-latch.test.cjs'),generatedFragments={p.name:identity(p) for p in sorted((O/'fragments-corrected').iterdir())},inputPins=gate['pins'],nativeCRT=identity(pathlib.Path('/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll')),qualification='Exact consumed files and transform fixture only; not a build revision or native/original observation.'))
def excerpt(p,start,end):
 text=(S/p).read_text();a=text.index(start);b=text.index(end,a);s=text[a:b];assert len(s.encode())<=8192
 return dict(path=p,startAnchor=start,endAnchorExclusive=end,bytes=len(s.encode()),sha256=sha(s.encode()),text=s)
excerpts=[excerpt('src/05-alu.wat','  (func $th_ret (param $op i32)','  (func $th_ret_imm '),excerpt('src/06b-core-handlers.wat','  (func $th_call_r (param $op i32)','  (func $th_jmp_r '),excerpt('src/07-decoder.wat','          (if (i32.eq (global.get $mr_reg) (i32.const 2)) ;; CALL r/m32','          (if (i32.eq (global.get $mr_reg) (i32.const 3)) ;; CALL FAR'),excerpt('src/07-decoder.wat','      (if (i32.eq (local.get $op) (i32.const 0xC3))\n','      (if (i32.eq (local.get $op) (i32.const 0xC2))\n')]
assert sum(x['bytes'] for x in excerpts)<=8192
write('dispatch-excerpts.json',dict(totalCodeBytes=sum(x['bytes'] for x in excerpts),excerpts=excerpts,recipe='UTF-8 full source; unique exact start/end string anchors; end exclusive. Full source SHA in source-identity.json.'))
for p in sorted(O.iterdir()):
 if p.is_file() and (p.name.startswith('tests-') or p.name in ['transform.json','transform.log','transform-corrected.json','transform-corrected.log','transform-config.json','resource-precheckout.json','configuration.json','checkout.json','checkout.py','check.py','package.py']):
  assert p.stat().st_size<=2<<20;shutil.copyfile(p,E/p.name)
write('qualification.json',dict(passChecks=True,modelGroups=13,native=False,compiled=False,original=False,productionSourcesChanged=False,acceptedArtifactsChanged=False,futureRequirement='New exact canonical diagnostic build and native dispatch qualification before separately authorized original capture; only status4 event3 plus matching accepted completion identity is acceptance.',retainedPackagingFailure='transform.json/log: erroneous owned RLIMIT_FSIZE=131072; no unchanged retry. Corrected limits per-file25165824 and separate output131072, new fragments-corrected directory. Partial fragments are excluded.',boxes=dict(assigned=[],bx_g84h8h98='coordinator-reported stopped; unqueried',hostbx_69aem736='untouched',shutdownOwner='coordinator')))
manifest={str(p.relative_to(E)):identity(p) for p in sorted(E.iterdir()) if p.is_file() and p.name!='manifest.json'}
write('manifest.json',manifest)
print(json.dumps(dict(files=len(manifest),bytes=sum(x['bytes'] for x in manifest.values()),codeExcerptBytes=sum(x['bytes'] for x in excerpts))))
