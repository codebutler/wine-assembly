from control import *
gate('before-selective-materialization')
P=json.load(open(DONOR/'ops/publication.json'))
assert {k:P[k] for k in ('commit','tree','parent')}==dict(commit=REV,tree=TREE,parent='f4455d87f011890622b76c846e342492b2bdcfda')
assert (O/'candidate-identity-output.log').read_text().strip()==REV+' '+TREE+' '+P['parent']
assert (O/'remote-pins-output.log').read_text().splitlines()==[MAIN+'\trefs/heads/main',REV+'\trefs/heads/task/alien-terminal-dispatch-boundary-repair-oct26']
paths=list(P['sourcePins'])+['test/alien-terminal-failfast-independent-accept-oct26.py','test/test-alien-terminal-dispatch-boundary-oct26.py']
pins={p:c.sha((DONOR/'repo'/p).read_bytes()) for p in paths}
assert all(pins[p]==s for p,s in P['sourcePins'].items())
assert pins['test/alien-terminal-failfast-independent-accept-oct26.py']=='c009312a10ca4e05df15c9375e77cdf92f789d25923542ab4d2d685b3a0abc2a'
assert pins['test/test-alien-terminal-dispatch-boundary-oct26.py']=='7728be1d23f0d203e7b774a873f233f8872f18b2980da5b691dfad787436856b'
for p in paths:
 dest=R/p;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(DONOR/'repo'/p,dest)
(R/'.git/objects/info/alternates').write_text(str(DONOR/'repo/.git/objects')+'\n')
(R/'.git/config').write_text('[core]\n repositoryformatversion = 0\n filemode = true\n bare = false\n logallrefupdates = true\n sshCommand = '+c.SSH+'\n[remote "origin"]\n url = git@github.com:vgrichina/wine-assembly.git\n[user]\n name = Wine Ops\n email = wine-ops@local\n')
(R/'.git/HEAD').write_text('ref: refs/heads/'+BR+'\n')
# Boundary is tested against exact candidate index; integration later starts at main.
(R/'.git/refs/heads/task').mkdir(exist_ok=True)
(R/'.git/refs/heads'/BR).write_text(REV+'\n')
save('pins.json',dict(candidate=REV,tree=TREE,sourcePins=pins,remoteMain=MAIN,actualProductionEntry=True,donorReadOnly=True,objectAlternateStandingInput=str(DONOR/'repo/.git/objects'),objectsCopied=False))
with open(c.NODE,'rb') as stream:nodeSHA=hashlib.file_digest(stream,'sha256').hexdigest()
save('configuration.json',dict(ssh=c.SSH,mountArgv=[],intendedFiles=[],parser='/tmp/alien-controller-terminal-failfast-repair-oct26/repo/docs/reviews/alien-controller-terminal-failfast-repair-oct26/offline-mount-parser.cjs',nodeSHA256=nodeSHA,flags=['--max-old-space-size=64'],nodeReceipt='node-startup-output.log',sourceSupervisorSHA256=c.sha((DONOR/'ops/common.py').read_bytes()),rootRefReceipt=json.load(open(ROOT/'scratch/usage-watch'/NAME/'root-ref-digest.json'))))
checkpoint=json.load(open(O/'checkpoint.json'))
checkpoint.update(candidate=REV,tree=TREE,sourcePins=pins,remaining=['independent-focused-checks','acceptance-decision','conditional-integration-publication'])
checkpoint['completed']=['resource-admission','trusted-remote-pins','node-startup','canonical-empty-mount-parser','exact-candidate-minimal-source','first-production-reproducer']
save('checkpoint.json',checkpoint)
save('incidents.json',dict(inheritedOriginalPhysicalStop=dict(bytes=134811648,cap=134217728,fix='exec replaced idle driver, cap unchanged',receipt=str(DONOR/'ops/first-physical-boundary-7-execution.json')),preparation=dict(receipt='prepare-execution.json',cause='read_bytes of installed Node binary during configuration hash',fix='hashlib.file_digest streaming; same physical cap; no acceptance group repeated'),platformDenials='Actual CivII/Maelstrom denials preserved; no runtime attempt'))
print('Verified pins and materialized eight exact candidate files; standing objects remain read-only donor inputs.')
