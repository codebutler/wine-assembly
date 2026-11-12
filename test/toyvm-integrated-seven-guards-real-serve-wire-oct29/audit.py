"""Audit recorded wire evidence without repeating accepted behavior groups."""
import json,struct
from verify_inputs import OUT,TASK,REPO,verify,pin
def main():
 verified=verify()
 result=json.loads((OUT/'results.json').read_text())
 production=json.loads((OUT/'production.json').read_text())
 assert result['status']=='PASS' and production['failure'] is None
 events=production['wire'];assert len(events)==99
 by_label={e['label']:e for e in events}
 rejects=0
 for i,e in enumerate(events):
  request=bytes.fromhex(e['request']);reply=bytes.fromhex(e['reply'])
  length,op,u,ino,*_=struct.unpack_from('<2I2Q4I',request)
  n,error,identity=struct.unpack_from('<IiQ',reply)
  assert length==len(request) and n==len(reply)
  assert (op,u,ino)==(e['op'],e['unique'],e['ino']) and identity==u
  assert error==-e['expectedErrno']
  if 'before' in e:
   expected=dict(e['before']);expected['operations']+=1
   assert expected==e['after']
  if e['expectedErrno']:
   rejects+=1
   assert len(reply)==16
   assert events[i+1]['op']==3 and events[i+1]['expectedErrno']==0
 assert rejects==41
 expected_labels={
 'rename-type':'file over directory 12','unlink-type':'UNLINK directory',
 'cycle':'descendant cycle 12','readdir-parent':'nested b parent a',
 'create-parent':'35 file parent','setattr-flags':'SETATTR unsupported 2056',
 'rename-parent':'12 source missing'}
 source=REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
 original=source.read_text();audit=[]
 for m in result['mutants']:
  family=m['family'];private=TASK/'private-mutants'/(family+'.py')
  saved=OUT/'mutants'/(family+'.py')
  assert original.count(m['old'])==1
  assert saved.read_text()==original.replace(m['old'],m['new'],1)
  assert saved.read_bytes()==private.read_bytes() and pin(saved)==m['source']
  data=json.loads((OUT/('mutant-'+family+'.json')).read_text())
  assert data['failure'] and data['cleanup']['allOwnedEBADF']
  event=data['wire'][-1];assert event['label']==expected_labels[family]
  primary=by_label[event['label']]
  assert event['op']==primary['op'] and event['ino']==primary['ino']
  assert bytes.fromhex(event['request'])[40:]==bytes.fromhex(primary['request'])[40:]
  assert event['expectedErrno']==primary['expectedErrno']
  error=struct.unpack_from('<i',bytes.fromhex(event['reply']),4)[0]
  if family!='readdir-parent':
   assert error!=-primary['expectedErrno']
  else:
   assert error==0
   # First '.' entry is 32 bytes, second '..' entry inode is at payload offset32.
   assert struct.unpack_from('<Q',bytes.fromhex(primary['reply']),48)[0]==2
   assert struct.unpack_from('<Q',bytes.fromhex(event['reply']),48)[0]==1
  audit.append(dict(family=family,label=event['label'],sameWirePayload=True,
   expectedErrno=primary['expectedErrno'],mutantObservedErrno=-error,
   failureLabel=json.loads(data['failure'])['label'],isolatedPredicate=True))
 assert result['totalWireCount']==len(events)+sum(json.loads((OUT/('mutant-'+m['family']+'.json')).read_text())['wireCount'] for m in result['mutants'])
 record=dict(status='PASS',productionWireCount=99,rejections=rejects,totalWireCount=result['totalWireCount'],
  exactRequestReplyIdentities=True,fullStateAtomicity=True,successAfterEveryRejection=True,
  distinguishingMutants=audit,sourcePinsAfter=verified['sourcePins'])
 (OUT/'evidence-audit.json').write_text(json.dumps(record,indent=2)+'\n')
 print('PASS record audit: 99 production frames, 41 atomic rejections, seven distinguishing private mutants')
if __name__=='__main__':main()
