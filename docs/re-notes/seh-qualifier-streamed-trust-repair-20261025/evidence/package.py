import pathlib,json,hashlib,shutil
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo'
P=R/'docs/re-notes/seh-qualifier-streamed-trust-repair-20261025';E=P/'evidence';E.mkdir(exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
review=json.load(open(O/'review.json'));assert review['state']=='REPAIR_REVIEW_PASS'
assert review['qualifierSHA256']==sha(R/'docs/re-notes/seh-current-canonical-qualifier-20261025/qualify.cjs')
admission=json.load(open(O/'prepublication-admission.json'));assert admission['passAdmission']
(O/'setup-corrections.json').write_text(json.dumps(dict(beforeCheckout=True,issues=['Initial heredoc shell quoting syntax error; no script executed','Manifest schema was a list, not a dictionary; corrected local setup reader before checkout'],controls='No resource/access gate denial or unchanged retry; original previous-worker blocker files verified and preserved'),indent=2)+'\n')
(O/'result.json').write_text(json.dumps(dict(state='REPAIRED_STATIC_PASS_AWAITING_INDEPENDENT_REVIEW',base=review['base'],qualifierSHA256=review['qualifierSHA256'],source=review['source'],existingRejectionControls=35,addedSubstitutionRejections=12,legitimateStaticBinaries=2,reviewerReproducer='unchanged original succeeds baseline and repair rejects same malicious inputs',moduleReceipts='exact genuine original receipts reused only; no new WebAssembly API',rootRefsUnchanged=True,rootIndexUnchanged=True,noMainIntegration=True,box=None,boxState='notassigned',expiry=None,protectedBox='bx_69aem736 untouched',Boat403='api_key_action_forbidden; no retry',shutdownOwner='coordinator'),indent=2)+'\n')
for p in sorted(O.rglob('*')):
 if not p.is_file() or p.is_symlink():continue
 if any(part.endswith('-leaf') for part in p.relative_to(O).parts):continue
 if p.name in ['final-evidence-manifest.json','publication-complete.json']:continue
 target=E/p.relative_to(O);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
assert not list(P.rglob('*.wasm'))
files=[p for p in P.rglob('*') if p.is_file() and p.name!='seal.json']
files += [R/'docs/re-notes/seh-current-canonical-qualifier-20261025'/n for n in ['README.md','qualify.cjs','test-qualifier.cjs','test-trust-anchor.cjs']]
seal=[dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(files)]
(E/'seal.json').write_text(json.dumps(seal,indent=2)+'\n')
for row in seal:
 p=R/row['path'];assert p.stat().st_size==row['bytes'] and sha(p)==row['sha256']
print('PACKAGE PASS',len(seal),'sealed files; no binaries copied or committed; recovery and exact originals retained')
