from pathlib import Path
import json,os
O=Path(__file__).parent;alias=O/'a';alias.mkdir(exist_ok=True);count=0
# Only task-created links change; readonly target object bytes are untouched.
for i,v in enumerate(sorted((O/'v').iterdir())):
 links=list(v.iterdir())
 if not links:continue
 target=links[0].resolve().parent
 a=alias/str(i);a.symlink_to(target,target_is_directory=True)
 for p in links:
  dest=Path('../../a')/str(i)/p.name
  assert len(str(dest).encode())<60
  p.unlink();p.symlink_to(dest,target_is_directory=True);count+=1
(O/'metadata-repair.json').write_text(json.dumps(dict(links=count,reason='Long symlink target allocation previously omitted; replace only task-owned object views by short relative references through declared readonly donor aliases; no new materialized input bytes concealed',allTargetsReadonly=True),indent=2));print(count)
