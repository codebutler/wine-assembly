from common import *
V=R/'docs/reviews'/H.name;p=V/'acceptance.cjs';b=p.read_bytes();(V/'first-acceptance.cjs').write_bytes(b)
save('checkpoint-independent-prefix.json',dict(candidate=REV,fixtureSHA256=sha(b),sourceSHA256=sha((R/'tools/enigma-presented-menu-controller.cjs').read_bytes()),results='11 sequential cases passed before lateBatch classification assertion failed: original lost envelope,8 tracked ambiguous replies, cleanup rejection,lost witness',evidence='failures.jsonl plus first-acceptance.cjs strict awaited sequential control flow',remaining='lateBatch correct dispatch-phase classification, normal ack, actual drain, wiring gate',firstFailure='lateBatch mutates before cleanup, cleanup prepares successfully, controller dispatches atomic request which rejects; conservative unknown is required after ask invocation, not pre-dispatch known rejection',productionEdits=0))
s=b.decode().replace("await examine('unchanged-original-lost-reply-envelope'", "if(!process.argv.includes('--remaining')) await examine('unchanged-original-lost-reply-envelope'")
s=s.replace("for(const fault of ['lostReplyThrow'", "for(const fault of (process.argv.includes('--remaining')?[]:['lostReplyThrow'")
s=s.replace("'wrongBatch','badOk'])", "'wrongBatch','badOk']))")
s=s.replace("for(const fault of ['cleanupError','lostWitness','lateBatch'])", "for(const fault of (process.argv.includes('--remaining')?[]:['cleanupError','lostWitness']))")
s=s.replace(" await examine('actual-tracked-handler-normal-ack'", " await examine('actual-tracked-handler-lateBatch-after-dispatch',fixture('lateBatch'),{clicks:0,outcome:'unknown'});\n await examine('actual-tracked-handler-normal-ack'")
s=s.replace(" const before=f.context.schedule.length;", " const before=f.context.schedule.length;")
# Persist each successful case for provider interruption reuse.
s=s.replace("wrapperRestored:true});", "wrapperRestored:true});fs.writeFileSync(__dirname+'/case-progress.json',JSON.stringify(rows,null,2)+'\\n');")
p.write_text(s)
p=O/'run-acceptance.py';s=p.read_text().replace("str(O/'tracked-run.js')]", "str(O/'tracked-run.js'),'--remaining']").replace("results=len(j['results'])", "prefixPasses=11,results=len(j['results'])");p.write_text(s)
