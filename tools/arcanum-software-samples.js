'use strict';
// Validation of raw selected-layer compositor submissions, never logical FPS.
function validateSoftwareSamples(r,minSeconds=20,maxSeconds=32){
 const reasons=[],s=r.samples||[],ev=r.events||[];
 if(r.errors?.length)reasons.push('observer errors');
 if(!Number.isFinite(r.seconds)||r.seconds<minSeconds||r.seconds>maxSeconds)reasons.push('interval');
 if(!Number.isFinite(r.fps)||!(r.frames>0))reasons.push('nonpositive or invalid counter');
 if(s.length<3||s.some((x,i)=>!x.valid||!x.sink||!Number.isFinite(x.t)||!Number.isInteger(x.count)||(i&&(x.t<=s[i-1].t||x.count<s[i-1].count||x.writeSeq<s[i-1].writeSeq))))reasons.push('invalid samples');
 if(s.length&&(s.at(-1).count-s[0].count!==r.frames||Math.abs((s.at(-1).t-s[0].t)/1000-r.seconds)>1e-9))reasons.push('raw delta mismatch');
 if(ev.length!==r.frames||ev.some((x,i)=>!x.sink||!['completed visible filter.present','visible direct logical canvas'].includes(x.kind)||!Number.isFinite(x.submittedAt)||(s.length&&(x.submittedAt<s[0].t||x.submittedAt>s.at(-1).t))||(i&&(x.submittedAt<ev[i-1].submittedAt||x.seq<=ev[i-1].seq))))reasons.push('copy chain events');
 if(Math.abs(r.frames/r.seconds-r.fps)>1e-9)reasons.push('rate mismatch');
 return {ok:!reasons.length,reasons,submissions:r.frames,seconds:r.seconds,submissionsPerSecond:reasons.length?null:r.fps,meaning:'selected-layer compositor submissions, not logical game frames or physical refresh'};
}
module.exports={validateSoftwareSamples};
